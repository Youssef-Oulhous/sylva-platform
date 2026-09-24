import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { LIMIT_ROWS } from './about-data';
import shared from './AboutSection.module.css';
import styles from './LimitsSection.module.css';

/**
 * What this platform does not do.
 *
 * Every entry here is a misreading with a consequence: mistaking this record
 * for the scheme's registry, reading a commitment as a purchase, reading a unit
 * as an interest in the land, or reading an evidence pack as an assurance that
 * an auditor will accept it. The brief asks the interface to prevent each of
 * them, and the cheapest place to do that is a page that says so in plain
 * words, once, with the source beside each statement.
 *
 * Stated as denials rather than as reassurance. Nothing here claims that the
 * platform satisfies a regulation or an auditor, because no source document
 * says that.
 */
export default async function LimitsSection() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('about.limits.title')}</h2>
      <p className={shared.lead}>{t('about.limits.lead')}</p>

      <ul className={styles.list}>
        {LIMIT_ROWS.map((row) => (
          <li key={row.id} className={styles.row}>
            <h3 className={styles.head}>{t(row.headKey)}</h3>
            <p className={styles.body}>{t(row.bodyKey)}</p>
            <SourceStamp
              source={{
                label: t(row.source.labelKey),
                locator: row.source.locator,
                asOfDate: row.source.asOfDate,
              }}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
