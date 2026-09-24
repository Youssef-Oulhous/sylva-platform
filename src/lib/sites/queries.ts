import { readAs, withActor } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type {
  BuyerSite,
  SiteProjectRelation,
  SiteWithDistances,
  SourceLine,
} from './types';

/**
 * The buyer's own site register: reads and writes.
 *
 * Every statement goes through readAs() or withActor(), so it runs as the
 * caller's PostgreSQL role with the caller's signed organisation context.
 * geo.buyer_site's policy is `org_id = sylva.actor_org_id()` for SELECT,
 * INSERT, UPDATE and DELETE alike, so this file never writes a WHERE clause
 * restricting rows to the caller's organisation and never needs to: the
 * database does it, and a second copy of the rule in application code is how
 * the two drift apart.
 *
 * sylva_web_anon holds no grant on geo.buyer_site at all, so an anonymous
 * caller fails on privilege before any policy is consulted. That is asserted in
 * tests/db/sites.test.ts and by ci.assert_buyer_sites_are_private().
 *
 * ONE CONSEQUENCE TO KNOW BEFORE REUSING THESE READS. The policy that scopes a
 * row to one organisation is written `TO sylva_buyer`; the operator and the
 * auditor read the table under `USING (true)`, which is their support and audit
 * access and is asserted in tests/db/sites.test.ts. So listBuyerSites() returns
 * EVERY organisation's register when the caller is one of those two. That is
 * correct for an operator tool and wrong for any screen headed "your sites", so
 * such a screen must scope the read itself - src/lib/dashboard/queries.ts does,
 * with the same sylva.actor_org_id() the policy uses. The two pages here are
 * behind requireRole('buyer'), which is why they do not.
 */

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

interface SiteRow extends Record<string, unknown> {
  id: string;
  label: string;
  country_code: string;
  latitude: number;
  longitude: number;
  registered_on: string;
  src_label: string;
  src_locator: string | null;
  src_as_of: string;
}

const SITES_SQL = `
  SELECT s.id,
         s.label::text          AS label,
         s.country_code::text   AS country_code,
         ST_Y(s.geom)::float8   AS latitude,
         ST_X(s.geom)::float8   AS longitude,
         s.registered_at::date::text AS registered_on,
         r.label::text          AS src_label,
         r.locator              AS src_locator,
         r.as_of_date::text     AS src_as_of
    FROM geo.buyer_site s
    JOIN sylva.source_ref r ON r.id = s.source_ref_id
   ORDER BY s.registered_at DESC, s.label`;

function toSite(r: SiteRow): BuyerSite {
  const source: SourceLine = {
    label: r.src_label,
    locator: r.src_locator,
    asOfDate: r.src_as_of,
  };
  return {
    id: r.id,
    label: r.label,
    countryCode: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    registeredOn: r.registered_on,
    source,
  };
}

/** The caller's organisation's sites. Empty for an organisation with none. */
export async function listBuyerSites(actor: Actor): Promise<BuyerSite[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<SiteRow>(SITES_SQL);
    return rows.map(toSite);
  });
}

interface RelationRow extends Record<string, unknown> {
  site_id: string;
  project_id: string;
  slug: string;
  title: string;
  country_code: string;
  distance_m: number;
  in_catchment: boolean | null;
  catchment_dataset: string | null;
  boundary_src_label: string;
  boundary_src_as_of: string;
  catchment_src_label: string | null;
  catchment_src_as_of: string | null;
}

/**
 * Distance from every one of the caller's sites to every published project.
 *
 * Two things the SQL does NOT say, because the database already does:
 *
 *   - it does not filter geo.buyer_site by organisation. The policy does.
 *   - it does not filter proj.project by status. p_project_public is
 *     `proj.is_publicly_visible(id)`, so a draft project is not in the join
 *     for a buyer in the first place.
 *
 * ST_Distance on ::geography is metres on the WGS 84 spheroid, measured to the
 * NEAREST POINT of the boundary, and is 0 inside it. ST_Covers answers the
 * catchment question against the polygon the PROJECT supplied - never one we
 * derived, which would be us making a hydrological claim (DECISIONS D4).
 */
