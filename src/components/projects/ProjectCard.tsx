import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import BoundaryThumb from './BoundaryThumb';
import type { ProjectSummary } from '@/lib/projects/types';
import styles from './ProjectCard.module.css';

/**
 * One card, one project, one unit type.
 *
 * The card shows the project's NEAREST period only. It never rolls the
 * project's periods into a single figure, and the index never rolls cards into
 * a platform figure: the unit label travels with every number precisely so that
 * two cards cannot be read as comparable.
 */
export default async function ProjectCard({ project }: { project: ProjectSummary }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const next = project.availability[0] ?? null;

  const fig = (labelKey: string, amount: number, extraClass = '') => (
    <div className={`${styles.fig} ${extraClass}`}>
      <span className={styles.figLabel}>{t(labelKey)}</span>
      <span className={styles.figValue}>{format.number(amount)}</span>
    </div>
  );

  return (
    <article className={styles.card}>
      <div className={styles.thumb}>
        <BoundaryThumb
          geojson={project.boundaryGeoJson}
          label={`${t('project.location')}: ${project.title}`}
        />
      </div>

      <div>
        <div className={styles.head}>
          <h3 className={styles.title}>
            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
          </h3>
          <span className={styles.place}>{project.countryCode}</span>
        </div>

        <div className={styles.badges}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          {project.outcomeDomains.includes('water') && (
            <Badge tone="water">{t('project.water')}</Badge>
          )}
          {project.outcomeDomains.includes('biodiversity') && (
            <Badge tone="bio">{t('project.biodiversity')}</Badge>
          )}
          <Badge tone="neutral">{project.schemeName}</Badge>
        </div>

        {project.summary && <p className={styles.summary}>{project.summary}</p>}

        {next && (
          <div className={styles.availability}>
            <div className={styles.availHead}>
              <span className={styles.availLabel}>
                {t('project.availability')} · {next.periodLabel}
              </span>
              {/* The unit is stated on every card. Two cards showing "12,400"
                  and "540" are not comparable, and the label is what says so. */}
              <span className={styles.unitNote}>{next.unitMetricLabel}</span>
            </div>
            <div className={styles.figs}>
              {fig('project.expectedIssuance', next.expected.amount)}
              {fig('project.buffer', next.buffer.amount)}
              {fig('project.committed', next.committed.amount)}
              {fig('project.remaining', next.remaining.amount, styles.remaining)}
            </div>
          </div>
        )}

        <div className={styles.foot}>
          <span className={styles.place}>
            {t('project.owner')}: {project.ownerOrgName}
          </span>
          <Link href={`/projects/${project.slug}`} className={styles.cta}>
            {t('projects.viewProject')} &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}
