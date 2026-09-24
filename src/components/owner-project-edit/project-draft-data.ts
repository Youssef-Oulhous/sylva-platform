/**
 * DEMO DATA for the owner's project record (create or edit).
 *
 * Nothing here comes from the database. The form is built, reviewed and
 * translated before the data layer exists, so the record below is a typed
 * constant. Every organisation name begins with "DEMO", every figure is
 * fictional, and no value describes a real wetland, a real verification or a
 * real environmental result.
 *
 * Two conventions, both copied from src/components/project-detail/demo-data.ts:
 *
 *   - Prose a reader sees is held as an i18n KEY, not an English string, so the
 *     German site is not silently served English. Proper nouns (organisation
 *     names, gauge names, file names, document references) and figures stay as
 *     literals, which is how they will arrive from the database later.
 *   - The two summary fields are the exception. They hold the text that will be
 *     published in each language, so they are literals per language: that is
 *     content the owner types, not interface copy.
 *
 * Rule 7. Every unit figure below belongs to ONE project and ONE unit type, and
 * every figure carries the i18n key of the unit label printed beside its field.
 * There is no field in these types that could hold a figure spanning projects,
 * and nothing here is summed - not even across this project's own periods.
 */

/** Every inert control on the form points at the one note that explains why. */
export const INERT_NOTE_ID = 'opf-inert-note';

/** Section anchors. Shared by the sections and by the readiness panel that
 *  links to them, so the two cannot drift apart. */
export const SECTION = {
  identity: 's-identity',
  location: 's-location',
  summary: 's-summary',
  outcomes: 's-outcomes',
  claims: 's-claims',
  durability: 's-durability',
  partners: 's-partners',
  periods: 's-periods',
  documents: 's-documents',
} as const;

/* -------------------------------------------------------------------------- */
/* Sources                                                                     */
/* -------------------------------------------------------------------------- */

export interface DemoSourceDoc {
  id: string;
  /** Key inside the `ownerProjectForm` namespace. */
  labelKey: string;
}

/**
 * The documents a figure on this record may cite. The provenance control on
 * every figure is a select over this list rather than a free-text box: a source
 * that names a document the record does not hold is not a source.
 */
export const SOURCE_DOCS: readonly DemoSourceDoc[] = [
  { id: 'pin', labelKey: 'doc.ideaNote' },
  { id: 'pdd', labelKey: 'doc.designDocument' },
  { id: 'monitoringPlan', labelKey: 'doc.monitoringPlan' },
  { id: 'verificationReport', labelKey: 'doc.verificationReport' },
  { id: 'baselineSurvey', labelKey: 'doc.baselineSurvey' },
  { id: 'catchmentAssessment', labelKey: 'doc.catchmentAssessment' },
  { id: 'lease', labelKey: 'doc.lease' },
  { id: 'claimAnnex', labelKey: 'doc.claimAnnex' },
  { id: 'financialModel', labelKey: 'doc.financialModel' },
];

/* -------------------------------------------------------------------------- */
/* Figures                                                                     */
/* -------------------------------------------------------------------------- */

export interface DemoFigure {
  id: string;
  /**
   * The value as the owner typed it. A string, because that is what a text
   * field holds: "−0.74" and "8400" both arrive from a keyboard, and an empty
   * string is a figure nobody has entered yet.
   */
  value: string;
  /** i18n key of the unit label printed beside the field (Rule 7). */
  unitKey: string;
  /** id in SOURCE_DOCS, or null when no source has been stated. */
  sourceDocId: string | null;
  /** Page, clause or table inside that document. Not translated. */
  locator: string | null;
  /** ISO date the figure is stated as of, or null when not stated. */
  asOfDate: string | null;
}

const figure = (
  id: string,
  value: string,
  unitKey: string,
  sourceDocId: string | null,
  locator: string | null,
  asOfDate: string | null,
): DemoFigure => ({ id, value, unitKey, sourceDocId, locator, asOfDate });

const filled = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

/** A figure is provenanced when it has a value, a source document and a date. */
export const figureIsComplete = (f: DemoFigure): boolean =>
  filled(f.value) && f.sourceDocId !== null && filled(f.asOfDate);

/* -------------------------------------------------------------------------- */
/* The record                                                                  */
/* -------------------------------------------------------------------------- */

