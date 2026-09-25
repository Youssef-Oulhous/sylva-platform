import { readAs } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import { qtyFromRow } from '@/lib/units/qty';
import {
  isGateCode,
  wholeDaysSince,
  type OwnerInterest,
  type OwnerParty,
  type OwnerPeriod,
  type OwnerProject,
  type OwnerProjectRecord,
  type OwnerQuestion,
  type OwnerReference,
  type PublicationGateCode,
  type PublicationStatus,
  type RecordEntryView,
  type SourceRefView,
  type TextFieldValue,
} from './types';

/**
 * Everything the owner pages read.
 *
 * Every query runs through readAs(), so it executes in a READ ONLY transaction
 * as sylva_project_owner with the caller's HMAC-signed organisation context.
 * Three consequences worth stating, because they are what makes these queries
 * short:
 *
 *   - `WHERE p.owner_org_id = sylva.actor_org_id()` is a FILTER, not a security
 *     check. Row-level security has already narrowed proj.project to rows this
 *     organisation may see; the predicate is here because the owner's SELECT
 *     policy also admits every published project and this page is about its
 *     own. If the predicate were missing the page would be wrong, not leaky.
 *   - Nothing here selects org.organisation.legal_name. No public-facing role
 *     holds that column privilege, so a mistake in a template cannot leak a
 *     buyer's name - R5 is a privilege, not a convention.
 *   - Nothing here selects a *_raw column. Only the *_qty composites, which
 *     carry the project and unit type that make the number mean something.
 *
 * The unit label comes from units.unit_type_translation where the locale has
 * one and falls back to metric_label_en per row, never per page: one
 * untranslated unit type must not turn a German screen into an English one.
 */

/* ------------------------------------------------------------------ SHARED */

const PARTY_COLUMNS = `
         o.country_code                                  AS party_country,
         CASE WHEN $1 = 'de' THEN coalesce(sec.label_de, sec.label_en)
              ELSE sec.label_en END                      AS party_sector,
         CASE WHEN $1 = 'de' THEN coalesce(sb.label_de, sb.label_en)
              ELSE sb.label_en END                       AS party_size_band`;

interface PartyRow {
  party_country: string;
  party_sector: string;
  party_size_band: string;
  party_label: string | null;
}

/**
 * The counterparty, as the owner may see it.
 *
 * Pseudonymous by default, and the label is reached the only way this role can
 * reach one. Since migration 0075 (FINDING-006) no application role may read
 * the org_id column of either pseudonym table: a label is only a pseudonym
 * while the row that maps it back to an organisation is out of reach. So the
 * label comes from deal.deal_pseudonym joined on deal_id, through a deal this
 * organisation is itself a party to - which discloses nothing it did not
 * already know - and it is null wherever no deal ties the two together. The
 * screen then says "not yet labelled" rather than inventing a stand-in.
 *
 * The legal name is never selected here. The route to it is
 * deal.counterparty_legal_name(), which writes a record.access_log row and so
 * cannot run in a READ ONLY transaction: naming a counterparty is an act, and
 * an act belongs in the deal room rather than on a list.
 */
function toParty(r: PartyRow): OwnerParty {
  return {
    kind: r.party_label ? 'pseudonym' : 'unlabelled',
    label: r.party_label,
    legalName: null,
    sectorLabel: r.party_sector,
    countryCode: r.party_country,
    sizeBandLabel: r.party_size_band,
  };
}

interface AvailRow extends Record<string, unknown> {
  project_id: string; unit_type_id: string; period_id: string;
  period_label: string; starts_on: string; ends_on: string;
  unit_label: string; unit_of_measure: string;
  expected_amount: string; buffer_amount: string; reserved_amount: string;
  committed_amount: string; remaining_amount: string;
  src_label: string; src_locator: string | null; src_as_of: string; src_kind: string;
}

/**
 * One period of one project. Each amount is selected together with the project
 * and unit type it belongs to and wrapped in a UnitQty immediately, so a bare
 * number never escapes this function.
 */
