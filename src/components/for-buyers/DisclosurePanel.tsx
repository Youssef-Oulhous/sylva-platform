import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './DisclosurePanel.module.css';

/**
 * Pseudonymity, and the buyer's choice to be named.
 *
 * Two of the organisations interviewed asked for this directly, so it is stated
 * as a rule of the platform rather than as a setting buried in a profile: the
 * public record shows a label unless that particular deal has been flagged for
 * disclosure. The two record entries below are the same event written both
 * ways, because the difference is easier to check than to describe.
 */

interface DemoRecordEntry {
  id: 'pseudonymous' | 'named';
  captionKey: string;
  /** What the buyer field contains. A pseudonymous label, or the real name. */
  buyer: string;
  buyerIsPseudonym: boolean;
}

/** DEMO DATA. A fictional interest event on a fictional project. */
const DEMO_RECORD = {
  projectName: 'DEMO Untere Havel Wetland Restoration',
  occurredOn: '2026-09-23',
  pseudonym: 'Buyer 014',
  organisationName: 'DEMO Rheinwasser Getränke GmbH',
  source: { labelKey: 'forBuyers.source.publicRecord', locator: 'INT-2026-0140', asOfDate: '2026-09-23' },
} as const;

const DEMO_ENTRIES: readonly DemoRecordEntry[] = [
  {
    id: 'pseudonymous',
    captionKey: 'forBuyers.disclosure.recordDefaultCaption',
    buyer: DEMO_RECORD.pseudonym,
    buyerIsPseudonym: true,
  },
  {
    id: 'named',
    captionKey: 'forBuyers.disclosure.recordNamedCaption',
    buyer: DEMO_RECORD.organisationName,
    buyerIsPseudonym: false,
  },
];

export default async function DisclosurePanel() {
  const t = await getTranslations();
  const format = await getFormatter();
  const occurred = new Date(DEMO_RECORD.occurredOn);

  return (
    <>
      <h2>{t('forBuyers.disclosure.title')}</h2>
      <p className={styles.lead}>{t('forBuyers.disclosure.lead')}</p>

      <div className={styles.options}>
        <article className={`${styles.option} ${styles.optionDefault}`}>
          <Badge tone="neutral">{t('forBuyers.disclosure.defaultTag')}</Badge>
          <h3 className={styles.optionTitle}>{t('forBuyers.disclosure.defaultHeading')}</h3>
          <p className={styles.optionBody}>{t('forBuyers.disclosure.defaultBody')}</p>
        </article>

        <article className={styles.option}>
          <Badge tone="neutral">{t('forBuyers.disclosure.namedTag')}</Badge>
          <h3 className={styles.optionTitle}>{t('forBuyers.disclosure.namedHeading')}</h3>
          <p className={styles.optionBody}>{t('forBuyers.disclosure.namedBody')}</p>
        </article>
      </div>

      <h3 className={styles.recordTitle}>{t('forBuyers.disclosure.recordTitle')}</h3>

      <div className={styles.records}>
        {DEMO_ENTRIES.map((entry) => (
          <figure key={entry.id} className={styles.record}>
            <figcaption className={styles.recordCaption}>{t(entry.captionKey)}</figcaption>
            <dl className={styles.recordBody}>
              <div className={styles.field}>
                <dt className={styles.fieldLabel}>{t('forBuyers.disclosure.fieldProject')}</dt>
                <dd className={styles.fieldValue}>{DEMO_RECORD.projectName}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.fieldLabel}>{t('forBuyers.disclosure.fieldEvent')}</dt>
                <dd className={styles.fieldValue}>{t('forBuyers.disclosure.eventInterest')}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.fieldLabel}>{t('forBuyers.disclosure.fieldBuyer')}</dt>
                <dd className={styles.fieldValue}>
                  {entry.buyerIsPseudonym
                    ? t('forBuyers.disclosure.buyerPseudonym', { label: entry.buyer })
                    : t('forBuyers.disclosure.buyerNamed', { name: entry.buyer })}
                </dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.fieldLabel}>{t('forBuyers.disclosure.fieldDate')}</dt>
                <dd className={styles.fieldValue}>
                  <time dateTime={DEMO_RECORD.occurredOn}>
                    {format.dateTime(occurred, 'long')}
                  </time>
                </dd>
              </div>
            </dl>
          </figure>
        ))}
      </div>

      <SourceStamp
        source={{
          label: t(DEMO_RECORD.source.labelKey),
          locator: DEMO_RECORD.source.locator,
          asOfDate: DEMO_RECORD.source.asOfDate,
        }}
      />

      <h3 className={styles.alwaysTitle}>{t('forBuyers.disclosure.alwaysTitle')}</h3>
      <ul className={styles.always}>
        <li>{t('forBuyers.disclosure.alwaysOperator')}</li>
        <li>{t('forBuyers.disclosure.alwaysOwner')}</li>
        <li>{t('forBuyers.disclosure.alwaysAuditor')}</li>
      </ul>

      <p className={styles.appendOnly}>{t('forBuyers.disclosure.appendOnly')}</p>
    </>
  );
}
