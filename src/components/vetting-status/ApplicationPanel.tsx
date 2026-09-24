import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import StageTrack from './StageTrack';
import { STATE_TONE, type DemoApplication } from './demo-vetting';
import styles from './ApplicationPanel.module.css';

/**
 * One vetting application, shown in full.
 *
 * The same component renders the application a reader is waiting on and the
 * declined worked example further down the page, because a declined decision
 * deserves the same fields, the same dates and the same source as an open one.
 * Nothing is hidden from the declined variant except what it does not have.
 *
 * Four things every panel carries:
 *   - the state as a WORD as well as a tint,
 *   - the application reference, so a question to Sylva can name it,
 *   - "Decision due: Not set", because no target time is published and an
 *     empty field would read as an oversight rather than as the fact it is,
 *   - one source stamp: every date in the panel is read from one record, so
 *     one stamp is the honest number of stamps.
 *
 * Every panel ends in at least one thing the reader can actually do.
 */
export default async function ApplicationPanel({
  application,
  headingId,
}: {
  application: DemoApplication;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const date = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'long')}</time>
  );

  return (
    <article className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <p className={styles.orgLabel}>{t('vettingStatus.field.organisation')}</p>
          <h3 id={headingId} className={styles.org}>
            {application.organisationName}
          </h3>
        </div>
        <div className={styles.badges}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <Badge tone={STATE_TONE[application.state]}>
            {t(`vettingStatus.state.${application.state}`)}
          </Badge>
        </div>
      </header>

      <p className={styles.meaning}>
        {t(`vettingStatus.stateMeaning.${application.state}`)}
      </p>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.reference')}</dt>
          <dd className={styles.mono}>{application.reference}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.role')}</dt>
          <dd>{t(application.roleKey)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.sector')}</dt>
          <dd>{t(application.sectorKey)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.country')}</dt>
          <dd>{t(application.countryKey)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.submittedOn')}</dt>
          <dd>{date(application.submittedOn)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.lastEventOn')}</dt>
          <dd>{date(application.lastEventOn)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.decidedOn')}</dt>
          <dd>
            {application.decidedOn ? (
              date(application.decidedOn)
            ) : (
              <span className={styles.notSet}>{t('vettingStatus.field.notSet')}</span>
            )}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('vettingStatus.field.decisionDueOn')}</dt>
          <dd>
            <span className={styles.notSet}>{t('vettingStatus.field.notSet')}</span>
            <span className={styles.factNote}>{t('vettingStatus.field.notSetNote')}</span>
          </dd>
        </div>
      </dl>

      <SourceStamp
        source={{
          label: t(application.source.labelKey),
          asOfDate: application.source.asOfDate,
          locator: application.reference,
        }}
      />

      <section className={styles.block} aria-labelledby={`${headingId}-progress`}>
        <h4 id={`${headingId}-progress`} className={styles.blockTitle}>
          {t('vettingStatus.stage.heading')}
        </h4>
        <StageTrack stages={application.stages} />
      </section>

      {application.reason && (
        <section className={styles.block} aria-labelledby={`${headingId}-reason`}>
          <h4 id={`${headingId}-reason`} className={styles.blockTitle}>
            {t('vettingStatus.reason.heading')}
          </h4>
          <div className={styles.reason}>
            <p className={styles.reasonHeadline}>{t(application.reason.headlineKey)}</p>
            <p className={styles.reasonDetail}>{t(application.reason.detailKey)}</p>
            <p className={styles.reasonPart}>
              <span className={styles.reasonPartLabel}>
                {t('vettingStatus.reason.part')}
              </span>
              {t(application.reason.partKey)}
            </p>
          </div>
        </section>
      )}

      <section className={styles.block} aria-labelledby={`${headingId}-next`}>
        <h4 id={`${headingId}-next`} className={styles.blockTitle}>
          {t('vettingStatus.next.heading')}
        </h4>
        <ol className={styles.steps}>
          {application.nextSteps.map((step) => (
            <li key={step.id} className={styles.step}>
              <p className={styles.stepTitle}>{t(step.titleKey)}</p>
              <p className={styles.stepBody}>{t(step.bodyKey)}</p>
              {step.href && step.ctaKey && (
                <Link href={step.href} className={styles.stepCta}>
                  {t(step.ctaKey)}
                </Link>
              )}
              {step.email && step.ctaKey && (
                <a href={`mailto:${step.email}`} className={styles.stepCta}>
                  {t(step.ctaKey)}
                  <span className={styles.stepEmail}>{step.email}</span>
                </a>
              )}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
