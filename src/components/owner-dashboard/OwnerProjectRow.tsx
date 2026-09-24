import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { formatQty } from '@/lib/units/qty';
import { ownerText } from '@/lib/owner/messages';
import { statusKey, type OwnerProject } from '@/lib/owner/types';
import PublicationGateList from './PublicationGateList';
import styles from './OwnerProjectRow.module.css';

/**
 * One of the owner's projects: what it is, where it stands, what is still
 * blocking publication, and what it has on offer in its nearest period.
 *
 * RULE 7. The availability table belongs to ONE project and ONE period, and
 * every figure in it is rendered through formatQty() with the unit label this
 * project's unit type carries, so the unit is printed beside the number. There
 * is no column and no row here that could hold a figure spanning two projects,
 * and the page that renders these rows never adds them: two projects on this
 * dashboard measure different things, and the unit label on every line is what
 * says so.
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
function statusTone(status: string): BadgeTone {
  if (status === 'published') return 'bio';
  if (status === 'changes_requested') return 'warning';
  return 'neutral';
}

export default async function OwnerProjectRow({
  project,
  locale,
}: {
  project: OwnerProject;
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  let country = project.countryCode;
  try {
    country = new Intl.DisplayNames([locale], { type: 'region' }).of(project.countryCode)
      ?? project.countryCode;
  } catch {
    country = project.countryCode;
  }

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
            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
          ) : (
            project.title
          )}
        </h3>
        <Badge tone={statusTone(project.status)}>{t(statusKey(project.status))}</Badge>
      </header>

      <dl className={styles.meta}>
        <div className={styles.metaItem}>
          <dt>{t('project.location')}</dt>
          <dd>{country}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>{t('project.scheme')}</dt>
          <dd>{project.schemeName ?? ownerText(t, 'notStated')}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>{t('project.unitType')}</dt>
          <dd className={styles.unit}>
            {project.unitLabel ?? ownerText(t, 'notStated')}
          </dd>
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
                    project: project.title,
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
                      {formatQty(period.expected, period.unitLabel, locale)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.buffer')}
                    </th>
                    <td className="num">
                      {formatQty(period.buffer, period.unitLabel, locale)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.committed')}
                    </th>
                    <td className="num">
                      {formatQty(period.committed, period.unitLabel, locale)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className={styles.rowHead}>
                      {t('project.remaining')}
                    </th>
                    <td className={`num ${styles.remaining}`}>
                      {formatQty(period.remaining, period.unitLabel, locale)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className={styles.panelNote}>{t('project.availabilityNote')}</p>
              <SourceStamp
                source={{
                  label: period.source.label,
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

      <p className={styles.foot}>
        <Link href={`/owner/projects/${project.slug}`}>
          {ownerText(t, 'openRecord')} &rarr;
        </Link>
        {project.isPublished && (
          <>
            {' '}
            <Link href={`/projects/${project.slug}`}>
              {t('owner.projects.viewPublicPage')} &rarr;
            </Link>
          </>
        )}
      </p>
    </article>
  );
}
