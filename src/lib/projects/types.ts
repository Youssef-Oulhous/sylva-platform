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

/* ========================================================================== */
/* The project page                                                            */
/* ========================================================================== */

/**
 * One piece of translatable prose, already resolved for the requested locale.
 *
 * Locale fallback is PER FIELD, not per row and not per page. A German page
 * whose durability note has no reviewed translation shows the English durability
 * note and stays German everywhere else — and says so, which is what
 * `isFallback` is for. Silently presenting English as German is the failure this
 * flag exists to prevent.
 */
export interface Localised {
  body: string;
  /** The locale this text is actually written in. */
  locale: string;
  /** True when `locale` is not the one the reader asked for. */
  isFallback: boolean;
}

/** Prose that carries its own provenance, as project_text rows do. */
export interface ProjectText extends Localised {
  source: SourceRef;
}

export type GeometryKind = 'boundary' | 'catchment';

export interface GeometryLayer {
  kind: GeometryKind;
  versionNo: number;
  /** What the project owner called the dataset. Not translated: it is a name. */
  datasetName: string | null;
  licence: string;
  asOfDate: string;
  /**
   * Simplified server-side for drawing. The full-precision geometry is served
   * by the GeoJSON download route and is never inlined into a page.
   */
  geoJson: string;
  /** Computed by PostGIS on the geography. Both are given so neither screen has
   *  to divide a number whose unit it cannot see. */
  areaHectares: number;
  areaKm2: number;
  source: SourceRef;
}

export type IndicatorValueKind = 'baseline' | 'target' | 'measured';

export interface OutcomeFigure {
  kind: IndicatorValueKind;
  amount: number;
  /** The indicator's own unit — "cm below ground", not a unit of trade. These
   *  are NOT sylva.unit_qty and are never summed. */
  measureUnit: string;
  uncertaintyLow: number | null;
  uncertaintyHigh: number | null;
  asOfDate: string;
  source: SourceRef;
}

export interface OutcomeIndicator {
  code: string;
  versionNo: number;
  domain: 'water' | 'biodiversity';
  measureUnit: string;
  whatIsMeasured: Localised | null;
  methodNote: Localised | null;
  /** The independent body that verifies this indicator, where one is recorded. */
  verifierName: string | null;
  uncertaintyNote: string | null;
  baseline: OutcomeFigure | null;
  target: OutcomeFigure | null;
  /** Verified results, once they exist. Empty before first verification. */
  measured: OutcomeFigure[];
  source: SourceRef;
}

export interface ClaimRight {
  benefitKey: string;
  versionNo: number;
  sortOrder: number;
  benefitLabel: Localised | null;
  whoMayClaim: Localised | null;
  forWhat: Localised | null;
  exclusions: Localised | null;
  source: SourceRef;
}

export interface DurabilityCommitment {
  commitmentKey: string;
  versionNo: number;
  statement: Localised | null;
  landControlNote: Localised | null;
  responsibleOrgName: string | null;
  startsOn: string | null;
  endsOn: string | null;
  horizonYears: number | null;
  source: SourceRef;
}

/**
 * A date the project documents actually state. Nothing is interpolated between
 * two recorded dates and nothing is projected past the last one: where the
 * documents are silent the timeline simply ends, which is itself information a
 * buyer asked for.
 */
export interface TimelineEntry {
  id: string;
  kind: 'platform_record' | 'outcome_period' | 'commitment';
  /** A year or a range, rendered as recorded. Never invented precision. */
  when: string;
  startsOn: string | null;
  endsOn: string | null;
  /** null only for the platform's own record of publication. */
  source: SourceRef | null;
}

export interface PeriodRow {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  source: SourceRef;
  /** null where no effective forecast has been recorded for this period yet.
   *  The period still appears: its absence from the forecast is information. */
  availability: PeriodAvailability | null;
}

export type DocumentVisibility =
  | 'public' | 'vetted_buyer' | 'vetted_investor'
  | 'deal_participants' | 'admin' | 'auditor';

export interface ProjectDocumentRow {
  id: string;
  kind: string;
  visibility: DocumentVisibility;
  versionNo: number | null;
  mediaType: string | null;
  byteSize: number | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
  locale: string | null;
  /** False where the document row exists but has no readable version. */
  available: boolean;
}

