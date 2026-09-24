/**
 * DEMO DATA for the project detail page.
 *
 * Nothing here comes from the database. This module exists so that the page
 * and its section components can be built, reviewed and translated before the
 * data layer is wired in. Every organisation name begins with "DEMO" and every
 * figure is fictional. No number here describes a real wetland, a real
 * verification or a real environmental result.
 *
 * Prose that a reader sees is held as an i18n KEY, not as an English string, so
 * the German site is not silently served English. Proper nouns (organisation
 * names, gauge names, document locators) and figures stay as literals, which is
 * how they will arrive from the database later.
 *
 * Rule 7: every unit figure below belongs to ONE project and ONE unit type.
 * There is no field in these types that could hold a cross-project total.
 */

export type DemoOutcomeDomain = 'water' | 'biodiversity';

export interface DemoSource {
  /** Full i18n key naming the source document. */
  labelKey: string;
  /** Page, section or table reference inside that document. Not translated. */
  locator: string | null;
  /** ISO date the figure was last updated in that document. */
  asOfDate: string;
}

export interface DemoOutcomeRow {
  id: string;
  domain: DemoOutcomeDomain;
  /** i18n key for the metric name. */
  metricKey: string;
  /** Figures carry their own unit and are not translated. */
  baseline: string;
  expected: string;
  /** i18n key for the monitoring method. */
  methodKey: string;
  verifierName: string;
  uncertainty: string;
  source: DemoSource;
}

export interface DemoClaimRow {
  id: string;
  benefitKey: string;
  holderKey: string;
  allowedKey: string;
  excludedKey: string;
  source: DemoSource;
}

export interface DemoTimelineEntry {
  id: string;
  /** Displayed as written. A year or a range, never invented precision. */
  when: string;
  titleKey: string;
  bodyKey: string;
  /** 'past' is only used for entries the project documents record as done. */
  state: 'recorded' | 'planned' | 'open';
}

export interface DemoDurabilityFact {
  id: string;
  labelKey: string;
  valueKey: string;
  source: DemoSource;
}

export interface DemoPeriodRow {
  id: string;
  /** The label is the period as the scheme writes it. */
  label: string;
  startsOn: string;
  endsOn: string;
  expected: number;
  buffer: number;
  reserved: number;
  committed: number;
  remaining: number;
  source: DemoSource;
}

export interface DemoDocumentRow {
  id: string;
  nameKey: string;
  typeKey: string;
  /** null where the document does not exist yet. */
  version: string | null;
  date: string | null;
  uploadedBy: string | null;
  fileNote: string | null;
  available: boolean;
  href: string;
}

export interface DemoPartner {
  id: string;
  roleKey: string;
  name: string;
  /** City and country, as written on the organisation record. */
  place: string;
  noteKey: string;
  registryRef: string | null;
}

export interface DemoProject {
  slug: string;
  name: string;
  /** i18n key for the one-line placement of the project. */
  regionKey: string;
  countryKey: string;
  catchmentKey: string;
  ownerOrgName: string;
  /** Maps to the existing `status.*` namespace. */
  statusKey: string;
  verificationStateKey: string;
  schemeName: string;
  /** The unit label travels with every figure on this page. */
  unitLabelKey: string;
  /** Which of the three `project.vintage*` sentences applies here. */
  vintageKey: string;
  nearestPeriodLabel: string;
  dealTypeKeys: string[];
  areaHectares: number;
  catchmentAreaKm2: number;
  /** Simplified geometry, as the card thumbnail receives it. */
  boundaryGeoJson: string;
  catchmentAndBoundaryGeoJson: string;
  /** Same catchment as the visitor's sites: unknown while signed out. */
  sameCatchment: 'yes' | 'no' | 'unknown';
  summaryLeadKey: string;
  summaryParagraphKeys: string[];
  summaryDetailKeys: { titleKey: string; bodyKey: string }[];
  outcomes: DemoOutcomeRow[];
  claims: DemoClaimRow[];
  durabilityFacts: DemoDurabilityFact[];
  timeline: DemoTimelineEntry[];
  periods: DemoPeriodRow[];
  documents: DemoDocumentRow[];
  partners: DemoPartner[];
  evidencePackItemKeys: string[];
  /** Figures held back behind investor vetting. Shown as locked, never as a value. */
  investorFieldKeys: string[];
  headerSource: DemoSource;
}