function toPeriod(r: AvailRow): OwnerPeriod {
  const scope = { project_id: r.project_id, unit_type_id: r.unit_type_id };
  const source: SourceRefView = {
    label: r.src_label, locator: r.src_locator,
    asOfDate: r.src_as_of, kind: r.src_kind,
  };
  return {
    periodId: r.period_id,
    periodLabel: r.period_label,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    unitTypeId: r.unit_type_id,
    unitLabel: r.unit_label,
    unitOfMeasure: r.unit_of_measure,
    expected: qtyFromRow({ ...scope, amount: r.expected_amount }),
    buffer: qtyFromRow({ ...scope, amount: r.buffer_amount }),
    reserved: qtyFromRow({ ...scope, amount: r.reserved_amount }),
    committed: qtyFromRow({ ...scope, amount: r.committed_amount }),
    remaining: qtyFromRow({ ...scope, amount: r.remaining_amount }),
    source,
  };
}

const AVAILABILITY_SQL = `
  SELECT a.project_id, a.unit_type_id, a.period_id, a.period_label,
         a.starts_on::text AS starts_on, a.ends_on::text AS ends_on,
         coalesce(utt.metric_label, a.unit_metric_label) AS unit_label,
         a.unit_of_measure,
         (a.expected_issuance_qty).amount AS expected_amount,
         (a.buffer_qty).amount            AS buffer_amount,
         (a.reserved_qty).amount          AS reserved_amount,
         (a.committed_qty).amount         AS committed_amount,
         (a.remaining_qty).amount         AS remaining_amount,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.v_period_availability a
    JOIN sylva.source_ref s ON s.id = a.forecast_source_ref_id
    LEFT JOIN units.unit_type_translation utt
           ON utt.unit_type_id = a.unit_type_id AND utt.locale = $2
   WHERE a.project_id = ANY($1::uuid[])
   ORDER BY a.project_id, a.starts_on`;

/* ---------------------------------------------------------- THE DASHBOARD */

const PROJECT_LIST_SQL = `
  SELECT p.id, p.slug, p.country_code, p.status::text AS status,
         coalesce(t_loc.body, t_en.body, p.slug) AS title,
         (t_loc.body IS NULL)                    AS title_is_fallback,
         proj.publication_gaps(p.id)             AS gaps,
         sc.name                                 AS scheme_name,
         coalesce(utt.metric_label, ut.metric_label_en) AS unit_label,
         greatest(
           p.created_at,
           coalesce((SELECT max(x.recorded_at) FROM proj.project_text x
                      WHERE x.project_id = p.id), p.created_at),
           coalesce((SELECT max(f.recorded_at) FROM proj.period_forecast f
                      WHERE f.project_id = p.id), p.created_at),
           coalesce((SELECT max(g.recorded_at) FROM geo.project_geometry g
                      WHERE g.project_id = p.id), p.created_at)
         )::date::text AS last_change_on,
         (SELECT count(*) FROM deal.project_question q
           WHERE q.project_id = p.id
             AND NOT EXISTS (SELECT 1 FROM deal.project_question_answer a
                              WHERE a.question_id = q.id))::int AS open_questions,
         (SELECT count(*) FROM deal.deal d
           WHERE d.project_id = p.id AND NOT d.stage_is_terminal)::int AS open_interest
    FROM proj.project p
    -- The owner's own record, not the published page: the latest version of
    -- each field is shown whatever its translation status, because a draft the
    -- owner is writing is exactly what this page is for.
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN LATERAL (
      SELECT put.unit_type_id, put.scheme_id
        FROM proj.project_unit_type put
       WHERE put.project_id = p.id
       ORDER BY put.declared_at LIMIT 1) spine ON true
    LEFT JOIN units.scheme sc    ON sc.id = spine.scheme_id
    LEFT JOIN units.unit_type ut ON ut.id = spine.unit_type_id
    LEFT JOIN units.unit_type_translation utt
           ON utt.unit_type_id = spine.unit_type_id AND utt.locale = $1
   WHERE p.owner_org_id = sylva.actor_org_id()
   ORDER BY p.status, coalesce(t_loc.body, t_en.body, p.slug)`;

