import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import { qtyFromRow } from '@/lib/units/qty';
import type {
  BuyerProximity,
  ClaimRight,
  DurabilityCommitment,
  EvidencePack,
  EvidencePackItem,
  GeometryLayer,
  InvestorInfo,
  Localised,
  OutcomeFigure,
  OutcomeIndicator,
  Partner,
  PeriodAvailability,
  PeriodRow,
  ProjectDetail,
  ProjectDocumentRow,
  ProjectQuestionThread,
  ProjectSummary,
  ProjectText,
  SourceRef,
  TimelineEntry,
} from './types';

/**
 * Every query here runs through readAs(), so it executes inside a READ ONLY
 * transaction as the caller's database role with the caller's signed
 * organisation context. An anonymous visitor is served by sylva_web_anon, which
 * is a member of nothing and holds no grant on any private table.
 *
 * Nothing in this file filters by publication status. It does not need to:
 * row-level security does it, and duplicating the rule in application code is
 * how the two drift apart.
 */

interface AvailRow extends Record<string, unknown> {
  project_id: string; unit_type_id: string; period_id: string;
  period_label: string; starts_on: string; ends_on: string;
  unit_type_code: string; unit_metric_label: string; unit_of_measure: string;
  vintage_semantics: PeriodAvailability['vintageSemantics'];
  expected_amount: string; buffer_amount: string; reserved_amount: string;
  committed_amount: string; remaining_amount: string;
  src_label: string; src_locator: string | null; src_as_of: string; src_kind: string;
}

// Each quantity is selected together with the project and unit type it belongs
// to, and immediately wrapped in a UnitQty. A bare amount never escapes this
// function.
function toAvailability(r: AvailRow): PeriodAvailability {
  const scope = { project_id: r.project_id, unit_type_id: r.unit_type_id };
  const source: SourceRef = {
    label: r.src_label, locator: r.src_locator,
    asOfDate: r.src_as_of, kind: r.src_kind,
  };
  return {
    periodId: r.period_id,
    periodLabel: r.period_label,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    unitTypeId: r.unit_type_id,
    unitTypeCode: r.unit_type_code,
    unitMetricLabel: r.unit_metric_label,
    unitOfMeasure: r.unit_of_measure,
    vintageSemantics: r.vintage_semantics,
    expected:  qtyFromRow({ ...scope, amount: r.expected_amount }),
    buffer:    qtyFromRow({ ...scope, amount: r.buffer_amount }),
    reserved:  qtyFromRow({ ...scope, amount: r.reserved_amount }),
    committed: qtyFromRow({ ...scope, amount: r.committed_amount }),
    remaining: qtyFromRow({ ...scope, amount: r.remaining_amount }),
    source,
  };
}

const AVAILABILITY_SQL = `
  SELECT a.project_id, a.unit_type_id, a.period_id, a.period_label,
         a.starts_on, a.ends_on, a.unit_type_code, a.unit_metric_label,
         a.unit_of_measure, a.vintage_semantics,
         (a.expected_issuance_qty).amount AS expected_amount,
         (a.buffer_qty).amount            AS buffer_amount,
         (a.reserved_qty).amount          AS reserved_amount,
         (a.committed_qty).amount         AS committed_amount,
         (a.remaining_qty).amount         AS remaining_amount,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.v_period_availability a
    JOIN sylva.source_ref s ON s.id = a.forecast_source_ref_id
   WHERE a.project_id = ANY($1::uuid[])
   ORDER BY a.project_id, a.starts_on`;

const PROJECT_LIST_SQL = `
  -- Locale fallback is PER FIELD, not per project and not per list.
  -- A German page with one untranslated section must still be a German page,
  -- and a missing translation must never remove a project from the index.
  -- Only 'published' and 'reviewed' translations are shown: a machine_draft or
  -- an unreviewed human_draft is not something to put in front of a buyer.
  SELECT p.id, p.slug, p.country_code, p.status::text AS status,
         o.legal_name AS owner_org_name,
         COALESCE(t_loc.body, t_en.body)   AS title,
         COALESCE(s_loc.body, s_en.body)   AS summary,
         (t_loc.body IS NULL)              AS title_is_fallback,
         sc.name                           AS scheme_name,
         COALESCE(
           (SELECT array_agg(DISTINCT oi.domain ORDER BY oi.domain)
              FROM proj.outcome_indicator oi
             WHERE oi.project_id = p.id), '{}') AS outcome_domains,
         -- Simplified for the thumbnail only. The downloadable GeoJSON is the
         -- full-precision geometry, served from its own route.
         (SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(g.geom, 0.002))
            FROM geo.project_geometry g
           WHERE g.project_id = p.id AND g.kind = 'boundary'
           ORDER BY g.version_no DESC LIMIT 1) AS boundary_geojson
    FROM proj.project p
    -- org.v_public_party, not org.organisation: no public-facing role may read
    -- legal_name directly. The view names only declared parties and owners of
    -- already-public projects. See db/migrations/0022.
    JOIN org.v_public_party o ON o.id = p.owner_org_id
    JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = $1 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'summary'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) s_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'summary'
         AND x.locale = $1 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) s_loc ON true
    LEFT JOIN LATERAL (
      SELECT s2.name FROM proj.project_unit_type put
       JOIN units.scheme s2 ON s2.id = put.scheme_id
      WHERE put.project_id = p.id LIMIT 1) sc ON true
   ORDER BY COALESCE(t_loc.body, t_en.body)`;