const PDD: DemoSource = {
  labelKey: 'projectPage.doc.designDocument',
  locator: null,
  asOfDate: '2026-09-12',
};

const source = (labelKey: string, locator: string | null, asOfDate: string): DemoSource => ({
  labelKey,
  locator,
  asOfDate,
});

/**
 * The single demo project rendered by src/app/[locale]/projects/[slug]/page.tsx.
 * Fictional. See the module comment above.
 */
export const DEMO_PROJECT: DemoProject = {
  slug: 'demo-untere-havel-wetland-restoration',
  name: 'DEMO Untere Havel Wetland Restoration',
  regionKey: 'projectPage.demo.region',
  countryKey: 'projectPage.demo.country',
  catchmentKey: 'projectPage.demo.catchment',
  ownerOrgName: 'DEMO Moorland Trust gGmbH',
  statusKey: 'status.published',
  verificationStateKey: 'projectPage.verification.designVerified',
  schemeName: 'DEMO Wetland Biodiversity Standard',
  unitLabelKey: 'projectPage.unit.hectareYears',
  vintageKey: 'project.vintageOutcome',
  nearestPeriodLabel: '2028',
  dealTypeKeys: ['projectPage.dealType.forward', 'projectPage.dealType.coInvestment'],
  areaHectares: 412,
  catchmentAreaKm2: 1840,

  boundaryGeoJson: JSON.stringify({
    type: 'Polygon',
    coordinates: [
      [
        [12.33, 52.6],
        [12.39, 52.585],
        [12.45, 52.6],
        [12.47, 52.635],
        [12.44, 52.665],
        [12.375, 52.67],
        [12.335, 52.645],
        [12.33, 52.6],
      ],
    ],
  }),

  // Catchment first, project boundary second. BoundaryThumb normalises both
  // rings against one bounding box, so the boundary sits where it belongs
  // inside the catchment rather than being rescaled to fill the frame.
  catchmentAndBoundaryGeoJson: JSON.stringify({
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [12.06, 52.42],
          [12.21, 52.35],
          [12.46, 52.38],
          [12.63, 52.49],
          [12.74, 52.63],
          [12.69, 52.8],
          [12.52, 52.93],
          [12.31, 52.9],
          [12.14, 52.79],
          [12.04, 52.62],
          [12.06, 52.42],
        ],
      ],
      [
        [
          [12.33, 52.6],
          [12.39, 52.585],
          [12.45, 52.6],
          [12.47, 52.635],
          [12.44, 52.665],
          [12.375, 52.67],
          [12.335, 52.645],
          [12.33, 52.6],
        ],
      ],
    ],
  }),

  sameCatchment: 'unknown',

  summaryLeadKey: 'projectPage.summary.lead',
  summaryParagraphKeys: [
    'projectPage.summary.what',
    'projectPage.summary.why',
    'projectPage.summary.measured',
  ],
  summaryDetailKeys: [
    { titleKey: 'projectPage.summary.detail.worksTitle', bodyKey: 'projectPage.summary.detail.worksBody' },
    { titleKey: 'projectPage.summary.detail.baselineTitle', bodyKey: 'projectPage.summary.detail.baselineBody' },
    { titleKey: 'projectPage.summary.detail.riskTitle', bodyKey: 'projectPage.summary.detail.riskBody' },
  ],

  outcomes: [
    {
      id: 'groundwater',
      domain: 'water',
      metricKey: 'projectPage.outcome.groundwater.metric',
      baseline: '−0.92 m',
      expected: '−0.28 m',
      methodKey: 'projectPage.outcome.groundwater.method',
      verifierName: 'DEMO Hydro-Verify GmbH',
      uncertainty: '± 0.15 m',
      source: source('projectPage.doc.designDocument', '§ 4.2', '2026-09-12'),
    },
    {
      id: 'rewetted',
      domain: 'water',
      metricKey: 'projectPage.outcome.rewetted.metric',
      baseline: '0 ha',
      expected: '412 ha',
      methodKey: 'projectPage.outcome.rewetted.method',
      verifierName: 'DEMO Hydro-Verify GmbH',
      uncertainty: '± 18 ha',
      source: source('projectPage.doc.designDocument', '§ 4.3', '2026-09-12'),
    },
    {
      id: 'lowflow',
      domain: 'water',
      metricKey: 'projectPage.outcome.lowflow.metric',
      baseline: '0 m³',
      expected: '+ 0.90 million m³',
      methodKey: 'projectPage.outcome.lowflow.method',
      verifierName: 'DEMO Hydro-Verify GmbH',
      uncertainty: '± 0.35 million m³',
      source: source('projectPage.doc.monitoringPlan', '§ 2.1', '2026-08-28'),
    },
    {
      id: 'condition',
      domain: 'biodiversity',
      metricKey: 'projectPage.outcome.condition.metric',
      baseline: '31 / 100',
      expected: '62 / 100',
      methodKey: 'projectPage.outcome.condition.method',
      verifierName: 'DEMO Hydro-Verify GmbH',
      uncertainty: '± 6 points',
      source: source('projectPage.doc.designDocument', '§ 5.1', '2026-09-12'),
    },
    {
      id: 'waders',
      domain: 'biodiversity',
      metricKey: 'projectPage.outcome.waders.metric',
      baseline: '14 pairs',
      expected: '55 pairs',
      methodKey: 'projectPage.outcome.waders.method',
      verifierName: 'DEMO Hydro-Verify GmbH',
      uncertainty: '± 9 pairs',
      source: source('projectPage.doc.monitoringPlan', '§ 3.4', '2026-08-28'),
    },
    {
      id: 'favourable',
      domain: 'biodiversity',
      metricKey: 'projectPage.outcome.favourable.metric',
      baseline: '46 ha',
      expected: '305 ha',
      methodKey: 'projectPage.outcome.favourable.method',
      verifierName: 'DEMO Hydro-Verify GmbH',
      uncertainty: '± 24 ha',
      source: source('projectPage.doc.designDocument', '§ 5.3', '2026-09-12'),
    },
  ],

  claims: [
    {
      id: 'biodiversity',
      benefitKey: 'projectPage.claim.biodiversity.benefit',
      holderKey: 'projectPage.claim.biodiversity.holder',
      allowedKey: 'projectPage.claim.biodiversity.allowed',
      excludedKey: 'projectPage.claim.biodiversity.excluded',
      source: source('projectPage.doc.claimTerms', '§ 2', '2026-09-12'),
    },
    {
      id: 'water',
      benefitKey: 'projectPage.claim.water.benefit',
      holderKey: 'projectPage.claim.water.holder',
      allowedKey: 'projectPage.claim.water.allowed',
      excludedKey: 'projectPage.claim.water.excluded',
      source: source('projectPage.doc.claimTerms', '§ 3', '2026-09-12'),
    },
    {
      id: 'cofinance',
      benefitKey: 'projectPage.claim.cofinance.benefit',
      holderKey: 'projectPage.claim.cofinance.holder',
      allowedKey: 'projectPage.claim.cofinance.allowed',
      excludedKey: 'projectPage.claim.cofinance.excluded',
      source: source('projectPage.doc.claimTerms', '§ 4', '2026-09-12'),
    },
    {
      id: 'communication',
      benefitKey: 'projectPage.claim.communication.benefit',
      holderKey: 'projectPage.claim.communication.holder',
      allowedKey: 'projectPage.claim.communication.allowed',
      excludedKey: 'projectPage.claim.communication.excluded',
      source: source('projectPage.doc.claimTerms', '§ 5', '2026-09-12'),
    },
  ],

  durabilityFacts: [
    {
      id: 'control',
      labelKey: 'projectPage.durability.fact.control',
      valueKey: 'projectPage.durability.fact.controlValue',
      source: source('projectPage.doc.landControl', '§ 1', '2026-06-04'),
    },
    {
      id: 'maintenance',
      labelKey: 'projectPage.durability.fact.maintenance',
      valueKey: 'projectPage.durability.fact.maintenanceValue',
      source: source('projectPage.doc.landControl', '§ 3', '2026-06-04'),
    },
    {
      id: 'term',
      labelKey: 'projectPage.durability.fact.term',
      valueKey: 'projectPage.durability.fact.termValue',
      source: source('projectPage.doc.landControl', '§ 2', '2026-06-04'),
    },
    {
      id: 'after',
      labelKey: 'projectPage.durability.fact.after',
      valueKey: 'projectPage.durability.fact.afterValue',
      source: source('projectPage.doc.landControl', '§ 6', '2026-06-04'),
    },
  ],

  timeline: [
    {
      id: 'registration',
      when: '2026',
      titleKey: 'projectPage.timeline.registration.title',
      bodyKey: 'projectPage.timeline.registration.body',
      state: 'recorded',
    },
    {
      id: 'works',
      when: '2027',
      titleKey: 'projectPage.timeline.works.title',
      bodyKey: 'projectPage.timeline.works.body',
      state: 'planned',
    },
    {
      id: 'firstOutcome',
      when: '2028',
      titleKey: 'projectPage.timeline.firstOutcome.title',
      bodyKey: 'projectPage.timeline.firstOutcome.body',
      state: 'planned',
    },
    {
      id: 'verification',
      when: '2029',
      titleKey: 'projectPage.timeline.verification.title',
      bodyKey: 'projectPage.timeline.verification.body',
      state: 'planned',
    },
    {
      id: 'contractEnd',
      when: '2033',
      titleKey: 'projectPage.timeline.contractEnd.title',
      bodyKey: 'projectPage.timeline.contractEnd.body',
      state: 'planned',
    },
    {
      id: 'management',
      when: '2027–2057',
      titleKey: 'projectPage.timeline.management.title',
      bodyKey: 'projectPage.timeline.management.body',
      state: 'planned',
    },
    {
      id: 'beyond',
      when: '2057',
      titleKey: 'projectPage.timeline.beyond.title',
      bodyKey: 'projectPage.timeline.beyond.body',
      state: 'open',
    },
  ],

  // One row per period. expected − buffer − reserved − committed = remaining,
  // within this project and this unit type only.
  periods: [
    {
      id: 'p2028',
      label: '2028',
      startsOn: '2028-01-01',
      endsOn: '2028-12-31',
      expected: 12400,
      buffer: 1000,
      reserved: 600,
      committed: 4800,
      remaining: 6000,
      source: PDD,
    },
    {
      id: 'p2029',
      label: '2029',
      startsOn: '2029-01-01',
      endsOn: '2029-12-31',
      expected: 10000,
      buffer: 800,
      reserved: 0,
      committed: 2000,
      remaining: 7200,
      source: PDD,
    },
    {
      id: 'p2030',
      label: '2030',
      startsOn: '2030-01-01',
      endsOn: '2030-12-31',
      expected: 9500,
      buffer: 760,
      reserved: 400,
      committed: 0,
      remaining: 8340,
      source: PDD,
    },
  ],

  documents: [
    {
      id: 'pin',
      nameKey: 'projectPage.doc.ideaNote',
      typeKey: 'projectPage.docType.ideaNote',
      version: 'v1.2',
      date: '2026-03-18',
      uploadedBy: 'DEMO Moorland Trust gGmbH',
      fileNote: 'PDF · 1.4 MB',
      available: true,
      href: '/api/projects/demo-untere-havel-wetland-restoration/documents/pin',
    },
    {
      id: 'pdd',
      nameKey: 'projectPage.doc.designDocument',
      typeKey: 'projectPage.docType.designDocument',
      version: 'v2.0',
      date: '2026-09-12',
      uploadedBy: 'DEMO Havel Restoration Partners GmbH',
      fileNote: 'PDF · 6.2 MB',
      available: true,
      href: '/api/projects/demo-untere-havel-wetland-restoration/documents/pdd',
    },
    {
      id: 'monitoring',
      nameKey: 'projectPage.doc.monitoringPlan',
      typeKey: 'projectPage.docType.monitoringPlan',
      version: 'v1.1',
      date: '2026-08-28',
      uploadedBy: 'DEMO Hydro-Verify GmbH',
      fileNote: 'PDF · 2.1 MB',
      available: true,
      href: '/api/projects/demo-untere-havel-wetland-restoration/documents/monitoring',
    },
    {
      id: 'landControl',
      nameKey: 'projectPage.doc.landControl',
      typeKey: 'projectPage.docType.legalSummary',
      version: 'v1.0',
      date: '2026-06-04',
      uploadedBy: 'DEMO Moorland Trust gGmbH',
      fileNote: 'PDF · 0.4 MB',
      available: true,
      href: '/api/projects/demo-untere-havel-wetland-restoration/documents/land-control',
    },
    {
      id: 'hydrology',
      nameKey: 'projectPage.doc.baselineHydrology',
      typeKey: 'projectPage.docType.technicalReport',
      version: 'v1.0',
      date: '2026-02-27',
      uploadedBy: 'DEMO Hydro-Verify GmbH',
      fileNote: 'PDF · 3.8 MB',
      available: true,
      href: '/api/projects/demo-untere-havel-wetland-restoration/documents/baseline-hydrology',
    },
    {
      id: 'boundary',
      nameKey: 'projectPage.doc.boundary',
      typeKey: 'projectPage.docType.geodata',
      version: 'v1.0',
      date: '2026-09-12',
      uploadedBy: 'DEMO Havel Restoration Partners GmbH',
      fileNote: 'GeoJSON · 212 kB',
      available: true,
      href: '/api/projects/demo-untere-havel-wetland-restoration/boundary.geojson',
    },
    {
      id: 'verification',
      nameKey: 'projectPage.doc.verificationReport',
      typeKey: 'projectPage.docType.verificationReport',
      version: null,
      date: null,
      uploadedBy: null,
      fileNote: null,
      available: false,
      href: '/api/projects/demo-untere-havel-wetland-restoration/documents/verification-1',
    },
  ],

  partners: [
    {
      id: 'developer',
      roleKey: 'projectPage.partner.developer',
      name: 'DEMO Havel Restoration Partners GmbH',
      place: 'Rathenow, DE',
      noteKey: 'projectPage.partner.developerNote',
      registryRef: 'DEMO-ORG-4471',
    },
    {
      id: 'owner',
      roleKey: 'projectPage.partner.owner',
      name: 'DEMO Moorland Trust gGmbH',
      place: 'Potsdam, DE',
      noteKey: 'projectPage.partner.ownerNote',
      registryRef: 'DEMO-ORG-1192',
    },
    {
      id: 'landowner',
      roleKey: 'projectPage.partner.landOwner',
      name: 'DEMO Havelland Landstiftung',
      place: 'Premnitz, DE',
      noteKey: 'projectPage.partner.landOwnerNote',
      registryRef: 'DEMO-ORG-2088',
    },
    {
      id: 'verifier',
      roleKey: 'projectPage.partner.verifier',
      name: 'DEMO Hydro-Verify GmbH',
      place: 'Leipzig, DE',
      noteKey: 'projectPage.partner.verifierNote',
      registryRef: 'DEMO-ORG-7310',
    },
  ],

  evidencePackItemKeys: [
    'projectPage.evidence.item.description',
    'projectPage.evidence.item.action',
    'projectPage.evidence.item.timeframe',
    'projectPage.evidence.item.impact',
    'projectPage.evidence.item.budget',
    'projectPage.evidence.item.verification',
    'projectPage.evidence.item.documents',
    'projectPage.evidence.item.availability',
  ],

  investorFieldKeys: [
    'projectPage.investor.field.financingNeed',
    'projectPage.investor.field.revenueStreams',
    'projectPage.investor.field.model',
    'projectPage.investor.field.issuanceSchedule',
    'projectPage.investor.field.useOfFunds',
  ],

  headerSource: PDD,
};