interface ProjectRow extends Record<string, unknown> {
  id: string; slug: string; country_code: string; status: PublicationStatus;
  title: string; title_is_fallback: boolean; gaps: string[] | null;
  scheme_name: string | null; unit_label: string | null;
  last_change_on: string; open_questions: number; open_interest: number;
}

function gapsOf(raw: string[] | null): PublicationGateCode[] {
  return (raw ?? []).filter(isGateCode);
}

/** Every project this organisation owns, with its live publication gate. */
export async function listOwnerProjects(
  actor: Actor,
  locale: string,
): Promise<OwnerProject[]> {
  const today = new Date().toISOString().slice(0, 10);

  return readAs(actor, async (tx) => {
    const rows = await tx.query<ProjectRow>(PROJECT_LIST_SQL, [locale]);
    if (rows.length === 0) return [];

    const avail = await tx.query<AvailRow>(AVAILABILITY_SQL, [
      rows.map((r) => r.id),
      locale,
    ]);
    const nearest = new Map<string, OwnerPeriod>();
    for (const a of avail) {
      // Rows arrive ordered by starts_on, so the first one seen for a project
      // is the nearest period. Nothing is added across them.
      if (!nearest.has(a.project_id)) nearest.set(a.project_id, toPeriod(a));
    }

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      titleIsFallback: r.title_is_fallback,
      countryCode: r.country_code,
      status: r.status,
      isPublished: r.status === 'published',
      schemeName: r.scheme_name,
      unitLabel: r.unit_label,
      lastChangeOn: r.last_change_on,
      gateCheckedOn: today,
      gaps: gapsOf(r.gaps),
      nearestPeriod: nearest.get(r.id) ?? null,
      openQuestions: Number(r.open_questions),
      openInterest: Number(r.open_interest),
    }));
  });
}

/* ------------------------------------------------- THE PRIVATE QUESTION BOX */

const QUESTION_SQL = `
  SELECT q.id::text AS id, q.project_id, p.slug AS project_slug,
         p.country_code AS project_country,
         coalesce(t_loc.body, t_en.body, p.slug) AS project_title,
         q.body, q.asked_at::text AS asked_at,
         ps.label AS party_label,
${PARTY_COLUMNS}
    FROM deal.project_question q
    JOIN proj.project p ON p.id = q.project_id
    JOIN org.organisation o ON o.id = q.asker_org_id
    LEFT JOIN platform.sector    sec ON sec.code = o.sector_code
    LEFT JOIN platform.size_band sb  ON sb.code  = o.size_band_code
    -- The label this asker carries on a deal with THIS owner, if any. Joined
    -- through deal_id, never through org_id, which no application role may read.
    LEFT JOIN LATERAL (
      SELECT dp.label
        FROM deal.deal d
        JOIN deal.deal_pseudonym dp ON dp.deal_id = d.id
       WHERE d.project_id = q.project_id
         AND d.buyer_org_id = q.asker_org_id
         AND d.owner_org_id = sylva.actor_org_id()
       ORDER BY d.opened_at DESC LIMIT 1) ps ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE q.owner_org_id = sylva.actor_org_id()
   ORDER BY q.asked_at DESC, q.id DESC`;

const ANSWER_SQL = `
  SELECT a.id::text AS id, a.question_id::text AS question_id, a.body,
         a.answered_at::text AS answered_at,
         pp.legal_name AS by_org_name
    FROM deal.project_question_answer a
    JOIN deal.project_question q ON q.id = a.question_id
    LEFT JOIN org.v_public_party pp ON pp.id = a.answered_by_org_id
   WHERE q.owner_org_id = sylva.actor_org_id()
   ORDER BY a.answered_at, a.id`;

interface QuestionRow extends PartyRow, Record<string, unknown> {
  id: string; project_id: string; project_slug: string; project_country: string;
  project_title: string; body: string; asked_at: string;
}

interface AnswerRow extends Record<string, unknown> {
  id: string; question_id: string; body: string; answered_at: string;
  by_org_name: string | null;
}

/**
 * Every question asked about this organisation's projects, newest first, with
 * its answers.
 *
 * RLS does the scoping: p_question_owner admits only rows whose owner_org_id is
 * the actor's organisation, and p_answer_read follows the question. A buyer's
 * question about another owner's project is not filtered out here - it never
 * arrives.
 */
