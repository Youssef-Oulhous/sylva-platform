import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { orFallback } from '@/components/vetting/labels';
import { dateOf } from '@/lib/vetting/types';
import type { VettingStatus } from '@/lib/vetting/types';
import type { OrganisationLabels } from '@/lib/vetting/reference';
import StageTrack from './StageTrack';
import { STATE_FALLBACK_EN, STATE_MEANING_FALLBACK_EN, STATE_TONE, VETTING_CONTACT, type Stage } from './states';
import styles from './ApplicationPanel.module.css';

/**
 * One organisation's vetting application, shown in full, from the database.
 *
 * Four things the panel carries, unchanged from the first build because they
 * were right:
 *   - the state as a WORD as well as a tint,
 *   - the application reference, so a question to Sylva can name it,
 *   - "Decision due: Not set", because no target time is published and an empty
 *     field reads as an oversight rather than as the fact it is,
 *   - one source stamp: every date in the panel comes from one read, so one
 *     stamp is the honest number of stamps.
 *
 * What changed is where the content comes from. The reference is the submission
 * id, the dates are org.vetting_submission.submitted_at and
 * org.vetting_decision.decided_at, and the reason is the operator's recorded
 * text - shown verbatim, in the language it was written in, because it is a
 * record and not a label. Translating a recorded reason would be rewriting it.
 */