export interface Partner {
  orgId: string;
  /** A proj.party_role code, or 'owner' for the organisation that holds the
   *  project on the platform. */
  role: string;
  name: string;
  countryCode: string;
  description: Localised | null;
  source: SourceRef | null;
}

export interface EvidencePackItem {
  elementCode: string;
  itemNo: number;
  note: string | null;
  documentKind: string | null;
  documentVersionNo: number | null;
  metricCode: string | null;
}

export interface EvidencePack {
  /** The five things a reporting assessor asked for. Public reference data. */
  elements: { code: string; labelEn: string }[];
  /**
   * The assembled contents. `null` means "not visible to this viewer" — the
   * assembled pack is readable by vetted buyers, the project owner, the
   * operator and the auditor, and by nobody else. An empty array means visible
   * and not yet assembled, which is a different sentence on screen.
   */
  items: EvidencePackItem[] | null;
  assembledAt: string | null;
}

export interface InvestorInfo {
  /** True when this viewer may read the values, not merely the field names. */
  visible: boolean;
  financingNeed: number | null;
  currency: string | null;
  revenueStreamsNote: string | null;
  financialModelDocumentId: string | null;
  asOfDate: string | null;
  source: SourceRef | null;
}

/**
 * A buyer's own site measured against this project.
 *
 * PRIVATE. Read as sylva_buyer with the buyer's signed organisation context, so
 * row-level security returns that organisation's sites and no others. It must
 * never reach a cached or shared response — see the note on the page component.
 */
export interface BuyerSiteProximity {
  siteId: string;
  label: string;
  countryCode: string;
  /** Straight-line (great-circle) metres to the project boundary. Not travel
   *  distance, and the screen says so. */
  distanceMetres: number;
  /** Point-in-polygon against the project's own catchment polygon. null when
   *  the project has published no catchment, in which case the question has no
   *  answer rather than a negative one. */
  inCatchment: boolean | null;
}

export interface BuyerProximity {
  sites: BuyerSiteProximity[];
  /** Which polygon the catchment answer was computed against, and when it was
   *  supplied. D4: "same catchment" is stated against a named layer or not at
   *  all. */
  catchmentDatasetName: string | null;
  catchmentSource: SourceRef | null;
  boundarySource: SourceRef;
}

export interface QuestionAnswer {
  id: string;
  body: string;
  answeredAt: string;
  answeredByName: string | null;
}

export interface ProjectQuestionThread {
  id: string;
  body: string;
  askedAt: string;
  answers: QuestionAnswer[];
}

export interface ProjectDetail {
  id: string;
  slug: string;
  countryCode: string;
  /** English name from platform.eu_member_state; the UI prefers a translated
   *  label where one exists. */
  countryNameEn: string;
  status: string;
  publishedAt: string | null;

  ownerOrgId: string;
  ownerOrgName: string;

  title: ProjectText;
  summary: ProjectText | null;
  catchmentContext: ProjectText | null;
  durabilityNote: ProjectText | null;
  partnersNote: ProjectText | null;

  scheme: {
    code: string;
    name: string;
    registryUrl: string | null;
    sourceLabel: string;
    asOfDate: string;
  };
  unitType: {
    id: string;
    code: string;
    metricLabel: Localised;
    definition: Localised;
    unitOfMeasure: string;
    vintageSemantics: PeriodAvailability['vintageSemantics'];
    sourceLabel: string;
    asOfDate: string;
  };

  boundary: GeometryLayer | null;
  catchment: GeometryLayer | null;

  outcomes: OutcomeIndicator[];
  claimRights: ClaimRight[];
  durability: DurabilityCommitment[];
  timeline: TimelineEntry[];
  periods: PeriodRow[];
  documents: ProjectDocumentRow[];
  partners: Partner[];
  evidencePack: EvidencePack;
  investor: InvestorInfo;

  /** The three shapes the platform can record, as reference data. */
  dealShapes: { code: string; labelEn: string }[];

  /** Derived strictly from the document register: a verification report either
   *  is on the platform or is not. No other claim is made. */
  hasVerificationReport: boolean;

  /**
   * The viewer's own question threads for this project, newest first. `null`
   * when the viewer may not hold questions at all (an anonymous visitor), which
   * the page renders as an invitation to sign in rather than as an empty list.
   */
  questions: ProjectQuestionThread[] | null;
  /** True when this viewer's role may insert into deal.project_question. */
  canAskQuestion: boolean;
}
