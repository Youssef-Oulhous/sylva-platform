/**
 * DEMO DATA for the project owner dashboard.
 *
 * Nothing here comes from the database. The module exists so the page and its
 * components can be built, reviewed and translated before the data layer is
 * wired in. Every organisation name begins with "DEMO" and every figure is
 * fictional. No row below describes a real wetland, a real verification, a real
 * buyer or a real environmental result.
 *
 * Prose a reader sees is held as an i18n KEY, not an English string, so the
 * German site is not silently served English. Proper nouns (organisation names,
 * project names, region names, document locators, pseudonym labels) stay as
 * literals, which is how they will arrive from the database.
 *
 * The shapes mirror what the data layer will return:
 *  - the gate list mirrors proj.publication_gaps() in
 *    db/migrations/0013_a11_publication_gate.sql, code for code and in order;
 *  - publication status mirrors proj.publication_status;
 *  - a question mirrors deal.project_question and its append-only answer row;
 *  - an interest entry mirrors a deal at stage 'interest_expressed', which
 *    carries no volume.
 *
 * RULE 7. Every quantity below is a UnitQty carrying its own project and unit
 * type, and each one is only ever rendered through formatQty(), so the unit
 * label travels with the number. There is no field on any type in this module
 * that could hold a figure spanning two projects: availability hangs off one
 * project and one period, and the interest table has no volume column at all
 * (a deal at first interest carries none). Nothing on this page is added up.
 */

import { qty, type UnitQty } from '@/lib/units/qty';

/* ------------------------------------------------------------------ SOURCES */

export interface DemoOwnerSource {
  /** Full i18n key naming the source document. */
  labelKey: string;
  /** Page, section or table reference inside that document. Not translated. */
  locator: string | null;
  /** ISO date the figure was last updated in that source. */
  asOfDate: string;
}

/* ----------------------------------------------------- THE PUBLICATION GATE */

/**
 * The ten items proj.publication_gaps() checks, in the order the function
 * builds its array. The screen and the database read the same list, which is
 * the point of that migration: an owner is never told the project is ready
 * while the database would refuse to publish it.
 */
export const PUBLICATION_GATE_CODES = [
  'english_page_text',
  'boundary',
  'claim_rights',
  'outcomes',
  'outcome_baseline',
  'durability',
  'verifier',
  'project_idea_note',
  'project_design_document',
  'availability',
] as const;

export type PublicationGateCode = (typeof PUBLICATION_GATE_CODES)[number];

/** Gate code to the i18n key fragment under owner.gate.item.<fragment>. */
export const GATE_ITEM_KEY: Record<PublicationGateCode, string> = {
  english_page_text: 'englishPageText',
  boundary: 'boundary',
  claim_rights: 'claimRights',
  outcomes: 'outcomes',
  outcome_baseline: 'outcomeBaseline',
  durability: 'durability',
  verifier: 'verifier',
  project_idea_note: 'projectIdeaNote',
  project_design_document: 'projectDesignDocument',
  availability: 'availability',
};

/* --------------------------------------------------------------- PROJECTS */

/**
 * Availability for ONE period of ONE project, in that project's own unit type.
 * There is deliberately no field here for a figure covering several periods and
 * none for a figure covering several projects.
 */
export interface DemoOwnerPeriod {
  periodLabel: string;
  /** i18n key for the unit type's metric label, e.g. hectare-years. */
  unitLabelKey: string;
  expected: UnitQty;
  buffer: UnitQty;
  committed: UnitQty;
  remaining: UnitQty;
  source: DemoOwnerSource;
}

export interface DemoOwnerProject {
  id: string;
  slug: string;
  /** Legal project name. A proper noun, never translated. */
  name: string;
  /** Region as written in the project documents. A proper noun. */
  regionLabel: string;
  countryCode: string;
  /** Scheme name. A proper noun. */
  schemeName: string;
  /** i18n key for this project's unit type. */
  unitLabelKey: string;
  /** Full i18n key under the shared status namespace. */
  statusKey: string;
  /** True for the one status that puts the project on the public index. */
  isPublished: boolean;
  /** Gate codes with nothing recorded yet. Mirrors proj.publication_gaps(). */
  gaps: readonly PublicationGateCode[];
  /** ISO date of the owner's last change to the project. */
  lastChangeOn: string;
  /** ISO date the gate was last evaluated. */
  gateCheckedOn: string;
  /** The nearest period with availability recorded, or null when none is. */
  nearestPeriod: DemoOwnerPeriod | null;
}

