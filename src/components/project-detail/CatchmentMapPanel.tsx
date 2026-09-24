import { getFormatter, getTranslations } from 'next-intl/server';
import BoundaryThumb from '@/components/projects/BoundaryThumb';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { countryLabel, label, UI } from '@/lib/projects/labels';
import type { BuyerProximity, ProjectDetail } from '@/lib/projects/types';
import styles from './CatchmentMapPanel.module.css';

/**
 * The catchment view, drawn as inline SVG with no basemap and no mapping
 * library.
 *
 * Two reasons, in order of importance. First, which tile provider Sylva uses is
 * still an open decision, and a page that depends on one is a page that has
 * quietly made that decision - every view would tell a third party which
 * project the reader is looking at. Second, maplibre is a client bundle, and
 * this page is server-rendered.
 *
 * The large frame draws the catchment and the project boundary from one
 * bounding box, so the boundary sits in its real position within the catchment.
 * The inset re-draws the boundary alone, at detail.
 *
 * `proximity` IS PRIVATE. It holds the signed-in buyer's own site names and
 * their distances to this project, and the page that renders this component is
 * dynamic for that reason: it must never be stored in a shared cache. Another
 * organisation's sites cannot appear here even if this component were wrong -
 * the policy on geo.buyer_site is org_id = sylva.actor_org_id() and the context
 * is HMAC-signed (FINDING-001) - but a cached page would show one buyer's sites
 * to the next visitor, and no database policy can undo that.
 */
