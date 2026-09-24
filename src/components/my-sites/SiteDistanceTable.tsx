import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import type { SiteWithDistances } from '@/lib/sites/types';
import { formatDegrees, kilometresFrom } from './format';
import styles from './SiteDistanceTable.module.css';

/**
 * How far one registered site is from each published project.
 *
 * The distance is computed by PostGIS as ST_Distance on ::geography: a straight
 * line on the WGS 84 spheroid, from the site coordinates to the NEAREST POINT
 * of the published project boundary, zero when the site lies inside it. That is
 * the only claim the table makes, and it is written next to the figures rather
 * than assumed - a straight line is not a road distance, and being near a
 * project is not the same as being in its catchment, which is why the catchment
 * relation is a separate column.
 *
 * The catchment answer is point-in-polygon against the polygon the PROJECT
 * supplied, and the dataset the project named is printed beside it. Where a
 * project has published no catchment the cell says so rather than saying "no":
 * an unanswered question and a negative answer are different facts, and
 * DECISIONS D4 is explicit that "same catchment" is stated against a named
 * layer or not at all.
 *
 * Rule 7 is why this table has no volume column. Kilometres mean the same thing
 * in every row, so the rows can be compared and sorted. Unit volumes do not:
 * each project issues units under its own scheme and its own unit type, so
 * putting them in this table would invite exactly the comparison the rule
 * forbids. The last method note says so on the page, not only here.
 */
export default async function SiteDistanceTable({
  entry,
  countries,
}: {
  entry: SiteWithDistances;
  countries: readonly { readonly value: string; readonly label: string }[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const { site, relations } = entry;

  const countryLabel = (code: string) =>
    countries.find((c) => c.value === code)?.label ?? code;

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <span className={styles.siteLabel}>{t('mySites.distances.siteLabel')}</span>
            <span className={styles.siteName}>{site.label}</span>
            <span className={styles.siteWhere}>{countryLabel(site.countryCode)}</span>
          </div>
          <span className={styles.siteCoords}>
            {formatDegrees(site.latitude)}, {formatDegrees(site.longitude)}
          </span>
        </div>

        {relations.length === 0 ? (
          <p className={styles.exampleNote}>{t('mySites.distances.noProjects')}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <caption>{t('mySites.distances.caption', { site: site.label })}</caption>
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
                {relations.map((row) => (
                  <tr key={row.projectId}>
                    <th scope="row" className={styles.rowHead}>
                      <Link href={`/projects/${row.slug}`}>{row.title}</Link>
                    </th>
                    <td>{countryLabel(row.countryCode)}</td>
                    <td>
                      {row.catchmentDatasetName ?? ''}
                      {/* The relation is a word first. The tint only repeats
                          what the word already says. */}
                      <span className={styles.relation}>
                        {row.inCatchment === null ? (
                          <span className={styles.otherCatchment}>
                            {t('mySites.distances.catchmentUnknown')}
                          </span>
                        ) : row.inCatchment ? (
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
                      {format.number(kilometresFrom(row.distanceMetres))}{' '}
                      {/* The unit label never leaves the figure. */}
                      <span className={styles.unit}>
                        {t('mySites.distances.unitKm')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.panelFoot}>
          <SourceStamp
            source={{
              label: t('mySites.source.distances'),
              locator: null,
              asOfDate: site.source.asOfDate,
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
