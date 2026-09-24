import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { redirectTo } from '@/lib/i18n/navigate';
import { getViewer } from '@/lib/auth/session';
import { primaryRole } from '@/lib/auth/roles';
import { loadVettingApplication, loadVettingQueue } from '@/lib/admin/queries';
import { isAdminErrorCode, type AdminErrorCode } from '@/lib/admin/errors';
import { adminText } from '@/lib/admin/messages';
import DecisionForm from '@/components/admin-vetting/DecisionForm';
import DecisionModel from '@/components/admin-vetting/DecisionModel';
import EntryLog from '@/components/admin-vetting/EntryLog';
import QuestionnaireAnswers from '@/components/admin-vetting/QuestionnaireAnswers';
import QueueTable from '@/components/admin-vetting/QueueTable';
import SubmissionDetail from '@/components/admin-vetting/SubmissionDetail';
import styles from './page.module.css';

/**
 * The operator vetting queue, wired to the database.
 *
 * Vetting is the gate. No deal can be created for an organisation Sylva has not
 * approved (concept note section 8, rule 6), and the vetting decision is the
 * operator's main safeguard against greenwashing and a condition of the funding
 * behind the pilot (section 7). So this screen has one job and it is not
 * clearing a list: it is making a decision that will be read back for years.
 *
 * APPROVAL IS NOT SET, IT IS RECORDED. There is no control anywhere on this
 * page that writes a state, and no query behind it that could. The badge is
 * `org.org_role_approval.status`, a cache written only by the SECURITY DEFINER
 * trigger on `org.vetting_decision`; `ci.assert_approval_is_derived()` fails
 * the build if any application role gains a privilege on that table. The
 * decision form inserts an ENTRY, and the state follows from it.
 *
 * WHO MAY READ THIS PAGE. Sylva operators, and the database is what enforces
 * it: every query here runs as `sylva_operator`, which is the only role with a
 * policy letting it read another organisation's questionnaire answers. The
 * guard below decides what is SHOWN; it is not the boundary, and a bug in it
 * could not hand anybody another organisation's rows. See docs/FINDING-001.
 *
 * RULE 7 (no unit volumes added across projects). This screen renders no unit
 * volume at all: a vetting decision concerns an organisation, not a project, so
 * there is no quantity here that two projects' units could be summed into. The
 * only figures are dates and counts of APPLICATIONS, and each count prints the
 * word beside itself so it cannot be read as a volume.
 *
 * RULE J (invent no business or legal rules). What a suspension does to deals
 * already agreed, and how much of a recorded reason the applicant sees, are not
 * settled by the concept note. Both are printed as open questions rather than
 * answered.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminVetting' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // An operator screen holding other organisations' questionnaire answers has
    // nothing to index, and must never surface in a search for an applicant.
    robots: { index: false, follow: false },
  };
}

interface Search {
  application?: string;
  error?: string;
  recorded?: string;
}

export default async function AdminVettingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const query = await searchParams;

  const viewer = await getViewer();
  if (!viewer) {
    redirectTo({
      href: { pathname: '/sign-in', query: { next: '/admin/vetting' } },
      locale,
    });
  }
  if (primaryRole(viewer.roles) !== 'operator') {
    redirectTo({ href: { pathname: '/sign-in', query: { error: 'wrong_role' } }, locale });
  }

  const rows = await loadVettingQueue(viewer.actor, locale);

  /**
   * Which application the panel shows. The query string names one; otherwise
   * the oldest undecided application, because that is the one waiting longest
   * for the decision this screen exists to make.
   */
  const asked = typeof query.application === 'string' ? query.application : null;
  const fallback =
    [...rows].reverse().find((r) => r.state === 'submitted') ?? rows[0] ?? null;
  const openId = (asked && rows.some((r) => r.submissionId === asked))
    ? asked
    : fallback?.submissionId ?? null;

  const application = openId
    ? await loadVettingApplication(viewer.actor, openId, locale)
    : null;

  const error: AdminErrorCode | null = isAdminErrorCode(query.error) ? query.error : null;
  const recorded = typeof query.recorded === 'string' ? query.recorded : null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('adminVetting.operator')}</p>
        <h1>{t('adminVetting.title')}</h1>
        <p className={styles.lead}>{t('adminVetting.lead')}</p>
        <p className={styles.accessNote}>{adminText(t, 'accessNote')}</p>
        <p className={styles.accessNote}>{adminText(t, 'liveNote')}</p>
      </header>

      <DecisionModel />

      <QueueTable rows={rows} openId={openId} />

      {/* One application, in full. The queue row above it carries aria-current,
          so which application this is can be read from the table as well. */}
      {application && (
        <section className={styles.panel} aria-labelledby="panel-title">
          <SubmissionDetail application={application} headingId="panel-title" />
          <QuestionnaireAnswers application={application} headingId="panel-answers" />
          <EntryLog application={application} headingId="panel-log" />
          <DecisionForm
            application={application}
            headingId="panel-decide"
            error={error}
            recorded={recorded}
          />
        </section>
      )}

      <nav className={styles.related} aria-label={t('adminVetting.relatedTitle')}>
        <h2 className={styles.relatedTitle}>{t('adminVetting.relatedTitle')}</h2>
        <ul className={styles.relatedList}>
          <li>
            <Link href="/vetting">{t('adminVetting.related.questionnaire')}</Link>
            <span className={styles.relatedNote}>
              {t('adminVetting.related.questionnaireNote')}
            </span>
          </li>
          <li>
            <Link href="/record">{t('adminVetting.related.record')}</Link>
            <span className={styles.relatedNote}>{t('adminVetting.related.recordNote')}</span>
          </li>
          <li>
            <Link href="/how-it-works">{t('adminVetting.related.howItWorks')}</Link>
            <span className={styles.relatedNote}>
              {t('adminVetting.related.howItWorksNote')}
            </span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