export async function listOwnerQuestions(
  actor: Actor,
  locale: string,
): Promise<OwnerQuestion[]> {
  const now = new Date();

  return readAs(actor, async (tx) => {
    const rows = await tx.query<QuestionRow>(QUESTION_SQL, [locale]);
    if (rows.length === 0) return [];

    const answers = await tx.query<AnswerRow>(ANSWER_SQL, []);
    const byQuestion = new Map<string, AnswerRow[]>();
    for (const a of answers) {
      const list = byQuestion.get(a.question_id) ?? [];
      list.push(a);
      byQuestion.set(a.question_id, list);
    }

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectSlug: r.project_slug,
      projectTitle: r.project_title,
      projectCountryCode: r.project_country,
      asker: toParty(r),
      body: r.body,
      askedOn: r.asked_at,
      daysWaiting: wholeDaysSince(r.asked_at, now),
      answers: (byQuestion.get(r.id) ?? []).map((a) => ({
        id: a.id,
        body: a.body,
        byOrgName: a.by_org_name,
        answeredOn: a.answered_at,
      })),
    }));
  });
}

/* ------------------------------------------------------ EXPRESSED INTEREST */

const INTEREST_SQL = `
  SELECT d.id, d.project_id,
         coalesce(t_loc.body, t_en.body, p.slug) AS project_title,
         d.intended_shape AS shape_code, sh.label_en AS shape_label,
         d.stage AS stage_code, st.label_en AS stage_label,
         d.opened_at::text AS opened_at,
         ps.label AS party_label,
${PARTY_COLUMNS}
    FROM deal.deal d
    JOIN proj.project p ON p.id = d.project_id
    JOIN org.organisation o ON o.id = d.buyer_org_id
    JOIN deal.deal_stage st ON st.code = d.stage
    LEFT JOIN deal.deal_shape sh ON sh.code = d.intended_shape
    LEFT JOIN platform.sector    sec ON sec.code = o.sector_code
    LEFT JOIN platform.size_band sb  ON sb.code  = o.size_band_code
    -- One label per DEAL (migration 0021), joined on deal_id. Two deals by the
    -- same buyer on the same project carry different labels and are not
    -- linkable to each other.
    LEFT JOIN deal.deal_pseudonym ps ON ps.deal_id = d.id
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE d.owner_org_id = sylva.actor_org_id()
     AND NOT d.stage_is_terminal
   ORDER BY d.opened_at`;

interface InterestRow extends PartyRow, Record<string, unknown> {
  id: string; project_id: string; project_title: string;
  shape_code: string | null; shape_label: string | null;
  stage_code: string; stage_label: string; opened_at: string;
}

/**
 * Live deals on this organisation's projects.
 *
 * There is no volume column and no price column, because at stage
 * 'interest_expressed' the database holds neither: expressing interest opens a
 * private room, it does not reserve anything (concept note section 7, and
 * docs/DECISIONS.md D2). An empty column would read as missing data, so there
 * is no column.
 */
export async function listOwnerInterest(
  actor: Actor,
  locale: string,
): Promise<OwnerInterest[]> {
  const now = new Date();

  return readAs(actor, async (tx) => {
    const rows = await tx.query<InterestRow>(INTEREST_SQL, [locale]);
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectTitle: r.project_title,
      buyer: toParty(r),
      shapeCode: r.shape_code,
      shapeLabel: r.shape_label,
      stageCode: r.stage_code,
      stageLabel: r.stage_label,
      receivedOn: r.opened_at,
      daysWaiting: wholeDaysSince(r.opened_at, now),
    }));
  });
}

/* ------------------------------------------------------------- THE RECORD */

interface RecordHeadRow extends Record<string, unknown> {
  id: string; slug: string; country_code: string; status: PublicationStatus;
  created_at: string; last_change_on: string; gaps: string[] | null;
  scheme_name: string | null; unit_label: string | null; unit_type_id: string | null;
  boundary_versions: number; documents: number;
}