export default async function ApplicationPanel({
  status,
  labels,
  headingId,
}: {
  status: VettingStatus;
  labels: OrganisationLabels;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const date = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'long')}</time>
  );

  const submittedOn = dateOf(status.submission?.submittedAt ?? null);
  const decidedOn = dateOf(status.decision?.decidedAt ?? null);

  const stages: Stage[] = [
    {
      id: 'submitted',
      labelKey: 'vettingStatus.stage.submitted',
      noteKey: 'vettingStatus.stage.submittedNote',
      position: submittedOn ? (decidedOn ? 'done' : 'current') : 'ahead',
      reachedOn: submittedOn,
    },
    {
      id: 'decision',
      labelKey: 'vettingStatus.stage.decision',
      noteKey: 'vettingStatus.stage.decisionNote',
      position: decidedOn ? 'current' : 'ahead',
      reachedOn: decidedOn,
    },
  ];

  const notSet = <span className={styles.notSet}>{t('vettingStatus.field.notSet')}</span>;

  return (
    <article className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <p className={styles.orgLabel}>{t('vettingStatus.field.organisation')}</p>
          <h3 id={headingId} className={styles.org}>
            {status.organisation?.legalName
              ?? orFallback(t, 'vettingStatus.field.unknownOrganisation', 'Your organisation')}
          </h3>
        </div>
        <div className={styles.badges}>
          <Badge tone={STATE_TONE[status.state]}>
            {orFallback(
              t,
              `vettingStatus.state.${status.state}`,
              STATE_FALLBACK_EN[status.state],
            )}
          </Badge>
        </div>
      </header>

      <p className={styles.meaning}>
        {orFallback(
          t,
          `vettingStatus.stateMeaning.${status.state}`,
          STATE_MEANING_FALLBACK_EN[status.state],
        )}
      </p>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.reference')}</dt>
          {/* The submission id. An identifier, so it is set in mono, and it is
              the reference Sylva can actually look up. */}
          <dd className={styles.mono}>{status.submission?.id ?? notSet}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.role')}</dt>
          <dd>
            {orFallback(
              t,
              `vettingStatus.role.${camel(status.roleCode)}`,
              status.roleCode,
            )}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.sector')}</dt>
          <dd>{labels.sector}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.country')}</dt>
          <dd>{labels.country}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.submittedOn')}</dt>
          <dd>{submittedOn ? date(submittedOn) : notSet}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.decidedOn')}</dt>
          <dd>{decidedOn ? date(decidedOn) : notSet}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.decisionDueOn')}</dt>
          <dd>
            {notSet}
            <span className={styles.factNote}>{t('vettingStatus.field.notSetNote')}</span>
          </dd>
        </div>
      </dl>

      {status.asOfDate && (
        <SourceStamp
          source={{
            label: t('vettingStatus.sourceLabel'),
            asOfDate: dateOf(status.asOfDate)!,
            locator: status.submission?.id ?? null,
          }}
        />
      )}

      <section className={styles.block} aria-labelledby={`${headingId}-progress`}>
        <h4 id={`${headingId}-progress`} className={styles.blockTitle}>
          {t('vettingStatus.stage.heading')}
        </h4>
        <StageTrack stages={stages} />
      </section>

      {status.decision?.reason && (
        <section className={styles.block} aria-labelledby={`${headingId}-reason`}>
          <h4 id={`${headingId}-reason`} className={styles.blockTitle}>
            {t('vettingStatus.reason.heading')}
          </h4>
          <div className={styles.reason}>
            {/* Verbatim. This is what Sylva recorded; it is not a label. */}
            <p className={styles.reasonDetail}>{status.decision.reason}</p>
            <p className={styles.reasonPart}>
              <span className={styles.reasonPartLabel}>
                {t('vettingStatus.reason.part')}
              </span>
              {orFallback(
                t,
                `vettingStatus.decisionKind.${status.decision.decision}`,
                status.decision.decision,
              )}
            </p>
          </div>
        </section>
      )}

      <section className={styles.block} aria-labelledby={`${headingId}-next`}>
        <h4 id={`${headingId}-next`} className={styles.blockTitle}>
          {t('vettingStatus.next.heading')}
        </h4>
        <ol className={styles.steps}>
          {status.state === 'not_started' && (
            <li className={styles.step}>
              <p className={styles.stepTitle}>
                {orFallback(t, 'vettingStatus.next.start.title', 'Answer the questionnaire')}
              </p>
              <p className={styles.stepBody}>
                {orFallback(
                  t,
                  'vettingStatus.next.start.body',
                  'Sylva cannot record a decision until it has the answers. You can '
                  + 'save a draft and come back to it.',
                )}
              </p>
              <Link href="/vetting" className={styles.stepCta}>
                {t('vettingStatus.next.questionnaireCta')}
              </Link>
            </li>
          )}

          {status.state === 'submitted' && (
            <li className={styles.step}>
              <p className={styles.stepTitle}>{t('vettingStatus.next.pending.read')}</p>
              <p className={styles.stepBody}>{t('vettingStatus.next.pending.readBody')}</p>
              <Link href="/projects" className={styles.stepCta}>
                {t('home.ctaExplore')}
              </Link>
            </li>
          )}

          {status.state === 'approved' && (
            <li className={styles.step}>
              <p className={styles.stepTitle}>
                {orFallback(t, 'vettingStatus.next.approved.title', 'Express interest in a project')}
              </p>
              <p className={styles.stepBody}>
                {orFallback(
                  t,
                  'vettingStatus.next.approved.body',
                  'Approval is what rule 6 asks for, so a private room can now be '
                  + 'opened between this organisation and a project.',
                )}
              </p>
              <Link href="/projects" className={styles.stepCta}>
                {t('home.ctaExplore')}
              </Link>
            </li>
          )}

          {(status.state === 'declined'
            || status.state === 'suspended'
            || status.state === 'revoked') && (
            <li className={styles.step}>
              <p className={styles.stepTitle}>{t('vettingStatus.next.declined.reason')}</p>
              <p className={styles.stepBody}>{t('vettingStatus.next.declined.reasonBody')}</p>
            </li>
          )}

          <li className={styles.step}>
            <p className={styles.stepTitle}>{t('vettingStatus.next.pending.vetting')}</p>
            <p className={styles.stepBody}>{t('vettingStatus.next.pending.vettingBody')}</p>
            <Link href="/how-it-works#vetting" className={styles.stepCta}>
              {t('vettingStatus.next.howCta')}
            </Link>
          </li>

          <li className={styles.step}>
            <p className={styles.stepTitle}>{t('vettingStatus.next.declined.ask')}</p>
            <p className={styles.stepBody}>{t('vettingStatus.next.declined.askBody')}</p>
            <a href={`mailto:${VETTING_CONTACT}`} className={styles.stepCta}>
              {t('vettingStatus.next.contactCta')}
              <span className={styles.stepEmail}>{VETTING_CONTACT}</span>
            </a>
          </li>
        </ol>
      </section>
    </article>
  );
}

/** buyer -> buyer, project_owner -> projectOwner. The catalogue's key style. */
function camel(code: string): string {
  return code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
