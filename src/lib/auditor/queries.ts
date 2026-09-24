import { readAs, withActor } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import { qtyFromRow } from '@/lib/units/qty';
import { shortRef } from './people';
import type {
  AuditAccessLogRow,
  AuditActor,
  AuditAvailabilityRow,
  AuditDeal,
  AuditDealEvent,
  AuditDocument,
  AuditFilterOptions,
  AuditGuard,
  AuditOrganisation,
  AuditOverview,
  AuditProjectDetail,
  AuditProjectSummary,
  AuditRecordEntry,
  AuditRecordPage,
  AuditRegistryRecord,
  AuditSource,
  AuditVerification,
} from './types';

/**
 * Everything the auditor's view reads.
 *
 * Three rules hold across this whole file and are worth stating once:
 *
 *  1. Every statement goes through readAs(), which runs it inside a READ ONLY
 *     transaction as sylva_auditor with a signed organisation context. There
 *     is no raw client here and no query that bypasses row-level security. The
 *     one exception is logAuditorAccess() at the bottom, which writes the
 *     platform's own access log through a SECURITY DEFINER function and says
 *     so at length.
 *
 *  2. Nothing filters by publication status, disclosure or entry type. The
 *     auditor's policies are USING (true) on these tables - which is the whole
 *     point of the role - so a filter added here would be this file deciding
 *     what an auditor may see, in application code, invisibly. Where the
 *     auditor sees more than the public does, the SHAPE of the result says so:
 *     on_public_record is a column, not a filter.
 *
 *  3. No *_raw column appears in any statement below. Quantities are read as
 *     the *_qty composite and wrapped immediately, with the unit label beside
 *     them, so a figure cannot be detached from the project it measures.
 *     Rule 7 has nothing to do on this view - there is no total anywhere - but
 *     the discipline is the same one.
 */

/* ------------------------------------------------------------- provenance */

interface SourceCols {
  src_label: string | null;
  src_locator: string | null;
  src_kind: string | null;
  src_as_of: string | Date | null;
}

const SOURCE_SELECT = (alias: string) => `
         ${alias}.label::text      AS src_label,
         ${alias}.locator          AS src_locator,
         ${alias}.kind::text       AS src_kind,
         ${alias}.as_of_date       AS src_as_of`;

function toSource(r: SourceCols): AuditSource | null {
  if (r.src_label === null) return null;
  return {
    label: r.src_label,
    locator: r.src_locator,
    kind: r.src_kind ?? 'document',
    asOfDate: isoDate(r.src_as_of),
  };
}

function isoDate(v: string | Date | null): string {
  if (v === null) return '';
  return (typeof v === 'string' ? new Date(v) : v).toISOString().slice(0, 10);
}

function isoInstant(v: string | Date | null): string {
  if (v === null) return '';
  return (typeof v === 'string' ? new Date(v) : v).toISOString();
}

/* ------------------------------------------------------------------ actors */

interface ActorCols {
  actor_org_id: string | null;
  actor_org_name: string | null;
  actor_role_snapshot: string;
  actor_person_ref: string | null;
  actor_person_name: string | null;
  actor_person_label: string;
}

/**
 * The actor columns, joined the same way everywhere.
 *
 * identity.user_account is LEFT JOINed on person_ref, which has no foreign key
 * pointing at it - see docs/DECISIONS.md D3. The join therefore returns no row
 * for an erased person, which is the intended behaviour and the reason the
 * page can distinguish erasure from a missing entry.
 */
const ACTOR_JOIN = (entryAlias: string, orgAlias: string, userAlias: string) => `
    LEFT JOIN org.organisation      ${orgAlias}  ON ${orgAlias}.id = ${entryAlias}.actor_org_id
    LEFT JOIN identity.user_account ${userAlias} ON ${userAlias}.person_ref = ${entryAlias}.actor_person_ref`;

function toActor(r: ActorCols): AuditActor {
  return {
    orgId: r.actor_org_id,
    orgName: r.actor_org_name,
    roleAtTime: r.actor_role_snapshot,
    personRef: r.actor_person_ref,
    personName: r.actor_person_name,
    personLabel: r.actor_person_label,
  };
}

/* ---------------------------------------------------------------- overview */

const OVERVIEW_SQL = `
  SELECT
    (SELECT count(*) FROM proj.project)                                    AS projects,
    (SELECT count(*) FROM proj.project WHERE status = 'published')         AS projects_published,
    (SELECT count(*) FROM org.organisation)                                AS organisations,
    (SELECT count(*) FROM org.org_role_approval WHERE status = 'approved') AS approvals,
    (SELECT count(*) FROM record.entry)                                    AS entries,
    (SELECT count(*) FROM record.v_public_entry)                           AS public_entries,
    (SELECT count(*) FROM deal.deal)                                       AS deals,
    (SELECT count(*) FROM deal.deal WHERE disclosed)                       AS deals_disclosed,
    (SELECT count(*) FROM doc.document)                                    AS documents,
    (SELECT count(*) FROM doc.document_version)                            AS document_versions,
    (SELECT count(*) FROM doc.document_withdrawal)                         AS document_withdrawals,
    (SELECT count(*) FROM credit.registry_record)                          AS registry_records,
    (SELECT count(*) FROM credit.registry_record
      WHERE confirmation_status = 'confirmed')                             AS registry_confirmed,
    (SELECT count(*) FROM identity.user_account)                           AS people,
    (SELECT count(*) FROM identity.erasure_event)                          AS erasures,
    -- People the record names who have no account any more. Under D3 this is
    -- erasure; it is counted so the page can state the number rather than
    -- leaving a reader to notice blank cells and wonder.
    (SELECT count(DISTINCT e.actor_person_ref)
       FROM record.entry e
       LEFT JOIN identity.user_account u ON u.person_ref = e.actor_person_ref
      WHERE e.actor_person_ref IS NOT NULL AND u.person_ref IS NULL)       AS unresolved_people,
    (SELECT count(*) FROM record.access_log)                               AS access_log_rows`;

