import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { formatDegrees, type ProjectDistance, type RegisteredSite } from './demo-sites';
import styles from './SiteDistanceTable.module.css';

/**
 * How far one registered site is from each published project.
 *
 * The distance is a straight line from the site coordinates to the nearest point
 * on the published project boundary. That is the only claim the table makes, and
 * it is written next to the figures rather than assumed: a straight line is not a
 * road distance, and being near a project is not the same as being in its
 * catchment, which is why the catchment relation is a separate column.
 *
 * Rule 7 is why this table has no volume column. Kilometres mean the same thing
 * in every row, so the rows can be compared and sorted. Unit volumes do not:
 * each project issues units under its own scheme and its own unit type, so
 * putting them in this table would invite exactly the comparison the rule
 * forbids. The last method note says so on the page, not only here.
 */
export default async function SiteDistanceTable({
  site,
  distances,
  asOfDate,
}: {
  site: RegisteredSite;
  distances: readonly ProjectDistance[];
  asOfDate: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <span className={styles.siteLabel}>{t('mySites.distances.siteLabel')}</span>
            <span className={styles.siteName}>{site.name}</span>
            <span className={styles.siteWhere}>
              {site.regionLabel} · {t(`mySites.country.${site.countryCode}`)}
            </span>
          </div>
          <span className={styles.siteCoords}>
            {formatDegrees(site.latitude)}, {formatDegrees(site.longitude)}
          </span>
        </div>

        <div className="table-scroll">
          <table className={styles.table}>
            <caption>{t('mySites.distances.caption', { site: site.name })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('mySites.distances.colProject')}</th>
                <th scope="col">{t('mySites.register.colCountry')}</th>
                <th scope="col">{t('project.catchment')}</th>
                <th scope="col" className="num">
                  {t('mySites.distances.colDistance')}
                  <span className={styles.colNote}>
                    {t('mySites.distances.unitKm')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {distances.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className={styles.rowHead}>
                    {row.projectName}
                  </th>
                  <td>{t(`mySites.country.${row.countryCode}`)}</td>
                  <td>
                    {row.catchmentLabel}
                    {/* The relation is a word first. The tint only repeats what
                        the word already says. */}
                    <span className={styles.relation}>
                      {row.sameCatchment ? (
                        <Badge tone="water">
                          {t('mySites.distances.sameCatchment')}
                        </Badge>
                      ) : (
                        <span className={styles.otherCatchment}>
                          {t('mySites.distances.otherCatchment')}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="num">
                    {format.number(row.distanceKm)}{' '}
                    <span className={styles.unit}>
                      {t('mySites.distances.unitKm')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.panelFoot}>
          <p className={styles.exampleNote}>{t('mySites.distances.exampleNote')}</p>
          <SourceStamp
            source={{
              label: t('mySites.source.distances'),
              locator: null,
              asOfDate,
            }}
          />
        </div>
      </div>

      <h3 className={styles.methodTitle}>{t('mySites.distances.methodTitle')}</h3>
      <ul className={styles.method}>
        <li>{t('mySites.distances.methodLine')}</li>
        <li>{t('mySites.distances.methodCatchment')}</li>
        <li>{t('mySites.distances.methodUnits')}</li>
      </ul>

      <p className={styles.next}>
        <Link href="/projects">{t('mySites.distances.browseProjects')}</Link>
      </p>
    </>
  );
}