const RECORD_HEAD_SQL = `
  SELECT p.id, p.slug, p.country_code, p.status::text AS status,
         p.created_at::text AS created_at,
         greatest(
           p.created_at,
           coalesce((SELECT max(x.recorded_at) FROM proj.project_text x
                      WHERE x.project_id = p.id), p.created_at),
           coalesce((SELECT max(g.recorded_at) FROM geo.project_geometry g
                      WHERE g.project_id = p.id), p.created_at)
         )::date::text AS last_change_on,
         proj.publication_gaps(p.id) AS gaps,
         sc.name AS scheme_name,
         coalesce(utt.metric_label, ut.metric_label_en) AS unit_label,
         spine.unit_type_id,
         (SELECT count(*) FROM geo.project_geometry g
           WHERE g.project_id = p.id AND g.kind = 'boundary')::int AS boundary_versions,
         (SELECT count(*) FROM doc.document d
           WHERE d.project_id = p.id)::int AS documents
    FROM proj.project p
    LEFT JOIN LATERAL (
      SELECT put.unit_type_id, put.scheme_id FROM proj.project_unit_type put
       WHERE put.project_id = p.id ORDER BY put.declared_at LIMIT 1) spine ON true
    LEFT JOIN units.scheme sc    ON sc.id = spine.scheme_id
    LEFT JOIN units.unit_type ut ON ut.id = spine.unit_type_id
    LEFT JOIN units.unit_type_translation utt
           ON utt.unit_type_id = spine.unit_type_id AND utt.locale = $2
   WHERE p.slug = $1 AND p.owner_org_id = sylva.actor_org_id()`;

/** Latest version of every (field, locale) this project holds. */
const RECORD_TEXT_SQL = `
  SELECT DISTINCT ON (t.field_code, t.locale)
         t.field_code, t.locale, t.body, t.version_no, t.status::text AS status
    FROM proj.project_text t
   WHERE t.project_id = $1
   ORDER BY t.field_code, t.locale, t.version_no DESC`;

const RECORD_CLAIMS_SQL = `
  SELECT DISTINCT ON (c.benefit_key)
         c.benefit_key AS key, c.version_no,
         coalesce(ct_loc.benefit_label, ct_en.benefit_label, c.benefit_key) AS label,
         coalesce(ct_loc.exclusions, ct_en.exclusions, '') AS detail,
         coalesce(ct_loc.status, ct_en.status)::text AS public_status,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.claim_right c
    JOIN sylva.source_ref s ON s.id = c.source_ref_id
    LEFT JOIN proj.claim_right_text ct_en
           ON ct_en.project_id = c.project_id AND ct_en.benefit_key = c.benefit_key
          AND ct_en.version_no = c.version_no AND ct_en.locale = 'en'
    LEFT JOIN proj.claim_right_text ct_loc
           ON ct_loc.project_id = c.project_id AND ct_loc.benefit_key = c.benefit_key
          AND ct_loc.version_no = c.version_no AND ct_loc.locale = $2
   WHERE c.project_id = $1
   ORDER BY c.benefit_key, c.version_no DESC`;

const RECORD_OUTCOMES_SQL = `
  SELECT DISTINCT ON (oi.indicator_code)
         oi.indicator_code AS key, oi.version_no,
         coalesce(ot_loc.what_is_measured, ot_en.what_is_measured, oi.indicator_code) AS label,
         oi.domain || ' · ' || oi.measure_unit AS detail,
         coalesce(ot_loc.status, ot_en.status)::text AS public_status,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.outcome_indicator oi
    JOIN sylva.source_ref s ON s.id = oi.source_ref_id
    LEFT JOIN proj.outcome_indicator_text ot_en
           ON ot_en.project_id = oi.project_id AND ot_en.indicator_code = oi.indicator_code
          AND ot_en.version_no = oi.version_no AND ot_en.locale = 'en'
    LEFT JOIN proj.outcome_indicator_text ot_loc
           ON ot_loc.project_id = oi.project_id AND ot_loc.indicator_code = oi.indicator_code
          AND ot_loc.version_no = oi.version_no AND ot_loc.locale = $2
   WHERE oi.project_id = $1
   ORDER BY oi.indicator_code, oi.version_no DESC`;