export interface DemoOrgOption {
  id: string;
  /** A proper noun: not translated. */
  name: string;
}

export const OWNER_ORGS: readonly DemoOrgOption[] = [
  { id: 'nordmoor', name: 'DEMO Nordmoor Restoration gGmbH' },
  { id: 'moorland', name: 'DEMO Moorland Trust gGmbH' },
  { id: 'havelaue', name: 'DEMO Havelaue Naturstiftung' },
];

export const SCHEMES: readonly DemoOrgOption[] = [
  { id: 'mireCondition', name: 'DEMO Mire Condition Standard' },
  { id: 'wetlandBio', name: 'DEMO Wetland Biodiversity Standard' },
];

export const COUNTRIES: readonly { code: string; nameKey: string }[] = [
  { code: 'DE', nameKey: 'country.DE' },
  { code: 'DK', nameKey: 'country.DK' },
  { code: 'EE', nameKey: 'country.EE' },
  { code: 'NL', nameKey: 'country.NL' },
  { code: 'PL', nameKey: 'country.PL' },
  { code: 'SE', nameKey: 'country.SE' },
];

/** The three deal shapes offered side by side (concept note, section 5). */
export const DEAL_SHAPES = ['spot', 'forward', 'coInvestment'] as const;
export type DealShape = (typeof DEAL_SHAPES)[number];

/** What a period refers to under the scheme. Conflating the two misdates every
 *  forward contract, so it is asked once, explicitly, in the identity section. */
export const VINTAGE_CHOICES = [
  { value: 'period_of_outcome', labelKey: 'project.vintageOutcome' },
  { value: 'period_of_issuance', labelKey: 'project.vintageIssuance' },
  { value: 'undefined_by_scheme', labelKey: 'project.vintageUndefined' },
] as const;

export const RECORD = {
  /** The record's own reference. Mono on screen, never translated. */
  ref: 'DEMO-PRJ-0042',
  nameEn: 'DEMO Peene Valley Mire Rewetting',
  nameDe: 'DEMO Renaturierung Peenetal-Moor',
  slug: 'demo-peene-valley-mire-rewetting',
  ownerOrgId: 'nordmoor',
  schemeId: 'mireCondition',
  /** The unit label travels with every volume on this project. */
  unitKey: 'unit.indexPoints',
  vintage: 'period_of_outcome',
  dealShapes: ['forward', 'coInvestment'] as DealShape[],
  /** Maps to the existing `status.*` namespace. */
  statusKey: 'status.draft',
  savedOn: '2026-09-22',
  savedBy: 'DEMO Nordmoor Restoration gGmbH',
} as const;

/* --- location and geometry ------------------------------------------------ */

export interface DemoUpload {
  /** File name as uploaded. Not translated. */
  name: string;
  sizeNote: string;
  uploadedOn: string;
}

export const LOCATION = {
  countryCode: 'DE',
  region: 'Mecklenburg-Vorpommern',
  catchment: 'Peene',
  gaugeRef: 'DEMO gauge PEE-04',
  area: figure('area', '268', 'unit.hectares', 'pdd', '§ 2.1', '2026-09-14'),
  catchmentArea: figure(
    'catchmentArea',
    '5110',
    'unit.km2',
    'catchmentAssessment',
    'table 2',
    '2026-08-30',
  ),
  boundaryFile: {
    name: 'demo-peene-boundary.geojson',
    sizeNote: '41 kB',
    uploadedOn: '2026-09-14',
  } as DemoUpload | null,
  catchmentFile: {
    name: 'demo-peene-catchment.geojson',
    sizeNote: '112 kB',
    uploadedOn: '2026-09-14',
  } as DemoUpload | null,
};

/* --- summary -------------------------------------------------------------- */

/**
 * Published content, one field per language, so these are literals rather than
 * i18n keys. The German body is empty and the German text is not marked as
 * reviewed: that is what the readiness panel reports against this section.
 */
