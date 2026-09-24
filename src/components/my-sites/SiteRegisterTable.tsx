import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { BuyerSite } from '@/lib/sites/types';
import { removeSiteAction, updateSiteAction } from '@/lib/sites/actions';
import AddSiteForm from './AddSiteForm';
import { formatDegrees } from './format';
import styles from './SiteRegisterTable.module.css';

/**
 * The organisation's registered sites, with the two controls that make the
 * register maintainable: change and remove.
 *
 * Both are FORMS, not links. They write, and a link that writes is a link a
 * crawler, a prefetch or a browser's "open in new tab" can fire. Each posts to
 * a Server Action with the site id and nothing else; which rows that id is
 * allowed to touch is decided by geo.buyer_site's policy, not here.
 *
 * The edit form lives inside a native <details> so the table still reads as a
 * table, one row per site, with no client JavaScript and no modal.
 *
 * With no rows it renders the empty state instead of an empty table. An empty
 * table with four headers and no body tells a reader nothing about what to do
 * next, and a screen reader announces it as a table with no rows.
 */
export default async function SiteRegisterTable({
  sites,
  countries,
}: {
  sites: readonly BuyerSite[];
  /** The country list, read from platform.eu_member_state by the page. */
  countries: readonly { readonly value: string; readonly label: string }[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  if (sites.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('mySites.register.emptyTitle')}</p>
        <p className={styles.emptyBody}>{t('mySites.register.emptyBody')}</p>
        <p className={styles.emptyBody}>{t('mySites.register.emptyPrivacy')}</p>
      </div>
    );
  }

  // The register as a whole was read now; each row carries its own as-of date
  // underneath its name, which is the date that actually belongs to the figure.
  const latest = sites
    .map((s) => s.source.asOfDate)
    .sort()
    .at(-1)!;

  const countryLabel = (code: string) =>
    countries.find((c) => c.value === code)?.label ?? code;

  return (
    <div className={styles.panel}>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('mySites.register.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('mySites.register.colSite')}</th>
              <th scope="col">{t('mySites.register.colCountry')}</th>
              <th scope="col">
                {t('mySites.register.colCoordinates')}
                <span className={styles.colNote}>
                  {t('mySites.register.colCoordinatesNote')}
                </span>
              </th>
              <th scope="col">{t('mySites.register.colAdded')}</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id}>
                <th scope="row" className={styles.rowHead}>
                  {site.label}
                  {/* Every figure carries its source and its date. The
                      coordinates in this row are a figure. */}
                  <span className={styles.region}>
                    <SourceStamp
                      inline
                      source={{ label: site.source.label, asOfDate: site.source.asOfDate }}
                    />
                  </span>
                </th>
                <td>{countryLabel(site.countryCode)}</td>
                {/* Latitude and longitude are two figures in one cell, so each
                    carries its own label for a reader who cannot see that the
                    first number is the northern one. */}
                <td className={styles.coords}>
                  <span className="visually-hidden">
                    {t('mySites.form.latitude')}:{' '}
                  </span>
                  {formatDegrees(site.latitude)}
                  <span aria-hidden="true">, </span>
                  <span className="visually-hidden">
                    {t('mySites.form.longitude')}:{' '}
                  </span>
                  {formatDegrees(site.longitude)}
                </td>
                <td>
                  <time dateTime={site.registeredOn}>
                    {format.dateTime(new Date(site.registeredOn), 'short')}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* One editor per site, outside the table: a form inside a <td> that
          spans a row is a layout fight nobody wins, and a details element is
          announced as a disclosure either way. */}
      <ul className={styles.editors}>
        {sites.map((site) => (
          <li key={site.id} className={styles.editor}>
            <details>
              <summary className={styles.editSummary}>
                {t('mySites.register.editSummary', { site: site.label })}
              </summary>
              <div className={styles.editBody}>
                <AddSiteForm
                  idPrefix={`edit-${site.id}`}
                  formLabel={t('mySites.register.editSummary', { site: site.label })}
                  action={updateSiteAction}
                  countries={countries}
                  site={site}
                  submitLabel={t('mySites.register.saveChanges')}
                />
                {/* A separate form, so "save" and "remove" cannot be confused
                    for each other by a stray Enter key in a text box. */}
                <form action={removeSiteAction} className={styles.removeForm}>
                  <input type="hidden" name="id" value={site.id} />
                  <button type="submit" className={styles.remove}>
                    {t('mySites.register.remove')}
                  </button>
                  <span className={styles.removeNote}>
                    {t('mySites.register.removeNote')}
                  </span>
                </form>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <div className={styles.panelFoot}>
        <p className={styles.count}>
          {t('mySites.register.count', { count: sites.length })}
        </p>
        <SourceStamp
          source={{
            label: t('mySites.source.register'),
            locator: null,
            asOfDate: latest,
          }}
        />
      </div>
    </div>
  );
}
