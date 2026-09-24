import type { UnitQty } from '@/lib/units/qty';

export interface SourceRef {
  label: string;
  locator: string | null;
  asOfDate: string;
  kind: string;
}

export interface PeriodAvailability {
  periodId: string;
  periodLabel: string;
  startsOn: string;
  endsOn: string;
  unitTypeId: string;
  unitTypeCode: string;
  unitMetricLabel: string;
  unitOfMeasure: string;
  /** What a period MEANS under this scheme. Conflating the two misdates every
   *  forward contract, and most pilot deals are forward contracts. */
  vintageSemantics: 'period_of_issuance' | 'period_of_outcome' | 'undefined_by_scheme';
  expected: UnitQty;
  buffer: UnitQty;
  reserved: UnitQty;
  committed: UnitQty;
  remaining: UnitQty;
  source: SourceRef;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  countryCode: string;
  status: string;
  ownerOrgName: string;
  /** True when the title fell back to English because no reviewed translation
   *  exists in the requested locale. Surfaced so the UI can mark it rather
   *  than silently presenting English as German. */
  titleIsFallback: boolean;
  schemeName: string;
  /** Distinct outcome domains present on the project: 'water' | 'biodiversity' */
  outcomeDomains: string[];
  /** Simplified boundary for the card thumbnail. Full precision is served by
   *  the GeoJSON download route, never inlined into a list page. */
  boundaryGeoJson: string | null;
  /** Availability per period. NEVER reduced to a single figure for the card:
   *  a card shows this project's nearest period, labelled with its unit. */
  availability: PeriodAvailability[];
}
