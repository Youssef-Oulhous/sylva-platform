import { readAs } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import { qtyFromRow } from '@/lib/units/qty';
import type { PeriodAvailability, ProjectSummary, SourceRef } from './types';

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
