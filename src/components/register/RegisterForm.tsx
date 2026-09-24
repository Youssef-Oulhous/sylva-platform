import { getTranslations } from 'next-intl/server';
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
 * FRONTEND PASS. The form has no `action`, the submit control is a
 * `type="button"` so nothing is ever sent, and every field is uncontrolled -
 * so the whole form, radios included, stays a Server Component. There is no
 * validation here: the messages a real submission would produce depend on rules
 * that do not exist yet, and inventing them now would mean writing copy that
 * has to be thrown away.
 */

/**
 * DEMO / PROVISIONAL LISTS. Option sets for the three fields that also appear
 * beside the organisation's public label (concept note §8: sector, country and
 * size). The final lists come from the client; these are here so the form can
 * be read and reviewed. They are translated values, never stored strings.
 */
const SECTOR_OPTIONS = [
  { value: 'food_beverage', labelKey: 'register.sector.foodBeverage' },
  { value: 'energy_utilities', labelKey: 'register.sector.energyUtilities' },
  { value: 'water_utility', labelKey: 'register.sector.waterUtility' },
  { value: 'manufacturing', labelKey: 'register.sector.manufacturing' },
  { value: 'banking_investment', labelKey: 'register.sector.bankingInvestment' },
  { value: 'public_sector', labelKey: 'register.sector.publicSector' },
  { value: 'foundation', labelKey: 'register.sector.foundation' },
  { value: 'other', labelKey: 'register.sector.other' },
] as const;

const COUNTRY_OPTIONS = [
  { value: 'DK', labelKey: 'register.country.dk' },
  { value: 'DE', labelKey: 'register.country.de' },
  { value: 'ES', labelKey: 'register.country.es' },
  { value: 'FR', labelKey: 'register.country.fr' },
  { value: 'IE', labelKey: 'register.country.ie' },
  { value: 'NL', labelKey: 'register.country.nl' },
  { value: 'PL', labelKey: 'register.country.pl' },
  { value: 'SE', labelKey: 'register.country.se' },
  { value: 'other', labelKey: 'register.country.other' },
] as const;

/**
 * Size is a band, not a headcount: the band is what appears in public beside
 * the organisation's label, and a precise headcount would identify the
 * organisation more readily than a pseudonym is meant to allow.
 */
const SIZE_OPTIONS = [
  { value: '1_49', labelKey: 'register.size.s1' },
  { value: '50_249', labelKey: 'register.size.s2' },
  { value: '250_999', labelKey: 'register.size.s3' },
  { value: '1000_4999', labelKey: 'register.size.s4' },
  { value: '5000_plus', labelKey: 'register.size.s5' },
] as const;

export default async function RegisterForm({ idPrefix }: { idPrefix: string }) {
  const t = await getTranslations();
  const submitNoteId = `${idPrefix}-submit-note`;
  const options = (list: readonly { value: string; labelKey: string }[]) =>
    list.map((option) => ({ value: option.value, label: t(option.labelKey) }));

  return (
    <form className={styles.form} aria-label={t('register.form.ariaLabel')} noValidate>
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
              options={options(COUNTRY_OPTIONS)}
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
              options={options(SECTOR_OPTIONS)}
              placeholderOption={t('register.form.selectPlaceholder')}
            />
            <Field
              id={`${idPrefix}-size`}
              name="size_band"
              kind="select"
              autoComplete="off"
              label={t('register.org.size.label')}
              hint={t('register.org.size.hint')}
              options={options(SIZE_OPTIONS)}
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
            <Field
              id={`${idPrefix}-password`}
              name="password"
              kind="password"
              autoComplete="new-password"
              label={t('register.person.password.label')}
              hint={t('register.person.password.hint')}
            />
          </div>
        </div>
      </fieldset>

      <div className={styles.submitRow}>
        {/* type="button": this build has no account creation behind it, and a
            submit control that appeared to work would be a lie about state.
            Not aria-disabled - the control looks live to a sighted reviewer, so
            marking it unavailable to a screen reader would describe a different
            button. The note is tied to it with aria-describedby instead, so it
            is read out on focus. */}
        <button type="button" className={styles.submit} aria-describedby={submitNoteId}>
          {t('register.form.submit')}
        </button>
        <p id={submitNoteId} className={styles.submitNote}>
          {t('register.form.submitNote')}
        </p>
      </div>
    </form>
  );
}