const UNIT_HECTARE_YEARS = 'owner.unit.hectareYears';
const UNIT_INDEX_POINTS = 'owner.unit.indexPoints';

/* Unit type identifiers. Opaque here, as they are in the database: what they
   are for is keeping a quantity attached to the unit type it was measured in. */
const UT_HECTARE_YEARS = 'demo-ut-hectare-years';
const UT_INDEX_POINTS = 'demo-ut-index-points';

const P1 = 'demo-project-untere-havel';
const P2 = 'demo-project-oder-floodplain';

export const DEMO_OWNER_ORG = 'DEMO Moorland Trust gGmbH';

/** The date this demo view was assembled. Carried by the source stamps. */
export const DEMO_OWNER_AS_OF = '2026-09-24';

export const DEMO_OWNER_PROJECTS: readonly DemoOwnerProject[] = [
  {
    id: P1,
    slug: 'demo-untere-havel-wetland-restoration',
    name: 'DEMO Untere Havel Wetland Restoration',
    regionLabel: 'Brandenburg',
    countryCode: 'DE',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitLabelKey: UNIT_HECTARE_YEARS,
    statusKey: 'status.published',
    isPublished: true,
    gaps: [],
    lastChangeOn: '2026-09-12',
    gateCheckedOn: DEMO_OWNER_AS_OF,
    nearestPeriod: {
      periodLabel: '2028',
      unitLabelKey: UNIT_HECTARE_YEARS,
      expected: qty(P1, UT_HECTARE_YEARS, 12400),
      buffer: qty(P1, UT_HECTARE_YEARS, 1000),
      committed: qty(P1, UT_HECTARE_YEARS, 4800),
      remaining: qty(P1, UT_HECTARE_YEARS, 6600),
      source: { labelKey: 'owner.doc.designDocument', locator: '§ 6.1', asOfDate: '2026-09-12' },
    },
  },
  {
    id: P2,
    slug: 'demo-oder-floodplain-reconnection',
    name: 'DEMO Oder Floodplain Reconnection',
    regionLabel: 'Oderbruch, Brandenburg',
    countryCode: 'DE',
    schemeName: 'DEMO Riverine Habitat Scheme',
    unitLabelKey: UNIT_INDEX_POINTS,
    statusKey: 'status.published',
    isPublished: true,
    gaps: [],
    lastChangeOn: '2026-09-08',
    gateCheckedOn: DEMO_OWNER_AS_OF,
    nearestPeriod: {
      periodLabel: '2029',
      unitLabelKey: UNIT_INDEX_POINTS,
      expected: qty(P2, UT_INDEX_POINTS, 1850),
      buffer: qty(P2, UT_INDEX_POINTS, 150),
      committed: qty(P2, UT_INDEX_POINTS, 420),
      remaining: qty(P2, UT_INDEX_POINTS, 1280),
      source: { labelKey: 'owner.doc.designDocument', locator: '§ 5.3', asOfDate: '2026-09-08' },
    },
  },
  {
    id: 'demo-project-rhinluch-fen',
    slug: 'demo-rhinluch-fen-recovery',
    name: 'DEMO Rhinluch Fen Recovery',
    regionLabel: 'Ostprignitz-Ruppin, Brandenburg',
    countryCode: 'DE',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitLabelKey: UNIT_HECTARE_YEARS,
    statusKey: 'status.submitted_for_review',
    isPublished: false,
    gaps: ['verifier', 'project_design_document'],
    lastChangeOn: '2026-09-19',
    gateCheckedOn: DEMO_OWNER_AS_OF,
    nearestPeriod: {
      periodLabel: '2030',
      unitLabelKey: UNIT_HECTARE_YEARS,
      expected: qty('demo-project-rhinluch-fen', UT_HECTARE_YEARS, 5400),
      buffer: qty('demo-project-rhinluch-fen', UT_HECTARE_YEARS, 540),
      committed: qty('demo-project-rhinluch-fen', UT_HECTARE_YEARS, 0),
      remaining: qty('demo-project-rhinluch-fen', UT_HECTARE_YEARS, 4860),
      source: { labelKey: 'owner.doc.ideaNote', locator: '§ 4', asOfDate: '2026-09-19' },
    },
  },
  {
    id: 'demo-project-warta-mosaic',
    slug: 'demo-warta-floodplain-mosaic',
    name: 'DEMO Warta Floodplain Mosaic',
    regionLabel: 'Lubusz',
    countryCode: 'PL',
    schemeName: 'DEMO Riverine Habitat Scheme',
    unitLabelKey: UNIT_INDEX_POINTS,
    statusKey: 'status.changes_requested',
    isPublished: false,
    gaps: ['english_page_text', 'outcome_baseline', 'availability'],
    lastChangeOn: '2026-09-22',
    gateCheckedOn: DEMO_OWNER_AS_OF,
    nearestPeriod: null,
  },
  {
    id: 'demo-project-havellaendisches-luch',
    slug: 'demo-havellaendisches-luch-peat-rewetting',
    name: 'DEMO Havelländisches Luch Peat Rewetting',
    regionLabel: 'Havelland, Brandenburg',
    countryCode: 'DE',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitLabelKey: UNIT_HECTARE_YEARS,
    statusKey: 'status.draft',
    isPublished: false,
    gaps: [
      'english_page_text',
      'claim_rights',
      'outcomes',
      'outcome_baseline',
      'durability',
      'verifier',
      'project_design_document',
      'availability',
    ],
    lastChangeOn: '2026-09-23',
    gateCheckedOn: DEMO_OWNER_AS_OF,
    nearestPeriod: null,
  },
];

