import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { signInAction } from '@/lib/auth/actions';
import { authMessage, type AuthErrorCode } from '@/lib/auth/errors';
import Field from './Field';
import styles from './SignInForm.module.css';

/**
 * The sign-in form.
 *
 * Wired to src/lib/auth/actions.ts. No client JavaScript: a plain <form> with a
 * Server Action, which means it works before hydration and without it, and the
 * two fields never exist in a client bundle.
 *
 * There is no third-party sign-in of any kind. The client asked for none, and
 * the concept note (§9) keeps personal data inside the EU and out of third
 * parties' hands, which a social identity provider would not do.
 *
 * What the error says, and what it does not: "That email address and password
 * do not match an account", for a wrong password AND for an address with no
 * account. Saying which was wrong would turn this form into a way to find out
 * who has an account here, and on a platform where participation is
 * pseudonymous by default that is exactly what must not leak. The database
 * agrees: identity.auth_salt hands back a decoy salt for an unknown address so
 * the two attempts cost the same (db/migrations/0040).
 *
 * The email is not echoed back on failure either. It would have to travel in
 * the URL to get here, and an email address in a query string ends up in every
 * access log between the browser and the server.
 */
export default async function SignInForm({
  idPrefix,
  formLabel,
  errorCode = null,
  nextPath,
}: {
  idPrefix: string;
  /** Labels the form for assistive technology. */
  formLabel: string;
  /** Present renders the error state. */
  errorCode?: AuthErrorCode | null;
  /** Where to go after signing in. Validated server-side before it is used. */
  nextPath?: string;
}) {
  const t = await getTranslations();
  const message = errorCode ? authMessage(errorCode) : null;
  // The message catalogue is owned by another agent; until the key lands the
  // fallback sentence shows, rather than the raw key.
  const errorText = message
    ? (t.has(message.key) ? t(message.key) : message.fallbackEn)
    : null;

  return (
    <form className={styles.form} action={signInAction} aria-label={formLabel} noValidate>
      {errorText ? (
        /* Form-level message above the fields: a reader who has just failed to
           sign in should not have to find the reason among them. role="alert"
           because this block is the RESULT of an action now, not a specimen. */
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>{t('signIn.error.title')}</p>
          <p className={styles.bannerBody}>{errorText}</p>
        </div>
      ) : null}

      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      <div className={styles.fields}>
        {/* type="email" for the keyboard and the parser; autocomplete
            "username" because on a sign-in form this is the identifier field,
            which is the token a password manager looks for. */}
        <Field
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          label={t('signIn.email')}
          hint={t('signIn.emailHint')}
        />

        <Field
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          label={t('signIn.password')}
          action={
            <Link href="/forgotten-password" className={styles.forgotten}>
              {t('signIn.forgotten')}
            </Link>
          }
        />
      </div>

      <button type="submit" className={styles.submit}>
        {t('nav.signIn')}
      </button>
    </form>
  );
}