export const SUMMARY = {
  en: {
    lead:
      'A 268-hectare drained fen in the Peene valley is rewetted by blocking drainage ' +
      'ditches and rebuilding two weirs, so that the growing-season water table returns ' +
      'to within 0.3 m of the surface.',
    body:
      'The site was drained for grassland in the 1960s and has been losing peat since. ' +
      'Water leaves the fen through a network of ditches faster than rainfall replaces ' +
      'it, and the mire vegetation has given way to a few drought-tolerant grasses.\n\n' +
      'The works block 14 km of ditch and rebuild two weirs. Restoration is carried out ' +
      'over one winter season and monitored from 2027.\n\n' +
      'What is measured: growing-season water table depth at six piezometers, and the ' +
      'mire condition score under Part C of the scheme. Both are assessed against the ' +
      '2026 baseline survey and verified by an independent body.',
  },
  de: {
    lead:
      'Ein 268 Hektar großes, entwässertes Niedermoor im Peenetal wird durch das ' +
      'Verschließen von Entwässerungsgräben und den Neubau von zwei Stauwehren ' +
      'wiedervernässt, sodass der Wasserstand in der Vegetationsperiode wieder bis auf ' +
      '0,3 m unter die Oberfläche steigt.',
    body: '',
  },
  deReviewed: false,
};

/* --- outcomes ------------------------------------------------------------- */

export interface DemoOutcomeDraft {
  id: string;
  domain: 'water' | 'biodiversity' | 'other';
  metricKey: string;
  methodKey: string;
  /** Written as it appears in the monitoring plan. Not translated. */
  monitoringPeriod: string;
  /** A proper noun, empty when no verifier has been named. */
  verifierName: string;
  baseline: DemoFigure;
  expected: DemoFigure;
  uncertainty: DemoFigure;
}

export const OUTCOMES: readonly DemoOutcomeDraft[] = [
  {
    id: 'watertable',
    domain: 'water',
    metricKey: 'draft.outcome.watertable.metric',
    methodKey: 'draft.outcome.watertable.method',
    monitoringPeriod: '2027–2032',
    verifierName: 'DEMO Hydro-Verify GmbH',
    baseline: figure('o1-baseline', '−0.74', 'unit.metres', 'baselineSurvey', '§ 3.1', '2026-07-22'),
    expected: figure('o1-expected', '−0.21', 'unit.metres', 'pdd', '§ 4.2', '2026-09-14'),
    uncertainty: figure('o1-uncertainty', '± 0.12', 'unit.metres', 'pdd', '§ 4.4', '2026-09-14'),
  },
  {
    id: 'condition',
    domain: 'biodiversity',
    metricKey: 'draft.outcome.condition.metric',
    methodKey: 'draft.outcome.condition.method',
    monitoringPeriod: '2027–2032',
    verifierName: '',
    baseline: figure('o2-baseline', '31', 'unit.scorePoints', 'baselineSurvey', '§ 4.3', '2026-07-22'),
    expected: figure('o2-expected', '58', 'unit.scorePoints', 'pdd', '§ 5.1', '2026-09-14'),
    /** Not yet stated. The readiness panel reports it, and so does the field. */
    uncertainty: figure('o2-uncertainty', '', 'unit.scorePoints', null, null, null),
  },
];

/* --- claim rights --------------------------------------------------------- */

export interface DemoClaimDraft {
  id: string;
  benefitKey: string;
  holderKey: string;
  allowedKey: string;
  excludedKey: string;
  sourceDocId: string | null;
  locator: string | null;
  asOfDate: string | null;
}

export const CLAIMS: readonly DemoClaimDraft[] = [
  {
    id: 'water',
    benefitKey: 'draft.claim.water.benefit',
    holderKey: 'draft.claim.water.holder',
    allowedKey: 'draft.claim.water.allowed',
    excludedKey: 'draft.claim.water.excluded',
    sourceDocId: 'claimAnnex',
    locator: '§ 2',
    asOfDate: '2026-09-08',
  },
  {
    id: 'condition',
    benefitKey: 'draft.claim.condition.benefit',
    holderKey: 'draft.claim.condition.holder',
    allowedKey: 'draft.claim.condition.allowed',
    excludedKey: 'draft.claim.condition.excluded',
    sourceDocId: 'claimAnnex',
    locator: '§ 3',
    asOfDate: '2026-09-08',
  },
];

/* --- durability ----------------------------------------------------------- */