export async function readAuditorOverview(actor: Actor): Promise<AuditOverview> {
  return readAs(actor, async (tx) => {
    const r = await tx.one<Record<string, string>>(OVERVIEW_SQL);
    const n = (k: string) => Number(r[k] ?? 0);
    const entries = n('entries');
    const publicEntries = n('public_entries');
    return {
      projects: n('projects'),
      projectsPublished: n('projects_published'),
      projectsUnpublished: n('projects') - n('projects_published'),
      organisations: n('organisations'),
      approvals: n('approvals'),
      entries,
      publicEntries,
      entriesNotOnPublicRecord: entries - publicEntries,
      deals: n('deals'),
      dealsDisclosed: n('deals_disclosed'),
      documents: n('documents'),
      documentVersions: n('document_versions'),
      documentWithdrawals: n('document_withdrawals'),
      registryRecords: n('registry_records'),
      registryConfirmed: n('registry_confirmed'),
      people: n('people'),
      erasures: n('erasures'),
      unresolvedPeople: n('unresolved_people'),
      accessLogRows: n('access_log_rows'),
    };
  });
}

/* ------------------------------------------------------------------ guards */

/**
 * The guarantees this page claims, checked live against this database.
 *
 * "The role is read-only at the database level" is the kind of sentence that
 * is worth nothing on its own, so the page does not just assert it: it calls
 * ci.assert_auditor_is_read_only(), which reads information_schema and raises
 * if sylva_auditor holds any privilege other than SELECT on any table or
 * column. The two beside it are the other guarantees an auditor depends on -
 * that nothing can be edited or deleted anywhere, and that erasing a person
 * cannot cascade into the record.
 *
 * Each runs in its OWN transaction, because ci.fail() raises and an aborted
 * transaction cannot run the next one. A failure is reported, not thrown: a
 * guard that has started failing is the single most important thing this page
 * could tell an auditor, and swallowing it into an error page would bury it.
 */
export const AUDITOR_GUARDS = [
  'assert_auditor_is_read_only',
  'assert_append_only_complete',
  'assert_no_fk_into_identity',
] as const;