const RECORD_DURABILITY_SQL = `
  SELECT DISTINCT ON (d.commitment_key)
         d.commitment_key AS key, d.version_no,
         coalesce(dt_loc.statement, dt_en.statement, d.commitment_key) AS label,
         coalesce(d.ends_on::text, d.horizon_years::text || ' y', '') AS detail,
         coalesce(dt_loc.status, dt_en.status)::text AS public_status,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.durability_commitment d
    JOIN sylva.source_ref s ON s.id = d.source_ref_id
    LEFT JOIN proj.durability_commitment_text dt_en
           ON dt_en.project_id = d.project_id AND dt_en.commitment_key = d.commitment_key
          AND dt_en.version_no = d.version_no AND dt_en.locale = 'en'
    LEFT JOIN proj.durability_commitment_text dt_loc
           ON dt_loc.project_id = d.project_id AND dt_loc.commitment_key = d.commitment_key
          AND dt_loc.version_no = d.version_no AND dt_loc.locale = $2
   WHERE d.project_id = $1
   ORDER BY d.commitment_key, d.version_no DESC`;

const RECORD_PARTIES_SQL = `
  SELECT pp.party_role || ':' || pp.party_org_id::text AS key, 1 AS version_no,
         coalesce(vp.legal_name, pp.party_org_id::text) AS label,
         coalesce(pr.label_en, pp.party_role) AS detail,
         NULL::text AS public_status,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.project_party pp
    JOIN sylva.source_ref s ON s.id = pp.source_ref_id
    LEFT JOIN proj.party_role pr ON pr.code = pp.party_role
    LEFT JOIN org.v_public_party vp ON vp.id = pp.party_org_id
   WHERE pp.project_id = $1
   ORDER BY pp.party_role`;

interface EntryRow extends Record<string, unknown> {
  key: string; version_no: number; label: string; detail: string;
  /** i18n.translation_status of the latest version's text, null for a party. */
  public_status: string | null;
  src_label: string; src_locator: string | null; src_as_of: string; src_kind: string;
}

function toEntry(r: EntryRow): RecordEntryView {
  return {
    key: r.key,
    versionNo: Number(r.version_no),
    label: r.label,
    detail: r.detail,
    publicStatus: r.public_status,
    source: {
      label: r.src_label, locator: r.src_locator,
      asOfDate: r.src_as_of, kind: r.src_kind,
    },
  };
}

/**
 * One project, as its owner edits it.
 *
 * Returns null where the slug does not name a project this organisation owns.
 * That is one answer for "no such project" and for "somebody else's project",
 * on purpose: distinguishing them would turn the edit route into a way to find
 * out which slugs exist as other organisations' drafts.
 */
export async function getOwnerProjectRecord(
  actor: Actor,
  slug: string,
  locale: string,
): Promise<OwnerProjectRecord | null> {
  return readAs(actor, async (tx) => {
    const head = await tx.maybe<RecordHeadRow>(RECORD_HEAD_SQL, [slug, locale]);
    if (!head) return null;

    const args = [head.id, locale];
    const [text, claims, outcomes, durability, parties, avail] = await Promise.all([
      tx.query<TextFieldValue & Record<string, unknown>>(RECORD_TEXT_SQL, [head.id]),
      tx.query<EntryRow>(RECORD_CLAIMS_SQL, args),
      tx.query<EntryRow>(RECORD_OUTCOMES_SQL, args),
      tx.query<EntryRow>(RECORD_DURABILITY_SQL, args),
      tx.query<EntryRow>(RECORD_PARTIES_SQL, [head.id]),
      tx.query<AvailRow>(AVAILABILITY_SQL, [[head.id], locale]),
    ]);

    return {
      id: head.id,
      slug: head.slug,
      countryCode: head.country_code,
      status: head.status,
      createdAt: head.created_at,
      lastChangeOn: head.last_change_on,
      gaps: gapsOf(head.gaps),
      text: text.map((t) => ({
        fieldCode: (t as unknown as { field_code: string }).field_code,
        locale: t.locale,
        body: t.body,
        versionNo: Number((t as unknown as { version_no: number }).version_no),
        status: t.status,
      })),
      schemeName: head.scheme_name,
      unitLabel: head.unit_label,
      unitTypeId: head.unit_type_id,
      boundaryVersions: Number(head.boundary_versions),
      claimRights: claims.map(toEntry),
      outcomes: outcomes.map(toEntry),
      durability: durability.map(toEntry),
      parties: parties.map(toEntry),
      periods: avail.map(toPeriod),
      documents: Number(head.documents),
    };
  });
}

