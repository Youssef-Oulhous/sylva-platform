import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import EmptyState from './EmptyState';
import type { RegisteredSite } from './types';
import styles from './SitesTable.module.css';

/**
 * The organisation's own sites.
 *
 * "This information must remain private." (Master prompt, §28.) The privacy
 * note under the table is not reassurance copy: it states who can see these
 * rows, because a buyer registering the location of its production sites is
 * entitled to know that before it types one in.
 *
 * There is no distance column here. A distance is measured to a particular
 * project, so it belongs on that project's page, not in a register that would
 * then have to pick one project to measure against.
 */
export default async function SitesTable({
  sites,
  locale,
}: {
  sites: readonly RegisteredSite[];
  locale: string;
}) {
  const t = await getTranslations('buyerDashboard');
  // Location, country and catchment are the platform's existing field labels,
  // used on the project pages. This table borrows them rather than restating
  // them, so the two screens cannot end up with different words for a catchment.
  const tRoot = await getTranslations();
  const format = await getFormatter();

  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryName = (code: string) => {
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const degrees = (value: number) =>
    format.number(value, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const registerAction = (
    <button type="button" className={styles.action}>
      {t('sites.registerAction')}
    </button>
  );

  return (
    <>
      {sites.length === 0 ? (
        <EmptyState
          title={t('sites.empty.title')}
          body={t('sites.empty.body')}
          action={registerAction}
        />
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <caption className={styles.caption}>{t('sites.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('sites.col.site')}</th>
                <th scope="col">{tRoot('project.location')}</th>
                <th scope="col">{tRoot('projects.filters.country')}</th>
                <th scope="col">{tRoot('project.catchment')}</th>
                <th scope="col" className="num">{t('sites.col.latitude')}</th>
                <th scope="col" className="num">{t('sites.col.longitude')}</th>
                <th scope="col">{t('sites.col.registeredOn')}</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <th scope="row" className={styles.rowHead}>
                    {site.name}
                  </th>
                  <td>{site.locationLabel}</td>
                  <td>{countryName(site.countryCode)}</td>
                  <td>{site.catchmentLabel}</td>
                  <td className="num">
                    <span className={styles.mono}>{degrees(site.latitude)}</span>
                  </td>
                  <td className="num">
                    <span className={styles.mono}>{degrees(site.longitude)}</span>
                  </td>
                  <td className={styles.dateCell}>
                    <time dateTime={site.registeredOn}>
                      {format.dateTime(new Date(site.registeredOn), 'short')}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.foot}>
        <div>
          <h3 className={styles.privacyTitle}>{t('sites.privacyTitle')}</h3>
          <ul className={styles.privacy}>
            <li>{t('sites.privacy.owners')}</li>
            <li>{t('sites.privacy.buyers')}</li>
            <li>{t('sites.privacy.distance')}</li>
          </ul>
        </div>

        {sites.length === 0 ? null : (
          <div className={styles.actions}>
            {registerAction}
            <Link href="/projects" className={styles.link}>
              {t('sites.compareLink')}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
