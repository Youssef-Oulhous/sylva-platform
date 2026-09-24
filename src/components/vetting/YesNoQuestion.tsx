import { getTranslations } from 'next-intl/server';
import WhyWeAsk from './WhyWeAsk';
import { QUESTION_TOTAL, type VettingQuestion } from './vetting-data';
import styles from './Question.module.css';

/**
 * One yes/no question, plus an optional field for the detail behind the answer.
 *
 * These three are conditions rather than descriptions - whether units would be
 * resold instead of retired, whether the benefit would be presented as an
 * offset, whether exclusive claim rights are required - so they are radios and
 * not a text field. An open field here would collect a paragraph that still did
 * not say yes or no, and all three change the shape of a deal.
 *
 * Neither option is pre-selected: a default answer to a question this
 * consequential would be the platform answering on the buyer's behalf.
 *
 * FRONTEND PASS. Uncontrolled inputs, no handler, no submit.
 */
export default async function YesNoQuestion({
  question,
}: {
  question: VettingQuestion;
}) {
  const t = await getTranslations('vettingForm');

  const groupName = `${question.id}-answer`;
  const hintId = `${groupName}-hint`;
  const whyId = `${groupName}-why`;
  const detailId = `${question.id}-detail`;
  const detailHintId = `${detailId}-hint`;

  const options = [
    { value: 'yes', label: t('labels.yes') },
    { value: 'no', label: t('labels.no') },
  ] as const;

  return (
    /* A radio group is labelled by a legend, not by a label element. */
    <fieldset className={styles.group} id={question.id}>
      <legend className={styles.legend}>
        <span className={styles.kickerInline} aria-hidden="true">
          {t('labels.questionShort')}
          {question.n}
        </span>
        <span className="visually-hidden">
          {t('labels.questionNumber', { n: question.n, total: QUESTION_TOTAL })}
        </span>
        {t(`q.${question.key}.label`)}
        <span className={styles.marker}>{t('labels.required')}</span>
      </legend>

      <p className={styles.hint} id={hintId}>
        {t(`q.${question.key}.hint`)}
      </p>

      <div className={styles.choices}>
        {options.map((option) => (
          <label
            key={option.value}
            className={styles.choice}
            htmlFor={`${groupName}-${option.value}`}
          >
            <input
              type="radio"
              id={`${groupName}-${option.value}`}
              name={groupName}
              value={option.value}
              aria-describedby={`${hintId} ${whyId}`}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <div className={styles.followUp}>
        <label className={styles.followUpLabel} htmlFor={detailId}>
          {t(`q.${question.key}.followUpLabel`)}
          <span className={styles.marker}>{t('labels.optional')}</span>
        </label>
        <p className={styles.hint} id={detailHintId}>
          {t(`q.${question.key}.hintFollowUp`)}
        </p>
        <textarea
          className={styles.textarea}
          id={detailId}
          name={detailId}
          rows={question.rows}
          aria-describedby={detailHintId}
        />
      </div>

      <WhyWeAsk id={whyId} label={t('labels.why')}>
        {t(`q.${question.key}.why`)}
      </WhyWeAsk>
    </fieldset>
  );
}
