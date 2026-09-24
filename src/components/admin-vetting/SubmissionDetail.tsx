import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { adminText, stateLabel } from '@/lib/admin/messages';
import { ROLE_KEY, STATE_TONE, type AdminVettingApplication } from '@/lib/admin/types';
import styles from './SubmissionDetail.module.css';

/**
 * The head of the review panel: who this application is, and the state that
 * follows from the decisions recorded for this organisation and this role.
 *
 * The state is printed as a badge with the word in it, and immediately beside
 * it the sentence that says where the word came from - how many entries it was
 * read from, and the reference of the newest one. A reviewer should never have
 * to wonder whether the badge is a setting or a reading. It is a reading:
 * `org.org_role_approval.status`, written only by the trigger on
 * `org.vetting_decision`.
 *
 * Every date here comes from the same record, so one source stamp covers the
 * panel rather than one per line.
 */
export default async function SubmissionDetail({
  application,
  headingId,
}: {
  application: AdminVettingApplication;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const newest = application.entries[application.entries.length - 1];

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  const roleKey = ROLE_KEY[application.roleCode];

  const facts: readonly { key: string; label: string; value: React.ReactNode }[] = [
    {
      key: 'reference',
      label: t('adminVetting.col.reference'),
      value: <span className={styles.mono}>{application.submissionId}</span>,
    },
    {
      key: 'role',
      label: t('adminVetting.col.role'),
      value: roleKey ? t(`adminVetting.role.${roleKey}`) : application.roleCode,
    },
    { key: 'sector', label: t('adminVetting.col.sector'), value: application.sectorLabel },
    { key: 'country', label: t('adminVetting.col.country'), value: application.countryName },
    {
      key: 'submitted',
      label: t('adminVetting.col.submitted'),
      value: day(application.submittedOn),
    },
    {
      key: 'lastEntry',
      label: t('adminVetting.col.lastEntry'),
      value: day(application.lastEntryOn),
    },
    {
      key: 'count',
      label: adminText(t, 'submissionCount'),
      value: application.submissionCount,
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t('adminVetting.panel.eyebrow')}</p>
        <h2 id={headingId} className={styles.org}>
          {application.organisationName}
        </h2>
        <div className={styles.badges}>
          <Badge tone={STATE_TONE[application.state]}>
            {stateLabel(t, application.state)}
          </Badge>
        </div>
      </div>

      {/* Where the word in that badge came from. */}
      <p className={styles.derivedFrom}>
        {t('adminVetting.panel.derivedFrom', {
          count: application.entries.length,
          reference: newest ? newest.reference : '—',
        })}
      </p>

      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.key} className={styles.fact}>
            <dt className={styles.factLabel}>{fact.label}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <SourceStamp
        source={{
          label: t('adminVetting.logSource'),
          locator: null,
          asOfDate: application.lastEntryOn,
        }}
      />
    </div>
  );
}
