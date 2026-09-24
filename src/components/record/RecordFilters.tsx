import { getTranslations } from 'next-intl/server';
import { DEMO_RECORD_PROJECTS, NOTED_EVENT_CODES, PROPOSED_EVENT_CODES } from './demo-record';
import styles from './RecordFilters.module.css';

/**
 * Project and event-type filters, rendered but not wired: the functions come
 * later. There is no <form> element, so nothing can submit by accident, and the
 * button is type="button" for the same reason.
 *
 * The controls are left enabled rather than disabled, and the note explaining
 * that they do nothing is attached to both of them with aria-describedby - so a
 * screen-reader user is told exactly what a sighted user is told, instead of
 * meeting a control that is silently inert.
 */
export default async function RecordFilters() {
  const t = await getTranslations();
  const noteId = 'record-filters-note';

  return (
    <section className={styles.section} aria-labelledby="record-filters">
      <h2 id="record-filters" className={styles.heading}>
        {t('record.filters.title')}
      </h2>

      <div className={styles.row} role="group" aria-labelledby="record-filters">
        <div className={styles.field}>
          <label htmlFor="record-filter-project">{t('record.filters.project')}</label>
          <select id="record-filter-project" name="project" aria-describedby={noteId}>
            <option value="">{t('projects.filters.all')}</option>
            {DEMO_RECORD_PROJECTS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="record-filter-event">{t('record.filters.eventType')}</label>
          <select id="record-filter-event" name="eventType" aria-describedby={noteId}>
            <option value="">{t('projects.filters.all')}</option>
            {NOTED_EVENT_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`record.event.${code}`)}
              </option>
            ))}
            {PROPOSED_EVENT_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`record.event.${code}`)}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className={styles.apply} aria-describedby={noteId}>
          {t('record.filters.apply')}
        </button>
      </div>

      <p id={noteId} className={styles.note}>
        {t('record.filters.notConnected')}
      </p>
    </section>
  );
}
