import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { adminText } from '@/lib/admin/messages';
import { isAnswered, type AdminAnswer, type AdminVettingApplication } from '@/lib/admin/types';
import styles from './QuestionnaireAnswers.module.css';

/**
 * The submitted questionnaire, in full, in the order it was asked.
 *
 * Nothing is truncated and nothing is behind a disclosure control. Vetting is
 * the operator's main safeguard against greenwashing (concept note section 7);
 * an answer a reviewer has to expand is an answer a reviewer skips.
 *
 * THE QUESTIONS ARE DATA. They come from `org.question` for the questionnaire
 * this application was submitted against, in `sort_order`, with the prompts
 * that questionnaire actually asked. Nothing here hardcodes a question set, so
 * a new questionnaire version renders without a code change and an application
 * submitted against an older version still renders the questions it was asked.
 *
 * A boolean answer prints its word - Yes or No - before anything else, because
 * those questions are conditions rather than descriptions and the word is what
 * a decision turns on. No judgement is attached to any answer: flagging one as
 * a concern would be this screen inventing a vetting rule the client has not
 * written (RULE J).
 *
 * A question with no answer says so rather than rendering an empty paragraph.
 * An optional question left blank is a fact about the application.
 */
function answerBody(a: AdminAnswer): string | null {
  if (a.text !== null && a.text.trim() !== '') return a.text;
  if (a.numeric !== null && a.numeric.trim() !== '') return a.numeric;
  return null;
}

export default async function QuestionnaireAnswers({
  application,
  headingId,
}: {
  application: AdminVettingApplication;
  headingId: string;
}) {
  const t = await getTranslations();
  const { answers } = application;

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminVetting.answersTitle')}</h3>
        <p className={styles.lead}>
          {t('adminVetting.answersLead', { count: answers.length })}
        </p>
        <SourceStamp
          source={{
            label: t('adminVetting.answerSource'),
            locator: null,
            asOfDate: application.submittedOn,
          }}
        />
      </div>

      <ol className={styles.answers}>
        {answers.map((a, i) => {
          const body = answerBody(a);
          return (
            <li key={a.questionCode} className={styles.answer}>
              <p className={styles.question}>
                <span className={styles.qNum} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {a.promptEn}
                {a.isRequired && (
                  <span className="visually-hidden"> {adminText(t, 'answerRequired')}</span>
                )}
              </p>

              {a.boolean !== null && (
                <p className={styles.yesNo}>
                  <span className={styles.yesNoLabel}>{t('adminVetting.answered')}</span>
                  <strong className={styles.yesNoWord}>
                    {a.boolean ? t('adminVetting.yesNo.yes') : t('adminVetting.yesNo.no')}
                  </strong>
                </p>
              )}

              {body !== null ? (
                <p className={styles.body}>{body}</p>
              ) : (
                !isAnswered(a) && (
                  <p className={styles.body}>{adminText(t, 'notAnswered')}</p>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
