import { getTranslations } from 'next-intl/server';
import { DEAL_STAGES, type DealStage } from './types';
import styles from './StageTimeline.module.css';

/**
 * Where a deal has got to.
 *
 * "A stage marker running from first interest, through a letter of intent and a
 * term sheet, to signed." (Concept note, §7.) Four stages, in that order, and
 * no stage the note does not name.
 *
 * Every stage carries its state as a WORD - reached, current stage, not reached
 * - so the rule above each one is reinforcement, never the only signal. The
 * current stage also carries aria-current="step", which is how a screen reader
 * finds it without reading the whole list.
 *
 * This is an ordered list, not a progress bar: a deal is a sequence of recorded
 * events, and nothing here should suggest a percentage or an inevitability.
 */
export default async function StageTimeline({
  stage,
  labelledBy,
}: {
  stage: DealStage;
  /** Id of the heading that names this timeline for assistive technology. */
  labelledBy: string;
}) {
  const t = await getTranslations('buyerDashboard');
  const currentIndex = DEAL_STAGES.indexOf(stage);

  return (
    <ol className={styles.stages} aria-labelledby={labelledBy}>
      {DEAL_STAGES.map((name, index) => {
        const state =
          index < currentIndex ? 'reached' : index === currentIndex ? 'current' : 'notReached';

        return (
          <li
            key={name}
            className={`${styles.stage} ${styles[state]}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.stageIndex}>{String(index + 1)}</span>
            <span className={styles.stageName}>{t(`deals.stage.${name}`)}</span>
            <span className={styles.stageState}>{t(`deals.stageState.${state}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
