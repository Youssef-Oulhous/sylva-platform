import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import CorrectionForm from '@/components/admin-area/CorrectionForm';
import RecordFilters from '@/components/admin-area/RecordFilters';
import RecordPager from '@/components/admin-area/RecordPager';
import RecordTable from '@/components/admin-area/RecordTable';
import { requireRole } from '@/lib/auth/guards';
import { AREA, RECORD, isCorrectionError, label, labelWith } from '@/lib/admin/labels';
import {
  logOperatorRead,
  parseRecordParams,
  readOperatorRecord,
  readOperatorRecordOptions,
  type OperatorRecordOptions,
  type OperatorRecordPage,
  type RecordScope,
} from '@/lib/admin/record';
import styles from '@/components/admin-area/AdminArea.module.css';

/**
 * The whole transaction record, and the one write the operator holds on it.
 *
 * TWO THINGS THE PUBLIC PAGE CANNOT DO. /record reads record.v_public_entry,
 * which drops entries on projects that were never published and resolves every
 * counterparty to a label such as "Buyer 003" unless that deal was flagged for
 * disclosure. This page reads record.entry underneath it, names each
 * counterparty, and marks every row with whether the public view reaches it.
 * The operator and the auditor are the only roles granted
 * org.organisation.legal_name, so this is one of exactly two screens where a
 * name is legitimately visible - and the page says so above the table.
 *
 * NOTHING IS FILTERED IN THIS FILE. The operator's policy on record.entry is
 * USING (true), and a predicate written here would be application code quietly
 * deciding what an operator may read. The only filter is the reader's own, it
 * lives in the URL, and it is checked against what the database holds before it
 * reaches a statement.
 *
 * THE WRITE IS AN APPEND. record.entry refuses UPDATE, DELETE and TRUNCATE to
 * every role; the operator holds INSERT. So a correction is a NEW row pointing
 * at the old one, and the old one stays visible for ever - which is what the
 * form says in words rather than leaving it to be discovered. A unique index
 * means an entry is corrected at most once, and that appears as a sentence: the
 * select offers only entries nothing already points at, and a race that gets
 * past it comes back as "that entry has already been corrected", never as
 * 23505.
 *
 * WHAT IS DELIBERATELY ABSENT. §8 names nine entry types; the platform has one
 * write path into the record (express interest) plus this correction. Issuance
 * and retirement are deferred by §10, so there is no control for them here, and
 * inventing one would be asserting a flow the note does not describe.
 *
 * RULE 7. No cell on this page is a unit volume, so nothing on it is added
 * across projects or unit types.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: label(t, RECORD.title),
    // Named counterparties, some of them on unpublished projects. Never indexed.
    robots: { index: false, follow: false },
  };
}

export default async function AdminRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireRole('operator', '/admin/record');

  const t = await getTranslations();
  const query = await searchParams;

  let options: OperatorRecordOptions = { projects: [], events: [] };
  let extract: OperatorRecordPage | null = null;
  let failed = false;
  let parsed = {
    projectSlug: null as string | null,
    entryType: null as string | null,
    scope: 'all' as RecordScope,
    page: 1,
    ignored: [] as Array<'project' | 'event'>,
  };

  try {
    // Options first: the filter is validated against them, so an address asking
    // for a project this record does not hold is reported rather than silently
    // turned into an empty table that reads like "nothing happened".
    options = await readOperatorRecordOptions(viewer.actor, locale);
    parsed = parseRecordParams(query, options);
    extract = await readOperatorRecord(viewer.actor, {
      locale,
      projectSlug: parsed.projectSlug,
      entryType: parsed.entryType,
      scope: parsed.scope,
      page: parsed.page,
    });
  } catch (err) {
    console.error('[admin] could not read the record:', err);
    failed = true;
  }

  // Resolving a counterparty to a name is a restricted capability, and one that
  // leaves no trace is one nobody can audit.
  await logOperatorRead(
    viewer.actor,
    'admin.record',
    parsed.projectSlug !== null ? 'project' : null,
    parsed.projectSlug,
  );

  const error = isCorrectionError(query.error) ? query.error : null;
  const corrected = typeof query.corrected === 'string' ? query.corrected : null;

  // What the extract is true as of: the newest entry it holds, or today when it
  // holds none - which is when the read was made either way.
  const asOf =
    extract?.entries.map((e) => e.recordedOn).sort().at(-1)
    ?? new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{label(t, AREA.eyebrow)}</p>
        <div className={styles.headTop}>
          <h1>{label(t, RECORD.title)}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{label(t, RECORD.lead)}</p>
        <p className={`${styles.statement} ${styles.statementStrong}`}>
          {label(t, RECORD.whyIdentity)}
        </p>
        <p className={styles.note}>{label(t, AREA.restricted)}</p>
        <div className={styles.stamp}>
          <SourceStamp
            source={{ label: label(t, RECORD.sourceLabel), locator: null, asOfDate: asOf }}
          />
        </div>
      </header>

      {failed && (
        <p className={styles.failure} role="alert">{label(t, AREA.readFailed)}</p>
      )}

      {!failed && (
        <>
          <div className={styles.section}>
            <RecordFilters
              options={options}
              projectSlug={parsed.projectSlug}
              entryType={parsed.entryType}
              scope={parsed.scope}
              ignored={parsed.ignored}
            />

            <p className={styles.count}>
              {labelWith(t, RECORD.count, { count: extract?.total ?? 0 })}
            </p>

            {extract === null || extract.entries.length === 0 ? (
              <p className={styles.empty}>{label(t, RECORD.empty)}</p>
            ) : (
              <>
                <RecordTable entries={extract.entries} />
                <RecordPager
                  extract={extract}
                  projectSlug={parsed.projectSlug}
                  entryType={parsed.entryType}
                  scope={parsed.scope}
                />
              </>
            )}
          </div>

          <CorrectionForm
            entries={extract?.entries ?? []}
            projectSlug={parsed.projectSlug}
            entryType={parsed.entryType}
            scope={parsed.scope}
            page={parsed.page}
            error={error}
            corrected={corrected}
          />
        </>
      )}
    </div>
  );
}
