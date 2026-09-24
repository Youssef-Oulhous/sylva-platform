import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  DEMO_DRAFT_SOURCE,
  QUESTIONS_ANSWERED,
  QUESTION_TOTAL,
  VETTING_QUESTIONS,
} from './vetting-data';
import styles from './VettingProgress.module.css';

/**
 * Progress through the questionnaire, and an index of the eight questions.
 *
 * The bar is the least important part of this: what a buyer returning to a
 * half-finished questionnaire needs is to see WHICH questions are still open and
 * to reach one in a single click. So the panel is an index with a status word
 * against each line, and the bar sits above it as a summary.
 *
 * The status is never carried by the tick colour alone - every line states
 * "Answered" or "Not answered" in words, and the bar itself is given an
 * accessible label rather than left as decoration.
 *
 * FRONTEND PASS. The counts are derived from the DEMO question statuses in
 * vetting-data.ts, so the figure and the index cannot disagree.
 */
export default async function VettingProgress() {
  const t = await getTranslations('vettingForm');

  return (
    <section className={styles.panel} aria-labelledby="vetting-progress-title">
      <h2 id="vetting-progress-title" className={styles.title}>
        {t('progress.title')}
      </h2>

      <p className={styles.summary}>
        {t('progress.summary', { answered: QUESTIONS_ANSWERED, total: QUESTION_TOTAL })}
      </p>

      {/* One tick per question, in document order. It is an image of the index
          below it, so it carries a label and nothing else depends on it. */}
      <div
        className={styles.bar}
        role="img"
        aria-label={t('progress.barLabel', {
          answered: QUESTIONS_ANSWERED,
          total: QUESTION_TOTAL,
        })}
      >
        {VETTING_QUESTIONS.map((question) => (
          <span
            key={question.id}
            className={
              question.status === 'answered' ? `${styles.tick} ${styles.tickDone}` : styles.tick
            }
          />
        ))}
      </div>

      <SourceStamp
        source={{
          label: t(DEMO_DRAFT_SOURCE.labelKey),
          locator: DEMO_DRAFT_SOURCE.locator,
          asOfDate: DEMO_DRAFT_SOURCE.asOfDate,
        }}
      />

      <h3 className={styles.indexTitle}>{t('progress.indexLabel')}</h3>
      <ol className={styles.index}>
        {VETTING_QUESTIONS.map((question) => {
          const answered = question.status === 'answered';
          return (
            <li key={question.id} className={styles.item}>
              <a className={styles.link} href={`#${question.id}`}>
                <span className={styles.num} aria-hidden="true">
                  {t('labels.questionShort')}
                  {question.n}
                </span>
                <span className={styles.short}>{t(`q.${question.key}.short`)}</span>
              </a>
              <span className={answered ? styles.statusDone : styles.statusOpen}>
                {answered ? t('progress.answered') : t('progress.notAnswered')}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
