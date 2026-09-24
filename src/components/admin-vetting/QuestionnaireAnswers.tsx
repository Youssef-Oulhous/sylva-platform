import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  ANSWER_TOTAL,
  DEMO_ANSWER_PARTS,
  QUESTIONNAIRE_SOURCE,
} from './demo-queue';
import styles from './QuestionnaireAnswers.module.css';

/**
 * The submitted questionnaire, in full, in the order it was asked.
 *
 * Nothing is truncated and nothing is behind a disclosure control. Vetting is
 * the operator's main safeguard against greenwashing (concept note section 7);
 * an answer a reviewer has to expand is an answer a reviewer skips.
 *
 * The three conditions at the end print the word answered - Yes or No - before
 * the detail, because they are conditions rather than descriptions and the word
 * is what a decision turns on. They are grouped under their own heading with a
 * note saying why they are read together, and no judgement is attached to any
 * answer: flagging an answer as a concern would be this screen inventing a
 * vetting rule the client has not written.
 */
export default async function QuestionnaireAnswers({ headingId }: { headingId: string }) {
  const t = await getTranslations();

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminVetting.answersTitle')}</h3>
        <p className={styles.lead}>
          {t('adminVetting.answersLead', { count: ANSWER_TOTAL })}
        </p>
        <SourceStamp
          source={{
            label: t(QUESTIONNAIRE_SOURCE.labelKey),
            locator: QUESTIONNAIRE_SOURCE.locator,
            asOfDate: QUESTIONNAIRE_SOURCE.asOfDate,
          }}
        />
      </div>

      {DEMO_ANSWER_PARTS.map((part) => (
        <section key={part.id} className={styles.part} aria-labelledby={`${part.id}-title`}>
          <h4 id={`${part.id}-title`} className={styles.partTitle}>
            {t(part.titleKey)}
          </h4>
          <p className={styles.partNote}>{t(part.noteKey)}</p>

          <ol className={styles.answers}>
            {part.answers.map((answer) => (
              <li key={answer.id} className={styles.answer}>
                <p className={styles.question}>
                  <span className={styles.qNum} aria-hidden="true">
                    {String(answer.n).padStart(2, '0')}
                  </span>
                  {t(`adminVetting.q.${answer.questionKey}`)}
                </p>

                {answer.yesNo && (
                  <p className={styles.yesNo}>
                    <span className={styles.yesNoLabel}>
                      {t('adminVetting.answered')}
                    </span>
                    <strong className={styles.yesNoWord}>
                      {t(`adminVetting.yesNo.${answer.yesNo}`)}
                    </strong>
                  </p>
                )}

                <p className={styles.body}>{t(`adminVetting.answers.${answer.answerKey}`)}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}