export async function runAuditorGuards(actor: Actor): Promise<AuditGuard[]> {
  const out: AuditGuard[] = [];
  for (const name of AUDITOR_GUARDS) {
    try {
      // The name comes from the frozen list above, never from input. An
      // identifier cannot be bound as a parameter, which is why that matters.
      await readAs(actor, (tx) => tx.query(`SELECT ci.${name}()`));
      out.push({ name, ok: true, detail: null });
    } catch (err) {
      out.push({
        name,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------- the record */

const RECORD_WHERE = `
   WHERE ($1::text IS NULL OR p.slug = $1::text)
     AND ($2::text IS NULL OR e.entry_type = $2::text)`;

const RECORD_SQL = `
  SELECT e.entry_no::text,
         e.public_id::text,
         e.entry_type,
         et.label_en::text                       AS entry_label_en,
         et.is_public                            AS type_is_public,
         e.occurred_at,
         e.recorded_at,
         p.slug                                  AS project_slug,
         p.status::text                          AS project_status,
         COALESCE(t_loc.body, t_en.body, p.slug) AS project_title,
         e.deal_id::text,
         bo.legal_name::text                     AS deal_buyer_org_name,
         oo.legal_name::text                     AS deal_owner_org_name,
         e.actor_org_id::text,
         ao.legal_name::text                     AS actor_org_name,
         e.actor_role_snapshot,
         e.actor_person_ref::text,
         ua.full_name                            AS actor_person_name,
         e.actor_person_label,
         nullif(concat_ws('.', e.subject_schema, e.subject_table), '') AS subject_table,
         e.subject_id,
         e.detail::text                          AS detail,
         corrected.public_id::text               AS corrects_public_id,
         e.correction_reason,
         e.correction_depth,
         (SELECT c.public_id::text FROM record.entry c
           WHERE c.corrects_entry_no = e.entry_no) AS superseded_by_public_id,
         -- A COLUMN, not a filter. The auditor reads record.entry; the public
         -- reads record.v_public_entry, which is narrower. Saying which rows
         -- differ is the honest way to show a superset.
         EXISTS (SELECT 1 FROM record.v_public_entry v
                  WHERE v.public_id = e.public_id)  AS on_public_record,
${SOURCE_SELECT('s')}
    FROM record.entry e
    JOIN record.entry_type et ON et.code = e.entry_type
    JOIN proj.project p       ON p.id = e.project_id
    LEFT JOIN org.organisation bo ON bo.id = e.deal_buyer_org_id
    LEFT JOIN org.organisation oo ON oo.id = e.deal_owner_org_id
${ACTOR_JOIN('e', 'ao', 'ua')}
    LEFT JOIN sylva.source_ref s  ON s.id = e.source_ref_id
    LEFT JOIN record.entry corrected ON corrected.entry_no = e.corrects_entry_no
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $3::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
  ${RECORD_WHERE}
   -- occurred_at alone is not a total order; entry_no is the order the record
   -- was written in and breaks the tie, so paging cannot drop or repeat a row.
   ORDER BY e.occurred_at DESC, e.entry_no DESC
   LIMIT $4::int OFFSET $5::int`;

const RECORD_COUNT_SQL = `
  SELECT count(*)::int AS n
    FROM record.entry e
    JOIN proj.project p ON p.id = e.project_id
  ${RECORD_WHERE}`;

interface RecordRow extends Record<string, unknown>, SourceCols, ActorCols {
  entry_no: string;
  public_id: string;
  entry_type: string;
  entry_label_en: string;
  type_is_public: boolean;
  occurred_at: Date;
  recorded_at: Date;
  project_slug: string;
  project_status: string;
  project_title: string;
  deal_id: string | null;
  deal_buyer_org_name: string | null;
  deal_owner_org_name: string | null;
  subject_table: string | null;
  subject_id: string | null;
  detail: string;
  corrects_public_id: string | null;
  correction_reason: string | null;
  correction_depth: number;
  superseded_by_public_id: string | null;
  on_public_record: boolean;
}

function toRecordEntry(r: RecordRow): AuditRecordEntry {
  return {
    entryNo: r.entry_no,
    publicId: r.public_id,
    shortRef: shortRef(r.public_id),
    entryType: r.entry_type,
    entryLabelEn: r.entry_label_en,
    typeIsPublic: r.type_is_public,
    onPublicRecord: r.on_public_record,
    occurredAt: isoInstant(r.occurred_at),
    recordedAt: isoInstant(r.recorded_at),
    projectSlug: r.project_slug,
    projectTitle: r.project_title,
    projectStatus: r.project_status,
    dealId: r.deal_id,
    dealBuyerOrgName: r.deal_buyer_org_name,
    dealOwnerOrgName: r.deal_owner_org_name,
    actor: toActor(r),
    subject: r.subject_table
      ? `${r.subject_table}${r.subject_id ? ` · ${r.subject_id}` : ''}`
      : null,
    detail: r.detail,
    source: toSource(r),
    correctsPublicId: r.corrects_public_id,
    correctsShortRef: r.corrects_public_id ? shortRef(r.corrects_public_id) : null,
    correctionReason: r.correction_reason,
    correctionDepth: r.correction_depth,
    supersededByPublicId: r.superseded_by_public_id,
    supersededByShortRef: r.superseded_by_public_id
      ? shortRef(r.superseded_by_public_id)
      : null,
  };
}

export const AUDIT_PAGE_SIZE = 25;

export interface AuditRecordQuery {
  locale: string;
  projectSlug: string | null;
  entryType: string | null;
  page: number;
  /** Clamped. Not a URL parameter; it exists so a test can page a short record. */
  pageSize?: number;
}

export async function readAuditorRecord(
  actor: Actor,
  q: AuditRecordQuery,
): Promise<AuditRecordPage> {
  const pageSize = Math.min(Math.max(1, Math.trunc(q.pageSize ?? AUDIT_PAGE_SIZE)), 200);

  return readAs(actor, async (tx) => {
    // Count and page in ONE transaction, so the footer cannot describe a
    // different record from the table above it.
    const { n: entryCount } = await tx.one<{ n: number }>(RECORD_COUNT_SQL, [
      q.projectSlug,
      q.entryType,
    ]);
    const pageCount = Math.max(1, Math.ceil(entryCount / pageSize));
    const page = Math.min(Math.max(1, q.page), pageCount);
    const offset = (page - 1) * pageSize;

    const rows = await tx.query<RecordRow>(RECORD_SQL, [
      q.projectSlug,
      q.entryType,
      q.locale,
      pageSize,
      offset,
    ]);

    return {
      entries: rows.map(toRecordEntry),
      entryCount,
      page,
      pageSize,
      pageCount,
      from: entryCount === 0 ? 0 : offset + 1,
      to: offset + rows.length,
    };
  });
}

const FILTER_PROJECTS_SQL = `
  SELECT p.slug, p.status::text AS status,
         COALESCE(t_loc.body, t_en.body, p.slug) AS title
    FROM proj.project p
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   ORDER BY p.slug`;

const FILTER_TYPES_SQL = `
  -- EVERY entry type, not only the public ones. An auditor filtering the full
  -- record must be able to ask for a kind of event the public view omits.
  SELECT code, label_en::text AS label_en, is_public
    FROM record.entry_type ORDER BY is_public DESC, code`;

export async function readAuditorFilterOptions(
  actor: Actor,
  locale: string,
): Promise<AuditFilterOptions> {
  return readAs(actor, async (tx) => {
    const projects = await tx.query<{ slug: string; title: string; status: string }>(
      FILTER_PROJECTS_SQL,
      [locale],
    );
    const entryTypes = await tx.query<{
      code: string; label_en: string; is_public: boolean;
    }>(FILTER_TYPES_SQL);
    return {
      projects: projects.map((p) => ({ slug: p.slug, title: p.title, status: p.status })),
      entryTypes: entryTypes.map((e) => ({
        code: e.code, labelEn: e.label_en, isPublic: e.is_public,
      })),
    };
  });
}

/* ---------------------------------------------------------------- projects */

const PROJECT_SUMMARY_SELECT = `
  SELECT p.id::text, p.slug, p.status::text AS status,
         p.country_code::text AS country_code,
         p.published_at, p.created_at,
         o.legal_name::text AS owner_org_name,
         COALESCE(t_loc.body, t_en.body, p.slug) AS title,
         (SELECT count(*) FROM doc.document d        WHERE d.project_id = p.id)  AS document_count,
         (SELECT count(*) FROM proj.project_party pp WHERE pp.project_id = p.id) AS party_count,
         (SELECT count(*) FROM record.entry e        WHERE e.project_id = p.id)  AS entry_count,
         (SELECT count(*) FROM deal.deal dl          WHERE dl.project_id = p.id) AS deal_count,
         (SELECT count(*) FROM credit.registry_record rr WHERE rr.project_id = p.id) AS registry_count,
         -- The gate itself, not a restatement of it. proj.publication_gaps() is
         -- what proj.enforce_publication_gate() consults, so this column can
         -- never drift away from what publication would actually refuse.
         COALESCE(proj.publication_gaps(p.id), '{}'::text[]) AS gaps
    FROM proj.project p
    JOIN org.organisation o ON o.id = p.owner_org_id
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true`;

interface ProjectSummaryRow extends Record<string, unknown> {
  id: string; slug: string; status: string; country_code: string;
  published_at: Date | null; created_at: Date; owner_org_name: string; title: string;
  document_count: string; party_count: string; entry_count: string;
  deal_count: string; registry_count: string; gaps: string[];
}

function toProjectSummary(r: ProjectSummaryRow): AuditProjectSummary {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    countryCode: r.country_code,
    ownerOrgName: r.owner_org_name,
    publishedAt: r.published_at ? isoInstant(r.published_at) : null,
    createdAt: isoInstant(r.created_at),
    documentCount: Number(r.document_count),
    partyCount: Number(r.party_count),
    entryCount: Number(r.entry_count),
    dealCount: Number(r.deal_count),
    registryCount: Number(r.registry_count),
    gaps: r.gaps ?? [],
  };
}

export async function readAuditorProjects(
  actor: Actor,
  locale: string,
): Promise<AuditProjectSummary[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<ProjectSummaryRow>(
      `${PROJECT_SUMMARY_SELECT}
        ORDER BY p.status, p.slug`,
      [locale],
    );
    return rows.map(toProjectSummary);
  });
}

const PARTIES_SQL = `
  SELECT o.legal_name::text AS org_name, pp.party_role AS role, pp.description_en,
${SOURCE_SELECT('s')}
    FROM proj.project_party pp
    JOIN org.organisation o   ON o.id = pp.party_org_id
    JOIN sylva.source_ref s   ON s.id = pp.source_ref_id
   WHERE pp.project_id = $1::uuid
   ORDER BY pp.party_role, o.legal_name`;

const DOCUMENTS_SQL = `
  SELECT d.id::text, d.kind, dk.label_en::text AS kind_label_en,
         d.scope, d.visibility::text AS visibility, d.created_at,
         dv.id::text AS version_id, dv.version_no,
         encode(dv.content_sha256, 'hex') AS content_sha256,
         dv.byte_size::text AS byte_size, dv.media_type, dv.locale,
         dv.storage_region, sr.member_state AS storage_member_state,
         dv.storage_bucket, dv.storage_key,
         uo.legal_name::text AS uploaded_by_org_name, dv.uploaded_at,
         dw.withdrawn_at, dw.reason AS withdrawal_reason
    FROM doc.document d
    JOIN doc.document_kind dk        ON dk.code = d.kind
    LEFT JOIN doc.document_version dv ON dv.document_id = d.id
    LEFT JOIN platform.storage_region sr ON sr.code = dv.storage_region
    LEFT JOIN org.organisation uo     ON uo.id = dv.uploaded_by_org_id
    LEFT JOIN doc.document_withdrawal dw ON dw.document_version_id = dv.id
   WHERE d.project_id = $1::uuid
   ORDER BY dk.code, d.created_at, dv.version_no`;

const REGISTRY_SQL = `
  SELECT rr.id::text, sc.name::text AS scheme_name, rr.record_type,
         rr.external_record_id, rr.record_url,
         (rr.quantity_qty).project_id::text   AS project_id,
         (rr.quantity_qty).unit_type_id::text AS unit_type_id,
         (rr.quantity_qty).amount::text       AS amount,
         ut.unit_of_measure AS unit_label,
         rr.confirmation_status::text AS confirmation_status,
         rr.confirmed_at, co.legal_name::text AS confirmed_by_org_name,
         pe.label::text AS period_label,
         rr.evidence_document_version_id::text,
         rr.as_of_date,
${SOURCE_SELECT('s')}
    FROM credit.registry_record rr
    JOIN units.scheme sc      ON sc.id = rr.scheme_id
    JOIN units.unit_type ut   ON ut.id = rr.unit_type_id
    JOIN proj.period pe       ON pe.id = rr.period_id
    JOIN sylva.source_ref s   ON s.id = rr.source_ref_id
    LEFT JOIN org.organisation co ON co.id = rr.confirmed_by_org_id
   WHERE rr.project_id = $1::uuid
   ORDER BY rr.as_of_date DESC, rr.external_record_id`;

const VERIFICATION_SQL = `
  -- The current version of each indicator, and who verifies it. "Verification
  -- information" on this platform is a named verifier plus the source the
  -- claim rests on; there is no verification the platform performs itself.
  SELECT DISTINCT ON (oi.indicator_code)
         oi.indicator_code, oi.domain, oi.measure_unit::text AS measure_unit,
         oi.version_no, vo.legal_name::text AS verifier_org_name,
         oi.uncertainty_note,
${SOURCE_SELECT('s')}
    FROM proj.outcome_indicator oi
    JOIN sylva.source_ref s ON s.id = oi.source_ref_id
    LEFT JOIN org.organisation vo ON vo.id = oi.verifier_org_id
   WHERE oi.project_id = $1::uuid
   ORDER BY oi.indicator_code, oi.version_no DESC`;

const AVAILABILITY_SQL = `
  SELECT a.period_label::text AS period_label, a.starts_on, a.ends_on,
         a.unit_metric_label::text AS unit_label, a.unit_of_measure,
         a.vintage_semantics,
         a.project_id::text, a.unit_type_id::text,
         (a.expected_issuance_qty).amount::text AS expected_amount,
         (a.buffer_qty).amount::text            AS buffer_amount,
         (a.reserved_qty).amount::text          AS reserved_amount,
         (a.committed_qty).amount::text         AS committed_amount,
         (a.remaining_qty).amount::text         AS remaining_amount,
${SOURCE_SELECT('s')}
    FROM proj.v_period_availability a
    JOIN sylva.source_ref s ON s.id = a.forecast_source_ref_id
   WHERE a.project_id = $1::uuid
   ORDER BY a.starts_on`;

const TEXTS_SQL = `
  SELECT x.field_code, x.locale, x.version_no, x.status::text AS status,
         (x.version_no = max(x.version_no) OVER (PARTITION BY x.field_code, x.locale)) AS is_current
    FROM proj.project_text x
   WHERE x.project_id = $1::uuid
   ORDER BY x.field_code, x.locale, x.version_no DESC`;

const GEOMETRY_SQL = `
  SELECT g.kind::text AS kind, g.version_no,
${SOURCE_SELECT('s')}
    FROM geo.project_geometry g
    JOIN sylva.source_ref s ON s.id = g.source_ref_id
   WHERE g.project_id = $1::uuid
   ORDER BY g.kind, g.version_no DESC`;

interface DocumentRow extends Record<string, unknown> {
  id: string; kind: string; kind_label_en: string; scope: string;
  visibility: string; created_at: Date;
  version_id: string | null; version_no: number | null;
  content_sha256: string | null; byte_size: string | null; media_type: string | null;
  locale: string | null; storage_region: string | null;
  storage_member_state: string | null; storage_bucket: string | null;
  storage_key: string | null; uploaded_by_org_name: string | null;
  uploaded_at: Date | null; withdrawn_at: Date | null; withdrawal_reason: string | null;
}

export async function readAuditorProject(
  actor: Actor,
  slug: string,
  locale: string,
): Promise<AuditProjectDetail | null> {
  return readAs(actor, async (tx) => {
    const summaryRow = await tx.maybe<ProjectSummaryRow>(
      `${PROJECT_SUMMARY_SELECT} WHERE p.slug = $2::text`,
      [locale, slug],
    );
    if (summaryRow === null) return null;
    const summary = toProjectSummary(summaryRow);
    const id = summary.id;

    const partyRows = await tx.query<
      Record<string, unknown> & SourceCols & {
        org_name: string; role: string; description_en: string | null;
      }
    >(PARTIES_SQL, [id]);

    const docRows = await tx.query<DocumentRow>(DOCUMENTS_SQL, [id]);
    const documents: AuditDocument[] = [];
    for (const r of docRows) {
      let doc = documents.find((d) => d.id === r.id);
      if (!doc) {
        doc = {
          id: r.id,
          kind: r.kind,
          kindLabelEn: r.kind_label_en,
          scope: r.scope,
          visibility: r.visibility,
          createdAt: isoInstant(r.created_at),
          versions: [],
        };
        documents.push(doc);
      }
      if (r.version_id !== null) {
        doc.versions.push({
          versionId: r.version_id,
          versionNo: r.version_no ?? 0,
          contentSha256: r.content_sha256 ?? '',
          byteSize: r.byte_size ?? '0',
          mediaType: r.media_type ?? '',
          locale: r.locale,
          storageRegion: r.storage_region ?? '',
          storageMemberState: r.storage_member_state,
          storageBucket: r.storage_bucket ?? '',
          storageKey: r.storage_key ?? '',
          uploadedByOrgName: r.uploaded_by_org_name,
          uploadedAt: isoInstant(r.uploaded_at),
          withdrawnAt: r.withdrawn_at ? isoInstant(r.withdrawn_at) : null,
          withdrawalReason: r.withdrawal_reason,
        });
      }
    }

    const registryRows = await tx.query<
      Record<string, unknown> & SourceCols & {
        id: string; scheme_name: string; record_type: string;
        external_record_id: string; record_url: string | null;
        project_id: string | null; unit_type_id: string | null; amount: string | null;
        unit_label: string; confirmation_status: string;
        confirmed_at: Date | null; confirmed_by_org_name: string | null;
        period_label: string; evidence_document_version_id: string;
        as_of_date: Date;
      }
    >(REGISTRY_SQL, [id]);

    const verificationRows = await tx.query<
      Record<string, unknown> & SourceCols & {
        indicator_code: string; domain: string; measure_unit: string;
        version_no: number; verifier_org_name: string | null;
        uncertainty_note: string | null;
      }
    >(VERIFICATION_SQL, [id]);

    const availRows = await tx.query<
      Record<string, unknown> & SourceCols & {
        period_label: string; starts_on: Date; ends_on: Date;
        unit_label: string; unit_of_measure: string; vintage_semantics: string;
        project_id: string; unit_type_id: string;
        expected_amount: string; buffer_amount: string; reserved_amount: string;
        committed_amount: string; remaining_amount: string;
      }
    >(AVAILABILITY_SQL, [id]);

    const textRows = await tx.query<{
      field_code: string; locale: string; version_no: number;
      status: string; is_current: boolean;
    }>(TEXTS_SQL, [id]);

    const geomRows = await tx.query<
      Record<string, unknown> & SourceCols & { kind: string; version_no: number }
    >(GEOMETRY_SQL, [id]);

    const registry: AuditRegistryRecord[] = registryRows.map((r) => ({
      id: r.id,
      schemeName: r.scheme_name,
      recordType: r.record_type,
      externalRecordId: r.external_record_id,
      recordUrl: r.record_url,
      // Selected with its project and unit type, wrapped at once. Printed with
      // its unit label and never combined with anything.
      quantity:
        r.project_id && r.unit_type_id && r.amount !== null
          ? qtyFromRow({
              project_id: r.project_id,
              unit_type_id: r.unit_type_id,
              amount: r.amount,
            })
          : null,
      unitLabel: r.unit_label,
      confirmationStatus: r.confirmation_status,
      confirmedAt: r.confirmed_at ? isoInstant(r.confirmed_at) : null,
      confirmedByOrgName: r.confirmed_by_org_name,
      periodLabel: r.period_label,
      evidenceDocumentVersionId: r.evidence_document_version_id,
      source: toSource(r)!,
      asOfDate: isoDate(r.as_of_date),
    }));

    const verification: AuditVerification[] = verificationRows.map((r) => ({
      indicatorCode: r.indicator_code,
      domain: r.domain,
      measureUnit: r.measure_unit,
      versionNo: r.version_no,
      verifierOrgName: r.verifier_org_name,
      uncertaintyNote: r.uncertainty_note,
      source: toSource(r)!,
    }));

    const availability: AuditAvailabilityRow[] = availRows.map((r) => {
      const scope = { project_id: r.project_id, unit_type_id: r.unit_type_id };
      return {
        periodLabel: r.period_label,
        startsOn: isoDate(r.starts_on),
        endsOn: isoDate(r.ends_on),
        unitLabel: r.unit_label,
        unitOfMeasure: r.unit_of_measure,
        vintageSemantics: r.vintage_semantics,
        expected: qtyFromRow({ ...scope, amount: r.expected_amount }),
        buffer: qtyFromRow({ ...scope, amount: r.buffer_amount }),
        reserved: qtyFromRow({ ...scope, amount: r.reserved_amount }),
        committed: qtyFromRow({ ...scope, amount: r.committed_amount }),
        remaining: qtyFromRow({ ...scope, amount: r.remaining_amount }),
        source: toSource(r)!,
      };
    });

    return {
      summary,
      parties: partyRows.map((r) => ({
        orgName: r.org_name,
        role: r.role,
        descriptionEn: r.description_en,
        source: toSource(r)!,
      })),
      documents,
      registry,
      verification,
      availability,
      texts: textRows.map((r) => ({
        fieldCode: r.field_code,
        locale: r.locale,
        versionNo: r.version_no,
        status: r.status,
        isCurrent: r.is_current,
      })),
      geometry: geomRows.map((r) => ({
        kind: r.kind,
        versionNo: r.version_no,
        source: toSource(r)!,
      })),
    };
  });
}

/* ------------------------------------------------------------------- deals */

const DEALS_SQL = `
  SELECT d.id::text, d.stage, d.stage_is_terminal, d.disclosed, d.opened_at,
         d.intended_shape,
         p.slug AS project_slug,
         COALESCE(t_loc.body, t_en.body, p.slug) AS project_title,
         b.legal_name::text  AS buyer_org_name,
         ow.legal_name::text AS owner_org_name,
         -- One label per deal: R5. Printed beside the legal name so an auditor
         -- can reconcile a pseudonymous public row with a named party, which
         -- no other role can do.
         dp.label AS pseudonym,
         (SELECT count(*) FROM deal.deal_stage_event se WHERE se.deal_id = d.id) AS stage_event_count,
         (SELECT count(*) FROM record.entry e WHERE e.deal_id = d.id)            AS entry_count
    FROM deal.deal d
    JOIN proj.project p      ON p.id = d.project_id
    JOIN org.organisation b  ON b.id = d.buyer_org_id
    JOIN org.organisation ow ON ow.id = d.owner_org_id
    LEFT JOIN deal.deal_pseudonym dp ON dp.deal_id = d.id
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   ORDER BY d.opened_at DESC`;

const DEAL_EVENTS_SQL = `
  SELECT deal_id, occurred_at, kind, description,
         actor_org_id, actor_org_name, actor_role_snapshot,
         actor_person_ref, actor_person_name, actor_person_label
    FROM (
      SELECT se.deal_id::text                          AS deal_id,
             se.occurred_at                            AS occurred_at,
             'stage'::text                             AS kind,
             se.from_stage || ' → ' || se.to_stage AS description,
             se.actor_org_id::text                     AS actor_org_id,
             ao.legal_name::text                       AS actor_org_name,
             se.actor_role                             AS actor_role_snapshot,
             se.actor_person_ref::text                 AS actor_person_ref,
             ua.full_name                              AS actor_person_name,
             ''::text                                  AS actor_person_label,
             se.entry_no                               AS entry_no
        FROM deal.deal_stage_event se
        LEFT JOIN org.organisation ao      ON ao.id = se.actor_org_id
        LEFT JOIN identity.user_account ua ON ua.person_ref = se.actor_person_ref
      UNION ALL
      SELECT de.deal_id::text,
             de.decided_at,
             'disclosure'::text,
             CASE WHEN de.disclosed THEN 'disclosed' ELSE 'withdrawn' END,
             de.decided_by_org_id::text,
             do_.legal_name::text,
             'decided_by'::text,
             de.decided_by_person_ref::text,
             ua2.full_name,
             ''::text,
             de.entry_no
        FROM deal.deal_disclosure_event de
        LEFT JOIN org.organisation do_      ON do_.id = de.decided_by_org_id
        LEFT JOIN identity.user_account ua2 ON ua2.person_ref = de.decided_by_person_ref
    ) ev
   ORDER BY occurred_at DESC, entry_no DESC
   LIMIT 200`;

export async function readAuditorDeals(
  actor: Actor,
  locale: string,
): Promise<{ deals: AuditDeal[]; events: AuditDealEvent[] }> {
  return readAs(actor, async (tx) => {
    const dealRows = await tx.query<Record<string, unknown> & {
      id: string; stage: string; stage_is_terminal: boolean; disclosed: boolean;
      opened_at: Date; intended_shape: string | null; project_slug: string;
      project_title: string; buyer_org_name: string; owner_org_name: string;
      pseudonym: string | null; stage_event_count: string; entry_count: string;
    }>(DEALS_SQL, [locale]);

    const eventRows = await tx.query<Record<string, unknown> & ActorCols & {
      deal_id: string; occurred_at: Date; kind: 'stage' | 'disclosure';
      description: string;
    }>(DEAL_EVENTS_SQL);

    return {
      deals: dealRows.map((r) => ({
        id: r.id,
        shortRef: shortRef(r.id),
        projectSlug: r.project_slug,
        projectTitle: r.project_title,
        stage: r.stage,
        stageIsTerminal: r.stage_is_terminal,
        disclosed: r.disclosed,
        intendedShape: r.intended_shape,
        openedAt: isoInstant(r.opened_at),
        buyerOrgName: r.buyer_org_name,
        ownerOrgName: r.owner_org_name,
        pseudonym: r.pseudonym,
        stageEventCount: Number(r.stage_event_count),
        entryCount: Number(r.entry_count),
      })),
      events: eventRows.map((r) => ({
        dealId: r.deal_id,
        dealShortRef: shortRef(r.deal_id),
        kind: r.kind,
        occurredAt: isoInstant(r.occurred_at),
        description: r.description,
        actor: toActor(r),
      })),
    };
  });
}

/* ---------------------------------------------------------- organisations */

const ORGS_SQL = `
  SELECT o.id::text, o.legal_name::text AS legal_name, o.registration_number,
         o.country_code::text AS country_code, o.sector_code, o.size_band_code,
         o.created_at,
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'roleCode', a.role_code, 'status', a.status,
                     'updatedAt', a.updated_at) ORDER BY a.role_code)
                     FROM org.org_role_approval a WHERE a.org_id = o.id), '[]'::jsonb) AS approvals,
         (SELECT count(*) FROM org.vetting_submission vs WHERE vs.org_id = o.id) AS submission_count,
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'roleCode', vd.role_code, 'decision', vd.decision::text,
                     'decidedAt', vd.decided_at, 'reason', vd.reason,
                     'decidedByOrgName', dbo.legal_name) ORDER BY vd.decided_at DESC)
                     FROM org.vetting_decision vd
                     LEFT JOIN org.organisation dbo ON dbo.id = vd.decided_by_org_id
                    WHERE vd.org_id = o.id), '[]'::jsonb) AS decisions,
         (SELECT count(*) FROM identity.user_account u  WHERE u.org_id = o.id)  AS people_count,
         (SELECT count(*) FROM identity.erasure_event e WHERE e.org_id = o.id)  AS erasure_count
    FROM org.organisation o
   ORDER BY o.legal_name`;

interface OrgRow extends Record<string, unknown> {
  id: string; legal_name: string; registration_number: string | null;
  country_code: string; sector_code: string; size_band_code: string;
  created_at: Date;
  approvals: { roleCode: string; status: string; updatedAt: string }[];
  submission_count: string;
  decisions: {
    roleCode: string; decision: string; decidedAt: string;
    reason: string | null; decidedByOrgName: string | null;
  }[];
  people_count: string; erasure_count: string;
}

export async function readAuditorOrganisations(actor: Actor): Promise<AuditOrganisation[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<OrgRow>(ORGS_SQL);
    return rows.map((r) => ({
      id: r.id,
      legalName: r.legal_name,
      registrationNumber: r.registration_number,
      countryCode: r.country_code,
      sectorCode: r.sector_code,
      sizeBandCode: r.size_band_code,
      createdAt: isoInstant(r.created_at),
      approvals: (r.approvals ?? []).map((a) => ({
        roleCode: a.roleCode,
        status: a.status,
        updatedAt: isoInstant(a.updatedAt),
      })),
      submissionCount: Number(r.submission_count),
      decisions: (r.decisions ?? []).map((d) => ({
        roleCode: d.roleCode,
        decision: d.decision,
        decidedAt: isoInstant(d.decidedAt),
        reason: d.reason,
        decidedByOrgName: d.decidedByOrgName,
      })),
      peopleCount: Number(r.people_count),
      erasureCount: Number(r.erasure_count),
    }));
  });
}

