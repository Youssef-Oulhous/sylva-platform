import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { LOG_SOURCE, STATE_TONE, deriveState, type QueueRow } from './demo-queue';
import styles from './SubmissionDetail.module.css';

/**
 * The head of the review panel: who this application is, and the state that
 * follows from its entries.
 *
 * The state is printed as a badge with the word in it, and immediately beside it
 * the sentence that says where the word came from - how many entries it was read
 * from, and the reference of the newest one. A reviewer should never have to
 * wonder whether the badge is a setting or a reading.
 *
 * Every date here comes from the same record, so one source stamp covers the
 * panel rather than one per line.
 */
export default async function SubmissionDetail({
  row,
  headingId,
}: {
  row: QueueRow;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const state = deriveState(row.log);
  const newest = row.log[row.log.length - 1];

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  const facts: readonly { key: string; value: React.ReactNode }[] = [
    { key: 'reference', value: <span className={styles.mono}>{row.reference}</span> },
    { key: 'role', value: t(`adminVetting.role.${row.role}`) },
    { key: 'sector', value: t(row.sectorKey) },
    { key: 'country', value: t(row.countryKey) },
    { key: 'submitted', value: day(row.submittedOn) },
    { key: 'lastEntry', value: day(row.lastEntryOn) },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t('adminVetting.panel.eyebrow')}</p>
        <h2 id={headingId} className={styles.org}>
          {row.organisationName}
        </h2>
        <div className={styles.badges}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <Badge tone={STATE_TONE[state]}>{t(`adminVetting.state.${state}`)}</Badge>
        </div>
      </div>

      {/* Where the word in that badge came from. */}
      <p className={styles.derivedFrom}>
        {t('adminVetting.panel.derivedFrom', {
          count: row.log.length,
          reference: newest ? newest.reference : '—',
        })}
      </p>

      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.key} className={styles.fact}>
            <dt className={styles.factLabel}>{t(`adminVetting.col.${fact.key}`)}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <SourceStamp
        source={{
          label: t(LOG_SOURCE.labelKey),
          locator: LOG_SOURCE.locator,
          asOfDate: row.lastEntryOn,
        }}
      />
    </div>
  );
}
