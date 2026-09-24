import { getTranslations } from 'next-intl/server';
import styles from './QuestionFilters.module.css';

/**
 * Project and state filters, and they work.
 *
 * A GET form, so the filter lands in the query string and the page re-renders
 * on the server with it. No client component, no bundle, and the filtered view
 * has a URL of its own that can be bookmarked or sent to a colleague - which a
 * JavaScript filter over a list would not.
 *
 * The project list comes from the projects this inbox actually holds questions
 * for, so a filter can never name a project the reader cannot see.
 */
export default async function QuestionFilters({
  projects,
  selectedProject,
  selectedState,
}: {
  projects: readonly { slug: string; title: string }[];
  selectedProject: string;
  selectedState: string;
}) {
  const t = await getTranslations();

  return (
    <section className={styles.section} aria-labelledby="owner-questions-filter">
      <h3 id="owner-questions-filter" className={styles.heading}>
        {t('ownerQuestions.filters.heading')}
      </h3>

      <form
        method="get"
        className={styles.row}
        role="group"
        aria-labelledby="owner-questions-filter"
      >
        <div className={styles.field}>
          <label htmlFor="owner-questions-filter-project">
            {t('ownerQuestions.filters.project')}
          </label>
          <select
            id="owner-questions-filter-project"
            name="project"
            defaultValue={selectedProject}
          >
            <option value="">{t('projects.filters.all')}</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="owner-questions-filter-state">
            {t('ownerQuestions.filters.state')}
          </label>
          <select
            id="owner-questions-filter-state"
            name="state"
            defaultValue={selectedState}
          >
            <option value="">{t('projects.filters.all')}</option>
            <option value="unanswered">{t('ownerQuestions.state.unanswered')}</option>
            <option value="answered">{t('ownerQuestions.state.answered')}</option>
          </select>
        </div>

        <button type="submit" className={styles.apply}>
          {t('ownerQuestions.filters.apply')}
        </button>
      </form>
    </section>
  );
}
