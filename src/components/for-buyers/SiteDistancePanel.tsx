import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './SiteDistancePanel.module.css';

/**
 * The buyer's own site register, and what it changes on a project page.
 *
 * The water-dependent buyers interviewed wanted a project in the same catchment
 * as their own sites, so distance is the first question they ask. The table
 * below is what ONE buyer sees on its own screen: a project owner never sees
 * it, and no other buyer sees it.
 *
 * The figures here are distances in kilometres, not units. Kilometres are
 * comparable between rows; units are not comparable between projects, which is
 * why this panel deliberately shows no volumes at all.
 */

interface DemoSiteSource {
  labelKey: string;
  locator: string | null;
  asOfDate: string;
}

interface DemoBuyerSite {
  id: string;
  /** Proper nouns, held as literals exactly as they will arrive from the database. */
  name: string;
  locationLabel: string;
  catchmentLabel: string;
  /** Same catchment as the demo project, which is the question being answered. */
  sameCatchment: boolean;
  /** Straight-line distance to the project boundary, in kilometres. */
  distanceKm: number;
}

/**
 * DEMO DATA. A fictional buyer organisation and its fictional sites. None of
 * these places exist and none of these distances describes a real site.
 */
const DEMO_BUYER_ORG = 'DEMO Rheinwasser Getränke GmbH';
const DEMO_PROJECT_NAME = 'DEMO Untere Havel Wetland Restoration';

const DEMO_SITES: readonly DemoBuyerSite[] = [
  {
    id: 'site-brandenburg',
    name: 'DEMO Rheinwasser Bottling Plant',
    locationLabel: 'Brandenburg, DE',
    catchmentLabel: 'Untere Havel',
    sameCatchment: true,
    distanceKm: 18,
  },
  {
    id: 'site-saxony-anhalt',
    name: 'DEMO Rheinwasser Malting Works',
    locationLabel: 'Sachsen-Anhalt, DE',
    catchmentLabel: 'Mittlere Elbe',
    sameCatchment: false,
    distanceKm: 63,
  },
  {
    id: 'site-lower-saxony',
    name: 'DEMO Rheinwasser Distribution Centre',
    locationLabel: 'Niedersachsen, DE',
    catchmentLabel: 'Aller',
    sameCatchment: false,
    distanceKm: 214,
  },
];

const DEMO_SITE_SOURCE: DemoSiteSource = {
  labelKey: 'forBuyers.source.siteRegister',
  locator: null,
  asOfDate: '2026-09-18',
};

export default async function SiteDistancePanel() {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <h2>{t('project.yourSites')}</h2>
      <p className={styles.lead}>{t('forBuyers.sites.lead')}</p>

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <span className={styles.panelOrg}>{DEMO_BUYER_ORG}</span>
        </div>

        <div className="table-scroll">
          <table className={styles.table}>
            <caption>
              {t('forBuyers.sites.caption', { project: DEMO_PROJECT_NAME })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('forBuyers.sites.colSite')}</th>
                <th scope="col">{t('project.location')}</th>
                <th scope="col">{t('project.catchment')}</th>
                <th scope="col">{t('forBuyers.sites.colRelation')}</th>
                <th scope="col" className="num">{t('forBuyers.sites.colDistance')}</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_SITES.map((site) => (
                <tr key={site.id}>
                  <th scope="row" className={styles.rowHead}>{site.name}</th>
                  <td>{site.locationLabel}</td>
                  <td>{site.catchmentLabel}</td>
                  <td>
                    {/* The relation is a word first. The badge tint only
                        repeats what the word already says. */}
                    {site.sameCatchment ? (
                      <Badge tone="water">{t('forBuyers.sites.sameCatchment')}</Badge>
                    ) : (
                      <span className={styles.otherCatchment}>
                        {t('forBuyers.sites.otherCatchment')}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {format.number(site.distanceKm)}{' '}
                    <span className={styles.unit}>{t('forBuyers.sites.unitKm')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.panelFoot}>
          <p className={styles.method}>{t('project.yourSitesNote')}</p>
          <SourceStamp
            source={{
              label: t(DEMO_SITE_SOURCE.labelKey),
              locator: DEMO_SITE_SOURCE.locator,
              asOfDate: DEMO_SITE_SOURCE.asOfDate,
            }}
          />
        </div>
      </div>

      <h3 className={styles.privacyTitle}>{t('forBuyers.sites.privacyTitle')}</h3>
      <ul className={styles.privacy}>
        <li>{t('forBuyers.sites.privacyOwners')}</li>
        <li>{t('forBuyers.sites.privacyBuyers')}</li>
        <li>{t('forBuyers.sites.privacyCalculation')}</li>
      </ul>
    </>
  );
}
