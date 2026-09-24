import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { isAnswered, type OwnerQuestion } from '@/lib/owner/types';
import { ownerText } from '@/lib/owner/messages';
import BuyerParty from './BuyerParty';
import styles from './QuestionQueue.module.css';

/**
 * Open questions from buyers, longest wait first.
 *
 * The concept note (section 6) gives the question box one rule: a question goes
 * to the project owner and to Sylva, never to a public comment feed. So this is
 * laid out as correspondence in a project file - project, counterparty, date,
 * body - and not as a message stream. The counterparty appears under its label
 * for the deal, or as its three public attributes where no label has been
 * issued.
 *
 * An answer is a separate append-only row, never an edit of the question, which
 * is why an answered question still shows the question above the answer with
 * the date of each. Answered questions are folded into a native <details>: on
 * the page, but not competing with what is still waiting, and no client
 * component to open it.
 *
 * Replying happens in the inbox, which this section links to. There is no reply
 * control here, because a reply is written against the project's documents and
 * this is a summary rather than a place to write one.
 *
 * RULE 7. No unit volume appears here. The only figures are a count of
 * questions and a number of days.
 */
export default async function QuestionQueue({
  questions,
  locale,
}: {
  questions: readonly OwnerQuestion[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const awaiting = questions.filter((q) => !isAnswered(q))
    .slice()
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
  const answered = questions.filter(isAnswered);

  const day = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'short')}</time>
  );

  return (
    <div className={styles.queue}>
      {awaiting.length === 0 ? (
        <p className={styles.empty}>{t('owner.questions.noneWaiting')}</p>
      ) : (
        <ol className={styles.list}>
          {awaiting.map((q) => (
            <li key={q.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.project}>{q.projectTitle}</span>
                <span className={styles.waiting}>
                  {t('owner.questions.waiting', { days: q.daysWaiting })}
                </span>
              </div>

              <p className={styles.body}>{q.body}</p>

              <div className={styles.itemFoot}>
                <BuyerParty party={q.asker} locale={locale} />
                <span className={styles.asked}>
                  {t('owner.questions.asked')} {day(q.askedOn)}
                </span>
                <Link className={styles.action} href={`/owner/questions#question-${q.id}`}>
                  {t('owner.questions.reply')}
                </Link>
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
                  <span className={styles.project}>{q.projectTitle}</span>
                  <span className={styles.askedInline}>
                    {t('owner.questions.asked')} {day(q.askedOn)}
                  </span>
                </div>

                <p className={styles.body}>{q.body}</p>

                {q.answers.map((a) => (
                  <div key={a.id} className={styles.answer}>
                    <p className={styles.answerBody}>{a.body}</p>
                    <span className={styles.answerMeta}>
                      {t('owner.questions.answeredBy')}{' '}
                      {a.byOrgName ?? ownerText(t, 'notStated')}{' '}
                      {t('source.separator')} {day(a.answeredOn)}
                    </span>
                  </div>
                ))}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
