import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { isAnswered, type AnswerMap, type Questionnaire } from '@/lib/vetting/types';
import { questionLabels } from './labels';
import styles from './VettingProgress.module.css';

/**
 * Progress through the questionnaire, and an index of its questions.
 *
 * The bar is the least important part: what a buyer returning to a
 * half-finished questionnaire needs is to see WHICH questions are still open
 * and reach one in a single click. So the panel is an index with a status word
 * against each line, and the bar sits above it as a summary.
 *
 * The status is never carried by the tick colour alone - every line states
 * "Answered" or "Not answered" in words, and the bar carries an accessible
 * label rather than being left as decoration.
 *
 * Both the count and the index are computed from the SAME answers the form
 * renders, so the figure and the list cannot disagree. "Answered" means what
 * the database means by it - src/lib/vetting/types.ts isAnswered(), which is
 * also what the submit path checks a required question against.
 */
export default async function VettingProgress({
  questionnaire,
  answers,
  savedAt,
  savedLabel,
  missing,
}: {
  questionnaire: Questionnaire;
  answers: AnswerMap;
  savedAt: string | null;
  /** What the date beside the progress figure IS. A draft and a submitted
      application are different things and must not share a label. */
  savedLabel: string;
  missing: readonly string[];
}) {
  const t = await getTranslations('vettingForm');
  const missingSet = new Set(missing);

  const rows = questionnaire.questions.map((question, index) => ({
    question,
    n: index + 1,
    answered: isAnswered(answers[question.questionCode]),
    labels: questionLabels(t, question),
    flagged: missingSet.has(question.questionCode),
  }));

  const total = rows.length;
  const answered = rows.filter((r) => r.answered).length;

  return (
    <section className={styles.panel} aria-labelledby="vetting-progress-title">
      <h2 id="vetting-progress-title" className={styles.title}>
        {t('progress.title')}
      </h2>

      <p className={styles.summary}>
        {t('progress.summary', { answered, total })}
      </p>

      {/* One tick per question, in document order. It is a picture of the index
          below it, so it carries a label and nothing else depends on it. */}
      <div
        className={styles.bar}
        role="img"
        aria-label={t('progress.barLabel', { answered, total })}
      >
        {rows.map((r) => (
          <span
            key={r.question.questionCode}
            className={r.answered ? `${styles.tick} ${styles.tickDone}` : styles.tick}
          />
        ))}
      </div>

      {savedAt && (
        <SourceStamp
          source={{
            label: savedLabel,
            locator: null,
            asOfDate: savedAt,
          }}
        />
      )}

      <h3 className={styles.indexTitle}>{t('progress.indexLabel')}</h3>
      <ol className={styles.index}>
        {rows.map((r) => (
          <li key={r.question.questionCode} className={styles.item}>
            <a className={styles.link} href={`#${r.question.questionCode}`}>
              <span className={styles.num} aria-hidden="true">
                {t('labels.questionShort')}
                {r.n}
              </span>
              <span className={styles.short}>{r.labels.short}</span>
            </a>
            <span className={r.answered ? styles.statusDone : styles.statusOpen}>
              {r.answered ? t('progress.answered') : t('progress.notAnswered')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