export interface DemoTimelineDraft {
  id: string;
  /** A year or a range, written as the documents write it. */
  when: string;
  noteKey: string;
}

export const DURABILITY = {
  landControlKey: 'draft.durability.landControl',
  maintenanceOrg: 'DEMO Peenetal Wasser- und Bodenverband',
  commitmentLength: figure('commitment', '40', 'unit.years', 'lease', 'clause 3', '2026-05-04'),
  /** Not written yet. The readiness panel reports it. */
  afterContract: '',
  timeline: [
    { id: 't1', when: '2027', noteKey: 'draft.timeline.works' },
    { id: 't2', when: '2028', noteKey: 'draft.timeline.monitoring' },
    { id: 't3', when: '2029', noteKey: 'draft.timeline.verification' },
    { id: 't4', when: '2067', noteKey: 'draft.timeline.leaseEnds' },
  ] as DemoTimelineDraft[],
};

/* --- partners ------------------------------------------------------------- */

export const PARTNER_ROLES = ['developer', 'landOwner', 'verifier', 'maintenance', 'other'] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export interface DemoPartnerDraft {
  id: string;
  role: PartnerRole;
  name: string;
  /** City and country as written on the organisation record. */
  place: string;
  registryRef: string | null;
  noteKey: string | null;
}

export const PARTNERS: readonly DemoPartnerDraft[] = [
  {
    id: 'p1',
    role: 'developer',
    name: 'DEMO Nordmoor Restoration gGmbH',
    place: 'Greifswald, Germany',
    registryRef: 'DEMO-ORG-4471',
    noteKey: 'draft.partner.developer',
  },
  {
    id: 'p2',
    role: 'landOwner',
    name: 'DEMO Kreis Vorpommern-Nord',
    place: 'Anklam, Germany',
    registryRef: 'DEMO-ORG-1180',
    noteKey: 'draft.partner.landOwner',
  },
  {
    id: 'p3',
    role: 'verifier',
    name: 'DEMO Hydro-Verify GmbH',
    place: 'Hamburg, Germany',
    registryRef: 'DEMO-ORG-9024',
    noteKey: 'draft.partner.verifier',
  },
  {
    id: 'p4',
    role: 'maintenance',
    name: 'DEMO Peenetal Wasser- und Bodenverband',
    place: 'Demmin, Germany',
    registryRef: null,
    noteKey: 'draft.partner.maintenance',
  },
];

/* --- periods -------------------------------------------------------------- */

export interface DemoPeriodDraft {
  id: string;
  /** The period as the scheme writes it. */
  label: string;
  startsOn: string;
  endsOn: string;
  expected: DemoFigure;
  buffer: DemoFigure;
  /**
   * Committed volume for this period. It comes from recorded deals, not from
   * this form, so it is shown and not edited. Held as a string for the same
   * reason the figures are: it is displayed, never arithmetic.
   */
  committedValue: string;
  committedAsOf: string;
  /**
   * Remaining, as the project page states it for this period. null while a
   * figure the project page needs is missing - the form shows a dash rather
   * than a number it cannot stand behind.
   */
  remainingValue: string | null;
}

export const PERIODS: readonly DemoPeriodDraft[] = [
  {
    id: '2029',
    label: '2029',
    startsOn: '2029-01-01',
    endsOn: '2029-12-31',
    expected: figure('p2029-expected', '8400', RECORD.unitKey, 'pdd', '§ 6.1', '2026-09-14'),
    buffer: figure('p2029-buffer', '840', RECORD.unitKey, 'pdd', '§ 6.1', '2026-09-14'),
    committedValue: '0',
    committedAsOf: '2026-09-22',
    remainingValue: '7560',
  },
  {
    id: '2030',
    label: '2030',
    startsOn: '2030-01-01',
    endsOn: '2030-12-31',
    expected: figure('p2030-expected', '9600', RECORD.unitKey, 'pdd', '§ 6.1', '2026-09-14'),
    buffer: figure('p2030-buffer', '960', RECORD.unitKey, 'pdd', '§ 6.1', '2026-09-14'),
    committedValue: '0',
    committedAsOf: '2026-09-22',
    remainingValue: '8640',
  },
  {
    id: '2031',
    label: '2031',
    startsOn: '2031-01-01',
    endsOn: '2031-12-31',
    /** A figure with no source and no date, and a buffer nobody has set. */
    expected: figure('p2031-expected', '9600', RECORD.unitKey, null, null, null),
    buffer: figure('p2031-buffer', '', RECORD.unitKey, null, null, null),
    committedValue: '0',
    committedAsOf: '2026-09-22',
    remainingValue: null,
  },
];

