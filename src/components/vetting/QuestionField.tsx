import { getTranslations } from 'next-intl/server';
import WhyWeAsk from './WhyWeAsk';
import { orFallback, questionLabels } from './labels';
import type { AnswerValue, VettingQuestion } from '@/lib/vetting/types';
import styles from './Question.module.css';

/**
 * One question, rendered from the row that defines it.
 *
 * Everything structural comes from org.question: the code, the position, the
 * prompt, whether it is required, and - the important one - answer_kind, which
 * decides the control. Nothing here has a list of questions in it, so adding a
 * ninth question to the database adds it to this page.
 *
 * Field naming is the contract with src/lib/vetting/actions.ts:
 *
 *     answer.<question_code>
 *
 * and nothing else is read from the form. There is no hidden questionnaire id,
 * no hidden organisation and no hidden "required" flag, because the action
 * re-reads all three from the database.
 *
 * Still a Server Component: the controls are uncontrolled, the values come from
 * the saved draft or the submitted answers as defaultValue/defaultChecked, and
 * the form posts to a Server Action. No client bundle.
 */
export default async function QuestionField({
  question,
  n,
  total,
  answer,
  missing = false,
  readOnly = false,
}: {
  question: VettingQuestion;
  n: number;
  total: number;
  answer: AnswerValue | undefined;
  /** Required, and not answered on the attempt that was just refused. */
  missing?: boolean;
  /** A submitted questionnaire is shown, not re-typed. */
  readOnly?: boolean;
}) {
  const t = await getTranslations('vettingForm');
  const labels = questionLabels(t, question);

  const id = question.questionCode;
  const fieldId = `answer-${id}`;
  const fieldName = `answer.${id}`;
  const hintId = `${fieldId}-hint`;
  const whyId = `${fieldId}-why`;
  const missingId = `${fieldId}-missing`;

  const described = [
    labels.hint ? hintId : null,
    labels.why ? whyId : null,
    missing ? missingId : null,
  ].filter((x): x is string => x !== null).join(' ');

  const kicker = (
    <>
      <span aria-hidden="true">
        {t('labels.questionShort')}
        {n}
      </span>
      <span className="visually-hidden">
        {t('labels.questionNumber', { n, total })}
      </span>
    </>
  );

  const marker = (
    <span className={styles.marker}>
      {question.isRequired ? t('labels.required') : t('labels.optional')}
    </span>
  );

  const notice = missing ? (
    <p className={styles.missing} id={missingId}>
      {orFallback(
        t,
        'error.questionMissing',
        'This question has to be answered before the questionnaire can be submitted.',
      )}
    </p>
  ) : null;

  const why = labels.why ? (
    <WhyWeAsk id={whyId} label={t('labels.why')}>
      {labels.why}
    </WhyWeAsk>
  ) : null;

  const hint = labels.hint ? (
    <p className={styles.hint} id={hintId}>
      {labels.hint}
    </p>
  ) : null;

  /* ---------------------------------------------------------- yes / no */
  if (question.answerKind === 'boolean') {
    const options = [
      { value: 'yes', label: t('labels.yes'), checked: answer?.boolean === true },
      { value: 'no', label: t('labels.no'), checked: answer?.boolean === false },
    ] as const;

    return (
      // A radio group is labelled by a legend, not by a label element.
      <fieldset className={styles.group} id={id}>
        <legend className={styles.legend}>
          <span className={styles.kickerInline}>{kicker}</span>
          {labels.label}
          {marker}
        </legend>
        {hint}
        {notice}
        <div className={styles.choices}>
          {options.map((option) => (
            <label
              key={option.value}
              className={styles.choice}
              htmlFor={`${fieldId}-${option.value}`}
            >
              <input
                type="radio"
                id={`${fieldId}-${option.value}`}
                name={fieldName}
                value={option.value}
                defaultChecked={option.checked}
                disabled={readOnly}
                aria-describedby={described || undefined}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {why}
      </fieldset>
    );
  }

  /* ------------------------------------------------------------ number */
  if (question.answerKind === 'number') {
    return (
      <div className={styles.question} id={id}>
        <p className={styles.kicker}>{kicker}</p>
        <label className={styles.label} htmlFor={fieldId}>
          {labels.label}
          {marker}
        </label>
        {hint}
        {notice}
        <input
          className={styles.input}
          type="text"
          inputMode="decimal"
          id={fieldId}
          name={fieldName}
          readOnly={readOnly}
          defaultValue={answer?.numeric ?? ''}
          aria-describedby={described || undefined}
        />
        {why}
      </div>
    );
  }

  /* ------------------------------------------- choice and file: not built */
  if (question.answerKind === 'choice' || question.answerKind === 'file') {
    // A question Sylva has published that this release cannot collect. Saying
    // so is the only honest option: rendering it as a text box would store an
    // answer of the wrong kind, and hiding it would let an incomplete
    // questionnaire look complete.
    return (
      <div className={styles.question} id={id}>
        <p className={styles.kicker}>{kicker}</p>
        <p className={styles.label}>
          {labels.label}
          {marker}
        </p>
        {hint}
        {/* If the submit path just refused BECAUSE of this question, say so
            here too. Without it the person reads "some required questions have
            not been answered", looks down the page, sees every box filled, and
            has no way to discover that the blocking question is one this
            release cannot collect at all. */}
        {notice}
        <p className={styles.unsupported}>
          {orFallback(
            t,
            'error.unsupportedKind',
            'This question cannot be answered on this page yet. '
            + 'Sylva will ask for it directly.',
          )}
        </p>
        {why}
      </div>
    );
  }

  /* ------------------------------------------------- text and longtext */
  // Both are textareas. org.question.answer_kind distinguishes them, but every
  // question in the published set asks for a paragraph - "describe your
  // organisation's approach to sustainability" is not a one-line answer - so
  // 'text' gets a smaller box rather than a single-line input.
  const rows = question.answerKind === 'longtext' ? 8 : 5;

  return (
    <div className={styles.question} id={id}>
      <p className={styles.kicker}>{kicker}</p>
      <label className={styles.label} htmlFor={fieldId}>
        {labels.label}
        {marker}
      </label>
      {hint}
      {notice}
      <textarea
        className={styles.textarea}
        id={fieldId}
        name={fieldName}
        rows={rows}
        readOnly={readOnly}
        defaultValue={answer?.text ?? ''}
        aria-describedby={described || undefined}
      />
      {why}
    </div>
  );
}
