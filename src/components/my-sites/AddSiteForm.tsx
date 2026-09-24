import { getTranslations } from 'next-intl/server';
import SiteField from './SiteField';
import type { BuyerSite } from '@/lib/sites/types';
import styles from './AddSiteForm.module.css';

/**
 * Add a site to the register, or change one that is already on it.
 *
 * One component for both, because they are the same five fields and a second
 * copy of them is a second place a validation rule can drift. `site` decides
 * which: absent, it posts to the add action with empty fields; present, it
 * posts to the update action with the site's values and a hidden id.
 *
 * NO CLIENT JAVASCRIPT. This is a plain <form> with a Server Action, so it
 * works before hydration and with scripting off, which is the same reasoning as
 * the sign-in and registration forms. The `required`, `min` and `max`
 * attributes below are a convenience for the person typing; the check that
 * matters is the zod schema in src/lib/sites/actions.ts, server-side, and it
 * does not trust one character of this form.
 *
 * Latitude and longitude sit in a fieldset with a legend because they are one
 * piece of information entered in two boxes; a screen reader hears
 * "Coordinates, latitude" rather than a bare "latitude" floating between a
 * country list and a button. The ranges are the ranges of the coordinate
 * system, not a rule about where a site may be.
 *
 * There is no free-text notes field. geo.buyer_site holds no such column, and
 * adding one would create a second home for text a person might type a name
 * into - which is the open question the concept note leaves to the client
 * (§10, erasure of free text), not something a form should decide.
 */
export default async function AddSiteForm({
  idPrefix,
  formLabel,
  action,
  countries,
  site,
  submitLabel,
}: {
  /** Prefixes every id. The page renders one of these per site, so it must. */
  idPrefix: string;
  formLabel: string;
  action: (formData: FormData) => Promise<void>;
  countries: readonly { readonly value: string; readonly label: string }[];
  /** Present when this form edits an existing site. */
  site?: BuyerSite;
  submitLabel: string;
}) {
  const t = await getTranslations();

  return (
    <form className={styles.form} action={action} aria-label={formLabel}>
      {site ? <input type="hidden" name="id" value={site.id} /> : null}

      <div className={styles.fields}>
        <SiteField
          kind="text"
          id={`${idPrefix}-label`}
          name="label"
          label={t('mySites.form.name')}
          hint={t('mySites.form.nameHint')}
          autoComplete="off"
          defaultValue={site?.label}
          required
        />

        <SiteField
          kind="select"
          id={`${idPrefix}-country`}
          name="country"
          label={t('mySites.form.country')}
          options={countries}
          placeholderOption={t('mySites.form.countryPlaceholder')}
          defaultValue={site?.countryCode}
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
              defaultValue={site ? String(site.latitude) : undefined}
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
              defaultValue={site ? String(site.longitude) : undefined}
              required
            />
          </div>
        </fieldset>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>
          {submitLabel}
        </button>
        <p className={styles.actionNote}>{t('mySites.form.privacyReminder')}</p>
      </div>
    </form>
  );
}
