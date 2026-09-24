import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import EmptyState from './EmptyState';
import type { BuyerSite } from '@/lib/sites/types';
import styles from './SitesTable.module.css';

/**
 * The organisation's own sites.
 *
 * "This information must remain private." (Master prompt, §28.) The privacy
 * note under the table is not reassurance copy: it states who can see these
 * rows, and it is true because geo.buyer_site's policy makes it true - a buyer
 * reads `org_id = sylva.actor_org_id()` and a project owner holds no grant on
 * the table at all. tests/db/sites.test.ts asserts both.
 *
 * There is no distance column here. A distance is measured to a particular
 * project, so it belongs on that project's page or on /dashboard/sites, not in
 * a register that would then have to pick one project to measure against.
 */
export default async function SitesTable({
  sites,
  locale,
}: {
  sites: readonly BuyerSite[];
  locale: string;
}) {
  const t = await getTranslations('buyerDashboard');
  // Country is the platform's existing field label, used on the project pages.
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

  // Not format.number(): a coordinate is closer to an identifier than to a
  // quantity, and a reader comparing this column with a GeoJSON file should
  // see the same characters in both. See src/components/my-sites/format.ts.
  const degrees = (value: number) => value.toFixed(4);

  const registerAction = (
    <Link href="/dashboard/sites" className={styles.action}>
      {t('sites.registerAction')}
    </Link>
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
                <th scope="col">{tRoot('projects.filters.country')}</th>
                <th scope="col" className="num">{t('sites.col.latitude')}</th>
                <th scope="col" className="num">{t('sites.col.longitude')}</th>
                <th scope="col">{t('sites.col.registeredOn')}</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <th scope="row" className={styles.rowHead}>
                    {site.label}
                    {/* Every figure carries its source and its date. */}
                    <SourceStamp
                      inline
                      source={{
                        label: site.source.label,
                        asOfDate: site.source.asOfDate,
                      }}
                    />
                  </th>
                  <td>{countryName(site.countryCode)}</td>
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
            <Link href="/dashboard/sites" className={styles.link}>
              {t('sites.compareLink')}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
