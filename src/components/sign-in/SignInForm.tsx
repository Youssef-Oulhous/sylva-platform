import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Field from './Field';
import styles from './SignInForm.module.css';

/**
 * The sign-in form.
 *
 * FRONTEND PASS. There is no authentication behind this. The form has no
 * action, the button is a `type="button"` so nothing is ever submitted, and the
 * error state is a rendered specimen rather than the result of a check. Nothing
 * here reads a database, calls a server action or inspects a session.
 *
 * Two identity fields, and no third-party sign-in of any kind: the client asked
 * for none, and the concept note (§9) keeps personal data inside the EU and out
 * of third-party hands, which a social identity provider would not do.
 *
 * The component is rendered twice on the page - once live, once as the error
 * specimen - so every id is derived from `idPrefix`.
 */
export default async function SignInForm({
  idPrefix,
  formLabel,
  errorState = null,
}: {
  idPrefix: string;
  /** Labels the form for assistive technology. */
  formLabel: string;
  /** Present renders the error state. `rejectedEmail` is the entry shown back. */
  errorState?: { rejectedEmail: string } | null;
}) {
  const t = await getTranslations();
  const inError = errorState !== null;

  return (
    <form className={styles.form} aria-label={formLabel} noValidate>
      {inError ? (
        /* Form-level message above the fields, because a reader who has just
           failed to sign in should not have to find the reason among them.
           When authentication is wired up this block needs role="alert" and the
           focus moved to it; as static demo content it must not announce. */
        <div className={styles.banner}>
          <p className={styles.bannerTitle}>{t('signIn.error.title')}</p>
          <p className={styles.bannerBody}>{t('signIn.error.body')}</p>
        </div>
      ) : null}

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
          defaultValue={errorState?.rejectedEmail}
          readOnly={inError}
          error={inError ? t('signIn.error.email') : undefined}
          errorPrefix={t('signIn.error.prefix')}
        />

        <Field
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          readOnly={inError}
          label={t('signIn.password')}
          action={
            <Link href="/forgotten-password" className={styles.forgotten}>
              {t('signIn.forgotten')}
            </Link>
          }
        />
      </div>

      {/* A real button, and deliberately not a submit: the client asked for the
          pages first and the functions later. */}
      <button type="button" className={styles.submit}>
        {t('nav.signIn')}
      </button>
    </form>
  );
}
