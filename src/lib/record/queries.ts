import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type {
  CounterpartyKind,
  RecordClassifications,
  RecordEntry,
  RecordExtract,
  RecordFilterOptions,
} from './types';

/**
 * The public transaction record.
 *
 * Everything here reads record.v_public_entry and nothing here reads
 * record.entry. That distinction is the whole security boundary of this page:
 *
 *   - record.entry holds deal_buyer_org_id, actor_org_id and actor_person_ref.
 *     Row-level security keeps a buyer out of another buyer's rows, but the
 *     rows a reader CAN see still carry organisation identifiers.
 *   - record.v_public_entry is owned by sylva_record, applies the disclosure
 *     test as at each entry's own timestamp, and returns a label or a legal
 *     name - never an organisation id. It is the only route by which a
 *     counterparty reaches a public page.
 *
 * So this file must never "improve" a label by joining anything of its own,
 * and must never fall back to another source when counterparty_label is null.
 * A null label means the view declined to name the party, and the page says
 * so. See db/migrations/0075.
 *
 * Every query runs through readAs(), inside a READ ONLY transaction, as the
 * caller's database role. There is no publication filter and no correction
 * filter in any statement below: the view already restricts itself to public
 * entry types on public projects, and a superseded entry is deliberately still
 * returned. Nothing is ever hidden from this record - that is R4.
 */

const PAGE_SIZE = 25;
export const RECORD_PAGE_SIZE = PAGE_SIZE;

/**
 * Newest first, and stable.
 *
 * occurred_at alone is not a total order - the demo record has two entries in
 * the same minute and a real one will have entries in the same millisecond -
 * and an unstable sort makes LIMIT/OFFSET drop and duplicate rows between
 * pages. public_id breaks the tie. entry_no would order the record exactly as
 * it was written, but it is not on the view and should not be: a monotonic
 * counter tells an anonymous reader how many entries exist platform-wide,
 * including the ones on projects they cannot see.
 */
const ORDER_BY = 'ORDER BY v.occurred_at DESC, v.public_id DESC';

/**
 * The filter, as one SQL fragment used by both the page query and the count,
 * so the two can never disagree about what matched.
 *
 * $1 project slug or null, $2 entry type or null. A null parameter matches
 * everything, which keeps this one statement rather than four.
 */
const WHERE = `
   WHERE ($1::text IS NULL OR v.project_slug = $1::text)
     AND ($2::text IS NULL OR v.entry_type  = $2::text)`;

const ENTRIES_SQL = `
  SELECT v.public_id::text,
         v.occurred_at,
         v.entry_type,
         v.entry_label::text          AS entry_label_en,
         v.project_id::text,
         v.project_slug,
         COALESCE(t_loc.body, t_en.body, v.project_slug) AS project_title,
         v.counterparty_label,
         v.counterparty_is_named,
         v.actor_role_snapshot,
         v.sector_code,
         CASE WHEN $3::text = 'de' THEN COALESCE(sec.label_de, sec.label_en::text)
              ELSE sec.label_en::text END      AS sector_label,
         v.country_code::text          AS country_code,
         v.size_band_code,
         CASE WHEN $3::text = 'de' THEN COALESCE(sb.label_de, sb.label_en::text)
              ELSE sb.label_en::text END       AS size_band_label,
         v.corrects_entry_public_id::text,
         v.correction_reason,
         v.is_superseded,
         v.superseded_by_public_id::text,
         -- Provenance, per entry. record.entry.source_ref_id is NOT NULL, so
         -- this join finds a row for every entry unless the reader's role
         -- cannot read sylva.source_ref at all - hence LEFT, and hence the
         -- nullable type. The date that belongs beside an entry is the
         -- source's as_of_date, not the date this page was rendered.
         sr.kind::text                 AS source_kind,
         sr.label::text                AS source_label,
         sr.locator::text              AS source_locator,
         sr.as_of_date                 AS source_as_of_date
    FROM record.v_public_entry v
    LEFT JOIN sylva.source_ref sr ON sr.id = v.source_ref_id
    -- The project's own title, per field and per locale, exactly as the
    -- projects index resolves it. A missing German title falls back to the
    -- English one rather than removing the row: an entry must never disappear
    -- from the record because of a translation.
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = v.project_id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = v.project_id AND x.field_code = 'title'
         AND x.locale = $3::text AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN platform.sector    sec ON sec.code = v.sector_code
    LEFT JOIN platform.size_band sb  ON sb.code  = v.size_band_code
  ${WHERE}
  ${ORDER_BY}
   LIMIT $4::int OFFSET $5::int`;