/* ---------------------------------------------------------------- BUYERS */

export type DemoSectorCode = 'food_bev' | 'utilities' | 'chemicals' | 'finance';
export type DemoSizeBandCode = 'sme' | 'large';

/**
 * How a buyer appears to the project owner.
 *
 * 'label' is a per-deal pseudonym; 'named' is a buyer that chose disclosure for
 * that deal. The concept note makes the pseudonym the default and naming the
 * buyer's own choice, deal by deal.
 */
export interface DemoBuyerParty {
  kind: 'label' | 'named';
  /** A pseudonym label or a legal name. Never translated. */
  display: string;
  sectorCode: DemoSectorCode;
  countryCode: string;
  sizeBandCode: DemoSizeBandCode;
}

const BUYER_001: DemoBuyerParty = {
  kind: 'label',
  display: 'Buyer 001',
  sectorCode: 'food_bev',
  countryCode: 'DE',
  sizeBandCode: 'large',
};
const BUYER_002_NAMED: DemoBuyerParty = {
  kind: 'named',
  display: 'DEMO Nordbräu AG',
  sectorCode: 'food_bev',
  countryCode: 'DE',
  sizeBandCode: 'large',
};
const BUYER_004: DemoBuyerParty = {
  kind: 'label',
  display: 'Buyer 004',
  sectorCode: 'chemicals',
  countryCode: 'NL',
  sizeBandCode: 'large',
};
const BUYER_007: DemoBuyerParty = {
  kind: 'label',
  display: 'Buyer 007',
  sectorCode: 'utilities',
  countryCode: 'DE',
  sizeBandCode: 'large',
};
const BUYER_011: DemoBuyerParty = {
  kind: 'label',
  display: 'Buyer 011',
  sectorCode: 'finance',
  countryCode: 'FR',
  sizeBandCode: 'large',
};

export const SECTOR_KEY: Record<DemoSectorCode, string> = {
  food_bev: 'owner.sector.foodBeverage',
  utilities: 'owner.sector.utilities',
  chemicals: 'owner.sector.chemicals',
  finance: 'owner.sector.finance',
};

export const SIZE_BAND_KEY: Record<DemoSizeBandCode, string> = {
  sme: 'owner.sizeBand.sme',
  large: 'owner.sizeBand.large',
};

/* ------------------------------------------------- THE PRIVATE QUESTION BOX */

export interface DemoOwnerAnswer {
  /** i18n key for the answer body. */
  bodyKey: string;
  /** The organisation that answered. A proper noun. */
  byOrgName: string;
  answeredOn: string;
}