const RELATIONS_SQL = `
  SELECT s.id                          AS site_id,
         p.id                          AS project_id,
         p.slug,
         COALESCE(t_loc.body, t_en.body) AS title,
         p.country_code::text          AS country_code,
         round(ST_Distance(s.geom::geography, b.geom::geography)::numeric, 0)::float8
                                       AS distance_m,
         CASE WHEN c.geom IS NULL THEN NULL
              ELSE ST_Covers(c.geom::geography, s.geom::geography) END
                                       AS in_catchment,
         c.dataset_name                AS catchment_dataset,
         bs.label::text                AS boundary_src_label,
         bs.as_of_date::text           AS boundary_src_as_of,
         cs.label::text                AS catchment_src_label,
         cs.as_of_date::text           AS catchment_src_as_of
    FROM geo.buyer_site s
    CROSS JOIN proj.project p
    JOIN LATERAL (
      SELECT g.geom, g.source_ref_id
        FROM geo.project_geometry g
       WHERE g.project_id = p.id AND g.kind = 'boundary'
       ORDER BY g.version_no DESC LIMIT 1) b ON true
    JOIN sylva.source_ref bs ON bs.id = b.source_ref_id
    LEFT JOIN LATERAL (
      SELECT g.geom, g.dataset_name, g.source_ref_id
        FROM geo.project_geometry g
       WHERE g.project_id = p.id AND g.kind = 'catchment'
       ORDER BY g.version_no DESC LIMIT 1) c ON true
    LEFT JOIN sylva.source_ref cs ON cs.id = c.source_ref_id
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
   ORDER BY s.registered_at DESC, distance_m`;

function toRelation(r: RelationRow): SiteProjectRelation {
  return {
    projectId: r.project_id,
    slug: r.slug,
    title: r.title,
    countryCode: r.country_code,
    distanceMetres: r.distance_m,
    inCatchment: r.in_catchment,
    catchmentDatasetName: r.catchment_dataset,
    boundarySource: {
      label: r.boundary_src_label,
      locator: null,
      asOfDate: r.boundary_src_as_of,
    },
    catchmentSource:
      r.catchment_src_label === null || r.catchment_src_as_of === null
        ? null
        : {
            label: r.catchment_src_label,
            locator: null,
            asOfDate: r.catchment_src_as_of,
          },
  };
}

/**
 * Every site with its distance to every published project, in one round trip.
 *
 * A site with no projects to measure against still appears, with an empty
 * relation list - "there is nothing published near you" is information, and
 * dropping the row would look like the site had not been saved.
 */
