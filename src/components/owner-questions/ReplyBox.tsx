import { getTranslations } from 'next-intl/server';
import { answerQuestionAction } from '@/lib/owner/actions';
import { ownerText } from '@/lib/owner/messages';
import styles from './ReplyBox.module.css';

/**
 * The reply box. It writes.
 *
 * A plain <form action={…}> over a Server Action, so there is no client
 * component here and no JavaScript bundle: the page works with scripting turned
 * off, which is what the rest of this codebase does and what a document-like
 * interface should do.
 *
 * The two notes under the field are not decoration. An owner about to type into
 * this box needs to know, at the point of typing, that Sylva reads the reply,
 * that nothing typed here is published, and that a reply cannot be taken back -
 * deal.project_question_answer is append-only, so a correction is a further
 * reply and the first one stays on the record. Putting any of that behind a
 * disclosure control would be putting it where it is not read.
 *
 * The question id travels in a hidden field and is validated server-side
 * against the row policy, which admits only questions asked of this
 * organisation. A tampered id is refused by the database, not by this form.
 */
export default async function ReplyBox({
  questionId,
  variant = 'reply',
}: {
  questionId: string;
  variant?: 'reply' | 'further';
}) {
  const t = await getTranslations();
  const tq = await getTranslations('ownerQuestions');

  const fieldId = `reply-${questionId}-${variant}`;
  const hintId = `${fieldId}-hint`;
  const appendId = `${fieldId}-append`;

  return (
    <form className={styles.box} action={answerQuestionAction}>
      <input type="hidden" name="question_id" value={questionId} />

      <label className={styles.label} htmlFor={fieldId}>
        {variant === 'further' ? tq('reply.furtherLabel') : tq('reply.label')}
      </label>

      <p className={styles.hint} id={hintId}>
        {tq('reply.hint')}
      </p>

      <textarea
        className={styles.textarea}
        id={fieldId}
        name="body"
        rows={5}
        required
        maxLength={8000}
        aria-describedby={`${hintId} ${appendId}`}
      />

      <p className={styles.visibility}>{tq('reply.visibility')}</p>

      <div className={styles.actions}>
        <button type="submit" className={styles.send}>
          {ownerText(t, 'replySend')}
        </button>
      </div>

      <p id={appendId} className={styles.inertNote}>
        {ownerText(t, 'replyAppendNote')}
      </p>
    </form>
  );
}
