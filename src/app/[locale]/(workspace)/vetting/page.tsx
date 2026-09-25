import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { requireActor } from '@/lib/auth/guards';
import { primaryRole } from '@/lib/auth/roles';
import { logAuthFailure } from '@/lib/auth/errors';
import { loadDraft, loadQuestionnaire, loadVettingStatus } from '@/lib/vetting/queries';
import { organisationLabels } from '@/lib/vetting/reference';
import { isTransactingRole } from '@/lib/vetting/roles';
import { dateOf, type DraftState, type Questionnaire, type VettingStatus } from '@/lib/vetting/types';
import {
  codeForVettingError,
  isVettingErrorCode,
  resolveVettingMessage,
} from '@/lib/vetting/errors';
import { orFallback } from '@/components/vetting/labels';
import OrganisationPanel from '@/components/vetting/OrganisationPanel';
import VettingProgress from '@/components/vetting/VettingProgress';
import VettingForm from '@/components/vetting/VettingForm';
import styles from './page.module.css';

/**
 * The vetting questionnaire, wired to the database.
 *
 * Vetting is the operator's main safeguard against greenwashing and a condition
 * of the funding behind the pilot (concept note section 7). It is also the
 * gate: no deal can be created for an organisation that has not been approved.
 * So this page has two jobs at once - collect the answers, and explain itself
 * well enough that the answers are worth reading.
 *
 * Where everything comes from:
 *
 *   the questions      org.questionnaire + org.question, highest published
 *                      version for the viewer's role. Not a constant in src/.
 *   the answers        org.vetting_draft while it is a draft, then
 *                      org.vetting_answer once it has been submitted.
 *   the organisation   org.my_organisation(), migration 0071.
 *   the state          derived from org.vetting_submission and
 *                      org.org_role_approval. Never stored, never guessed.
 *
 * Signed out, this page redirects to /sign-in with a `next`, because a
 * questionnaire has to belong to an organisation before a single answer means
 * anything. An operator or auditor gets a short explanation rather than a form:
 * Sylva does not vet itself.
 *
 * Once submitted, the questionnaire is shown read-only. The answers are in an
 * append-only table; re-applying writes a NEW submission that supersedes this
 * one, and the old one stays visible. That is Rule 4, and the status page is
 * where it is offered.
 *
 * RULE 7 (no unit volumes added across projects): this page renders no unit
 * volumes at all. Its only figure counts questions in one questionnaire, which
 * is a document rather than a project, so there is no quantity here that two
 * projects' units could be added into.
 *
 * A refusal from the database ends as a SENTENCE. There is no error boundary
 * above this route, so an unhandled throw is the framework's default error page
 * - useless in production, and in development it shows the reader the SQL. The
 * reads are wrapped and mapped through the shared refusal table.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vettingForm' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // A questionnaire an organisation fills in about itself has nothing to
    // index, and it must not turn up in a search for the organisation's name.
    robots: { index: false, follow: true },
  };
}

export default async function VettingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tv = await getTranslations('vettingForm');

  const viewer = await requireActor('/vetting');
  const role = primaryRole(viewer.roles);

  const query = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const errorCode = one(query.error);
  const error = isVettingErrorCode(errorCode) ? errorCode : null;
  const missing = (one(query.missing) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9_]{1,64}$/.test(s));
  const justSaved = one(query.saved) === '1';
  // Revising is how an organisation applies again after a decision, or corrects
  // an application Sylva has not decided on yet. It never edits the submitted
  // answers - org.vetting_submission is append-only - it prefills the form with
  // them so the next submission supersedes this one. See Rule 4.
  const revising = one(query.revise) === '1';

  /* Sylva staff and auditors do not have a questionnaire. Saying so is better
     than a redirect: the page they asked for exists, it just is not theirs. */
  if (role === null || !isTransactingRole(role)) {
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <h1>{t('vettingForm.title')}</h1>
          <p className={styles.lead}>
            {orFallback(
              tv,
              'notApplicable',
              'This questionnaire is for organisations that want to buy, own a '
              + 'project or invest. Your account is not one of those, so there is '
              + 'nothing here to fill in.',
            )}
          </p>
        </header>
      </div>
    );
  }

  let questionnaire: Questionnaire | null;
  let status: VettingStatus;
  let labels: Awaited<ReturnType<typeof organisationLabels>> | null;
  try {
    questionnaire = await loadQuestionnaire(viewer.actor, role);
    status = await loadVettingStatus(viewer.actor, role);
    labels = status.organisation
      ? await organisationLabels(locale, status.organisation)
      : null;
  } catch (err) {
    logAuthFailure('vetting.form', err);
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <h1>{t('vettingForm.title')}</h1>
          <p className={styles.error} role="alert">
            {resolveVettingMessage(tv, codeForVettingError(err))}
          </p>
        </header>
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <h1>{t('vettingForm.title')}</h1>
          <p className={styles.lead}>
            {resolveVettingMessage(tv, 'no_questionnaire')}
          </p>
        </header>
        <OrganisationPanel
          organisation={status.organisation}
          labels={labels}
          state={status.state}
        />
      </div>
    );
  }

  // A submitted questionnaire is shown as submitted. A draft is shown as a
  // draft. The two never mix: reading the draft over a submission would show
  // an organisation answers that Sylva is not looking at.
  const submitted = status.submission !== null;
  const readOnly = submitted && !revising;
  let draft: DraftState | null = null;
  if (!readOnly) {
    try {
      draft = await loadDraft(viewer.actor, questionnaire.id);
    } catch (err) {
      // A draft that cannot be read is not worth losing the page over: the
      // questionnaire still renders, from the submitted answers or empty.
      logAuthFailure('vetting.draft', err);
    }
  }
  // In revise mode a saved draft wins over the submitted answers: it is the
  // newer thing this organisation typed. With no draft, the submitted answers
  // are the starting point, so revising is editing rather than retyping.
  // Narrowed to the draft ITSELF rather than to a boolean: a boolean does not
  // carry the non-null fact to the three places below that dereference it.
  const liveDraft =
    draft !== null && Object.keys(draft.answers).length > 0 ? draft : null;
  const draftHasAnswers = liveDraft !== null;
  const answers = liveDraft
    ? liveDraft.answers
    : (status.submission?.answers ?? {});
  // The DATE only. These are timestamptz values rendered as text by
  // PostgreSQL ("2026-09-20 00:00:00+00"); handing that to new Date() parses a
  // non-standard format and can land on the previous day in a server whose zone
  // is ahead of UTC. dateOf() takes the date the database already computed.
  const savedAt = dateOf(
    liveDraft ? liveDraft.savedAt : (status.submission?.submittedAt ?? null),
  );
  // A saved draft and a submitted application are different records, and the
  // source stamp must not call one the other.
  const savedLabel = draftHasAnswers
    ? tv('progress.sourceLabel')
    : orFallback(tv, 'source.submission', 'Your submitted application');

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('vettingForm.title')}</h1>
        <p className={styles.lead}>{t('vettingForm.lead')}</p>

        {error && (
          <p className={styles.error} role="alert">
            {resolveVettingMessage(tv, error)}
          </p>
        )}
        {justSaved && !error && (
          <p className={styles.saved} role="status">
            {orFallback(
              tv,
              'actions.savedNote',
              'Draft saved. Nothing has been sent to Sylva yet.',
            )}
          </p>
        )}
      </header>

      <OrganisationPanel
        organisation={status.organisation}
        labels={labels}
        state={status.state}
      />

      <div className={styles.layout}>
        {/* Not an <aside>: it is the index to the document beside it, and an
            unlabelled complementary landmark would add noise rather than
            structure. The panel inside carries its own heading. */}
        <div className={styles.side}>
          <VettingProgress
            questionnaire={questionnaire}
            answers={answers}
            savedAt={savedAt}
            savedLabel={savedLabel}
            missing={missing}
          />
        </div>

        <div className={styles.body}>
          <section className={styles.why} aria-labelledby="vetting-why-title">
            <h2 id="vetting-why-title">{t('vettingForm.whyTitle')}</h2>
            <p>{t('vettingForm.whyBody1')}</p>
            <p>{t('vettingForm.whyBody2')}</p>
            <p className={styles.readBy}>{t('vettingForm.readBy')}</p>
          </section>

          <VettingForm
            questionnaire={questionnaire}
            answers={answers}
            missing={missing}
            readOnly={readOnly}
            savedAt={savedAt}
            savedLabel={savedLabel}
          />

          <section className={styles.next} aria-labelledby="vetting-next-title">
            <h2 id="vetting-next-title">{t('vettingForm.next.title')}</h2>
            <ol className={styles.steps}>
              <li className={styles.step}>{t('vettingForm.next.step1')}</li>
              <li className={styles.step}>{t('vettingForm.next.step2')}</li>
              <li className={styles.step}>{t('vettingForm.next.step3')}</li>
            </ol>

            {/* What approval is not. Stated with the same weight as what it is:
                the client's safeguard is worth nothing if the page lets a reader
                infer that we have audited them or endorsed their claim. */}
            <div className={styles.limit}>
              <h3 className={styles.limitTitle}>{t('vettingForm.next.notTitle')}</h3>
              <p className={styles.limitBody}>{t('vettingForm.next.notBody')}</p>
            </div>

            <p className={styles.away}>
              <Link href="/vetting/status">
                {t('vettingStatus.title')}
              </Link>
              <Link href="/for-buyers">{t('vettingForm.next.backToBuyers')}</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
