import { getTranslations } from 'next-intl/server';
import SiteField from './SiteField';
import { SITE_COUNTRY_CODES } from './demo-sites';
import styles from './AddSiteForm.module.css';

/**
 * Add a site to the register.
 *
 * FRONTEND PASS. The form has no action, the button is a `type="button"` so
 * nothing is ever submitted, and nothing on this page validates, saves or
 * geocodes anything. The fields, their labels, their hints and their ranges are
 * the deliverable.
 *
 * Latitude and longitude sit in a fieldset with a legend because they are one
 * piece of information entered in two boxes; a screen reader hears "Coordinates,
 * latitude" rather than a bare "latitude" floating between a country list and a
 * notes box. The ranges are the ranges of the coordinate system, not a rule
 * about where a site may be.
 */
export default async function AddSiteForm({
  idPrefix,
  formLabel,
}: {
  /** Prefixes every id. The page renders no second copy, but the register will. */
  idPrefix: string;
  formLabel: string;
}) {
  const t = await getTranslations();

  const countryOptions = SITE_COUNTRY_CODES.map((code) => ({
    value: code,
    label: t(`mySites.country.${code}`),
  }));

  return (
    <form className={styles.form} aria-label={formLabel} noValidate>
      <div className={styles.fields}>
        <SiteField
          kind="text"
          id={`${idPrefix}-name`}
          name="name"
          label={t('mySites.form.name')}
          hint={t('mySites.form.nameHint')}
          autoComplete="off"
          required
        />

        <SiteField
          kind="select"
          id={`${idPrefix}-country`}
          name="country"
          label={t('mySites.form.country')}
          options={countryOptions}
          placeholderOption={t('mySites.form.countryPlaceholder')}
          required
        />

        <fieldset className={styles.coords}>
          <legend className={styles.legend}>{t('mySites.form.coordinates')}</legend>
          <p className={styles.legendHint}>{t('mySites.form.coordinatesHint')}</p>

          <div className={styles.coordFields}>
            <SiteField
              kind="number"
              id={`${idPrefix}-latitude`}
              name="latitude"
              label={t('mySites.form.latitude')}
              hint={t('mySites.form.latitudeHint')}
              min={-90}
              max={90}
              step="0.0001"
              placeholder="52.8297"
              required
            />
            <SiteField
              kind="number"
              id={`${idPrefix}-longitude`}
              name="longitude"
              label={t('mySites.form.longitude')}
              hint={t('mySites.form.longitudeHint')}
              min={-180}
              max={180}
              step="0.0001"
              placeholder="12.0783"
              required
            />
          </div>
        </fieldset>

        <SiteField
          kind="textarea"
          id={`${idPrefix}-notes`}
          name="notes"
          label={t('mySites.form.notes')}
          hint={t('mySites.form.notesHint')}
          optionalNote={t('mySites.form.optional')}
          rows={3}
        />
      </div>

      <div className={styles.actions}>
        {/* A real button, and deliberately not a submit: the client asked for
            the pages first and the functions later. */}
        <button type="button" className={styles.submit}>
          {t('mySites.form.submit')}
        </button>
        <p className={styles.actionNote}>{t('mySites.form.privacyReminder')}</p>
      </div>
    </form>
  );
}