/* ------------------------------------------------------------- access log */

const ACCESS_LOG_SQL = `
  SELECT al.entry_no::text, al.at, al.actor_db_role, al.action,
         -- See FINDING-005: actor_db_role is the LOGGING FUNCTION'S owner, not
         -- the caller, because record.log_access is SECURITY DEFINER and reads
         -- current_user inside itself. Where this view wrote the line it also
         -- put the real caller in the detail, evaluated in the caller's
         -- context. Both are returned; the page prints the caller and explains
         -- the other rather than showing a role nobody was.
         al.detail ->> 'caller_role' AS caller_role,
         al.object_kind, al.object_id,
         al.actor_org_id::text,
         o.legal_name::text AS actor_org_name,
         al.actor_db_role   AS actor_role_snapshot,
         al.actor_person_ref::text,
         u.full_name        AS actor_person_name,
         ''::text           AS actor_person_label
    FROM record.access_log al
    LEFT JOIN org.organisation o      ON o.id = al.actor_org_id
    LEFT JOIN identity.user_account u ON u.person_ref = al.actor_person_ref
   ORDER BY al.at DESC, al.entry_no DESC
   LIMIT $1::int`;

export async function readAuditorAccessLog(
  actor: Actor,
  limit = 100,
): Promise<AuditAccessLogRow[]> {
  const n = Math.min(Math.max(1, Math.trunc(limit)), 500);
  return readAs(actor, async (tx) => {
    const rows = await tx.query<Record<string, unknown> & ActorCols & {
      entry_no: string; at: Date; actor_db_role: string; action: string;
      caller_role: string | null;
      object_kind: string | null; object_id: string | null;
    }>(ACCESS_LOG_SQL, [n]);
    return rows.map((r) => ({
      entryNo: r.entry_no,
      at: isoInstant(r.at),
      dbRole: r.actor_db_role,
      callerRole: r.caller_role,
      action: r.action,
      objectKind: r.object_kind,
      objectId: r.object_id,
      actor: toActor(r),
    }));
  });
}

