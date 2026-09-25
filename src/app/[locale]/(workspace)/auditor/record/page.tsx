import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Pager from '@/components/auditor/Pager';
import RecordFilters from '@/components/auditor/RecordFilters';
import RecordTable from '@/components/auditor/RecordTable';
import { getActor } from '@/lib/auth/session';
import { auditorErrorLabel, label, labelWith, RECORD } from '@/lib/auditor/labels';
import { parseAuditParams } from '@/lib/auditor/params';
import {
  logAuditorAccess, readAuditorFilterOptions, readAuditorRecord,
} from '@/lib/auditor/queries';
import type { AuditFilterOptions, AuditRecordPage } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: label(t, RECORD.title),
    robots: { index: false, follow: false },
  };
}

/**
 * The full transaction record, read from record.entry.
 *
 * The public page reads record.v_public_entry, which is narrower in two ways:
 * it drops entry types that are not public and entries on projects that were
 * never published, and it resolves every counterparty to a label or a name as
 * at that entry's own date. This page reads the table underneath it, and marks
 * each row with whether the public view reaches it.
 *
 * Nothing here filters by publication, disclosure or entry type. The auditor's
 * policy on record.entry is USING (true), and a filter applied in this file
 * would be application code quietly deciding what an auditor may see. The
 * filter that does exist is the reader's own, it lives in the URL, and it is
 * validated against what the database holds before it reaches a query.
 */
export default async function AuditorRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const query = await searchParams;
  const actor = await getActor();

  let options: AuditFilterOptions = { projects: [], entryTypes: [] };
  let extract: AuditRecordPage | null = null;
  let failure: unknown = null;
  let parsed = {
    projectSlug: null as string | null,
    entryType: null as string | null,
    page: 1,
    ignored: [] as Array<'project' | 'event'>,
  };

  try {
    // The options are read first because the filter is validated against them:
    // ?project=does-not-exist is a well-formed slug and must be reported, not
    // silently turned into an empty table that reads like "no entries".
    options = await readAuditorFilterOptions(actor, locale);
    parsed = parseAuditParams(query, options);
    extract = await readAuditorRecord(actor, {
      locale,
      projectSlug: parsed.projectSlug,
      entryType: parsed.entryType,
      page: parsed.page,
    });
  } catch (err) {
    console.error('[auditor] could not read the record:', err);
    failure = err;
  }
  await logAuditorAccess(
    actor,
    'auditor.record',
    parsed.projectSlug ? 'project' : null,
    parsed.projectSlug,
  );

  const notPublic = extract
    ? extract.entries.filter((e) => !e.onPublicRecord).length
    : 0;

  return (
    <section className={styles.section} aria-labelledby="auditor-record">
      <h1 id="auditor-record">{label(t, RECORD.title)}</h1>
      <p className={styles.lead}>{label(t, RECORD.lead)}</p>

      <RecordFilters
        options={options}
        projectSlug={parsed.projectSlug}
        entryType={parsed.entryType}
        ignored={parsed.ignored}
      />

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {label(t, auditorErrorLabel(failure))}
        </p>
      ) : extract === null || extract.entryCount === 0 ? (
        <p className={styles.empty}>{label(t, RECORD.empty)}</p>
      ) : (
        <>
          <p className={styles.small}>
            {labelWith(t, RECORD.count, { count: extract.entryCount })}
            {notPublic > 0 && ` · ${label(t, RECORD.notOnPublicNote)}`}
          </p>

          <RecordTable entries={extract.entries} />

          <Pager
            extract={extract}
            projectSlug={parsed.projectSlug}
            entryType={parsed.entryType}
          />
        </>
      )}
    </section>
  );
}