interface ProjectRow extends Record<string, unknown> {
  id: string; slug: string; country_code: string; status: string;
  owner_org_name: string; title: string; summary: string | null;
  scheme_name: string | null; outcome_domains: string[];
  title_is_fallback: boolean;
  boundary_geojson: string | null;
}

/**
 * Published projects, in the caller's locale.
 *
 * Falls back to English per field when a German translation is missing, rather
 * than hiding the project: a missing translation must never remove a project
 * from the index.
 */
export async function listProjects(
  actor: Actor,
  locale: string,
): Promise<ProjectSummary[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<ProjectRow>(PROJECT_LIST_SQL, [locale]);
    if (rows.length === 0) return [];

    const avail = await tx.query<AvailRow>(AVAILABILITY_SQL, [rows.map((r) => r.id)]);
    const byProject = new Map<string, PeriodAvailability[]>();
    for (const a of avail) {
      const list = byProject.get(a.project_id) ?? [];
      list.push(toAvailability(a));
      byProject.set(a.project_id, list);
    }

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      countryCode: r.country_code,
      status: r.status,
      ownerOrgName: r.owner_org_name,
      titleIsFallback: r.title_is_fallback,
      boundaryGeoJson: r.boundary_geojson,
      schemeName: r.scheme_name ?? '',
      outcomeDomains: r.outcome_domains ?? [],
      availability: byProject.get(r.id) ?? [],
    }));
  });
}

/* ========================================================================== */
/* The project page                                                            */
/* ========================================================================== */

/**
 * Everything the page at /projects/[slug] renders, read in one READ ONLY
 * transaction as the caller's own database role.
 *
 * Three things are worth knowing before changing anything below.
 *
 * 1. NOTHING HERE FILTERS BY PUBLICATION. A draft project is invisible because
 *    proj.is_publicly_visible() says so inside the row-level policy, not
 *    because of a WHERE clause here. `getProjectDetail` returning null IS the
 *    404, and it is the database's answer, not this module's opinion.
 *
 * 2. SOME TABLES ARE NOT GRANTED TO EVERY ROLE. An anonymous visitor holds no
 *    privilege at all on proj.evidence_pack_item, proj.project_financials or
 *    deal.project_question — a SELECT would raise 42501 and abort the whole
 *    transaction, taking the public page down with it. So those three reads are
 *    guarded by `capabilities()` below, which mirrors migration 0016's grants.
 *    The guard decides whether to ASK; the database still decides the answer.
 *
 * 3. LOCALE FALLBACK IS PER FIELD. Each query fetches the requested locale and
 *    English together and the assembly picks per field, marking what fell back.
 *    Only 'published' and 'reviewed' translations are eligible: a machine draft
 *    is not something to put in front of a buyer.
 */

/** What this actor's ROLE is even allowed to ask for. Mirrors migration 0016. */
function capabilities(actor: Actor) {
  const memberRole = actor.kind === 'member' ? actor.role : null;
  const privileged = actor.kind === 'operator' || actor.kind === 'auditor';
  return {
    /** proj.evidence_pack_item: granted to buyer, project owner, operator, auditor. */
    evidenceItems:
      privileged || memberRole === 'buyer' || memberRole === 'project_owner',
    /** proj.project_financials: granted to investor, project owner, operator, auditor. */
    financials:
      privileged || memberRole === 'investor' || memberRole === 'project_owner',
    /** deal.project_question: granted to buyer, investor, project owner, operator, auditor. */
    questions:
      privileged || memberRole === 'buyer' || memberRole === 'investor'
      || memberRole === 'project_owner',
    /** INSERT on deal.project_question. The operator asks on somebody's behalf. */
    askQuestion: actor.kind === 'operator' || memberRole === 'buyer' || memberRole === 'investor',
    /** geo.buyer_site holds the viewer's own sites. Only a buyer has any. */
    ownSites: memberRole === 'buyer',
  };
}

interface SourceCols extends Record<string, unknown> {
  src_label: string;
  src_locator: string | null;
  src_as_of: string;
  src_kind: string;
}

/** The four columns every provenance join selects, under one alias. */
const SOURCE_COLS = `s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind`;

function toSource(r: SourceCols): SourceRef {
  return {
    label: r.src_label,
    locator: r.src_locator,
    asOfDate: r.src_as_of,
    kind: r.src_kind,
  };
}

/**
 * Per-FIELD locale fallback.
 *
 * Preference order is: the locale asked for, then English, then whatever else
 * exists. A field is only taken from a row where it is actually present, so a
 * row that carries three translated fields and one empty one falls back on that
 * one field alone rather than dragging the whole row back to English.
 */