const COUNT_SQL = `
  SELECT count(*)::int AS n FROM record.v_public_entry v ${WHERE}`;

interface EntryRow extends Record<string, unknown> {
  public_id: string;
  occurred_at: Date;
  entry_type: string;
  entry_label_en: string;
  project_id: string;
  project_slug: string;
  project_title: string;
  counterparty_label: string | null;
  counterparty_is_named: boolean;
  actor_role_snapshot: string;
  sector_code: string | null;
  sector_label: string | null;
  country_code: string | null;
  size_band_code: string | null;
  size_band_label: string | null;
  corrects_entry_public_id: string | null;
  correction_reason: string | null;
  is_superseded: boolean;
  superseded_by_public_id: string | null;
  source_kind: string | null;
  source_label: string | null;
  source_locator: string | null;
  source_as_of_date: Date | string | null;
}

/** ISO date, whatever pg handed back for a `date` column. */
function isoDate(v: Date | string | null): string | null {
  if (v === null) return null;
  if (v instanceof Date) {
    // A `date` arrives as local midnight; toISOString() would shift it a day
    // west of Greenwich. The parts are what the column actually holds.
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return v.slice(0, 10);
}

/**
 * A short printable reference.
 *
 * The record's public identity is a UUID and stays a UUID - it is what a
 * correction cites and what a deep link addresses. A shortened form goes in the
 * dense table, because thirteen characters can be read across a row and
 * thirty-six cannot. The full value is always in the DOM beside it, on the
 * row's id and on the title of the reference, so nothing is lost.
 *
 * BOTH ends, not just the first block. The first block alone is what this used
 * to print, and on the demo record it identifies nothing: every seeded entry is
 * ec000000-0000-0000-0000-0000000000cN, so eleven rows printed the reference
 * "ec000000" and "Corrects entry ec000000" named all of them at once. That is a
 * legibility defect on the one page whose job is to be citable, and it is not
 * only a demo-data problem: sequentially allocated or prefixed identifiers are
 * ordinary, and a reference that cannot distinguish two entries is not a
 * reference. Taking both ends keeps it readable and keeps it distinguishing.
 */
export function shortRef(publicId: string): string {
  if (publicId.length <= 13) return publicId;
  return `${publicId.slice(0, 8)}\u2026${publicId.slice(-4)}`;
}

/**
 * How the counterparty should be presented. This is a RENDERING decision made
 * from what the view already decided; it does not re-decide anything.
 */
function kindOf(r: EntryRow): CounterpartyKind {
  if (r.counterparty_label === null) return 'withheld';
  if (!r.counterparty_is_named) return 'label';
  return r.actor_role_snapshot === 'project_owner' ? 'owner' : 'named';
}

function toEntry(r: EntryRow): RecordEntry {
  return {
    publicId: r.public_id,
    shortRef: shortRef(r.public_id),
    occurredAt: new Date(r.occurred_at).toISOString(),
    entryType: r.entry_type,
    entryLabelEn: r.entry_label_en,
    projectId: r.project_id,
    projectSlug: r.project_slug,
    projectTitle: r.project_title,
    counterpartyKind: kindOf(r),
    counterpartyLabel: r.counterparty_label,
    sectorCode: r.sector_code,
    sectorLabel: r.sector_label,
    countryCode: r.country_code,
    sizeBandCode: r.size_band_code,
    sizeBandLabel: r.size_band_label,
    correctsPublicId: r.corrects_entry_public_id,
    correctsShortRef: r.corrects_entry_public_id
      ? shortRef(r.corrects_entry_public_id)
      : null,
    correctionReason: r.correction_reason,
    isSuperseded: r.is_superseded,
    supersededByPublicId: r.superseded_by_public_id,
    supersededByShortRef: r.superseded_by_public_id
      ? shortRef(r.superseded_by_public_id)
      : null,
    source: sourceOf(r),
  };
}

/**
 * The entry's own provenance, or null.
 *
 * Null is returned only when the join found nothing - a reader whose role holds
 * no privilege on sylva.source_ref. A partial source is not returned: a label
 * without a date, or a date without a label, is worse than saying the source
 * could not be read, because it looks like provenance and is not.
 */
function sourceOf(r: EntryRow): RecordEntry['source'] {
  const asOfDate = isoDate(r.source_as_of_date);
  if (r.source_label === null || asOfDate === null) return null;
  return {
    kind: r.source_kind ?? '',
    label: r.source_label,
    locator: r.source_locator,
    asOfDate,
  };
}

export interface RecordQuery {
  locale: string;
  projectSlug: string | null;
  eventType: string | null;
  /** 1-based. */
  page: number;
  /**
   * Rows per page. Defaults to RECORD_PAGE_SIZE and is clamped, because an
   * unbounded page size is a way to ask one query for the whole record.
   *
   * The page never passes this: it is not a URL parameter and must not become
   * one. It exists so a test can exercise paging against a record with fewer
   * entries than one page holds, which is the only way paging is testable
   * before the pilot has run for a while.
   */
  pageSize?: number;
}

/**
 * One page of the record, with the total that matches the same filter.
 *
 * The count and the page are read in ONE transaction, so the footer cannot
 * describe a different record from the table above it. That matters more here
 * than on most pages: entries are appended continuously and a count read a
 * moment later would routinely disagree.
 */
export async function readRecordExtract(
  actor: Actor,
  q: RecordQuery,
): Promise<RecordExtract> {
  const pageSize = Math.min(Math.max(1, Math.trunc(q.pageSize ?? PAGE_SIZE)), 200);

  return readAs(actor, async (tx) => {
    const params = [q.projectSlug, q.eventType] as const;
    const { n: total } = await tx.one<{ n: number }>(COUNT_SQL, params);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, q.page), pageCount);
    const offset = (page - 1) * pageSize;

    const rows = await tx.query<EntryRow>(ENTRIES_SQL, [
      q.projectSlug,
      q.eventType,
      q.locale,
      pageSize,
      offset,
    ]);

    return {
      entries: rows.map(toEntry),
      total,
      page,
      pageSize,
      pageCount,
      from: total === 0 ? 0 : offset + 1,
      to: offset + rows.length,
    };
  });
}

