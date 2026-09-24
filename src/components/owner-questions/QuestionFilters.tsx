import { getTranslations } from 'next-intl/server';
import { DEMO_OWNER_PROJECTS } from './demo-questions';
import styles from './QuestionFilters.module.css';

/**
 * Project and state filters, rendered but not wired: the functions come later.
 *
 * There is no <form> element, so nothing can submit by accident, and the button
 * is type="button" for the same reason. The controls stay enabled rather than
 * being disabled, and the note saying they do nothing yet is attached to all
 * three with aria-describedby, so a screen-reader user is told what a sighted
 * user is told instead of meeting a control that is silently inert.
 *
 * The apply control is outlined, not filled. The one filled control on this page
 * is "Send reply", because that is the action the page exists for.
 */
export default async function QuestionFilters() {
  const t = await getTranslations();
  const noteId = 'owner-questions-filter-note';

  return (
    <section className={styles.section} aria-labelledby="owner-questions-filter">
      <h3 id="owner-questions-filter" className={styles.heading}>
        {t('ownerQuestions.filters.heading')}
      </h3>

      <div className={styles.row} role="group" aria-labelledby="owner-questions-filter">
        <div className={styles.field}>
          <label htmlFor="owner-questions-filter-project">
            {t('ownerQuestions.filters.project')}
          </label>
          <select
            id="owner-questions-filter-project"
            name="project"
            aria-describedby={noteId}
          >
            <option value="">{t('projects.filters.all')}</option>
            {DEMO_OWNER_PROJECTS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="owner-questions-filter-state">
            {t('ownerQuestions.filters.state')}
          </label>
          <select id="owner-questions-filter-state" name="state" aria-describedby={noteId}>
            <option value="">{t('projects.filters.all')}</option>
            <option value="unanswered">{t('ownerQuestions.state.unanswered')}</option>
            <option value="answered">{t('ownerQuestions.state.answered')}</option>
          </select>
        </div>

        <button type="button" className={styles.apply} aria-describedby={noteId}>
          {t('ownerQuestions.filters.apply')}
        </button>
      </div>

      <p id={noteId} className={styles.note}>
        {t('ownerQuestions.filters.notConnected')}
      </p>
    </section>
  );
}
