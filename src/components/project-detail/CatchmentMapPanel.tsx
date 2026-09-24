import { getFormatter, getTranslations } from 'next-intl/server';
import BoundaryThumb from '@/components/projects/BoundaryThumb';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoProject } from './demo-data';
import styles from './CatchmentMapPanel.module.css';

/**
 * The catchment view, drawn as inline SVG with no basemap and no mapping
 * library.
 *
 * Two reasons, in order of importance. First, which tile provider Sylva uses is
 * still an open decision, and a page that depends on one is a page that has
 * quietly made that decision - every view would tell a third party which
 * project the reader is looking at. Second, maplibre is a client bundle, and
 * this pass is server-rendered only.
 *
 * The large frame draws the catchment and the project boundary from one
 * bounding box, so the boundary sits in its real position within the catchment.
 * The inset re-draws the boundary alone, at detail.
 */
export default async function CatchmentMapPanel({ project }: { project: DemoProject }) {
  const t = await getTranslations();
  const format = await getFormatter();

  const sameCatchmentText =
    project.sameCatchment === 'yes'
      ? t('projectPage.map.sameCatchmentYes')
      : project.sameCatchment === 'no'
        ? t('projectPage.map.sameCatchmentNo')
        : t('projectPage.map.sameCatchmentUnknown');

  return (
    <>
      <h2>{t('project.map')}</h2>
      <p className={styles.lead}>{t('projectPage.map.lead')}</p>

      <div className={styles.layout}>
        <figure className={styles.figure}>
          <div className={styles.frame}>
            <BoundaryThumb
              geojson={project.catchmentAndBoundaryGeoJson}
              label={t('projectPage.map.altCombined')}
            />
            <div className={styles.insetWrap}>
              <p className={styles.insetLabel}>{t('projectPage.map.insetLabel')}</p>
              <div className={styles.inset}>
                <BoundaryThumb
                  geojson={project.boundaryGeoJson}
                  label={t('projectPage.map.altBoundary')}
                />
              </div>
            </div>
          </div>

          <figcaption className={styles.legend}>
            <ul className={styles.legendList}>
              <li>
                <span className={styles.swatchCatchment} aria-hidden="true" />
                {t('projectPage.map.legendCatchment')} ·{' '}
                <span className={styles.mono}>
                  {format.number(project.catchmentAreaKm2)} km²
                </span>
              </li>
              <li>
                <span className={styles.swatchBoundary} aria-hidden="true" />
                {t('projectPage.map.legendBoundary')} ·{' '}
                <span className={styles.mono}>
                  {format.number(project.areaHectares)} ha
                </span>
              </li>
            </ul>
            <SourceStamp
              source={{
                label: t('projectPage.doc.boundary'),
                locator: 'v1.0',
                asOfDate: '2026-09-12',
              }}
            />
          </figcaption>
        </figure>

        <div className={styles.side}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>{t('projectPage.map.geometryTitle')}</h3>
            <dl className={styles.kv}>
              <div>
                <dt>{t('project.catchment')}</dt>
                <dd>{t(project.catchmentKey)}</dd>
              </div>
              <div>
                <dt>{t('project.location')}</dt>
                <dd>
                  {t(project.regionKey)}, {t(project.countryKey)}
                </dd>
              </div>
              <div>
                <dt>{t('projectPage.map.projectArea')}</dt>
                <dd>
                  <span className={styles.mono}>
                    {format.number(project.areaHectares)} ha
                  </span>
                </dd>
              </div>
            </dl>
            <a
              href={`/api/projects/${project.slug}/boundary.geojson`}
              className={styles.download}
            >
              {t('project.downloadGeoJson')}
            </a>
            <p className={styles.panelNote}>{t('projectPage.map.geojsonNote')}</p>
          </div>

          {/* Signed-out state. Another organisation's sites are never shown
              here, in any state: the panel reads the visitor's own sites only. */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>{t('project.yourSites')}</h3>
            <p className={styles.empty}>{t('project.noSites')}</p>
            <p className={styles.panelNote}>{t('project.yourSitesNote')}</p>
            <p className={styles.sameCatchment}>
              <span className={styles.sameCatchmentLabel}>
                {t('projectPage.map.sameCatchmentQuestion')}
              </span>
              <span>{sameCatchmentText}</span>
            </p>
          </div>
        </div>
      </div>

      <p className={styles.basemapNote}>{t('projectPage.map.basemapPending')}</p>
    </>
  );
}