export interface DemoOwnerQuestion {
  id: string;
  projectId: string;
  asker: DemoBuyerParty;
  /** i18n key for the question body. */
  bodyKey: string;
  askedOn: string;
  /** Whole days the question has been open, as at DEMO_OWNER_AS_OF. */
  daysWaiting: number;
  /** An answer is a separate append-only row, never an edit of the question. */
  answer: DemoOwnerAnswer | null;
}

export const DEMO_OWNER_QUESTIONS: readonly DemoOwnerQuestion[] = [
  {
    id: 'demo-question-1',
    projectId: P1,
    asker: BUYER_007,
    bodyKey: 'owner.demo.question.claimRight',
    askedOn: '2026-09-17',
    daysWaiting: 7,
    answer: null,
  },
  {
    id: 'demo-question-2',
    projectId: P1,
    asker: BUYER_004,
    bodyKey: 'owner.demo.question.monitoringPoint',
    askedOn: '2026-09-21',
    daysWaiting: 3,
    answer: null,
  },
  {
    id: 'demo-question-3',
    projectId: P2,
    asker: BUYER_011,
    bodyKey: 'owner.demo.question.verifier',
    askedOn: '2026-09-22',
    daysWaiting: 2,
    answer: null,
  },
  {
    id: 'demo-question-4',
    projectId: P1,
    asker: BUYER_001,
    bodyKey: 'owner.demo.question.afterContract',
    askedOn: '2026-09-08',
    daysWaiting: 0,
    answer: {
      bodyKey: 'owner.demo.answer.afterContract',
      byOrgName: DEMO_OWNER_ORG,
      answeredOn: '2026-09-10',
    },
  },
];

/* --------------------------------------------------- EXPRESSED INTEREST */

export type DemoDealShapeCode = 'spot' | 'forward' | 'co_investment';

export const DEAL_SHAPE_KEY: Record<DemoDealShapeCode, string> = {
  spot: 'owner.dealShape.spot',
  forward: 'owner.dealShape.forward',
  co_investment: 'owner.dealShape.coInvestment',
};

/**
 * One expressed interest awaiting the owner's response.
 *
 * There is no volume field and no price field, which matches the database: in
 * the first release a deal exists only at stage 'interest_expressed' and
 * carries no volume, so expressing interest opens a private room rather than
 * reserving anything.
 */
export interface DemoOwnerInterest {
  id: string;
  projectId: string;
  buyer: DemoBuyerParty;
  /** The deal shape the buyer said it is interested in. */
  shapeCode: DemoDealShapeCode;
  receivedOn: string;
  daysWaiting: number;
  /** Full i18n key for the deal stage. */
  stageKey: string;
}

export const DEMO_OWNER_INTEREST: readonly DemoOwnerInterest[] = [
  {
    id: 'demo-interest-1',
    projectId: P1,
    buyer: BUYER_001,
    shapeCode: 'forward',
    receivedOn: '2026-09-15',
    daysWaiting: 9,
    stageKey: 'owner.stage.interestExpressed',
  },
  {
    id: 'demo-interest-2',
    projectId: P1,
    buyer: BUYER_002_NAMED,
    shapeCode: 'co_investment',
    receivedOn: '2026-09-19',
    daysWaiting: 5,
    stageKey: 'owner.stage.interestExpressed',
  },
  {
    id: 'demo-interest-3',
    projectId: P2,
    buyer: BUYER_004,
    shapeCode: 'spot',
    receivedOn: '2026-09-22',
    daysWaiting: 2,
    stageKey: 'owner.stage.interestExpressed',
  },
];

/* ------------------------------------------------------------------ LOOKUPS */

/** Project by id. Returns null rather than throwing: a missing project is a
 *  data problem, not a reason for a page to fail to render. */
export function ownerProject(projectId: string): DemoOwnerProject | null {
  return DEMO_OWNER_PROJECTS.find((p) => p.id === projectId) ?? null;
}

export function questionsAwaitingAnswer(
  questions: readonly DemoOwnerQuestion[],
): readonly DemoOwnerQuestion[] {
  return questions.filter((q) => q.answer === null);
}

export function questionsAnswered(
  questions: readonly DemoOwnerQuestion[],
): readonly DemoOwnerQuestion[] {
  return questions.filter((q) => q.answer !== null);
}