export default async function CatchmentMapPanel({
  project,
  proximity,
}: {
  project: ProjectDetail;
  proximity: BuyerProximity | null;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const boundary = project.boundary;
  const catchment = project.catchment;

  // One bounding box for both rings, so the boundary is drawn where it actually
  // sits inside the catchment rather than rescaled to fill the frame.
  const combined = combine(catchment?.geoJson, boundary?.geoJson);

  return (
    <>
      <h2>{t('project.map')}</h2>
      <p className={styles.lead}>{t('projectPage.map.lead')}</p>

      <div className={styles.layout}>
        <figure className={styles.figure}>
          <div className={styles.frame}>
            <BoundaryThumb geojson={combined} label={t('projectPage.map.altCombined')} />
            {boundary && (
              <div className={styles.insetWrap}>
                <p className={styles.insetLabel}>{t('projectPage.map.insetLabel')}</p>
                <div className={styles.inset}>
                  <BoundaryThumb
                    geojson={boundary.geoJson}
                    label={t('projectPage.map.altBoundary')}
                  />
                </div>
              </div>
            )}
          </div>

          <figcaption className={styles.legend}>
            <ul className={styles.legendList}>
              {catchment && (
                <li>
                  <span className={styles.swatchCatchment} aria-hidden="true" />
                  {t('projectPage.map.legendCatchment')} ·{' '}
                  <span className={styles.mono}>
                    {format.number(catchment.areaKm2)} km²
                  </span>
                </li>
              )}
              {boundary && (
                <li>
                  <span className={styles.swatchBoundary} aria-hidden="true" />
                  {t('projectPage.map.legendBoundary')} ·{' '}
                  <span className={styles.mono}>
                    {format.number(boundary.areaHectares)} ha
                  </span>
                </li>
              )}
            </ul>
            {boundary && (
              <SourceStamp
                source={{
                  label: boundary.source.label,
                  locator: boundary.source.locator,
                  asOfDate: boundary.asOfDate,
                }}
              />
            )}
            <p className={styles.panelNote}>{label(t, UI.areaComputed)}</p>
          </figcaption>
        </figure>

        <div className={styles.side}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>{t('projectPage.map.geometryTitle')}</h3>
            <dl className={styles.kv}>
              {catchment?.datasetName && (
                <div>
                  <dt>{t('project.catchment')}</dt>
                  <dd>{catchment.datasetName}</dd>
                </div>
              )}
              <div>
                <dt>{t('project.location')}</dt>
                <dd>{countryLabel(t, project.countryCode, project.countryNameEn)}</dd>
              </div>
              {boundary && (
                <div>
                  <dt>{t('projectPage.map.projectArea')}</dt>
                  <dd>
                    <span className={styles.mono}>
                      {format.number(boundary.areaHectares)} ha
                    </span>
                  </dd>
                </div>
              )}
              {catchment && (
                <div>
                  <dt>{label(t, UI.catchmentArea)}</dt>
                  <dd>
                    <span className={styles.mono}>
                      {format.number(catchment.areaKm2)} km²
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            <a
              href={`/api/projects/${project.slug}/boundary.geojson`}
              className={styles.download}
            >
              {t('project.downloadGeoJson')}
            </a>
            <p className={styles.panelNote}>{t('projectPage.map.geojsonNote')}</p>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>{t('project.yourSites')}</h3>

            {proximity === null ? (
              /* Signed out, or signed in as something other than a buyer.
                 Another organisation's sites are never shown here in any
                 state: this panel reads the viewer's own sites only. */
              <>
                <p className={styles.empty}>{t('project.noSites')}</p>
                <p className={styles.sameCatchment}>
                  <span className={styles.sameCatchmentLabel}>
                    {t('projectPage.map.sameCatchmentQuestion')}
                  </span>
                  <span>{t('projectPage.map.sameCatchmentUnknown')}</span>
                </p>
              </>
            ) : proximity.sites.length === 0 ? (
              <p className={styles.empty}>{t('project.noSites')}</p>
            ) : (
              <>
                <ul className={styles.siteList}>
                  {proximity.sites.map((s) => (
                    <li key={s.siteId} className={styles.site}>
                      <span className={styles.siteName}>
                        {s.label}
                        <span className={styles.siteCountry}>
                          {countryLabel(t, s.countryCode, s.countryCode)}
                        </span>
                      </span>
                      <span className={styles.siteDistance}>
                        <span className={styles.mono}>
                          {format.number(Math.round(s.distanceMetres / 1000))}
                        </span>{' '}
                        {t('mySites.distances.unitKm')}
                      </span>
                      <span
                        className={
                          s.inCatchment ? styles.siteInCatchment : styles.siteOutCatchment
                        }
                      >
                        {s.inCatchment === null
                          ? label(t, UI.sitesNoCatchment)
                          : s.inCatchment
                            ? label(t, UI.sitesInCatchment)
                            : label(t, UI.sitesNotInCatchment)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className={styles.panelNote}>{t('project.yourSitesNote')}</p>
                <p className={styles.panelNote}>{label(t, UI.sitesLevelNote)}</p>
                {proximity.catchmentDatasetName && (
                  <p className={styles.panelNote}>{proximity.catchmentDatasetName}</p>
                )}
                {proximity.catchmentSource && (
                  <SourceStamp
                    source={{
                      label: proximity.catchmentSource.label,
                      locator: proximity.catchmentSource.locator,
                      asOfDate: proximity.catchmentSource.asOfDate,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {project.catchmentContext && (
        <div className={styles.context}>
          <p>{project.catchmentContext.body}</p>
          <FallbackNote text={project.catchmentContext} />
          <SourceStamp
            source={{
              label: project.catchmentContext.source.label,
              locator: project.catchmentContext.source.locator,
              asOfDate: project.catchmentContext.source.asOfDate,
            }}
          />
        </div>
      )}

      <p className={styles.basemapNote}>{t('projectPage.map.basemapPending')}</p>
    </>
  );
}

/**
 * Catchment first, boundary second, in one MultiPolygon so BoundaryThumb
 * normalises both against a single bounding box. Returns whichever it has when
 * one of the two has not been published.
 */
function combine(catchment: string | undefined, boundary: string | undefined): string | null {
  const parts: number[][][][] = [];
  for (const raw of [catchment, boundary]) {
    if (!raw) continue;
    try {
      const g = JSON.parse(raw) as
        | { type: 'Polygon'; coordinates: number[][][] }
        | { type: 'MultiPolygon'; coordinates: number[][][][] };
      if (g.type === 'MultiPolygon') parts.push(...g.coordinates);
      else parts.push(g.coordinates);
    } catch {
      /* a geometry we cannot read is drawn as nothing, never as a guess */
    }
  }
  if (parts.length === 0) return null;
  return JSON.stringify({ type: 'MultiPolygon', coordinates: parts });
}
