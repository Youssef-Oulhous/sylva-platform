import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import type { InterestProject } from '@/lib/interest/types';
import styles from './InterestReference.module.css';

/**
 * What the enquiry is about, restated at the top of the form.
 *
 * A buyer arrives here from a project page and may have several projects open.
 * Before any field, the page says which project, whose project, under which
 * scheme and in which unit type - so nobody sends an enquiry about the project
 * they were reading a moment ago rather than the one in the URL.
 *
 * Read from the database. The owner's name comes through org.v_public_party,
 * because no public-facing role holds SELECT on org.organisation.legal_name.
 *
 * There are no figures in this panel, which is why it carries no source stamp:
 * a source stamp belongs to a figure. The figures on this page are the
 * remaining volumes in the form, and each of those carries its own.
 */

const VINTAGE_KEY: Record<InterestProject['vintageSemantics'], string> = {
  period_of_outcome: 'project.vintageOutcome',
  period_of_issuance: 'project.vintageIssuance',
  undefined_by_scheme: 'project.vintageUndefined',
};

export default async function InterestReference({
  project,
}: {
  project: InterestProject;
}) {
  const t = await getTranslations();

  return (
    <div className={styles.panel}>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.label}>{t('expressInterest.reference.project')}</dt>
          <dd className={styles.value}>
            <Link href={`/projects/${project.slug}`} className={styles.projectLink}>
              {project.title}
            </Link>
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.owner')}</dt>
          <dd className={styles.value}>{project.ownerOrgName}</dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.location')}</dt>
          {/* The two-letter code, as the projects index prints it. The
              platform has no translated country names and inventing a list
              here would be a second source of truth for them. */}
          <dd className={styles.value}>{project.countryCode}</dd>
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
            <span className={styles.unit}>{project.unitMetricLabel}</span>
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>{t('project.status')}</dt>
          <dd className={styles.value}>
            {/* The form only ever renders for a published project - an
                unpublished one has no row to read - so the word is fixed here
                rather than pretending to be a variable. */}
            <Badge tone="neutral">{t('status.published')}</Badge>
          </dd>
        </div>
      </dl>

      <p className={styles.vintage}>{t(VINTAGE_KEY[project.vintageSemantics])}</p>

      {/* Stated here rather than implied by the absence of a total. */}
      <p className={styles.incomparable}>{t('project.availabilityNote')}</p>
    </div>
  );
}
