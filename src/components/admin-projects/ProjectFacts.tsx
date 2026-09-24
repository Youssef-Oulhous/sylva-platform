import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { adminText } from '@/lib/admin/messages';
import { STATUS_TONE, type AdminProject } from '@/lib/admin/types';
import styles from './ProjectFacts.module.css';

/**
 * The head of the review panel: which project is open, and what is recorded
 * against it that an operator needs before reading the gate list.
 *
 * Every date here is read from the same record, so one source stamp covers the
 * panel rather than one per line.
 *
 * The unit type is stated among the facts, not because the gate checks it - it
 * does not - but because every figure this project will ever show is denominated
 * in it, and an operator publishing a project should have read it. Where no unit
 * type is recorded the field says so rather than being left blank.
 *
 * THERE IS NO "SUBMITTED" DATE. `proj.project` carries `created_at` and
 * `published_at` and nothing between them: a project moving from `draft` to
 * `submitted_for_review` leaves no timestamp. Printing one would be inventing
 * it, so the panel prints the status and the date of the last content change
 * instead.
 */
export default async function ProjectFacts({
  project,
  headingId,
}: {
  project: AdminProject;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  const facts: readonly { key: string; label: string; value: React.ReactNode }[] = [
    {
      key: 'reference',
      label: t('adminProjects.col.reference'),
      value: <span className={styles.mono}>{project.id}</span>,
    },
    {
      key: 'owner',
      label: t('adminProjects.col.owner'),
      value: project.ownerOrgName,
    },
    {
      key: 'country',
      label: t('adminProjects.col.country'),
      value: project.countryName,
    },
    {
      key: 'scheme',
      label: t('adminProjects.col.scheme'),
      value: project.schemeName ?? t('adminProjects.notRecorded'),
    },
    {
      key: 'unitType',
      label: t('adminProjects.col.unitType'),
      value: project.unitLabel ?? t('adminProjects.unit.notRecorded'),
    },
    {
      key: 'published',
      label: t('adminProjects.col.published'),
      value: project.publishedOn
        ? day(project.publishedOn)
        : t('adminProjects.panel.notPublished'),
    },
    {
      key: 'lastChange',
      label: t('adminProjects.col.lastChange'),
      value: day(project.lastChangeOn),
    },
    {
      key: 'slug',
      label: t('adminProjects.col.slug'),
      value: <span className={styles.mono}>{project.slug}</span>,
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t('adminProjects.panel.eyebrow')}</p>
        <h2 id={headingId} className={styles.title}>
          {project.title}
        </h2>
        <div className={styles.badges}>
          <Badge tone={STATUS_TONE[project.status]}>{t(`status.${project.status}`)}</Badge>
        </div>
      </div>

      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.key} className={styles.fact}>
            <dt className={styles.factLabel}>{fact.label}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <SourceStamp
        source={{
          label: t('adminProjects.source.projectRecord'),
          locator: null,
          asOfDate: project.lastChangeOn,
        }}
      />

      <p className={styles.pageLink}>
        <Link href={`/projects/${project.slug}`}>{t('adminProjects.panel.viewPage')}</Link>
      </p>
    </div>
  );
}