const PROJECT_OPTIONS_SQL = `
  -- Only projects that actually appear in the record. A filter that can only
  -- ever return nothing is not a filter.
  SELECT DISTINCT ON (v.project_slug)
         v.project_slug AS slug,
         COALESCE(t_loc.body, t_en.body, v.project_slug) AS title
    FROM record.v_public_entry v
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = v.project_id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = v.project_id AND x.field_code = 'title'
         AND x.locale = $1::text AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   ORDER BY v.project_slug`;

const EVENT_TYPE_OPTIONS_SQL = `
  -- Every PUBLIC entry type, whether or not it has entries yet. The vocabulary
  -- is part of what the page explains, and a type that has not happened yet is
  -- information rather than noise.
  SELECT code, label_en::text AS label_en, is_proposed_addition
    FROM record.entry_type
   WHERE is_public
   ORDER BY is_proposed_addition, code`;

export async function readRecordFilterOptions(
  actor: Actor,
  locale: string,
): Promise<RecordFilterOptions> {
  return readAs(actor, async (tx) => {
    const projects = await tx.query<{ slug: string; title: string }>(
      PROJECT_OPTIONS_SQL,
      [locale],
    );
    const eventTypes = await tx.query<{
      code: string; label_en: string; is_proposed_addition: boolean;
    }>(EVENT_TYPE_OPTIONS_SQL);

    return {
      projects: projects
        .map((p) => ({ slug: p.slug, title: p.title }))
        .sort((a, b) => a.title.localeCompare(b.title, locale)),
      eventTypes: eventTypes.map((e) => ({
        code: e.code,
        labelEn: e.label_en,
        isProposedAddition: e.is_proposed_addition,
      })),
    };
  });
}

/**
 * Which classifications the coded columns are expressed in.
 *
 * "Every figure on screen carries its source and date" applies to a coded
 * value too: "Food and beverage" means nothing until the reader knows which
 * classification produced it. Read from platform.sector / platform.size_band
 * rather than written into a message, because it is data and it is one of the
 * client's open decisions.
 */
const CLASSIFICATION_SQL = `
  SELECT (SELECT s.classification::text FROM platform.sector s
           GROUP BY s.classification ORDER BY count(*) DESC LIMIT 1) AS sector,
         (SELECT b.basis::text FROM platform.size_band b
           GROUP BY b.basis ORDER BY count(*) DESC LIMIT 1) AS size_band_basis`;

export async function readRecordClassifications(
  actor: Actor,
): Promise<RecordClassifications> {
  return readAs(actor, async (tx: Tx) => {
    const row = await tx.one<{ sector: string | null; size_band_basis: string | null }>(
      CLASSIFICATION_SQL,
    );
    return { sector: row.sector, sizeBandBasis: row.size_band_basis };
  });
}