/* --- documents ------------------------------------------------------------ */

export const DOC_VISIBILITY = ['public', 'investors'] as const;
export type DocVisibility = (typeof DOC_VISIBILITY)[number];

export interface DemoDocumentDraft {
  /** Matches the SOURCE_DOCS id where a figure may cite the document. */
  id: string;
  labelKey: string;
  version: string | null;
  dateOn: string | null;
  /** null where no file has been uploaded. */
  fileName: string | null;
  fileSize: string | null;
  uploadedOn: string | null;
  uploadedBy: string | null;
  visibility: DocVisibility;
  /** Why the row is empty, where it is empty. */
  noteKey: string | null;
}

export const DOCUMENTS: readonly DemoDocumentDraft[] = [
  {
    id: 'pin',
    labelKey: 'doc.ideaNote',
    version: '1.2',
    dateOn: '2026-04-18',
    fileName: 'demo-peene-idea-note-v1-2.pdf',
    fileSize: '1.4 MB',
    uploadedOn: '2026-04-19',
    uploadedBy: 'DEMO Nordmoor Restoration gGmbH',
    visibility: 'public',
    noteKey: null,
  },
  {
    id: 'pdd',
    labelKey: 'doc.designDocument',
    version: '2.0',
    dateOn: '2026-09-14',
    fileName: 'demo-peene-design-document-v2-0.pdf',
    fileSize: '6.2 MB',
    uploadedOn: '2026-09-15',
    uploadedBy: 'DEMO Nordmoor Restoration gGmbH',
    visibility: 'public',
    noteKey: null,
  },
  {
    id: 'monitoringPlan',
    labelKey: 'doc.monitoringPlan',
    version: null,
    dateOn: null,
    fileName: null,
    fileSize: null,
    uploadedOn: null,
    uploadedBy: null,
    visibility: 'public',
    noteKey: 'draft.doc.monitoringNote',
  },
  {
    id: 'verificationReport',
    labelKey: 'doc.verificationReport',
    version: null,
    dateOn: null,
    fileName: null,
    fileSize: null,
    uploadedOn: null,
    uploadedBy: null,
    visibility: 'public',
    noteKey: 'draft.doc.verificationNote',
  },
  {
    id: 'financialModel',
    labelKey: 'doc.financialModel',
    version: '0.9',
    dateOn: '2026-09-19',
    fileName: 'demo-peene-financial-model-v0-9.xlsx',
    fileSize: '284 kB',
    uploadedOn: '2026-09-19',
    uploadedBy: 'DEMO Nordmoor Restoration gGmbH',
    visibility: 'investors',
    noteKey: 'draft.doc.financialNote',
  },
];

/* -------------------------------------------------------------------------- */
/* Publication readiness                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every figure on the record, in one list, so the readiness panel counts the
 * same figures the form renders and the two cannot disagree. This is a list of
 * FIELDS, not of volumes: nothing here is added to anything.
 */
export const ALL_FIGURES: readonly DemoFigure[] = [
  LOCATION.area,
  LOCATION.catchmentArea,
  ...OUTCOMES.flatMap((o) => [o.baseline, o.expected, o.uncertainty]),
  DURABILITY.commitmentLength,
  ...PERIODS.flatMap((p) => [p.expected, p.buffer]),
];

export const FIGURES_INCOMPLETE = ALL_FIGURES.filter((f) => !figureIsComplete(f));

/**
 * 'optional' is for a requirement the record can be published without.
 * 'withOperator' is for the step the owner cannot complete at all.
 */
export type GateState = 'complete' | 'incomplete' | 'optional' | 'withOperator';

export interface Gate {
  /** Also the key stem: readiness.gate.<id>.title / .requirement / .detail */
  id: string;
  sectionId: string | null;
  state: GateState;
  /** True when the gate has a `detail` message to print. */
  hasDetail: boolean;
  /** Count for the plural in that message, where the message counts something. */
  count?: number;
}

