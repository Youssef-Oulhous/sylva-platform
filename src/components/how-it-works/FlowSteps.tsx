import { getTranslations } from 'next-intl/server';
import styles from './FlowSteps.module.css';

/**
 * The seven steps, expanded.
 *
 * The front page states the sequence in one line per step. This is the same
 * sequence with the four things a reviewer actually asks at each one: who acts,
 * what evidence exists by then, what the platform does, and what it does not.
 *
 * The fourth question is the reason this component exists. A process diagram
 * that only shows what a system does reads as a promise; the concept note is
 * explicit that this platform does not verify, does not issue, does not settle
 * and is not the registry, and those limits belong beside the step they apply
 * to rather than in a disclaimer nobody reaches.
 *
 * The step names and one-line notes are reused from the landing page keys, so
 * the two pages cannot drift into describing different processes.
 */
const STEP_KEYS = [
  'project',
  'evidence',
  'interest',
  'deal',
  'restoration',
  'verified',
  'units',
] as const;

/** doesNot is last on purpose: it is the answer people leave with. */
const DETAIL_KEYS = ['who', 'evidence', 'does', 'doesNot'] as const;

export default async function FlowSteps() {
  const t = await getTranslations();

  return (
    <ol className={styles.steps}>
      {STEP_KEYS.map((key, i) => (
        <li key={key} className={styles.step}>
          <div className={styles.head}>
            {/* The ordered list already conveys sequence to a screen reader;
                the printed number is for the eye only. */}
            <span className={styles.num} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className={styles.headText}>
              <h3 className={styles.name}>{t(`home.step.${key}`)}</h3>
              <p className={styles.note}>{t(`home.step.${key}Note`)}</p>
            </div>
          </div>

          <dl className={styles.detail}>
            {DETAIL_KEYS.map((d) => (
              <div
                key={d}
                className={d === 'doesNot' ? `${styles.row} ${styles.rowLimit}` : styles.row}
              >
                <dt className={styles.dt}>{t(`howItWorks.flow.${d}`)}</dt>
                <dd className={styles.dd}>{t(`howItWorks.flow.steps.${key}.${d}`)}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}
