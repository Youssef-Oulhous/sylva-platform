import { getTranslations } from 'next-intl/server';
import styles from './EntryPointSequence.module.css';

/**
 * Where an investor enters, as a numbered sequence rather than a diagram.
 *
 * The one thing this component exists to say is that financing is normally
 * discussed AFTER buyers have committed volume (concept note section 4).
 * The step where investors enter is marked with a word, not only with a rule
 * colour, so the marking survives a greyscale print and a screen reader.
 */

const STEPS = ['documented', 'committed', 'financing', 'signed'] as const;

const ENTRY_STEP: (typeof STEPS)[number] = 'financing';

export default async function EntryPointSequence() {
  const t = await getTranslations('forInvestors.sequence');

  return (
    <ol className={styles.steps}>
      {STEPS.map((key, i) => {
        const isEntry = key === ENTRY_STEP;
        return (
          <li key={key} className={isEntry ? `${styles.step} ${styles.entry}` : styles.step}>
            <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
            <h3 className={styles.name}>{t(`${key}.name`)}</h3>
            <p className={styles.note}>{t(`${key}.note`)}</p>
            {isEntry && <p className={styles.entryNote}>{t('entryMarker')}</p>}
          </li>
        );
      })}
    </ol>
  );
}
