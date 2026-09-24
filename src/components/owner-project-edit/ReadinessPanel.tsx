import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { GATES, GATES_MET, GATES_REQUIRED, RECORD, type GateState } from './project-draft-data';
import styles from './ReadinessPanel.module.css';

const STATE_CLASS: Record<GateState, string> = {
  complete: 'stateComplete',
  incomplete: 'stateIncomplete',
  optional: 'stateOptional',
  withOperator: 'stateOperator',
};

/**
 * Publication readiness, against the list of things the record either contains
 * or does not.
 *
 * Every line is derived from the same constants the form renders, so the panel
 * and the fields cannot disagree - a missing source is reported here because it
 * is missing there, not because a separate list says so.
 *
 * Two things this panel deliberately is not. It is not a score: there is no
 * percentage, no grade and no colour standing in for a word, and every line
 * states its status in words. And it is not an assurance: the last line is the
 * operator's review, and the note at the foot says plainly that a complete
 * record is not a claim that anything has been approved or accepted.
 */
export default async function ReadinessPanel() {
  const t = await getTranslations('ownerProjectForm');
  const met = GATES_MET.length;
  const required = GATES_REQUIRED.length;

  return (
    <section className={styles.panel} aria-labelledby="readiness-title">
      <h2 id="readiness-title" className={styles.title}>
        {t('readiness.title')}
      </h2>

      <p className={styles.summary}>{t('readiness.summary', { met, required })}</p>

      {/* One tick per requirement, in document order. It is an image of the list
          below it, so it carries a label and nothing else depends on it. */}
      <div className={styles.bar} role="img" aria-label={t('readiness.barLabel', { met, required })}>
        {GATES_REQUIRED.map((gate) => (
          <span
            key={gate.id}
            className={gate.state === 'complete' ? `${styles.tick} ${styles.tickDone}` : styles.tick}
          />
        ))}
      </div>

      <SourceStamp source={{ label: t('readiness.source'), asOfDate: RECORD.savedOn }} />

      <ol className={styles.list}>
        {GATES.map((gate) => {
          const title = t(`readiness.gate.${gate.id}.title`);
          return (
            <li key={gate.id} className={styles.item}>
              <div className={styles.itemHead}>
                {gate.sectionId ? (
                  <a className={styles.link} href={`#${gate.sectionId}`}>
                    {title}
                  </a>
                ) : (
                  <span className={styles.plain}>{title}</span>
                )}
                {/* The status is a word. The tint repeats it; it never carries
                    it alone. */}
                <span className={`${styles.state} ${styles[STATE_CLASS[gate.state]]}`}>
                  {t(`readiness.state.${gate.state}`)}
                </span>
              </div>

              <p className={styles.requirement}>{t(`readiness.gate.${gate.id}.requirement`)}</p>

              {gate.hasDetail && (
                <p className={styles.detail}>
                  {t(`readiness.gate.${gate.id}.detail`, { count: gate.count ?? 0 })}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.limit}>
        <h3 className={styles.limitTitle}>{t('readiness.limitTitle')}</h3>
        <p className={styles.limitBody}>{t('readiness.limitBody')}</p>
      </div>
    </section>
  );
}