/* --------------------------------------------------------- REFERENCE DATA */

/**
 * The lists the form offers, read from the database rather than typed into a
 * constant. A hard-coded code list is a foreign key violation waiting to
 * happen: the registration form shipped with one and every submission it made
 * would have been refused.
 */
export async function getOwnerReference(
  actor: Actor,
  locale: string,
): Promise<OwnerReference> {
  return readAs(actor, async (tx) => {
    const [schemes, unitTypes, countries, textFields, partyRoles, orgs] =
      await Promise.all([
        tx.query<{ id: string; name: string }>(
          'SELECT id, name FROM units.scheme ORDER BY name',
        ),
        tx.query<{
          id: string; scheme_id: string; code: string; label: string;
          unit_of_measure: string; vintage_semantics: string;
        }>(
          `SELECT ut.id, ut.scheme_id, ut.code,
                  coalesce(utt.metric_label, ut.metric_label_en) AS label,
                  ut.unit_of_measure, ut.vintage_semantics::text AS vintage_semantics
             FROM units.unit_type ut
             LEFT JOIN units.unit_type_translation utt
                    ON utt.unit_type_id = ut.id AND utt.locale = $1
            ORDER BY ut.code`,
          [locale],
        ),
        // platform.eu_member_state holds one name per state, in English. The
        // screen localises the two-letter code with Intl.DisplayNames rather
        // than the database carrying a name per locale, so a locale the
        // platform gains later needs no data migration.
        tx.query<{ code: string; label: string }>(
          'SELECT code, name_en AS label FROM platform.eu_member_state ORDER BY name_en',
        ),
        tx.query<{ code: string; label_en: string; required_for_publication: boolean; max_chars: number | null }>(
          'SELECT code, label_en, required_for_publication, max_chars FROM proj.text_field ORDER BY code',
        ),
        tx.query<{ code: string; label_en: string }>(
          'SELECT code, label_en FROM proj.party_role ORDER BY label_en',
        ),
        // The ONLY route to another organisation's name available to this role.
        // It names declared parties and owners of already-public projects and
        // nobody else - see db/migrations/0022.
        tx.query<{ id: string; legal_name: string }>(
          'SELECT id, legal_name FROM org.v_public_party ORDER BY legal_name',
        ),
      ]);

    return {
      schemes,
      unitTypes: unitTypes.map((u) => ({
        id: u.id, schemeId: u.scheme_id, code: u.code, label: u.label,
        unitOfMeasure: u.unit_of_measure, vintageSemantics: u.vintage_semantics,
      })),
      countries,
      textFields: textFields.map((f) => ({
        code: f.code, labelEn: f.label_en,
        required: f.required_for_publication, maxChars: f.max_chars,
      })),
      partyRoles: partyRoles.map((r) => ({ code: r.code, labelEn: r.label_en })),
      nameableOrgs: orgs.map((o) => ({ id: o.id, name: o.legal_name })),
    };
  });
}

/* ------------------------------------------------- THE OWNER'S OWN NAME */

/**
 * This organisation's own legal name, for the letterhead on its dashboard.
 *
 * org.actor_organisation_name() takes no argument and resolves through the
 * signed actor context, so no id can be substituted and a forged context
 * returns NULL. Reading your own name is not the read that needs a trace;
 * another organisation's name is still reachable only through
 * deal.counterparty_legal_name(), which logs it. See migration 0066.
 */
export async function getOwnerOrganisationName(actor: Actor): Promise<string | null> {
  return readAs(actor, async (tx) => {
    const row = await tx.one<{ name: string | null }>(
      'SELECT org.actor_organisation_name() AS name',
    );
    return row.name;
  });
}
