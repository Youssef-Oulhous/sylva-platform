import { getTranslations } from 'next-intl/server';
import { getPathname } from '@/lib/i18n/routing';
import { label, labelWith, FILTER } from '@/lib/record/labels';
import { EVENT_PARAM, PROJECT_PARAM } from '@/lib/record/params';
import type { RecordFilterOptions } from '@/lib/record/types';
import { inNoteOrder } from './vocabulary';
import styles from './RecordFilters.module.css';

/**
 * Project and event-type filters, server-side, in the URL.
 *
 * A plain <form method="get">. That is the whole mechanism, and it is chosen
 * rather than tolerated:
 *
 *  - It works with no client JavaScript. The record is the page most likely to
 *    be read from a locked-down corporate browser, and it is meant to be
 *    citable evidence, so it must not depend on a bundle loading.
 *  - A GET form puts the selection in the query string by itself, which is
 *    exactly what "shareable" means here: the address bar after Apply IS the
 *    link to send.
 *  - No hidden page field. Changing the filter returns to page 1, which is the
 *    only honest answer - page 7 of the old filter is not page 7 of the new one.
 *
 * The action is the localised /record path, so applying a filter on the German
 * site stays on the German site.
 */
export default async function RecordFilters({
  options,
  locale,
  projectSlug,
  eventType,
  ignored,
}: {
  options: RecordFilterOptions;
  locale: string;
  projectSlug: string | null;
  eventType: string | null;
  ignored: ReadonlyArray<'project' | 'event'>;
}) {
  const t = await getTranslations();
  const noteId = 'record-filters-note';
  const action = getPathname({ href: '/record', locale: locale as 'en' | 'de' });

  const eventLabel = (code: string, fallbackEn: string) => {
    const key = `record.event.${code}`;
    try {
      if (typeof t.has === 'function' && t.has(key)) return t(key);
    } catch {
      /* fall through */
    }
    return fallbackEn;
  };

  const byCode = new Map(options.eventTypes.map((e) => [e.code, e]));
  const orderedEventCodes = inNoteOrder(options.eventTypes.map((e) => e.code));

  return (
    <section className={styles.section} aria-labelledby="record-filters">
      <h2 id="record-filters" className={styles.heading}>
        {t('record.filters.title')}
      </h2>

      <form method="get" action={action} className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="record-filter-project">{t('record.filters.project')}</label>
          <select
            id="record-filter-project"
            name={PROJECT_PARAM}
            defaultValue={projectSlug ?? ''}
            aria-describedby={noteId}
          >
            <option value="">{label(t, FILTER.allProjects)}</option>
            {options.projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="record-filter-event">{t('record.filters.eventType')}</label>
          <select
            id="record-filter-event"
            name={EVENT_PARAM}
            defaultValue={eventType ?? ''}
            aria-describedby={noteId}
          >
            <option value="">{label(t, FILTER.allEvents)}</option>
            {orderedEventCodes.map((code) => {
              const e = byCode.get(code)!;
              const name = eventLabel(code, e.labelEn);
              return (
                <option key={code} value={code}>
                  {/* The brackets belong to the message, not to the code:
                      punctuation around a parenthetical is not the same in
                      every language this page will be translated into. */}
                  {e.isProposedAddition
                    ? labelWith(t, FILTER.proposedOption, { name })
                    : name}
                </option>
              );
            })}
          </select>
        </div>

        <button type="submit" className={styles.apply}>
          {label(t, FILTER.apply)}
        </button>

        {(projectSlug || eventType) && (
          // A link, not a reset button: clearing the filter is a different
          // address, and the address is the point of this control.
          <a className={styles.clear} href={action}>
            {label(t, FILTER.clear)}
          </a>
        )}
      </form>

      <p id={noteId} className={styles.note}>
        {label(t, FILTER.note)}
      </p>

      {/* A filter the address asked for and this page could not apply is said
          out loud. Silently showing the unfiltered record would be showing a
          different record from the one the link promised. */}
      {ignored.includes('project') && (
        <p className={styles.ignored} role="status">
          {label(t, FILTER.ignoredProject)}
        </p>
      )}
      {ignored.includes('event') && (
        <p className={styles.ignored} role="status">
          {label(t, FILTER.ignoredEvent)}
        </p>
      )}
    </section>
  );
}
