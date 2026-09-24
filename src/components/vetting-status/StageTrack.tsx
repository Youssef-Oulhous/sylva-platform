import { getFormatter, getTranslations } from 'next-intl/server';
import type { Stage } from './states';
import styles from './StageTrack.module.css';

/**
 * Submitted, then decision.
 *
 * Two stages and no more. The concept note says Sylva collects the answers and
 * approves or declines (section 7); it does not describe an internal pipeline,
 * so this track does not invent one - and the database records exactly these
 * two events, org.vetting_submission and org.vetting_decision. The "under
 * review" stage this track used to show was not backed by any row.
 *
 * The position of each stage is printed as a word - Completed, Current stage,
 * Not yet reached - above its label. The marker and the weight repeat that
 * visually, but a reader who cannot see either still reads the state.
 */
export default async function StageTrack({ stages }: { stages: readonly Stage[] }) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <ol className={styles.track}>
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          className={`${styles.stage} ${styles[stage.position]}`}
          aria-current={stage.position === 'current' ? 'step' : undefined}
        >
          <span className={styles.marker} aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className={styles.body}>
            <p className={styles.position}>
              {t(`vettingStatus.stage.position.${stage.position}`)}
            </p>
            <p className={styles.label}>{t(stage.labelKey)}</p>
            <p className={styles.date}>
              {stage.reachedOn ? (
                <time dateTime={stage.reachedOn}>
                  {format.dateTime(new Date(stage.reachedOn), 'long')}
                </time>
              ) : (
                t('vettingStatus.stage.noDate')
              )}
            </p>
            <p className={styles.note}>{t(stage.noteKey)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
