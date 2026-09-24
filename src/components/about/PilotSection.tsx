import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  RELEASE_FIRST,
  RELEASE_LATER,
  RELEASE_SOURCE,
  RESEARCH_ROWS,
  RESEARCH_SOURCE,
} from './about-data';
import shared from './AboutSection.module.css';
import styles from './PilotSection.module.css';

/**
 * What the pilot is for, what its design is based on, and what is being built
 * in what order.
 *
 * The interview table counts ORGANISATIONS, from one source, so its total is a
 * real total and is printed. It is the only summed figure on this page; there
 * is no unit volume here at all, and therefore nothing that Rule 7 could be
 * violated by.
 *
 * The EU co-funding statement is NOT repeated here. It is carried in the site
 * footer on every page, including this one, and a second copy on the About page
 * would be two compliance statements to keep in step instead of one. The page
 * points at it instead.
 */
export default async function PilotSection() {
  const t = await getTranslations();
  const format = await getFormatter();

  const interviewed = RESEARCH_ROWS.reduce((n, row) => n + row.count, 0);

  return (
    <>
      <h2>{t('about.pilot.title')}</h2>
      <p className={shared.lead}>{t('about.pilot.lead')}</p>

      <h3 className={shared.subhead}>{t('about.pilot.marketTitle')}</h3>
      <p className={shared.body}>{t('about.pilot.marketBody')}</p>
      <p className={shared.body}>{t('about.pilot.issuanceBody')}</p>

      <h3 className={shared.subhead}>{t('about.pilot.researchTitle')}</h3>
      <p className={shared.body}>{t('about.pilot.researchLead')}</p>

      <div className={`table-scroll ${styles.tableWrap}`}>
        <table>
          <caption>{t('about.pilot.research.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('about.pilot.research.group')}</th>
              <th scope="col" className="num">{t('about.pilot.research.count')}</th>
            </tr>
          </thead>
          <tbody>
            {RESEARCH_ROWS.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.rowHead}>{t(row.groupKey)}</th>
                <td className="num">{format.number(row.count)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={styles.totalHead}>
                {t('about.pilot.research.total')}
              </th>
              <td className={`num ${styles.totalValue}`}>{format.number(interviewed)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SourceStamp
        source={{
          label: t(RESEARCH_SOURCE.labelKey),
          locator: RESEARCH_SOURCE.locator,
          asOfDate: RESEARCH_SOURCE.asOfDate,
        }}
      />

      <h3 className={shared.subhead}>{t('about.pilot.releaseTitle')}</h3>
      <div className={styles.releases}>
        <div className={styles.release}>
          <p className={styles.releaseTitle}>{t('about.pilot.release.firstTitle')}</p>
          <p className={styles.releaseTarget}>{t('about.pilot.release.firstTarget')}</p>
          <ul className={styles.releaseList}>
            {RELEASE_FIRST.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
        <div className={styles.release}>
          <p className={styles.releaseTitle}>{t('about.pilot.release.laterTitle')}</p>
          <p className={styles.releaseTarget}>{t('about.pilot.release.laterTarget')}</p>
          <ul className={styles.releaseList}>
            {RELEASE_LATER.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      </div>
      <SourceStamp
        source={{
          label: t(RELEASE_SOURCE.labelKey),
          locator: RELEASE_SOURCE.locator,
          asOfDate: RELEASE_SOURCE.asOfDate,
        }}
      />

      <p className={shared.footNote}>{t('about.pilot.fundingPointer')}</p>
    </>
  );
}
