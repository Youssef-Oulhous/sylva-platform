import { getTranslations } from 'next-intl/server';
import styles from './AccessRequestForm.module.css';

const ORG_TYPES = ['bank', 'fund', 'insurer', 'other'] as const;

/**
 * The access request, as a form that does nothing.
 *
 * FRONTEND PASS: there is no action, no handler and no server action on this
 * form, and the button is type="button" so nothing can be submitted by accident.
 * It is a real form with real labels because the fields are what has to be
 * reviewed now; wiring it up is a later step, and the note above the button
 * says so instead of the interface implying otherwise.
 *
 * What is NOT asked here: the vetting questionnaire itself. The concept note
 * does not set out what is collected from an investor organisation, so this
 * form asks only who is asking and what they want to look at.
 */
export default async function AccessRequestForm() {
  const t = await getTranslations('forInvestors.form');

  return (
    <form className={styles.form} aria-label={t('title')}>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="investor-org" className={styles.label}>
            {t('org')}
          </label>
          <input
            id="investor-org"
            name="organisation"
            type="text"
            autoComplete="organization"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="investor-org-type" className={styles.label}>
            {t('orgType')}
          </label>
          <select id="investor-org-type" name="organisationType" className={styles.input}>
            {ORG_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`orgTypeOption.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="investor-country" className={styles.label}>
            {t('country')}
          </label>
          <input
            id="investor-country"
            name="country"
            type="text"
            autoComplete="country-name"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="investor-contact" className={styles.label}>
            {t('contact')}
          </label>
          <input
            id="investor-contact"
            name="contact"
            type="text"
            autoComplete="name"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="investor-email" className={styles.label}>
            {t('email')}
          </label>
          <input
            id="investor-email"
            name="email"
            type="email"
            autoComplete="email"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="investor-projects" className={styles.label}>
          {t('projects')}
        </label>
        <textarea
          id="investor-projects"
          name="projects"
          rows={3}
          className={styles.textarea}
          aria-describedby="investor-projects-hint"
        />
        <p id="investor-projects-hint" className={styles.hint}>
          {t('projectsHint')}
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="investor-note" className={styles.label}>
          {t('note')}
        </label>
        <textarea id="investor-note" name="note" rows={3} className={styles.textarea} />
      </div>

      <p className={styles.dataNote}>{t('dataNote')}</p>

      <div className={styles.actions}>
        {/* type="button": this form submits nothing in this pass. */}
        <button type="button" className={styles.submit}>
          {t('submit')}
        </button>
        <p className={styles.inertNote}>{t('inertNote')}</p>
      </div>
    </form>
  );
}
