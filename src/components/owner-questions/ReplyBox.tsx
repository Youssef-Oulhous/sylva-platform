import { getTranslations } from 'next-intl/server';
import styles from './ReplyBox.module.css';

/**
 * The reply box.
 *
 * FRONTEND PASS. There is no <form>, no action and no handler, so nothing can be
 * sent and the component stays a Server Component. The field is uncontrolled; a
 * saved draft is rendered as its defaultValue. Both controls are type="button",
 * left enabled and marked aria-disabled, and both are described by the note that
 * says why - removing them would hide from a keyboard reader that the actions
 * exist at all.
 *
 * The two notes under the field are not decoration. An owner about to type into
 * this box needs to know, at the point of typing, that the operator reads the
 * reply and that nothing typed here is published. Putting that behind a
 * disclosure control would be putting it where it is not read.
 */
export default async function ReplyBox({
  questionRef,
  draftKey,
  variant = 'reply',
}: {
  questionRef: string;
  /** i18n key for an unsent draft, or null when there is none. */
  draftKey?: string | null;
  variant?: 'reply' | 'further';
}) {
  const t = await getTranslations('ownerQuestions');

  const fieldId = `reply-${questionRef}-${variant}`;
  const hintId = `${fieldId}-hint`;
  const inertId = `${fieldId}-inert`;
  const draftId = `${fieldId}-draft`;

  const describedBy = draftKey
    ? `${hintId} ${draftId} ${inertId}`
    : `${hintId} ${inertId}`;

  return (
    <div className={styles.box}>
      <label className={styles.label} htmlFor={fieldId}>
        {variant === 'further' ? t('reply.furtherLabel') : t('reply.label')}
      </label>

      <p className={styles.hint} id={hintId}>
        {t('reply.hint')}
      </p>

      {draftKey && (
        <p className={styles.draftNote} id={draftId}>
          {t('reply.draftNote')}
        </p>
      )}

      <textarea
        className={styles.textarea}
        id={fieldId}
        name={fieldId}
        rows={draftKey ? 6 : 5}
        aria-describedby={describedBy}
        defaultValue={draftKey ? t(draftKey) : undefined}
      />

      <p className={styles.visibility}>{t('reply.visibility')}</p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.send}
          aria-disabled="true"
          aria-describedby={inertId}
        >
          {t('reply.send')}
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-disabled="true"
          aria-describedby={inertId}
        >
          {t('reply.saveDraft')}
        </button>
      </div>

      <p id={inertId} className={styles.inertNote}>
        {t('reply.inertNote')}
      </p>
    </div>
  );
}
