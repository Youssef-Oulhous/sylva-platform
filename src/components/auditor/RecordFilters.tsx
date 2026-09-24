import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';
import { EVENT_PARAM, PROJECT_PARAM } from '@/lib/auditor/params';
import { label, RECORD } from '@/lib/auditor/labels';
import type { AuditFilterOptions } from '@/lib/auditor/types';
import styles from './Auditor.module.css';

/**
 * The record filter.
 *
 * A plain GET form with no client JavaScript, for two reasons. It puts the
 * filter in the address, so a filtered extract can be cited in a report and
 * reopened exactly as it was read - which matters more on an audit page than
 * anywhere else on the platform. And a GET form cannot write: the only control
 * in the auditor's whole area submits a query string and nothing else.
 *
 * The page filter is reset on every submission (the page parameter is simply
 * absent from this form), because page 4 of one filter is meaningless under
 * another.
 */
export default function RecordFilters({
  options,
  projectSlug,
  entryType,
  ignored,
}: {
  options: AuditFilterOptions;
  projectSlug: string | null;
  entryType: string | null;
  ignored: Array<'project' | 'event'>;
}) {
  const t = useTranslations();
  const isFiltered = projectSlug !== null || entryType !== null;

  return (
    <>
      <form className={styles.filters} method="get" action="">
        <p className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="auditor-filter-project">
            {label(t, RECORD.filterProject)}
          </label>
          <select
            className={styles.select}
            id="auditor-filter-project"
            name={PROJECT_PARAM}
            defaultValue={projectSlug ?? ''}
          >
            <option value="">{label(t, RECORD.filterAllProjects)}</option>
            {options.projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} ({p.status})
              </option>
            ))}
          </select>
        </p>

        <p className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="auditor-filter-event">
            {label(t, RECORD.filterEvent)}
          </label>
          <select
            className={styles.select}
            id="auditor-filter-event"
            name={EVENT_PARAM}
            defaultValue={entryType ?? ''}
          >
            <option value="">{label(t, RECORD.filterAllEvents)}</option>
            {options.entryTypes.map((e) => (
              <option key={e.code} value={e.code}>
                {e.labelEn}
                {e.isPublic ? '' : ' — not public'}
              </option>
            ))}
          </select>
        </p>

        <button className={styles.apply} type="submit">
          {label(t, RECORD.filterApply)}
        </button>

        {isFiltered && (
          <Link className={styles.clear} href="/auditor/record">
            {label(t, RECORD.filterClear)}
          </Link>
        )}
      </form>

      {ignored.length > 0 && (
        <p className={styles.empty} role="status">
          {label(t, RECORD.filterIgnored)}
        </p>
      )}
    </>
  );
}
