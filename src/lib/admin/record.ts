import { readAs, withActor, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type { CorrectionErrorCode } from './labels';

/**
 * The operator's view of the transaction record, and the one write it allows.
 *
 * WHY THIS IS NOT THE PUBLIC PAGE. /record reads record.v_public_entry, which
 * is narrower than record.entry in three ways: it drops entry types that are
 * not public, it drops entries on projects that were never published, and it
 * resolves each counterparty to a pseudonym unless that deal was flagged for
 * disclosure before the entry occurred. An operator confirming a record, or
 * answering an auditor, needs the row underneath all three.
 *
 * SO THE VIEW IS JOINED RATHER THAN REIMPLEMENTED. `on_public_record`,
 * `public_counterparty_label` and `public_counterparty_is_named` all come from
 * record.v_public_entry, left-joined on public_id. Writing the disclosure rule
 * a second time in this file is how the operator's screen and the public page
 * would come to disagree about what a visitor can see - and then the operator
 * would be confirming the wrong thing.
 *
 * AND THE DIFFERENCE IS A COLUMN, NOT A FILTER. Nothing below hides an entry.
 * The operator's policy on record.entry is USING (true); a predicate added here
 * would be application code quietly deciding what an operator may read. The
 * only filter is the reader's own, it lives in the URL, and it is validated
 * against what the database holds before it reaches a statement.
 *
 * THE WRITE. record.entry is append-only - three ALWAYS triggers refuse UPDATE,
 * DELETE and TRUNCATE - and the operator holds INSERT. So a correction is a new
 * row that points backwards at the wrong one (R4). It cannot edit it, cannot
 * hide it, and cannot be undone; the unique index ux_record_corrected_once
 * means an entry is corrected at most once, and the correcting entry is itself
 * correctable in the same way. Every constraint that shapes this is in the
 * database, and this module's job is to turn each refusal into a sentence.
 */

/* ------------------------------------------------------------- the filter */

export const RECORD_SCOPES = ['all', 'not_public', 'corrections'] as const;
export type RecordScope = (typeof RECORD_SCOPES)[number];

export function isRecordScope(value: unknown): value is RecordScope {
  return typeof value === 'string' && (RECORD_SCOPES as readonly string[]).includes(value);
}

export interface RecordProjectOption {
  slug: string;
  title: string;
}
export interface RecordEventOption {
  code: string;
  labelEn: string;
  isPublic: boolean;
}
export interface OperatorRecordOptions {
  projects: RecordProjectOption[];
  events: RecordEventOption[];
}

export interface OperatorRecordQuery {
  locale: string;
  projectSlug: string | null;
  entryType: string | null;
  scope: RecordScope;
  page: number;
}

/* -------------------------------------------------------------- the shapes */

export interface OperatorRecordSource {
  kind: string;
  label: string;
  locator: string | null;
  asOfDate: string;
}

export interface OperatorRecordEntry {
  /** record.entry.public_id - the citable reference, and the form's value. */
  publicId: string;
  shortRef: string;
  entryType: string;
  entryLabelEn: string;
  typeIsPublic: boolean;
  occurredOn: string;
  recordedOn: string;

  projectSlug: string;
  projectTitle: string;
  projectStatus: string;

  /** The real identities. Visible to an operator and to an auditor, nobody else. */
  dealId: string | null;
  buyerOrgName: string | null;
  ownerOrgName: string | null;
  actorOrgName: string;
  actorRoleSnapshot: string;
  /** The non-personal label the entry was written under; survives erasure. */
  actorPersonLabel: string;

  /** Straight from record.v_public_entry, never recomputed here. */
  onPublicRecord: boolean;
  publicCounterpartyLabel: string | null;
  publicCounterpartyIsNamed: boolean;

  correctsPublicId: string | null;
  correctsShortRef: string | null;
  correctionReason: string | null;
  correctionDepth: number;
  supersededByPublicId: string | null;
  supersededByShortRef: string | null;
  /** False where a correction already points at this entry, or the chain is full. */
  correctable: boolean;

  source: OperatorRecordSource | null;
}

export interface OperatorRecordPage {
  entries: OperatorRecordEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  from: number;
  to: number;
}

export const PAGE_SIZE = 25;

/** The first block of a uuid. Enough to recognise a row, short enough to print. */
function shortRef(publicId: string): string {
  return publicId.slice(0, 8);
}

function isoDate(value: string | Date | null): string {
  if (value === null) return '';
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- options */

const PROJECT_OPTIONS_SQL = `
  SELECT p.slug,
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
   WHERE EXISTS (SELECT 1 FROM record.entry e WHERE e.project_id = p.id)
   ORDER BY title`;

/**
 * Only the event types the record actually holds.
 *
 * An empty table reached through a filter for an event nobody has ever
 * recorded reads like "nothing happened", which is a different statement.
 */
const EVENT_OPTIONS_SQL = `
  SELECT et.code, et.label_en::text AS label_en, et.is_public
    FROM record.entry_type et
   WHERE EXISTS (SELECT 1 FROM record.entry e WHERE e.entry_type = et.code)
   ORDER BY et.label_en`;

export async function readOperatorRecordOptions(
  actor: Actor,
  locale: string,
): Promise<OperatorRecordOptions> {
  return readAs(actor, async (tx) => {
    const projects = await tx.query<{ slug: string; title: string }>(
      PROJECT_OPTIONS_SQL,
      [locale],
    );
    const events = await tx.query<{ code: string; label_en: string; is_public: boolean }>(
      EVENT_OPTIONS_SQL,
    );
    return {
      projects: projects.map((r) => ({ slug: r.slug, title: r.title })),
      events: events.map((r) => ({
        code: r.code,
        labelEn: r.label_en,
        isPublic: r.is_public,
      })),
    };
  });
}

/**
 * The reader's filter, checked against what the database holds.
 *
 * ?project=does-not-exist is a well-formed slug. Turning it into an empty table
 * would tell the operator the record is empty; saying the filter was not
 * applied tells them the truth. Same for an event type.
 */
export function parseRecordParams(
  query: Record<string, string | string[] | undefined>,
  options: OperatorRecordOptions,
): {
  projectSlug: string | null;
  entryType: string | null;
  scope: RecordScope;
  page: number;
  ignored: Array<'project' | 'event'>;
} {
  const one = (key: string): string | null => {
    const v = query[key];
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  };

  const askedProject = one('project');
  const askedEvent = one('event');
  const ignored: Array<'project' | 'event'> = [];

  const projectSlug =
    askedProject !== null && options.projects.some((p) => p.slug === askedProject)
      ? askedProject
      : null;
  if (askedProject !== null && projectSlug === null) ignored.push('project');

  const entryType =
    askedEvent !== null && options.events.some((e) => e.code === askedEvent)
      ? askedEvent
      : null;
  if (askedEvent !== null && entryType === null) ignored.push('event');

  const askedScope = one('scope');
  const scope: RecordScope = isRecordScope(askedScope) ? askedScope : 'all';

  const askedPage = Number(one('page') ?? '1');
  const page = Number.isFinite(askedPage) && askedPage >= 1 ? Math.trunc(askedPage) : 1;

  return { projectSlug, entryType, scope, page, ignored };
}

/* ------------------------------------------------------------- the reading */

/**
 * $1 project slug · $2 entry type · $3 scope · $4 locale · $5 limit · $6 offset
 *
 * The scope is one of three literals validated by isRecordScope() before it
 * reaches here, and it is still bound as a parameter rather than interpolated.
 */
const RECORD_WHERE = `
   WHERE ($1::text IS NULL OR p.slug = $1::text)
     AND ($2::text IS NULL OR e.entry_type = $2::text)
     AND ($3::text <> 'not_public'
          OR NOT EXISTS (SELECT 1 FROM record.v_public_entry vv
                          WHERE vv.public_id = e.public_id))
     AND ($3::text <> 'corrections' OR e.corrects_entry_no IS NOT NULL)`;

const RECORD_SQL = `
  SELECT e.public_id::text                       AS public_id,
         e.entry_type,
         et.label_en::text                       AS entry_label_en,
         et.is_public                            AS type_is_public,
         e.occurred_at::date::text               AS occurred_on,
         e.recorded_at::date::text               AS recorded_on,
         p.slug                                  AS project_slug,
         p.status::text                          AS project_status,
         COALESCE(t_loc.body, t_en.body, p.slug) AS project_title,
         e.deal_id::text                         AS deal_id,
         bo.legal_name::text                     AS buyer_org_name,
         oo.legal_name::text                     AS owner_org_name,
         ao.legal_name::text                     AS actor_org_name,
         e.actor_role_snapshot,
         e.actor_person_label::text              AS actor_person_label,
         -- From the public view itself. See the note at the top of this file:
         -- the disclosure rule is not restated here, it is joined.
         (v.public_id IS NOT NULL)               AS on_public_record,
         v.counterparty_label                    AS public_counterparty_label,
         COALESCE(v.counterparty_is_named, false) AS public_counterparty_is_named,
         corrected.public_id::text               AS corrects_public_id,
         e.correction_reason,
         e.correction_depth,
         (SELECT c.public_id::text FROM record.entry c
           WHERE c.corrects_entry_no = e.entry_no) AS superseded_by_public_id,
         s.kind::text                            AS src_kind,
         s.label::text                           AS src_label,
         s.locator                               AS src_locator,
         s.as_of_date                            AS src_as_of
    FROM record.entry e
    JOIN record.entry_type et ON et.code = e.entry_type
    JOIN proj.project p       ON p.id = e.project_id
    LEFT JOIN record.v_public_entry v ON v.public_id = e.public_id
    LEFT JOIN org.organisation bo ON bo.id = e.deal_buyer_org_id
    LEFT JOIN org.organisation oo ON oo.id = e.deal_owner_org_id
    LEFT JOIN org.organisation ao ON ao.id = e.actor_org_id
    LEFT JOIN sylva.source_ref s ON s.id = e.source_ref_id
    LEFT JOIN record.entry corrected ON corrected.entry_no = e.corrects_entry_no
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $4::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
  ${RECORD_WHERE}
   -- occurred_at alone is not a total order. entry_no is the order the record
   -- was written in and breaks the tie, so paging cannot drop or repeat a row.
   ORDER BY e.occurred_at DESC, e.entry_no DESC
   LIMIT $5::int OFFSET $6::int`;

const RECORD_COUNT_SQL = `
  SELECT count(*)::int AS n
    FROM record.entry e
    JOIN proj.project p ON p.id = e.project_id
  ${RECORD_WHERE}`;

interface RecordRow extends Record<string, unknown> {
  public_id: string;
  entry_type: string;
  entry_label_en: string;
  type_is_public: boolean;
  occurred_on: string;
  recorded_on: string;
  project_slug: string;
  project_status: string;
  project_title: string;
  deal_id: string | null;
  buyer_org_name: string | null;
  owner_org_name: string | null;
  actor_org_name: string | null;
  actor_role_snapshot: string;
  actor_person_label: string;
  on_public_record: boolean;
  public_counterparty_label: string | null;
  public_counterparty_is_named: boolean;
  corrects_public_id: string | null;
  correction_reason: string | null;
  correction_depth: number;
  superseded_by_public_id: string | null;
  src_kind: string | null;
  src_label: string | null;
  src_locator: string | null;
  src_as_of: string | Date | null;
}

function toEntry(r: RecordRow): OperatorRecordEntry {
  return {
    publicId: r.public_id,
    shortRef: shortRef(r.public_id),
    entryType: r.entry_type,
    entryLabelEn: r.entry_label_en,
    typeIsPublic: r.type_is_public,
    occurredOn: r.occurred_on,
    recordedOn: r.recorded_on,
    projectSlug: r.project_slug,
    projectTitle: r.project_title,
    projectStatus: r.project_status,
    dealId: r.deal_id,
    buyerOrgName: r.buyer_org_name,
    ownerOrgName: r.owner_org_name,
    actorOrgName: r.actor_org_name ?? '',
    actorRoleSnapshot: r.actor_role_snapshot,
    actorPersonLabel: r.actor_person_label,
    onPublicRecord: r.on_public_record,
    publicCounterpartyLabel: r.public_counterparty_label,
    publicCounterpartyIsNamed: r.public_counterparty_is_named,
    correctsPublicId: r.corrects_public_id,
    correctsShortRef: r.corrects_public_id ? shortRef(r.corrects_public_id) : null,
    correctionReason: r.correction_reason,
    correctionDepth: r.correction_depth,
    supersededByPublicId: r.superseded_by_public_id,
    supersededByShortRef: r.superseded_by_public_id
      ? shortRef(r.superseded_by_public_id)
      : null,
    // Two reasons an entry cannot be corrected, both of them the database's:
    // ux_record_corrected_once, and the depth CHECK at ten.
    correctable: r.superseded_by_public_id === null && r.correction_depth < 10,
    source:
      r.src_label === null
        ? null
        : {
            kind: r.src_kind ?? 'operator_statement',
            label: r.src_label,
            locator: r.src_locator,
            asOfDate: isoDate(r.src_as_of),
          },
  };
}

export async function readOperatorRecord(
  actor: Actor,
  q: OperatorRecordQuery,
): Promise<OperatorRecordPage> {
  return readAs(actor, async (tx) => {
    const filter = [q.projectSlug, q.entryType, q.scope];
    const { n } = await tx.one<{ n: number }>(RECORD_COUNT_SQL, filter);
    const pageCount = Math.max(1, Math.ceil(n / PAGE_SIZE));
    const page = Math.min(Math.max(1, q.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    const rows = await tx.query<RecordRow>(RECORD_SQL, [
      ...filter,
      q.locale,
      PAGE_SIZE,
      offset,
    ]);

    return {
      entries: rows.map(toEntry),
      total: n,
      page,
      pageSize: PAGE_SIZE,
      pageCount,
      from: n === 0 ? 0 : offset + 1,
      to: n === 0 ? 0 : offset + rows.length,
    };
  });
}

/* ------------------------------------------------------------- the write */

/** The correction target is not an entry this record holds. */
export class UnknownEntryError extends Error {
  constructor() {
    super('no such record entry');
    this.name = 'UnknownEntryError';
  }
}

/** An entry is corrected at most once - ux_record_corrected_once. */
export class AlreadyCorrectedError extends Error {
  constructor() {
    super('entry has already been corrected');
    this.name = 'AlreadyCorrectedError';
  }
}

/**
 * The provenance of the correction itself.
 *
 * source_ref_id is nullable on record.entry, but an entry written by a person
 * with no source recorded against it is an assertion with the evidence taken
 * off - and this one is an assertion that an earlier entry is wrong. So the
 * correction carries its own source: kind `operator_statement`, as of today,
 * which is exactly what it is.
 */
const INSERT_SOURCE_SQL = `
  INSERT INTO sylva.source_ref (kind, label, as_of_date)
  VALUES ('operator_statement', $1::text, current_date)
  RETURNING id::text AS id`;

/**
 * The correcting entry.
 *
 * Every field but the reason is copied from the entry being corrected or taken
 * from the session. Nothing about which project, deal or subject the correction
 * concerns comes from the form, so a crafted post cannot attach a correction to
 * an unrelated project - and the record_deal_fk composite would refuse it if it
 * tried.
 *
 * `actor_person_label` comes from identity.actor_record_label(), a SECURITY
 * DEFINER function that answers about the caller and only the caller. It is a
 * non-personal label, so the entry still renders after the person behind it is
 * erased.
 */
const INSERT_CORRECTION_SQL = `
  INSERT INTO record.entry
    (entry_type, project_id, deal_id, deal_buyer_org_id, deal_owner_org_id,
     subject_schema, subject_table, subject_id,
     actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
     source_ref_id, detail, corrects_entry_no, correction_reason)
  SELECT 'correction', o.project_id, o.deal_id, o.deal_buyer_org_id, o.deal_owner_org_id,
         o.subject_schema, o.subject_table, o.subject_id,
         sylva.actor_org_id(), 'operator', sylva.actor_person_ref(),
         identity.actor_record_label(),
         $2::uuid,
         jsonb_build_object('corrects_public_id', o.public_id::text,
                            'corrects_entry_type', o.entry_type),
         o.entry_no, $3::text
    FROM record.entry o
   WHERE o.public_id = $1::uuid
  RETURNING public_id::text AS public_id`;

export interface CorrectionInput {
  /** record.entry.public_id of the entry being corrected. */
  targetPublicId: string;
  reason: string;
}

export interface CorrectionResult {
  publicId: string;
  shortRef: string;
}

export async function recordCorrectionIn(
  tx: Tx,
  input: CorrectionInput,
): Promise<CorrectionResult> {
  // Read first, so an unknown reference is a sentence rather than a foreign-key
  // SQLSTATE, and so no source_ref is written for a correction that cannot be.
  const target = await tx.maybe<{ public_id: string }>(
    'SELECT public_id::text AS public_id FROM record.entry WHERE public_id = $1::uuid',
    [input.targetPublicId],
  );
  if (target === null) throw new UnknownEntryError();

  const src = await tx.one<{ id: string }>(INSERT_SOURCE_SQL, [
    `Correction recorded by a Sylva operator against entry ${shortRef(input.targetPublicId)}`,
  ]);

  const rows = await tx.query<{ public_id: string }>(INSERT_CORRECTION_SQL, [
    input.targetPublicId,
    src.id,
    input.reason,
  ]);
  const row = rows[0];
  if (!row) throw new UnknownEntryError();
  return { publicId: row.public_id, shortRef: shortRef(row.public_id) };
}

/**
 * Record one correction. ONE transaction: the source and the entry land
 * together or neither does, so the record can never hold a correction whose
 * provenance is missing.
 *
 * Throws. The caller maps the refusal to a sentence - see correctionErrorCode().
 */
export async function recordCorrection(
  actor: Actor,
  input: CorrectionInput,
): Promise<CorrectionResult> {
  return withActor(actor, (tx) => recordCorrectionIn(tx, input));
}

/**
 * Which sentence a refusal gets.
 *
 *   23505  ux_record_corrected_once - this entry is already corrected
 *   23514  the depth CHECK at ten, reached through a long correction chain
 *   SY023  record.set_correction_depth() could not find the target
 *   42501  RLS or a missing grant - this account is not an operator
 */
export function correctionErrorCode(err: unknown): CorrectionErrorCode {
  if (err instanceof UnknownEntryError) return 'unknown_entry';
  if (err instanceof AlreadyCorrectedError) return 'already_corrected';
  const e = err as { code?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  if (code === '23505') return 'already_corrected';
  if (code === '23514') return 'too_deep';
  if (code === 'SY023') return 'unknown_entry';
  if (code === '42501') return 'no_access';
  return 'refused';
}

/**
 * Note the read in the platform's own access log.
 *
 * Resolving a counterparty to a name is a restricted capability, and a
 * restricted capability that leaves no trace is one nobody can audit. This
 * writes through record.log_access(), a SECURITY DEFINER function, so it needs
 * withActor() rather than readAs(): a read-only transaction cannot INSERT.
 *
 * A failure here is logged and swallowed. Losing a log line is bad; turning the
 * operator's record page into an error because the log line failed is worse.
 */
export async function logOperatorRead(
  actor: Actor,
  action: string,
  objectKind: string | null = null,
  objectId: string | null = null,
): Promise<void> {
  if (actor.kind !== 'operator') return;
  try {
    await withActor(actor, (tx) =>
      tx.query(
        `SELECT record.log_access($1::text, $2::text, $3::text,
            jsonb_build_object('view', 'operator', 'caller_role', current_user))`,
        [action, objectKind, objectId],
      ),
    );
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'operator access log write failed',
      action,
      detail: err instanceof Error ? err.message : String(err),
    }));
  }
}
