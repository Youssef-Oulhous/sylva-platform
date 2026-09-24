import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import type { DemoInterestProject } from './demo-interest';
import styles from './InterestReference.module.css';

/**
 * What the enquiry is about, restated at the top of the form.
 *
 * A buyer arrives here from a project page and may have several projects open.
 * Before any field, the page says which project, whose project, under which
 * scheme and in which unit type - so nobody sends an enquiry about the project
 * they were reading a moment ago rather than the one in the URL.
 *
 * There are no figures in this panel, which is why it carries no source stamp:
 * a source stamp belongs to a figure. The figures on this page are the remaining
 * volumes in the form, and each of those carries its own.
 */
export default async function InterestReference({
  project,
}: {
  project: DemoInterestProject;
}) {
  const t = await getTranslations();
  const unit = t(project.unitLabelKey);

  return (
    <div className={styles.panel}>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.label}>{t('expressInterest.reference.project')}</dt>
          <dd className={styles.value}>
            <Link href={`/projects/${project.slug}`} className={styles.projectLink}>
              {project.name}
            </Link>
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.owner')}</dt>
          <dd className={styles.value}>{project.ownerOrgName}</dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.location')}</dt>
          <dd className={styles.value}>
            {t(project.countryKey)}
            <span className={styles.sep}> · </span>
            {t(project.catchmentKey)}
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.scheme')}</dt>
          <dd className={styles.value}>{project.schemeName}</dd>
        </div>

        {/* The unit type is set in mono, like every other identifier on the
            platform, because it is the thing that decides what a number on this
            page means. */}
        <div className={styles.row}>
          <dt className={styles.label}>{t('project.unitType')}</dt>
          <dd className={styles.value}>
            <span className={styles.unit}>{unit}</span>
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.status')}</dt>
          <dd className={styles.value}>
            <Badge tone="neutral">{t(project.statusKey)}</Badge>
          </dd>
        </div>
      </dl>

      <p className={styles.vintage}>{t(project.vintageKey)}</p>

      {/* Stated here rather than implied by the absence of a total. */}
      <p className={styles.incomparable}>{t('project.availabilityNote')}</p>
    </div>
  );
}
