/**
 * A buyer's own site register.
 *
 * PRIVATE DATA. Every shape in this file describes where a company's plants
 * are, which the concept note (§3) treats as commercially sensitive and which
 * FINDING-001 was found on. Nothing here may be rendered on a public page, put
 * in a cached response, logged, or sent to a project owner.
 *
 * Rule 7 shows up here as an absence. There is no unit volume on any of these
 * types and no field one could be put in. Kilometres mean the same thing
 * measured against any project, so distances can be sorted and compared;
 * volumes cannot, so the distance table carries none.
 */

/** Every figure on screen carries its source and its as-of date. */
export interface SourceLine {
  label: string;
  locator: string | null;
  asOfDate: string;
}

export interface BuyerSite {
  id: string;
  /** What the organisation calls the site. geo.buyer_site.label. */
  label: string;
  countryCode: string;
  /** WGS 84 decimal degrees, as registered. North and east are positive. */
  latitude: number;
  longitude: number;
  /** ISO date the row was written. */
  registeredOn: string;
  /** The provenance row geo.buyer_site.source_ref_id points at. */
  source: SourceLine;
}

/**
 * How a site relates to one published project.
 *
 * Two separate facts, deliberately not merged into one badge: a short distance
 * does not mean shared water, and being in the same catchment does not mean
 * being close.
 */
export interface SiteProjectRelation {
  projectId: string;
  slug: string;
  title: string;
  countryCode: string;
  /**
   * Straight-line (great-circle) metres from the site point to the NEAREST
   * POINT of the project boundary - not to its centre and not along a road.
   * Zero when the site lies inside the boundary. The screen states this.
   */
  distanceMetres: number;
  /**
   * Point-in-polygon against the polygon the PROJECT supplied, at the level
   * that polygon describes (DECISIONS D4). `null` where the project has
   * published no catchment: then the question has no answer, which is not the
   * same as a negative one.
   */
  inCatchment: boolean | null;
  /** The name the project gave its catchment dataset. Shown beside the answer. */
  catchmentDatasetName: string | null;
  boundarySource: SourceLine;
  catchmentSource: SourceLine | null;
}

/** One site with its distances, newest-registered first, nearest project first. */
export interface SiteWithDistances {
  site: BuyerSite;
  relations: SiteProjectRelation[];
}
