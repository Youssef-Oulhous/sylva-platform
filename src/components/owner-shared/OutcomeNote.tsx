import { getTranslations } from 'next-intl/server';
import { isOwnerErrorCode, resolveOwnerMessage } from '@/lib/owner/errors';
import { ownerText, type OwnerTextCode } from '@/lib/owner/messages';
import styles from './OutcomeNote.module.css';

/**
 * What happened to the last thing this person submitted.
 *
 * A Server Action ends in a redirect carrying a CODE, never a message and never
 * anything the person typed: a sentence in a URL is a sentence in a server log,
 * and a value in a URL is a value in a browser history. This component turns
 * the code back into a sentence.
 *
 * It has role="status" so a screen reader announces it on arrival - the page
 * has navigated, so there is nothing else to tell a non-sighted reader that the
 * save either worked or did not. It is never colour alone: the heading states
 * "Recorded" or "This was not recorded" in words, and the tint repeats it.
 *
 * An unrecognised code renders nothing rather than guessing, because a
 * fabricated reassurance is worse than silence.
 */
export default async function OutcomeNote({
  error,
  saved,
  savedText = 'saved',
}: {
  error?: string;
  saved?: string;
  /** Which sentence a success shows. Sections differ in what "done" means. */
  savedText?: OwnerTextCode;
}) {
  const t = await getTranslations();

  if (error && isOwnerErrorCode(error)) {
    return (
      <div className={`${styles.note} ${styles.error}`} role="status">
        <p className={styles.heading}>{ownerText(t, 'notSaved')}</p>
        <p className={styles.body}>{resolveOwnerMessage(t, error)}</p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className={`${styles.note} ${styles.ok}`} role="status">
        <p className={styles.body}>{ownerText(t, savedText)}</p>
      </div>
    );
  }

  return null;
}