export async function listSitesWithDistances(
  actor: Actor,
  locale: string,
): Promise<SiteWithDistances[]> {
  return readAs(actor, async (tx) => {
    const siteRows = await tx.query<SiteRow>(SITES_SQL);
    if (siteRows.length === 0) return [];

    const relRows = await tx.query<RelationRow>(RELATIONS_SQL, [locale]);
    const bySite = new Map<string, SiteProjectRelation[]>();
    for (const row of relRows) {
      const list = bySite.get(row.site_id) ?? [];
      list.push(toRelation(row));
      bySite.set(row.site_id, list);
    }

    return siteRows.map((row) => ({
      site: toSite(row),
      relations: bySite.get(row.id) ?? [],
    }));
  });
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The label written on the provenance row for a site.
 *
 * sylva.source_ref is world-readable - migration 0016 grants SELECT on it to
 * sylva_web_anon and migration 0017's read policy is USING (true). So this
 * string must never name the site, the place, the coordinates or the
 * organisation. It says what KIND of statement the figure is and nothing else;
 * the private part stays in geo.buyer_site behind its organisation-scoped
 * policy. tests/db/sites.test.ts asserts exactly this.
 *
 * It is not translated. A source_ref label is a record of what was asserted,
 * read by an auditor across every locale, and is held in English like every
 * other row in that table.
 */
export const SITE_SOURCE_LABEL =
  'Site location as stated by the registering organisation';

export interface SiteInput {
  readonly label: string;
  /** Two uppercase letters. The database domain refuses anything else. */
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * One provenance row per stated location, then the site.
 *
 * org_id is `sylva.actor_org_id()` rather than a parameter, so this application
 * cannot express another organisation's id even by accident. The signed context
 * is the only thing that decides whose register the row lands in.
 */
export async function addBuyerSite(actor: Actor, input: SiteInput): Promise<string> {
  return withActor(actor, async (tx) => {
    const src = await tx.one<{ id: string }>(
      `INSERT INTO sylva.source_ref (kind, label, as_of_date)
       VALUES ('party_statement', $1, current_date)
       RETURNING id`,
      [SITE_SOURCE_LABEL],
    );
    const row = await tx.one<{ id: string }>(
      `INSERT INTO geo.buyer_site (org_id, label, country_code, geom, source_ref_id)
       VALUES (sylva.actor_org_id(), $1, $2,
               ST_SetSRID(ST_MakePoint($4::float8, $3::float8), 4326), $5)
       RETURNING id`,
      [input.label, input.countryCode, input.latitude, input.longitude, src.id],
    );
    return row.id;
  });
}

/**
 * Change a site.
 *
 * geo.buyer_site is deliberately NOT append-only - migration 0014 lists the
 * tables that are, and this is not one: a site register is operational data a
 * buyer maintains, not part of the permanent record. But the coordinate is
 * still a figure, so a new statement of it gets a NEW provenance row with
 * today's date rather than silently reusing yesterday's.
 *
 * Returns false when the row is not this organisation's. No exception: the
 * policy simply matched nothing, and there is no information in saying whether
 * such a row exists elsewhere.
 */
export async function updateBuyerSite(
  actor: Actor,
  siteId: string,
  input: SiteInput,
): Promise<boolean> {
  return withActor(actor, async (tx) => {
    // Look before writing the provenance row. sylva.source_ref is append-only
    // and world-readable, and minting one for an id the policy will not match
    // leaves a row behind that nothing points at - which a caller posting other
    // organisations' ids could do as often as it liked. The SELECT is subject
    // to the same policy as the UPDATE, so this is not an authorization check:
    // it decides only whether there is any point writing the source row first.
    const visible = await tx.maybe<{ id: string }>(
      'SELECT id FROM geo.buyer_site WHERE id = $1',
      [siteId],
    );
    if (visible === null) return false;

    const src = await tx.one<{ id: string }>(
      `INSERT INTO sylva.source_ref (kind, label, as_of_date)
       VALUES ('party_statement', $1, current_date)
       RETURNING id`,
      [SITE_SOURCE_LABEL],
    );
    const rows = await tx.query<{ id: string }>(
      `UPDATE geo.buyer_site
          SET label = $2,
              country_code = $3,
              geom = ST_SetSRID(ST_MakePoint($5::float8, $4::float8), 4326),
              source_ref_id = $6
        WHERE id = $1
        RETURNING id`,
      [siteId, input.label, input.countryCode, input.latitude, input.longitude, src.id],
    );
    return rows.length === 1;
  });
}

/**
 * Remove a site from the register.
 *
 * The sylva.source_ref row it pointed at stays: provenance is append-only under
 * R4 and is never deleted. It names nothing private, so an orphaned one
 * discloses nothing.
 */
export async function removeBuyerSite(actor: Actor, siteId: string): Promise<boolean> {
  return withActor(actor, async (tx) => {
    const rows = await tx.query<{ id: string }>(
      'DELETE FROM geo.buyer_site WHERE id = $1 RETURNING id',
      [siteId],
    );
    return rows.length === 1;
  });
}
