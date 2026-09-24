import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { formatQty } from '@/lib/units/qty';
import PublicationGateList from './PublicationGateList';
import type { DemoOwnerProject } from './demo-owner';
import styles from './OwnerProjectRow.module.css';

/**
 * One of the owner's projects: what it is, where it stands, what is still
 * blocking publication, and what it has on offer in its nearest period.
 *
 * RULE 7. The availability table belongs to ONE project and ONE period, and
 * every figure in it is rendered through formatQty(), so the unit type is
 * printed beside the number. There is no column and no row here that could hold
 * a figure spanning two projects, and the page that renders these rows never
 * adds them: two projects on this dashboard measure different things, and the
 * unit label on every line is what says so.
 *
 * Status is never colour alone: the badge carries the status word, and the note
 * under the name states in a sentence whether the project is on the public
 * index.
 */

/**
 * Tone for a project status.
 *
 * Green is the platform's "primary / selected" colour, so it marks the one
 * status that puts a project on the public index. Amber marks the one status
 * that is waiting on the owner. Everything else is neutral, because a draft is
 * not a problem.
 */
function statusTone(statusKey: string): BadgeTone {
  if (statusKey === 'status.published') return 'bio';
  if (statusKey === 'status.changes_requested') return 'warning';
  return 'neutral';
}

export default async function OwnerProjectRow({
  project,
  locale,
}: {
  project: DemoOwnerProject;
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const country =
    new Intl.DisplayNames([locale], { type: 'region' }).of(project.countryCode) ??
    project.countryCode;

  const unitLabel = t(project.unitLabelKey);
  const period = project.nearestPeriod;
  const headingId = `owner-project-${project.id}`;

  const day = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'short')}</time>
  );

  return (
    <article className={styles.project} aria-labelledby={headingId}>
      <header className={styles.head}>
        <h3 id={headingId} className={styles.name}>
          {project.isPublished ? (
            <Link href={`/projects/${project.slug}`}>{project.name}</Link>
          ) : (
            project.name
          )}
        </h3>
        <Badge tone={statusTone(project.statusKey)}>{t(project.statusKey)}</Badge>
      </header>

      <dl className={styles.meta}>
        <div className={styles.metaItem}>
          <dt>{t('project.location')}</dt>
          <dd>
            {project.regionLabel} {t('source.separator')} {country}
          </dd>
        </div>
        <div className={styles.metaItem}>
          <dt>{t('project.scheme')}</dt>
          <dd>{project.schemeName}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>{t('project.unitType')}</dt>
          <dd className={styles.unit}>{unitLabel}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>{t('owner.projects.lastChange')}</dt>
          <dd>{day(project.lastChangeOn)}</dd>
        </div>
      </dl>

      {!project.isPublished && (
        <p className={styles.notPublic}>{t('owner.projects.notPublic')}</p>
      )}

      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby={`${headingId}-availability`}>
          <h4 id={`${headingId}-availability`} className={styles.panelTitle}>
            {t('project.availability')}
          </h4>

          {period === null ? (
            <p className={styles.emptyPanel}>{t('owner.projects.noAvailability')}</p>
          ) : (
            <>
              {/* Two columns, one period, one project. The unit travels with
                  every figure rather than sitting once in a header, so no line
                  of this table can be read next to another project's. */}
              <table className={styles.availability}>
                <caption>
                  {t('owner.projects.availabilityCaption', {
                    project: project.name,
                    period: period.periodLabel,
                  })}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t('owner.projects.lineItem')}</th>
                    <th scope="col" className="num">
                      {period.periodLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.expectedIssuance')}
                    </th>
                    <td className="num">
                      {formatQty(period.expected, unitLabel, locale)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.buffer')}
                    </th>
                    <td className="num">{formatQty(period.buffer, unitLabel, locale)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.committed')}
                    </th>
                    <td className="num">
                      {formatQty(period.committed, unitLabel, locale)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.remaining')}
                    </th>
                    <td className={`num ${styles.remaining}`}>
                      {formatQty(period.remaining, unitLabel, locale)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className={styles.panelNote}>{t('project.availabilityNote')}</p>
              <SourceStamp
                source={{
                  label: t(period.source.labelKey),
                  locator: period.source.locator,
                  asOfDate: period.source.asOfDate,
                }}
              />
            </>
          )}
        </section>

        <section className={styles.panel} aria-labelledby={`${headingId}-gate`}>
          <h4 id={`${headingId}-gate`} className={styles.panelTitle}>
            {t('owner.projects.gateTitle')}
          </h4>
          <PublicationGateList
            gaps={project.gaps}
            checkedOn={project.gateCheckedOn}
            isPublished={project.isPublished}
          />
        </section>
      </div>

      {project.isPublished && (
        <p className={styles.foot}>
          <Link href={`/projects/${project.slug}`}>
            {t('owner.projects.viewPublicPage')} &rarr;
          </Link>
        </p>
      )}
    </article>
  );
}
