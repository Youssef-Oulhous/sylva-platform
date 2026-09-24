/**
 * DEMO DATA for the buyer site register.
 *
 * FRONTEND PASS. Nothing here is read from a database. The shapes below are the
 * shapes the page expects to receive once the data layer is wired in, so that
 * the components do not have to change when it is.
 *
 * Everything in this file is fictional. The organisation and its sites do not
 * exist, the coordinates point at ordinary places chosen only so that the
 * distances are plausible, and none of the distances describes a real site or a
 * real project boundary.
 *
 * Rule 7 (no unit volumes added across projects) shows up here as an absence:
 * there is no volume field on either shape. A site register holds locations, and
 * the only figures on the page are kilometres and coordinates - quantities that
 * mean the same thing whichever project they are measured against. Unit volumes
 * do not, so they are not on this page at all.
 */

/** The countries offered in the form. Codes, not names: names are translated. */
export const SITE_COUNTRY_CODES = [
  'AT',
  'BE',
  'DE',
  'DK',
  'ES',
  'FR',
  'NL',
  'PL',
] as const;

export type SiteCountryCode = (typeof SITE_COUNTRY_CODES)[number];

export interface RegisteredSite {
  readonly id: string;
  /** A proper noun, held as a literal exactly as it will arrive from the database. */
  readonly name: string;
  /** Region or state. Shown under the name, not as its own column. */
  readonly regionLabel: string;
  readonly countryCode: SiteCountryCode;
  /** Decimal degrees. North is positive. */
  readonly latitude: number;
  /** Decimal degrees. East is positive. */
  readonly longitude: number;
  /** ISO date the organisation added the site. */
  readonly addedOn: string;
  /** What the organisation wrote for itself. Optional, as on the form. */
  readonly notes: string | null;
}

export interface ProjectDistance {
  readonly id: string;
  readonly projectName: string;
  readonly countryCode: SiteCountryCode;
  readonly catchmentLabel: string;
  /**
   * Whether the site and the project drain into the same catchment. A short
   * distance does not imply this, which is why it is carried separately.
   */
  readonly sameCatchment: boolean;
  /** Straight-line distance to the nearest point on the project boundary, in km. */
  readonly distanceKm: number;
}

/** The organisation whose register this is. Fictional. */
export const DEMO_BUYER_ORG = 'DEMO Rheinwasser Getränke GmbH';

export const DEMO_SITES: readonly RegisteredSite[] = [
  {
    id: 'site-havelberg-bottling',
    name: 'DEMO Rheinwasser Bottling Plant',
    regionLabel: 'Sachsen-Anhalt',
    countryCode: 'DE',
    latitude: 52.8297,
    longitude: 12.0783,
    addedOn: '2026-07-14',
    notes: 'Main abstraction point for the bottling line.',
  },
  {
    id: 'site-brandenburg-malting',
    name: 'DEMO Rheinwasser Malting Works',
    regionLabel: 'Brandenburg',
    countryCode: 'DE',
    latitude: 52.4125,
    longitude: 12.5316,
    addedOn: '2026-07-14',
    notes: null,
  },
  {
    id: 'site-verden-distribution',
    name: 'DEMO Rheinwasser Distribution Centre',
    regionLabel: 'Niedersachsen',
    countryCode: 'DE',
    latitude: 52.5109,
    longitude: 9.8384,
    addedOn: '2026-08-03',
    notes: 'No water abstraction. Registered for reporting purposes.',
  },
  {
    id: 'site-gelderland-spring',
    name: 'DEMO Rheinwasser Spring Water Site',
    regionLabel: 'Gelderland',
    countryCode: 'NL',
    latitude: 51.8126,
    longitude: 5.8372,
    addedOn: '2026-09-11',
    notes: null,
  },
];

/** The empty register, for the empty state shown on the page. */
export const DEMO_NO_SITES: readonly RegisteredSite[] = [];

/**
 * The one site whose distance table is shown as an example. Each registered site
 * has its own; showing four tables would say nothing the first one does not.
 */
export const DEMO_DISTANCE_SITE_ID = 'site-havelberg-bottling';

/** Ascending by distance: the question the buyer is asking is "what is near me". */
export const DEMO_DISTANCES: readonly ProjectDistance[] = [
  {
    id: 'dist-untere-havel',
    projectName: 'DEMO Untere Havel Wetland Restoration',
    countryCode: 'DE',
    catchmentLabel: 'Untere Havel',
    sameCatchment: true,
    distanceKm: 18,
  },
  {
    id: 'dist-mittlere-elbe',
    projectName: 'DEMO Mittlere Elbe Floodplain Reconnection',
    countryCode: 'DE',
    catchmentLabel: 'Mittlere Elbe',
    sameCatchment: false,
    distanceKm: 74,
  },
  {
    id: 'dist-peene',
    projectName: 'DEMO Peene Valley Peatland Rewetting',
    countryCode: 'DE',
    catchmentLabel: 'Peene',
    sameCatchment: false,
    distanceKm: 186,
  },
  {
    id: 'dist-wieringermeer',
    projectName: 'DEMO Wieringermeer Polder Wetland',
    countryCode: 'NL',
    catchmentLabel: 'IJsselmeer',
    sameCatchment: false,
    distanceKm: 498,
  },
  {
    id: 'dist-biebrza',
    projectName: 'DEMO Biebrza Peatland Restoration',
    countryCode: 'PL',
    catchmentLabel: 'Biebrza',
    sameCatchment: false,
    distanceKm: 712,
  },
];

/** The dates the two source stamps on the page carry. */
export const DEMO_REGISTER_AS_OF = '2026-09-22';
export const DEMO_DISTANCES_AS_OF = '2026-09-19';

/**
 * Coordinates are printed with a decimal point in both locales, and with four
 * decimal places whatever was entered, so that a column of them aligns.
 *
 * This is deliberately not `format.number()`. A coordinate is closer to an
 * identifier than to a quantity: it is typed into the form with a decimal point,
 * it is written with a decimal point in the GeoJSON boundary files, and a reader
 * comparing the screen with a file should see the same characters in both.
 */
export function formatDegrees(value: number): string {
  return value.toFixed(4);
}
