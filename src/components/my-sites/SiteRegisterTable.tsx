import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { formatDegrees, type RegisteredSite } from './demo-sites';
import styles from './SiteRegisterTable.module.css';

/**
 * The organisation's registered sites.
 *
 * Four columns, the ones the client asked for: name, country, coordinates, date
 * added. Region and the organisation's own note sit inside the name cell rather
 * than becoming columns of their own, so the table still reads at 375px.
 *
 * With no rows it renders the empty state instead of an empty table. An empty
 * table with four headers and no body tells a reader nothing about what to do
 * next, and a screen reader announces it as a table with no rows.
 */
export default async function SiteRegisterTable({
  sites,
  asOfDate,
}: {
  sites: readonly RegisteredSite[];
  /** The date the register was read. Carried by the source stamp. */
  asOfDate: string;
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
                  {site.name}
                  <span className={styles.region}>{site.regionLabel}</span>
                  {site.notes !== null && (
                    <span className={styles.note}>
                      <span className="visually-hidden">
                        {t('mySites.form.notes')}:{' '}
                      </span>
                      {site.notes}
                    </span>
                  )}
                </th>
                <td>{t(`mySites.country.${site.countryCode}`)}</td>
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
                  <time dateTime={site.addedOn}>
                    {format.dateTime(new Date(site.addedOn), 'short')}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.panelFoot}>
        <p className={styles.count}>
          {t('mySites.register.count', { count: sites.length })}
        </p>
        <SourceStamp
          source={{
            label: t('mySites.source.register'),
            locator: null,
            asOfDate,
          }}
        />
      </div>
    </div>
  );
}
