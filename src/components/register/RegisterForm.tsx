import { getLocale, getTranslations } from 'next-intl/server';
import { registerAction } from '@/lib/auth/actions';
import { authMessage, isAuthErrorCode } from '@/lib/auth/errors';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { registrationReference } from '@/lib/auth/reference';
import Field from './Field';
import RoleChoice from './RoleChoice';
import styles from './RegisterForm.module.css';

/**
 * The registration form: one role, one organisation, one person.
 *
 * The order is deliberate. The role decides what the rest of the registration
 * is for, the organisation is what actually transacts on this platform, and the
 * person is only a way to sign in on its behalf. Putting the person last is the
 * same statement the data model makes: personal data sits in the user account
 * and nothing else, and everything else references the organisation by ID
 * (concept note §9).
 *
 * Wired to identity.register (db/migrations/0040) through a Server Action. One
 * transaction creates org.organisation, identity.user_account,
 * identity.person_label and identity.user_platform_role - and no approval.
 * Registering is not being approved: R6 still refuses this organisation a deal
 * until Sylva records a vetting decision, and the three steps above the form
 * say so.
 *
 * Still a Server Component with no client JavaScript: a plain <form> with an
 * action, uncontrolled fields and native radios.
 *
 * WHERE THE OPTIONS COME FROM. The three lists that also appear beside the
 * organisation's public label - sector, country and size (concept note §8) -
 * are read from platform.sector, platform.eu_member_state and
 * platform.size_band. They used to be hard-coded here with codes like
 * 'food_beverage' and '1_49'; not one of those exists in the reference tables,
 * so every submission would have been refused by a foreign key. Reading them
 * means the labels are translated by whoever owns the codes and a sector added
 * later needs no code change. See src/lib/auth/reference.ts.
 */
export default async function RegisterForm({
  idPrefix,
  errorCode = null,
}: {
  idPrefix: string;
  /** From ?error= on the page. A code, never a message. */
  errorCode?: string | null;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const reference = await registrationReference(locale);

  // An unrecognised code still gets a sentence: 'invalid_input' covers "the
  // form came back rejected" without guessing at which field, and a code this
  // build does not know is treated the same way rather than shown raw.
  const message = errorCode
    ? authMessage(isAuthErrorCode(errorCode) ? errorCode : 'invalid_input')
    : null;
  const errorText = message
    ? (t.has(message.key) ? t(message.key) : message.fallbackEn)
    : null;

  return (
    <form className={styles.form} action={registerAction} aria-label={t('register.form.ariaLabel')} noValidate>
      {errorText ? (
        <div className={styles.requiredNote} role="alert">
          <strong>{errorText}</strong>
        </div>
      ) : null}

      <p className={styles.requiredNote}>{t('register.form.requiredNote')}</p>

      <div className={styles.part}>
        <RoleChoice idPrefix={idPrefix} />
      </div>

      <fieldset className={styles.part}>
        <legend className={styles.legend}>{t('register.org.legend')}</legend>
        <p className={styles.intro}>{t('register.org.intro')}</p>

        <div className={styles.rows}>
          <Field
            id={`${idPrefix}-legal-name`}
            name="legal_name"
            kind="text"
            autoComplete="organization"
            label={t('register.org.legalName.label')}
            hint={t('register.org.legalName.hint')}
          />

          <div className={styles.pair}>
            <Field
              id={`${idPrefix}-registration-number`}
              name="registration_number"
              kind="text"
              autoComplete="off"
              label={t('register.org.regNumber.label')}
              hint={t('register.org.regNumber.hint')}
            />
            <Field
              id={`${idPrefix}-country`}
              name="country"
              kind="select"
              autoComplete="country-name"
              label={t('register.org.country.label')}
              hint={t('register.org.country.hint')}
              options={reference.countries}
              placeholderOption={t('register.form.selectPlaceholder')}
            />
          </div>

          <div className={styles.pair}>
            <Field
              id={`${idPrefix}-sector`}
              name="sector"
              kind="select"
              autoComplete="off"
              label={t('register.org.sector.label')}
              hint={t('register.org.sector.hint')}
              options={reference.sectors}
              placeholderOption={t('register.form.selectPlaceholder')}
            />
            <Field
              id={`${idPrefix}-size`}
              name="size_band"
              kind="select"
              autoComplete="off"
              label={t('register.org.size.label')}
              hint={t('register.org.size.hint')}
              options={reference.sizeBands}
              placeholderOption={t('register.form.selectPlaceholder')}
            />
          </div>

          <Field
            id={`${idPrefix}-address`}
            name="registered_address"
            kind="textarea"
            rows={3}
            autoComplete="street-address"
            label={t('register.org.address.label')}
            hint={t('register.org.address.hint')}
          />
        </div>
      </fieldset>

      <fieldset className={styles.part}>
        <legend className={styles.legend}>{t('register.person.legend')}</legend>
        <p className={styles.intro}>{t('register.person.intro')}</p>

        <div className={styles.rows}>
          <div className={styles.pair}>
            <Field
              id={`${idPrefix}-full-name`}
              name="full_name"
              kind="text"
              autoComplete="name"
              label={t('register.person.fullName.label')}
              hint={t('register.person.fullName.hint')}
            />
            <Field
              id={`${idPrefix}-job-title`}
              name="job_title"
              kind="text"
              autoComplete="organization-title"
              label={t('register.person.jobTitle.label')}
              hint={t('register.person.jobTitle.hint')}
            />
          </div>

          <div className={styles.pair}>
            {/* autocomplete "username": on an account form this is the
                identifier field, and that is the token a password manager
                looks for. */}
            <Field
              id={`${idPrefix}-email`}
              name="email"
              kind="email"
              inputMode="email"
              autoComplete="username"
              label={t('register.person.email.label')}
              hint={t('register.person.email.hint')}
            />
            {/* The only password rule is length. A composition rule makes
                passwords shorter and more guessable, and the hint already asks
                for a phrase. Enforced again in the Server Action. */}
            <Field
              id={`${idPrefix}-password`}
              name="password"
              kind="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              label={t('register.person.password.label')}
              hint={t('register.person.password.hint')}
            />
          </div>
        </div>
      </fieldset>

      <div className={styles.submitRow}>
        <button type="submit" className={styles.submit}>
          {t('register.form.submit')}
        </button>
      </div>
    </form>
  );
}