function localised<T extends { locale: string }>(
  rows: readonly T[],
  locale: string,
  pick: (row: T) => string | null | undefined,
): Localised | null {
  const order = [
    ...rows.filter((r) => r.locale === locale),
    ...rows.filter((r) => r.locale === 'en' && r.locale !== locale),
    ...rows.filter((r) => r.locale !== locale && r.locale !== 'en'),
  ];
  for (const row of order) {
    const body = pick(row);
    if (body !== null && body !== undefined && body !== '') {
      return { body, locale: row.locale, isFallback: row.locale !== locale };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ project */

interface DetailRow extends Record<string, unknown> {
  id: string;
  slug: string;
  country_code: string;
  country_name_en: string | null;
  status: string;
  published_at: Date | null;
  owner_org_id: string;
  owner_org_name: string;
  unit_type_id: string;
  unit_type_code: string;
  unit_metric_label_en: string;
  unit_definition_en: string;
  unit_of_measure: string;
  vintage_semantics: PeriodAvailability['vintageSemantics'];
  unit_source_label: string;
  unit_as_of: string;
  scheme_code: string;
  scheme_name: string;
  scheme_registry_url: string | null;
  scheme_source_label: string;
  scheme_as_of: string;
  has_verification_report: boolean;
}

const DETAIL_SQL = `
  SELECT p.id, p.slug, p.country_code, p.status::text AS status, p.published_at,
         p.owner_org_id, o.legal_name AS owner_org_name,
         ms.name_en AS country_name_en,
         ut.id   AS unit_type_id,
         ut.code AS unit_type_code,
         ut.metric_label_en   AS unit_metric_label_en,
         ut.definition_en     AS unit_definition_en,
         ut.unit_of_measure, ut.vintage_semantics,
         ut.source_label      AS unit_source_label,
         ut.as_of_date::text  AS unit_as_of,
         sc.code AS scheme_code, sc.name AS scheme_name,
         sc.registry_url AS scheme_registry_url,
         sc.source_label AS scheme_source_label,
         sc.as_of_date::text AS scheme_as_of,
         EXISTS (
           SELECT 1 FROM doc.document d
            JOIN doc.document_version dv ON dv.document_id = d.id
           WHERE d.project_id = p.id AND d.kind = 'verification_report'
         ) AS has_verification_report
    FROM proj.project p
    -- org.v_public_party, not org.organisation: no public-facing role may read
    -- legal_name directly. See db/migrations/0022.
    JOIN org.v_public_party o ON o.id = p.owner_org_id
    LEFT JOIN platform.eu_member_state ms ON ms.code = p.country_code
    -- A published project always has exactly one declared unit type; the LEFT
    -- JOIN is here so a half-built draft cannot 500 an operator's preview.
    LEFT JOIN proj.project_unit_type put ON put.project_id = p.id
    LEFT JOIN units.unit_type ut ON ut.id = put.unit_type_id
    LEFT JOIN units.scheme sc ON sc.id = put.scheme_id
   WHERE p.slug = $1`;

/* --------------------------------------------------------------------- text */

interface TextRow extends SourceCols, Record<string, unknown> {
  field_code: string;
  locale: string;
  body: string;
}

const TEXT_SQL = `
  SELECT x.field_code, x.locale, x.body, ${SOURCE_COLS}
    FROM proj.project_text x
    JOIN sylva.source_ref s ON s.id = x.source_ref_id
   WHERE x.project_id = $1
     AND x.locale IN ('en', $2)
     AND x.status IN ('published','reviewed')
     -- R4: nothing is edited, so "current" means the highest version that
     -- exists for this field in this locale. The earlier ones stay readable.
     AND x.version_no = (
       SELECT max(v.version_no) FROM proj.project_text v
        WHERE v.project_id = x.project_id AND v.field_code = x.field_code
          AND v.locale = x.locale AND v.status IN ('published','reviewed'))`;

function projectText(rows: TextRow[], field: string, locale: string): ProjectText | null {
  const forField = rows.filter((r) => r.field_code === field);
  const value = localised(forField, locale, (r) => r.body);
  if (!value) return null;
  const row = forField.find((r) => r.locale === value.locale)!;
  return { ...value, source: toSource(row) };
}

/* ----------------------------------------------------------------- geometry */

interface GeomRow extends SourceCols, Record<string, unknown> {
  kind: 'boundary' | 'catchment';
  version_no: number;
  dataset_name: string | null;
  source_licence: string;
  as_of_date: string;
  geojson: string;
  area_ha: string;
  area_km2: string;
}

const GEOMETRY_SQL = `
  SELECT DISTINCT ON (g.kind)
         g.kind::text AS kind, g.version_no, g.dataset_name, g.source_licence,
         g.as_of_date::text AS as_of_date,
         -- Simplified for drawing only. /api/projects/[slug]/boundary.geojson
         -- serves the full-precision geometry; a page never inlines it.
         ST_AsGeoJSON(ST_SimplifyPreserveTopology(g.geom, 0.0015)) AS geojson,
         -- Geodesic area, computed on the geography. Not planar degrees.
         round((ST_Area(g.geom::geography) / 10000)::numeric, 0)   AS area_ha,
         round((ST_Area(g.geom::geography) / 1000000)::numeric, 0) AS area_km2,
         ${SOURCE_COLS}
    FROM geo.project_geometry g
    JOIN sylva.source_ref s ON s.id = g.source_ref_id
   WHERE g.project_id = $1
   ORDER BY g.kind, g.version_no DESC`;

function toLayer(r: GeomRow): GeometryLayer {
  return {
    kind: r.kind,
    versionNo: r.version_no,
    datasetName: r.dataset_name,
    licence: r.source_licence,
    asOfDate: r.as_of_date,
    geoJson: r.geojson,
    areaHectares: Number(r.area_ha),
    areaKm2: Number(r.area_km2),
    source: toSource(r),
  };
}

/* ----------------------------------------------------------------- outcomes */

interface OutcomeRow extends SourceCols, Record<string, unknown> {
  indicator_code: string;
  version_no: number;
  domain: 'water' | 'biodiversity';
  measure_unit: string;
  uncertainty_note: string | null;
  verifier_name: string | null;
}

const OUTCOME_SQL = `
  WITH current_version AS (
    SELECT DISTINCT ON (o.indicator_code) o.*
      FROM proj.outcome_indicator o
     WHERE o.project_id = $1
     ORDER BY o.indicator_code, o.version_no DESC)
  SELECT c.indicator_code, c.version_no, c.domain, c.measure_unit,
         c.uncertainty_note, v.legal_name AS verifier_name, ${SOURCE_COLS}
    FROM current_version c
    LEFT JOIN org.v_public_party v ON v.id = c.verifier_org_id
    JOIN sylva.source_ref s ON s.id = c.source_ref_id
   ORDER BY c.domain, c.indicator_code`;

interface OutcomeTextRow extends Record<string, unknown> {
  indicator_code: string;
  version_no: number;
  locale: string;
  what_is_measured: string;
  method_note: string | null;
}

const OUTCOME_TEXT_SQL = `
  SELECT ot.indicator_code, ot.version_no, ot.locale,
         ot.what_is_measured, ot.method_note
    FROM proj.outcome_indicator_text ot
   WHERE ot.project_id = $1 AND ot.locale IN ('en', $2)
     AND ot.status IN ('published','reviewed')`;

interface IndicatorValueRow extends SourceCols, Record<string, unknown> {
  indicator_code: string;
  version_no: number;
  value_kind: OutcomeFigure['kind'];
  value_numeric: string;
  measure_unit: string;
  uncertainty_low: string | null;
  uncertainty_high: string | null;
  as_of_date: string;
}

const INDICATOR_VALUE_SQL = `
  SELECT v.indicator_code, v.version_no, v.value_kind, v.value_numeric,
         v.measure_unit, v.uncertainty_low, v.uncertainty_high,
         v.as_of_date::text AS as_of_date, ${SOURCE_COLS}
    FROM proj.indicator_value v
    JOIN sylva.source_ref s ON s.id = v.source_ref_id
   WHERE v.project_id = $1
   ORDER BY v.indicator_code, v.as_of_date`;

function toFigure(r: IndicatorValueRow): OutcomeFigure {
  return {
    kind: r.value_kind,
    amount: Number(r.value_numeric),
    measureUnit: r.measure_unit,
    uncertaintyLow: r.uncertainty_low === null ? null : Number(r.uncertainty_low),
    uncertaintyHigh: r.uncertainty_high === null ? null : Number(r.uncertainty_high),
    asOfDate: r.as_of_date,
    source: toSource(r),
  };
}

/* ------------------------------------------------------------- claim rights */

interface ClaimRow extends SourceCols, Record<string, unknown> {
  benefit_key: string;
  version_no: number;
  sort_order: number;
}

const CLAIM_SQL = `
  WITH current_version AS (
    SELECT DISTINCT ON (c.benefit_key) c.*
      FROM proj.claim_right c WHERE c.project_id = $1
     ORDER BY c.benefit_key, c.version_no DESC)
  SELECT c.benefit_key, c.version_no, c.sort_order, ${SOURCE_COLS}
    FROM current_version c
    JOIN sylva.source_ref s ON s.id = c.source_ref_id
   ORDER BY c.sort_order, c.benefit_key`;

interface ClaimTextRow extends Record<string, unknown> {
  benefit_key: string;
  version_no: number;
  locale: string;
  benefit_label: string;
  who_may_claim: string;
  for_what: string;
  exclusions: string;
}

const CLAIM_TEXT_SQL = `
  SELECT ct.benefit_key, ct.version_no, ct.locale, ct.benefit_label,
         ct.who_may_claim, ct.for_what, ct.exclusions
    FROM proj.claim_right_text ct
   WHERE ct.project_id = $1 AND ct.locale IN ('en', $2)
     AND ct.status IN ('published','reviewed')`;

/* --------------------------------------------------------------- durability */

interface DurabilityRow extends SourceCols, Record<string, unknown> {
  commitment_key: string;
  version_no: number;
  horizon_years: number | null;
  starts_on: string | null;
  ends_on: string | null;
  responsible_name: string | null;
}

const DURABILITY_SQL = `
  WITH current_version AS (
    SELECT DISTINCT ON (d.commitment_key) d.*
      FROM proj.durability_commitment d WHERE d.project_id = $1
     ORDER BY d.commitment_key, d.version_no DESC)
  SELECT d.commitment_key, d.version_no, d.horizon_years,
         d.starts_on::text AS starts_on, d.ends_on::text AS ends_on,
         r.legal_name AS responsible_name, ${SOURCE_COLS}
    FROM current_version d
    LEFT JOIN org.v_public_party r ON r.id = d.responsible_org_id
    JOIN sylva.source_ref s ON s.id = d.source_ref_id
   ORDER BY d.commitment_key`;

interface DurabilityTextRow extends Record<string, unknown> {
  commitment_key: string;
  version_no: number;
  locale: string;
  statement: string;
  land_control_note: string;
}

const DURABILITY_TEXT_SQL = `
  SELECT dt.commitment_key, dt.version_no, dt.locale, dt.statement,
         dt.land_control_note
    FROM proj.durability_commitment_text dt
   WHERE dt.project_id = $1 AND dt.locale IN ('en', $2)
     AND dt.status IN ('published','reviewed')`;

/* ------------------------------------------------------------------ periods */

interface PeriodRowRaw extends SourceCols, Record<string, unknown> {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
}

const PERIOD_SQL = `
  SELECT pe.id, pe.label, pe.starts_on::text AS starts_on,
         pe.ends_on::text AS ends_on, ${SOURCE_COLS}
    FROM proj.period pe
    JOIN sylva.source_ref s ON s.id = pe.source_ref_id
   WHERE pe.project_id = $1
   ORDER BY pe.starts_on`;

/* ---------------------------------------------------------------- documents */

interface DocumentRowRaw extends Record<string, unknown> {
  id: string;
  kind: string;
  visibility: ProjectDocumentRow['visibility'];
  version_no: number | null;
  media_type: string | null;
  byte_size: string | null;
  uploaded_at: Date | null;
  uploaded_by_name: string | null;
  doc_locale: string | null;
}

const DOCUMENT_SQL = `
  SELECT d.id, d.kind, d.visibility::text AS visibility,
         dv.version_no, dv.media_type, dv.byte_size, dv.uploaded_at,
         dv.locale AS doc_locale, u.legal_name AS uploaded_by_name
    FROM doc.document d
    -- The withdrawal filter lives in the row-level policy on document_version,
    -- not here: a withdrawn version is invisible, and a document whose only
    -- version was withdrawn is listed with nothing to download.
    LEFT JOIN LATERAL (
      SELECT v.* FROM doc.document_version v
       WHERE v.document_id = d.id
       ORDER BY v.version_no DESC LIMIT 1) dv ON true
    LEFT JOIN org.v_public_party u ON u.id = dv.uploaded_by_org_id
   WHERE d.project_id = $1
   ORDER BY d.kind`;

/* ----------------------------------------------------------------- partners */

interface PartyRow extends SourceCols, Record<string, unknown> {
  party_org_id: string;
  party_role: string;
  legal_name: string;
  country_code: string;
  description_en: string | null;
}

const PARTY_SQL = `
  SELECT pp.party_org_id, pp.party_role, o.legal_name, o.country_code,
         pp.description_en, ${SOURCE_COLS}
    FROM proj.project_party pp
    JOIN org.v_public_party o ON o.id = pp.party_org_id
    JOIN sylva.source_ref s ON s.id = pp.source_ref_id
   WHERE pp.project_id = $1
   ORDER BY pp.party_role`;

/* ----------------------------------------------------------- evidence pack */

/**
 * The five elements, in the order the concept note lists them rather than
 * alphabetically: a measurable action, a fixed timeframe, expected impact, a
 * budget, a verification standard. That is the order a reporting assessor reads
 * them in. proj.evidence_pack_element carries no sort column, so the order is
 * stated here as presentation and anything unrecognised sorts after, by code.
 */
const EVIDENCE_ELEMENT_SQL = `
  SELECT code, label_en,
         array_position(ARRAY['measurable_action','fixed_timeframe',
                              'expected_impact','budget','verification_standard'],
                        code) AS narrative_order
    FROM proj.evidence_pack_element
   ORDER BY narrative_order NULLS LAST, code`;

const EVIDENCE_ITEM_SQL = `
  SELECT ei.element_code, ei.item_no, ei.note, ei.source_metric_code,
         ei.assembled_at, d.kind AS document_kind, dv.version_no AS document_version_no
    FROM proj.evidence_pack_item ei
    LEFT JOIN doc.document_version dv ON dv.id = ei.source_document_version_id
    LEFT JOIN doc.document d ON d.id = dv.document_id
   WHERE ei.project_id = $1
   ORDER BY ei.element_code, ei.item_no`;

/* -------------------------------------------------------------- financials */

const FINANCIALS_SQL = `
  SELECT f.financing_need, f.currency, f.revenue_streams_note,
         f.financial_model_document_id, f.as_of_date::text AS as_of_date,
         ${SOURCE_COLS}
    FROM proj.project_financials f
    JOIN sylva.source_ref s ON s.id = f.source_ref_id
   WHERE f.project_id = $1
   ORDER BY f.version_no DESC
   LIMIT 1`;

/* --------------------------------------------------------------- questions */

const QUESTION_SQL = `
  SELECT q.id::text AS id, q.body, q.asked_at
    FROM deal.project_question q
   WHERE q.project_id = $1
   ORDER BY q.asked_at DESC`;

const ANSWER_SQL = `
  SELECT a.id::text AS id, a.question_id::text AS question_id, a.body,
         a.answered_at, o.legal_name AS answered_by_name
    FROM deal.project_question_answer a
    LEFT JOIN org.v_public_party o ON o.id = a.answered_by_org_id
   WHERE a.question_id = ANY($1::bigint[])
   ORDER BY a.answered_at`;

/* ------------------------------------------------------------------ deal shapes */

const DEAL_SHAPE_SQL = `SELECT code, label_en FROM deal.deal_shape`;

/* ---------------------------------------------------------------- assembly */

const AVAILABILITY_ONE_PROJECT_SQL = AVAILABILITY_SQL;

/**
 * The whole project page, or null when the slug names nothing this caller may
 * see — an unknown slug and an unpublished one are the same answer on purpose,
 * because telling a stranger that a draft exists is itself a disclosure.
 */
export async function getProjectDetail(
  actor: Actor,
  slug: string,
  locale: string,
): Promise<ProjectDetail | null> {
  const can = capabilities(actor);

  return readAs(actor, async (tx) => {
    const p = await tx.maybe<DetailRow>(DETAIL_SQL, [slug]);
    if (!p) return null;
    const id = p.id;

    // Sequential, not Promise.all: these all run on ONE connection inside one
    // transaction, so there is no parallelism to win, and node-postgres
    // deprecates overlapping queries on a single client.
    const textRows       = await tx.query<TextRow>(TEXT_SQL, [id, locale]);
    const geomRows       = await tx.query<GeomRow>(GEOMETRY_SQL, [id]);
    const outcomeRows    = await tx.query<OutcomeRow>(OUTCOME_SQL, [id]);
    const outcomeTextRows = await tx.query<OutcomeTextRow>(OUTCOME_TEXT_SQL, [id, locale]);
    const valueRows      = await tx.query<IndicatorValueRow>(INDICATOR_VALUE_SQL, [id]);
    const claimRows      = await tx.query<ClaimRow>(CLAIM_SQL, [id]);
    const claimTextRows  = await tx.query<ClaimTextRow>(CLAIM_TEXT_SQL, [id, locale]);
    const durRows        = await tx.query<DurabilityRow>(DURABILITY_SQL, [id]);
    const durTextRows    = await tx.query<DurabilityTextRow>(DURABILITY_TEXT_SQL, [id, locale]);
    const periodRows     = await tx.query<PeriodRowRaw>(PERIOD_SQL, [id]);
    const availRows      = await tx.query<AvailRow>(AVAILABILITY_ONE_PROJECT_SQL, [[id]]);
    const docRows        = await tx.query<DocumentRowRaw>(DOCUMENT_SQL, [id]);
    const partyRows      = await tx.query<PartyRow>(PARTY_SQL, [id]);
    const elementRows    = await tx.query<{ code: string; label_en: string }>(EVIDENCE_ELEMENT_SQL);
    const shapeRows      = await tx.query<{ code: string; label_en: string }>(DEAL_SHAPE_SQL);

    const title = projectText(textRows, 'title', locale);
    // A project with no title in any published locale cannot be rendered as a
    // document, and the publication gate refuses to publish one. Treating it as
    // absent is safer than printing a slug where a name belongs.
    if (!title) return null;

    /* outcomes ------------------------------------------------------------ */
    const outcomes: OutcomeIndicator[] = outcomeRows.map((o) => {
      const texts = outcomeTextRows.filter(
        (t) => t.indicator_code === o.indicator_code && t.version_no === o.version_no,
      );
      const values = valueRows.filter(
        (v) => v.indicator_code === o.indicator_code && v.version_no === o.version_no,
      );
      return {
        code: o.indicator_code,
        versionNo: o.version_no,
        domain: o.domain,
        measureUnit: o.measure_unit,
        whatIsMeasured: localised(texts, locale, (t) => t.what_is_measured),
        methodNote: localised(texts, locale, (t) => t.method_note),
        verifierName: o.verifier_name,
        uncertaintyNote: o.uncertainty_note,
        baseline: values.filter((v) => v.value_kind === 'baseline').map(toFigure)[0] ?? null,
        target: values.filter((v) => v.value_kind === 'target').map(toFigure)[0] ?? null,
        measured: values.filter((v) => v.value_kind === 'measured').map(toFigure),
        source: toSource(o),
      };
    });

    /* claim rights -------------------------------------------------------- */
    const claimRights: ClaimRight[] = claimRows.map((c) => {
      const texts = claimTextRows.filter(
        (t) => t.benefit_key === c.benefit_key && t.version_no === c.version_no,
      );
      return {
        benefitKey: c.benefit_key,
        versionNo: c.version_no,
        sortOrder: c.sort_order,
        benefitLabel: localised(texts, locale, (t) => t.benefit_label),
        whoMayClaim: localised(texts, locale, (t) => t.who_may_claim),
        forWhat: localised(texts, locale, (t) => t.for_what),
        exclusions: localised(texts, locale, (t) => t.exclusions),
        source: toSource(c),
      };
    });

    /* durability ---------------------------------------------------------- */
    const durability: DurabilityCommitment[] = durRows.map((d) => {
      const texts = durTextRows.filter(
        (t) => t.commitment_key === d.commitment_key && t.version_no === d.version_no,
      );
      return {
        commitmentKey: d.commitment_key,
        versionNo: d.version_no,
        statement: localised(texts, locale, (t) => t.statement),
        landControlNote: localised(texts, locale, (t) => t.land_control_note),
        responsibleOrgName: d.responsible_name,
        startsOn: d.starts_on,
        endsOn: d.ends_on,
        horizonYears: d.horizon_years,
        source: toSource(d),
      };
    });

    /* periods and availability -------------------------------------------- */
    const availByPeriod = new Map<string, PeriodAvailability>();
    for (const a of availRows) availByPeriod.set(a.period_id, toAvailability(a));

    const periods: PeriodRow[] = periodRows.map((pe) => ({
      id: pe.id,
      label: pe.label,
      startsOn: pe.starts_on,
      endsOn: pe.ends_on,
      source: toSource(pe),
      availability: availByPeriod.get(pe.id) ?? null,
    }));

    /* the timeline: recorded dates only ------------------------------------ */
    const timeline: TimelineEntry[] = [];
    if (p.published_at) {
      timeline.push({
        id: 'platform-record',
        kind: 'platform_record',
        when: String(p.published_at.getFullYear()),
        startsOn: p.published_at.toISOString().slice(0, 10),
        endsOn: null,
        source: null,
      });
    }
    for (const pe of periods) {
      timeline.push({
        id: `period-${pe.id}`,
        kind: 'outcome_period',
        when: pe.label,
        startsOn: pe.startsOn,
        endsOn: pe.endsOn,
        source: pe.source,
      });
    }
    for (const d of durability) {
      if (!d.startsOn && !d.endsOn) continue;
      timeline.push({
        id: `commitment-${d.commitmentKey}`,
        kind: 'commitment',
        when: [d.startsOn?.slice(0, 4), d.endsOn?.slice(0, 4)].filter(Boolean).join('–'),
        startsOn: d.startsOn,
        endsOn: d.endsOn,
        source: d.source,
      });
    }
    timeline.sort((a, b) => (a.startsOn ?? '').localeCompare(b.startsOn ?? ''));

    /* documents ----------------------------------------------------------- */
    const documents: ProjectDocumentRow[] = docRows.map((d) => ({
      id: d.id,
      kind: d.kind,
      visibility: d.visibility,
      versionNo: d.version_no,
      mediaType: d.media_type,
      byteSize: d.byte_size === null ? null : Number(d.byte_size),
      uploadedAt: d.uploaded_at ? d.uploaded_at.toISOString().slice(0, 10) : null,
      uploadedByName: d.uploaded_by_name,
      locale: d.doc_locale,
      available: d.version_no !== null,
    }));

    /* partners: the owner first, then the declared parties ---------------- */
    const partners: Partner[] = [
      {
        orgId: p.owner_org_id,
        role: 'owner',
        name: p.owner_org_name,
        countryCode: p.country_code,
        description: null,
        source: null,
      },
      ...partyRows.map((pp) => ({
        orgId: pp.party_org_id,
        role: pp.party_role,
        name: pp.legal_name,
        countryCode: pp.country_code,
        // description_en is English in the schema, so for any other locale it
        // is a fallback by construction and is marked as one.
        description: pp.description_en
          ? { body: pp.description_en, locale: 'en', isFallback: locale !== 'en' }
          : null,
        source: toSource(pp),
      })),
    ];

    /* evidence pack, financials, questions: role-gated --------------------- */
    const unitMetricLabel = await unitLabel(tx, p, locale, 'metric_label', p.unit_metric_label_en);
    const unitDefinition = await unitLabel(tx, p, locale, 'definition', p.unit_definition_en);

    const evidencePack = await readEvidencePack(tx, id, elementRows, can.evidenceItems);
    const investor = await readInvestorInfo(tx, id, can.financials);
    const questions = can.questions ? await readQuestions(tx, id) : null;

    return {
      id,
      slug: p.slug,
      countryCode: p.country_code,
      countryNameEn: p.country_name_en ?? p.country_code,
      status: p.status,
      publishedAt: p.published_at ? p.published_at.toISOString() : null,
      ownerOrgId: p.owner_org_id,
      ownerOrgName: p.owner_org_name,
      title,
      summary: projectText(textRows, 'summary', locale),
      catchmentContext: projectText(textRows, 'catchment_context', locale),
      durabilityNote: projectText(textRows, 'durability_note', locale),
      partnersNote: projectText(textRows, 'partners_note', locale),
      scheme: {
        code: p.scheme_code,
        name: p.scheme_name,
        registryUrl: p.scheme_registry_url,
        sourceLabel: p.scheme_source_label,
        asOfDate: p.scheme_as_of,
      },
      unitType: {
        id: p.unit_type_id,
        code: p.unit_type_code,
        // units.unit_type_translation carries the German label once it is
        // reviewed; until then the English one is shown and marked.
        metricLabel: unitMetricLabel,
        definition: unitDefinition,
        unitOfMeasure: p.unit_of_measure,
        vintageSemantics: p.vintage_semantics,
        sourceLabel: p.unit_source_label,
        asOfDate: p.unit_as_of,
      },
      boundary: geomRows.filter((g) => g.kind === 'boundary').map(toLayer)[0] ?? null,
      catchment: geomRows.filter((g) => g.kind === 'catchment').map(toLayer)[0] ?? null,
      outcomes,
      claimRights,
      durability,
      timeline,
      periods,
      documents,
      partners,
      evidencePack,
      investor,
      dealShapes: shapeRows.map((r) => ({ code: r.code, labelEn: r.label_en })),
      hasVerificationReport: p.has_verification_report,
      questions,
      canAskQuestion: can.askQuestion,
    };
  });
}

/** The unit type's label in the reader's locale, or English, marked. */
async function unitLabel(
  tx: Tx,
  p: DetailRow,
  locale: string,
  column: 'metric_label' | 'definition',
  english: string,
): Promise<Localised> {
  if (locale === 'en' || !p.unit_type_id) {
    return { body: english, locale: 'en', isFallback: false };
  }
  const row = await tx.maybe<{ body: string }>(
    `SELECT ${column} AS body FROM units.unit_type_translation
      WHERE unit_type_id = $1 AND locale = $2 AND status IN ('published','reviewed')`,
    [p.unit_type_id, locale],
  );
  return row
    ? { body: row.body, locale, isFallback: false }
    : { body: english, locale: 'en', isFallback: true };
}

async function readEvidencePack(
  tx: Tx,
  projectId: string,
  elements: { code: string; label_en: string }[],
  allowed: boolean,
): Promise<EvidencePack> {
  const base = {
    elements: elements.map((e) => ({ code: e.code, labelEn: e.label_en })),
  };
  if (!allowed) return { ...base, items: null, assembledAt: null };

  const rows = await tx.query<{
    element_code: string; item_no: number; note: string | null;
    source_metric_code: string | null; assembled_at: Date;
    document_kind: string | null; document_version_no: number | null;
  }>(EVIDENCE_ITEM_SQL, [projectId]);

  const items: EvidencePackItem[] = rows.map((r) => ({
    elementCode: r.element_code,
    itemNo: r.item_no,
    note: r.note,
    documentKind: r.document_kind,
    documentVersionNo: r.document_version_no,
    metricCode: r.source_metric_code,
  }));
  const assembledAt = rows[0]?.assembled_at?.toISOString() ?? null;
  return { ...base, items, assembledAt };
}

async function readInvestorInfo(
  tx: Tx,
  projectId: string,
  allowed: boolean,
): Promise<InvestorInfo> {
  const withheld: InvestorInfo = {
    visible: false, financingNeed: null, currency: null,
    revenueStreamsNote: null, financialModelDocumentId: null,
    asOfDate: null, source: null,
  };
  if (!allowed) return withheld;

  const row = await tx.maybe<SourceCols & {
    financing_need: string | null; currency: string;
    revenue_streams_note: string | null;
    financial_model_document_id: string | null; as_of_date: string;
  }>(FINANCIALS_SQL, [projectId]);
  // The grant exists but the row-level policy still decides. An unvetted
  // investor gets no row, which is "withheld", not an error.
  if (!row) return withheld;

  return {
    visible: true,
    financingNeed: row.financing_need === null ? null : Number(row.financing_need),
    currency: row.currency,
    revenueStreamsNote: row.revenue_streams_note,
    financialModelDocumentId: row.financial_model_document_id,
    asOfDate: row.as_of_date,
    source: toSource(row),
  };
}

async function readQuestions(tx: Tx, projectId: string): Promise<ProjectQuestionThread[]> {
  const qs = await tx.query<{ id: string; body: string; asked_at: Date }>(
    QUESTION_SQL, [projectId],
  );
  if (qs.length === 0) return [];

  const as = await tx.query<{
    id: string; question_id: string; body: string;
    answered_at: Date; answered_by_name: string | null;
  }>(ANSWER_SQL, [qs.map((q) => q.id)]);

  return qs.map((q) => ({
    id: q.id,
    body: q.body,
    askedAt: q.asked_at.toISOString(),
    answers: as
      .filter((a) => a.question_id === q.id)
      .map((a) => ({
        id: a.id,
        body: a.body,
        answeredAt: a.answered_at.toISOString(),
        answeredByName: a.answered_by_name,
      })),
  }));
}

/* ------------------------------------------------------ the buyer's own sites */

const PROXIMITY_SQL = `
  SELECT s.id, s.label, s.country_code,
         round(ST_Distance(s.geom::geography, b.geom::geography)::numeric, 0) AS distance_m,
         CASE WHEN c.geom IS NULL THEN NULL
              ELSE ST_Intersects(c.geom, s.geom) END AS in_catchment,
         c.dataset_name AS catchment_dataset,
         cs.label AS c_label, cs.locator AS c_locator,
         cs.as_of_date::text AS c_as_of, cs.kind::text AS c_kind,
         bs.label AS b_label, bs.locator AS b_locator,
         bs.as_of_date::text AS b_as_of, bs.kind::text AS b_kind
    FROM geo.buyer_site s
    -- One boundary and one catchment, both the current version. The buyer's
    -- sites come from geo.buyer_site, whose policy is org_id = actor_org_id():
    -- another organisation's site cannot enter this result at all.
    CROSS JOIN LATERAL (
      SELECT g.geom, g.source_ref_id FROM geo.project_geometry g
       WHERE g.project_id = $1 AND g.kind = 'boundary'
       ORDER BY g.version_no DESC LIMIT 1) b
    JOIN sylva.source_ref bs ON bs.id = b.source_ref_id
    LEFT JOIN LATERAL (
      SELECT g.geom, g.dataset_name, g.source_ref_id FROM geo.project_geometry g
       WHERE g.project_id = $1 AND g.kind = 'catchment'
       ORDER BY g.version_no DESC LIMIT 1) c ON true
    LEFT JOIN sylva.source_ref cs ON cs.id = c.source_ref_id
   ORDER BY distance_m`;

/**
 * How far each of the VIEWER'S OWN sites is from this project, and whether it
 * sits inside the project's catchment.
 *
 * Private to the owning buyer, twice over: only a buyer's role holds any
 * privilege on geo.buyer_site, and the policy on that table restricts it to
 * `org_id = sylva.actor_org_id()` — an HMAC-signed value the role cannot forge
 * (FINDING-001). This function returns null for everybody else rather than an
 * empty list, so a page can tell "no sites registered" from "not your question".
 *
 * The caller must keep this OUT of any cached or shared response. The page that
 * uses it is rendered dynamically for that reason.
 */
export async function getBuyerSiteProximity(
  actor: Actor,
  projectId: string,
): Promise<BuyerProximity | null> {
  if (!capabilities(actor).ownSites) return null;

  return readAs(actor, async (tx) => {
    const rows = await tx.query<{
      id: string; label: string; country_code: string;
      distance_m: string; in_catchment: boolean | null;
      catchment_dataset: string | null;
      c_label: string | null; c_locator: string | null;
      c_as_of: string | null; c_kind: string | null;
      b_label: string; b_locator: string | null;
      b_as_of: string; b_kind: string;
    }>(PROXIMITY_SQL, [projectId]);

    // No boundary, or no sites: either way there is nothing to measure. The
    // project's own source is unknown here, so the panel shows its empty state.
    const first = rows[0];
    if (!first) return { sites: [], catchmentDatasetName: null, catchmentSource: null,
                         boundarySource: { label: '', locator: null, asOfDate: '', kind: '' } };

    return {
      sites: rows.map((r) => ({
        siteId: r.id,
        label: r.label,
        countryCode: r.country_code,
        distanceMetres: Number(r.distance_m),
        inCatchment: r.in_catchment,
      })),
      catchmentDatasetName: first.catchment_dataset,
      catchmentSource: first.c_label
        ? { label: first.c_label, locator: first.c_locator,
            asOfDate: first.c_as_of ?? '', kind: first.c_kind ?? '' }
        : null,
      boundarySource: {
        label: first.b_label, locator: first.b_locator,
        asOfDate: first.b_as_of, kind: first.b_kind,
      },
    };
  });
}
