import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { label, labelWith, QUESTIONS } from '@/lib/admin/labels';
import type { OperatorQuestion } from '@/lib/admin/questions';
import styles from './AdminArea.module.css';

/**
 * One question, with the owner's answer where there is one.
 *
 * Not a table: a question is prose and so is its answer, and a wide row of
 * truncated cells is how an operator ends up answering an audit query from an
 * excerpt. The facts that ARE scannable - project, asker, dates, waiting time -
 * sit in a definition list above the words.
 *
 * The asker is shown twice on purpose: the label it appears under on the record,
 * and its registered name. An operator arriving from the record has the label
 * and needs the name; an operator arriving from the vetting queue has the name
 * and needs the label. Printing one only would send them to the other screen.
 */
export default async function QuestionThread({
  question,
  headingId,
}: {
  question: OperatorQuestion;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const day = (iso: string) => (
    <time dateTime={iso} className={styles.mono}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  return (
    <article className={styles.thread} aria-labelledby={headingId}>
      <div className={styles.threadHead}>
        <h3 id={headingId} className={styles.threadTitle}>{question.projectTitle}</h3>
        <span
          className={`${styles.tag} ${question.answers.length === 0 ? styles.tagPrivate : styles.tagPublic}`}
        >
          {question.answers.length === 0
            ? label(t, QUESTIONS.unanswered)
            : labelWith(t, QUESTIONS.answerCount, { count: question.answers.length })}
        </span>
      </div>

      <dl className={styles.pairs}>
        <dt>{label(t, QUESTIONS.askedBy)}</dt>
        <dd>
          {question.askerName}
          <span className={styles.sub}>
            {question.askerSector} · {question.askerCountry}
          </span>
        </dd>

        <dt>{label(t, QUESTIONS.askerLabel)}</dt>
        <dd>
          {question.askerLabel !== null ? (
            <span className={styles.mono}>{question.askerLabel}</span>
          ) : (
            <span className={styles.muted}>{label(t, QUESTIONS.askerLabelNone)}</span>
          )}
        </dd>

        <dt>{label(t, QUESTIONS.owner)}</dt>
        <dd>{question.ownerName}</dd>

        <dt>{label(t, QUESTIONS.asked)}</dt>
        <dd>
          {day(question.askedOn)}
          {question.answers.length === 0 && (
            <span className={styles.sub}>
              {labelWith(t, QUESTIONS.waiting, {
                days: labelWith(t, QUESTIONS.waitingDays, { count: question.waitingDays }),
              })}
            </span>
          )}
        </dd>
      </dl>

      <p className={styles.body}>{question.body}</p>

      {question.answers.map((a) => (
        <div key={a.answerId} className={styles.answer}>
          <p className={styles.answerMeta}>
            {label(t, QUESTIONS.answeredBy)}: {a.answeredByName}
            {a.answeredByOwner ? ` (${label(t, QUESTIONS.owner)})` : ''} ·{' '}
            {label(t, QUESTIONS.answered)}: {day(a.answeredOn)}
          </p>
          <p className={styles.body}>{a.body}</p>
        </div>
      ))}

      <p className={styles.more}>
        <Link href={`/projects/${question.projectSlug}`}>
          {label(t, QUESTIONS.viewProject)}
        </Link>
      </p>
    </article>
  );
}
