import { getTranslations } from 'next-intl/server';
import WhyWeAsk from './WhyWeAsk';
import { QUESTION_TOTAL, type VettingQuestion } from './vetting-data';
import styles from './Question.module.css';

/**
 * One long-form question: label, helper text, field, reason.
 *
 * FRONTEND PASS. The field is uncontrolled and has no handler, so this stays a
 * Server Component. Answered questions render their DEMO answer as the field's
 * defaultValue; nothing is read from or written to a database.
 *
 * The helper text and the reason are both tied to the field with
 * aria-describedby: a screen-reader user hears what to include and why it is
 * asked at the point where the answer is typed, not only when the block is read
 * from the top.
 */
export default async function LongAnswerQuestion({
  question,
}: {
  question: VettingQuestion;
}) {
  const t = await getTranslations('vettingForm');

  const fieldId = `${question.id}-answer`;
  const hintId = `${fieldId}-hint`;
  const whyId = `${fieldId}-why`;

  return (
    <div className={styles.question} id={question.id}>
      <p className={styles.kicker}>
        <span aria-hidden="true">
          {t('labels.questionShort')}
          {question.n}
        </span>
        <span className="visually-hidden">
          {t('labels.questionNumber', { n: question.n, total: QUESTION_TOTAL })}
        </span>
      </p>

      <label className={styles.label} htmlFor={fieldId}>
        {t(`q.${question.key}.label`)}
        <span className={styles.marker}>{t('labels.required')}</span>
      </label>

      <p className={styles.hint} id={hintId}>
        {t(`q.${question.key}.hint`)}
      </p>

      {/* No form action, no handler, no submit: the field is here to be read. */}
      <textarea
        className={styles.textarea}
        id={fieldId}
        name={fieldId}
        rows={question.rows}
        aria-describedby={`${hintId} ${whyId}`}
        defaultValue={
          question.demoAnswerKey ? t(`demoAnswers.${question.demoAnswerKey}`) : undefined
        }
      />

      <WhyWeAsk id={whyId} label={t('labels.why')}>
        {t(`q.${question.key}.why`)}
      </WhyWeAsk>
    </div>
  );
}
