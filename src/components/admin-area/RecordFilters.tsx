import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { label, RECORD } from '@/lib/admin/labels';
import { RECORD_SCOPES, type OperatorRecordOptions, type RecordScope } from '@/lib/admin/record';
import styles from './AdminArea.module.css';

/**
 * The record filter: a plain GET form, no client JavaScript.
 *
 * The filter belongs in the address rather than in component state. An operator
 * who has narrowed the record to one project and one event type is usually
 * about to send that view to somebody - an auditor, a project owner, a
 * colleague - and a URL that reopens exactly what they were reading is the
 * whole point. It also means the page works with JavaScript off, and that a
 * filter cannot write anything: this form submits a query string.
 *
 * A filter the record cannot honour is REPORTED, not silently dropped.
 * ?project=does-not-exist is a well-formed slug; turning it into an empty table
 * would tell the operator the record is empty, which is a different statement.
 */
export default async function RecordFilters({
  options,
  projectSlug,
  entryType,
  scope,
  ignored,
}: {
  options: OperatorRecordOptions;
  projectSlug: string | null;
  entryType: string | null;
  scope: RecordScope;
  ignored: Array<'project' | 'event'>;
}) {
  const t = await getTranslations();
  const filtered = projectSlug !== null || entryType !== null || scope !== 'all';

  const scopeLabel: Record<RecordScope, string> = {
    all: label(t, RECORD.scopeAll),
    not_public: label(t, RECORD.scopeNotPublic),
    corrections: label(t, RECORD.scopeCorrections),
  };

  return (
    <section aria-labelledby="record-filter">
      <h2 id="record-filter" className="visually-hidden">
        {label(t, RECORD.filterTitle)}
      </h2>

      <form className={styles.filters} method="get" action="">
        <p className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="record-project">
            {label(t, RECORD.filterProject)}
          </label>
          <select
            className={styles.select}
            id="record-project"
            name="project"
            defaultValue={projectSlug ?? ''}
          >
            <option value="">{label(t, RECORD.allProjects)}</option>
            {options.projects.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
        </p>

        <p className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="record-event">
            {label(t, RECORD.filterEvent)}
          </label>
          <select
            className={styles.select}
            id="record-event"
            name="event"
            defaultValue={entryType ?? ''}
          >
            <option value="">{label(t, RECORD.allEvents)}</option>
            {options.events.map((e) => (
              <option key={e.code} value={e.code}>{e.labelEn}</option>
            ))}
          </select>
        </p>

        <p className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="record-scope">
            {label(t, RECORD.filterScope)}
          </label>
          <select
            className={styles.select}
            id="record-scope"
            name="scope"
            defaultValue={scope}
          >
            {RECORD_SCOPES.map((s) => (
              <option key={s} value={s}>{scopeLabel[s]}</option>
            ))}
          </select>
        </p>

        <button className={styles.apply} type="submit">{label(t, RECORD.apply)}</button>

        {filtered && (
          <Link className={styles.clear} href="/admin/record">
            {label(t, RECORD.clear)}
          </Link>
        )}
      </form>

      <p className={styles.small}>{label(t, RECORD.filterInUrl)}</p>

      {ignored.includes('project') && (
        <p className={styles.failure} role="status">
          {label(t, RECORD.ignoredProject)}
        </p>
      )}
      {ignored.includes('event') && (
        <p className={styles.failure} role="status">
          {label(t, RECORD.ignoredEvent)}
        </p>
      )}
    </section>
  );
}
