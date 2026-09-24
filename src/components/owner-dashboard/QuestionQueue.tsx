import { getFormatter, getTranslations } from 'next-intl/server';
import BuyerParty from './BuyerParty';
import {
  ownerProject,
  questionsAnswered,
  questionsAwaitingAnswer,
  type DemoOwnerQuestion,
} from './demo-owner';
import styles from './QuestionQueue.module.css';

/**
 * Open questions from buyers, oldest wait first.
 *
 * The concept note (section 6) gives the question box one rule: a question goes
 * to the project owner and to Sylva, never to a public comment feed. So this is
 * laid out as correspondence in a project file - project, counterparty, date,
 * body - and not as a message stream. The buyer appears under its label for the
 * deal unless it chose to be named.
 *
 * An answer is a separate record, never an edit of the question, which is why an
 * answered question still shows the question above the answer and the date of
 * each. Answered questions are folded into a native <details>: on the page, but
 * not competing with what is still waiting, and no client component to open it.
 *
 * FRONTEND PASS. The reply control is an inert type="button". Writing an answer
 * happens in the question inbox, which this section links to.
 *
 * RULE 7. No unit volume appears here. The only figures are a count of
 * questions and a number of days.
 */
export default async function QuestionQueue({
  questions,
  locale,
}: {
  questions: readonly DemoOwnerQuestion[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const awaiting = [...questionsAwaitingAnswer(questions)].sort(
    (a, b) => b.daysWaiting - a.daysWaiting,
  );
  const answered = questionsAnswered(questions);

  const day = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'short')}</time>
  );

  const projectName = (projectId: string) =>
    ownerProject(projectId)?.name ?? t('owner.questions.unknownProject');

  return (
    <div className={styles.queue}>
      {awaiting.length === 0 ? (
        <p className={styles.empty}>{t('owner.questions.noneWaiting')}</p>
      ) : (
        <ol className={styles.list}>
          {awaiting.map((q) => (
            <li key={q.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.project}>{projectName(q.projectId)}</span>
                <span className={styles.waiting}>
                  {t('owner.questions.waiting', { days: q.daysWaiting })}
                </span>
              </div>

              <p className={styles.body}>{t(q.bodyKey)}</p>

              <div className={styles.itemFoot}>
                <BuyerParty party={q.asker} locale={locale} />
                <span className={styles.asked}>
                  {t('owner.questions.asked')} {day(q.askedOn)}
                </span>
                <button type="button" className={styles.action}>
                  {t('owner.questions.reply')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {answered.length > 0 && (
        <details className={styles.answered}>
          <summary className={styles.answeredSummary}>
            {t('owner.questions.answeredSummary', { count: answered.length })}
          </summary>
          <ol className={styles.list}>
            {answered.map((q) => (
              <li key={q.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.project}>{projectName(q.projectId)}</span>
                  <span className={styles.askedInline}>
                    {t('owner.questions.asked')} {day(q.askedOn)}
                  </span>
                </div>

                <p className={styles.body}>{t(q.bodyKey)}</p>

                {q.answer && (
                  <div className={styles.answer}>
                    <p className={styles.answerBody}>{t(q.answer.bodyKey)}</p>
                    <span className={styles.answerMeta}>
                      {t('owner.questions.answeredBy')} {q.answer.byOrgName}{' '}
                      {t('source.separator')} {day(q.answer.answeredOn)}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