/**
 * Record that this view was opened.
 *
 * This is the one statement in the auditor's area that is not a read, and it
 * needs saying plainly: it does NOT make the auditor role writable.
 * record.log_access is a SECURITY DEFINER function, owned by the schema owner
 * and granted EXECUTE to every role, that inserts one row into
 * record.access_log. sylva_auditor holds SELECT on that table and no INSERT -
 * ci.assert_auditor_is_read_only() would fail if it did. The auditor can ask
 * the platform to log the read; it cannot write the log itself, and it cannot
 * alter or remove a line once written, because record.access_log is
 * append-only like everything else.
 *
 * It runs through withActor() rather than readAs() for the obvious reason: a
 * READ ONLY transaction refuses the insert even inside a definer function.
 *
 * A failure here is swallowed deliberately. An auditor must be able to read
 * the record when the log is unavailable; refusing the page would turn an
 * audit-trail outage into an outage of the thing being audited. The failure is
 * logged to the server so it is not silent.
 */
export async function logAuditorAccess(
  actor: Actor,
  action: string,
  objectKind: string | null = null,
  objectId: string | null = null,
): Promise<void> {
  if (actor.kind !== 'auditor') return;
  try {
    await withActor(actor, (tx) =>
      // current_user is evaluated as an ARGUMENT, in the caller's context, so
      // it is sylva_auditor. The same expression read inside the SECURITY
      // DEFINER function - which is what the function's own actor_db_role
      // column records - returns the function owner instead. FINDING-005.
      tx.query(
        `SELECT record.log_access($1::text, $2::text, $3::text,
            jsonb_build_object('view', 'auditor', 'caller_role', current_user))`,
        [action, objectKind, objectId],
      ),
    );
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'auditor access log write failed',
      action,
      detail: err instanceof Error ? err.message : String(err),
    }));
  }
}
