import { signOutAction } from '@/lib/auth/actions';
import styles from './SignOutForm.module.css';

/**
 * Sign out.
 *
 * A form and a submit button, not a link. Signing out changes state on the
 * server - it deletes the session row - and a GET that changes state gets
 * fetched by link prefetchers, by antivirus scanners and by the browser's own
 * speculative loading, which is how people end up mysteriously signed out.
 *
 * No client JavaScript: a Server Action on a plain form.
 */
export default function SignOutForm({ label }: { label: string }) {
  return (
    <form action={signOutAction} className={styles.form}>
      <button type="submit" className={styles.button}>
        {label}
      </button>
    </form>
  );
}
