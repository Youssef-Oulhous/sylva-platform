import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { RECORD_SOURCE, STATUS_TONE, type ReviewRow } from './demo-projects';
import styles from './ProjectFacts.module.css';

/**
 * The head of the review panel: which project is open, and what is recorded
 * against it that an operator needs before reading the gate list.
 *
 * Every date here is read from the same record, so one source stamp covers the
 * panel rather than one per line.
 *
 * The unit type is stated among the facts, not because the gate checks it - it
 * does not - but because every figure this project will ever show is denominated
 * in it, and an operator publishing a project should have read it. Where no unit
 * type is recorded the field says so rather than being left blank.
 */
export default async function ProjectFacts({
  row,
  headingId,
}: {
  row: ReviewRow;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  const facts: readonly { key: string; value: React.ReactNode }[] = [
    { key: 'reference', value: <span className={styles.mono}>{row.reference}</span> },
    { key: 'owner', value: row.ownerOrgName },
    { key: 'country', value: t(`adminProjects.country.${row.countryCode}`) },
    { key: 'scheme', value: row.schemeName ?? t('adminProjects.notRecorded') },
    {
      key: 'unitType',
      value: row.unitKey
        ? t(`adminProjects.unit.${row.unitKey}`)
        : t('adminProjects.unit.notRecorded'),
    },
    {
      key: 'submitted',
      value: row.submittedOn ? day(row.submittedOn) : t('adminProjects.panel.notSubmitted'),
    },
    {
      key: 'published',
      value: row.publishedOn ? day(row.publishedOn) : t('adminProjects.panel.notPublished'),
    },
    { key: 'lastChange', value: day(row.lastChangeOn) },
    { key: 'slug', value: <span className={styles.mono}>{row.slug}</span> },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t('adminProjects.panel.eyebrow')}</p>
        <h2 id={headingId} className={styles.title}>
          {row.title}
        </h2>
        <div className={styles.badges}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <Badge tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>
        </div>
      </div>

      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.key} className={styles.fact}>
            <dt className={styles.factLabel}>{t(`adminProjects.col.${fact.key}`)}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <SourceStamp
        source={{
          label: t(RECORD_SOURCE.labelKey),
          locator: RECORD_SOURCE.locator,
          asOfDate: RECORD_SOURCE.asOfDate,
        }}
      />

      <p className={styles.pageLink}>
        <Link href={`/projects/${row.slug}`}>{t('adminProjects.panel.viewPage')}</Link>
      </p>
    </div>
  );
}