const identityComplete =
  filled(RECORD.nameEn) &&
  filled(RECORD.ownerOrgId) &&
  filled(RECORD.schemeId) &&
  filled(RECORD.vintage) &&
  RECORD.dealShapes.length > 0;

const geometryComplete =
  filled(LOCATION.region) &&
  filled(LOCATION.catchment) &&
  LOCATION.boundaryFile !== null &&
  LOCATION.catchmentFile !== null;

const outcomesComplete = OUTCOMES.every(
  (o) =>
    filled(o.verifierName) &&
    filled(o.monitoringPeriod) &&
    figureIsComplete(o.baseline) &&
    figureIsComplete(o.expected) &&
    figureIsComplete(o.uncertainty),
);

const claimsComplete =
  CLAIMS.length > 0 &&
  CLAIMS.every((c) => c.sourceDocId !== null && filled(c.asOfDate));

const durabilityComplete =
  filled(DURABILITY.maintenanceOrg) &&
  figureIsComplete(DURABILITY.commitmentLength) &&
  filled(DURABILITY.afterContract);

const partnersComplete = (['developer', 'landOwner', 'verifier'] as PartnerRole[]).every((role) =>
  PARTNERS.some((p) => p.role === role && filled(p.name)),
);

const periodsComplete = PERIODS.every(
  (p) => figureIsComplete(p.expected) && figureIsComplete(p.buffer),
);

const documentsComplete = (['pin', 'pdd', 'monitoringPlan'] as string[]).every((id) =>
  DOCUMENTS.some((d) => d.id === id && d.fileName !== null),
);

/**
 * The gate list. Each line is something the record either contains or does not.
 * It is not a judgement on the project, and it is not a claim that the record
 * satisfies any scheme, auditor or regulation: publication is decided by the
 * operator, which is the last line.
 */
export const GATES: readonly Gate[] = [
  {
    id: 'identity',
    sectionId: SECTION.identity,
    state: identityComplete ? 'complete' : 'incomplete',
    hasDetail: !identityComplete,
  },
  {
    id: 'geometry',
    sectionId: SECTION.location,
    state: geometryComplete ? 'complete' : 'incomplete',
    hasDetail: !geometryComplete,
  },
  {
    id: 'summary',
    sectionId: SECTION.summary,
    state: SUMMARY.deReviewed ? 'complete' : 'optional',
    hasDetail: !SUMMARY.deReviewed,
  },
  {
    id: 'outcomes',
    sectionId: SECTION.outcomes,
    state: outcomesComplete ? 'complete' : 'incomplete',
    hasDetail: !outcomesComplete,
  },
  {
    id: 'claims',
    sectionId: SECTION.claims,
    state: claimsComplete ? 'complete' : 'incomplete',
    hasDetail: !claimsComplete,
  },
  {
    id: 'durability',
    sectionId: SECTION.durability,
    state: durabilityComplete ? 'complete' : 'incomplete',
    hasDetail: !durabilityComplete,
  },
  {
    id: 'partners',
    sectionId: SECTION.partners,
    state: partnersComplete ? 'complete' : 'incomplete',
    hasDetail: !partnersComplete,
  },
  {
    id: 'periods',
    sectionId: SECTION.periods,
    state: periodsComplete ? 'complete' : 'incomplete',
    hasDetail: !periodsComplete,
  },
  {
    id: 'documents',
    sectionId: SECTION.documents,
    state: documentsComplete ? 'complete' : 'incomplete',
    hasDetail: !documentsComplete,
  },
  {
    id: 'provenance',
    sectionId: null,
    state: FIGURES_INCOMPLETE.length === 0 ? 'complete' : 'incomplete',
    hasDetail: FIGURES_INCOMPLETE.length > 0,
    count: FIGURES_INCOMPLETE.length,
  },
  {
    id: 'review',
    sectionId: null,
    state: 'withOperator',
    hasDetail: false,
  },
];

/** Gates the owner is expected to close. An optional line is not one of them. */
export const GATES_REQUIRED = GATES.filter(
  (g) => g.state !== 'withOperator' && g.state !== 'optional',
);
export const GATES_MET = GATES_REQUIRED.filter((g) => g.state === 'complete');
