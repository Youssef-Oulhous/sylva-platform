import type { BadgeTone } from '@/components/ui/Badge';

/**
 * DEMO DATA for the operator's project review and publication screen.
 *
 * Nothing here reads a database. This is the shape a project in review would
 * have to have for the screen to be built, reviewed and translated before the
 * data layer exists.
 *
 * Every organisation below begins with "DEMO". No project, reference, date,
 * document version or verifier describes a real wetland, a real organisation or
 * a real verification.
 *
 * Prose a reader sees is held as an i18n KEY, never an English string, so the
 * German site is not silently served English. Proper nouns - project titles,
 * organisation names, scheme names, references, slugs and document versions -
 * stay as literals, which is how they will arrive from the database.
 *
 * THE POINT OF THIS MODULE'S SHAPE. The ten gate items below are not a list
 * this screen invented. They are the ten codes `proj.publication_gaps()`
 * returns, in the order that function builds them, and the trigger
 * `t_publication_gate` refuses any change into `published` while the function
 * returns a non-empty array. The screen shows the operator the same list the
 * database will apply, so a publication cannot be forced from the interface and
 * cannot be a surprise either.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT HOLD. There is no volume, quantity,
 * price or unit amount field anywhere in it, and the screen renders none. This
 * screen is the one place in the platform that puts projects from different
 * schemes in a single table, so it is the place a cross-project volume column
 * would most easily appear - a hectare-year and an index point measure
 * different things and must never share a column (rule 7). The `availability`
 * gate item therefore reports how many PERIODS are recorded, which is a count
 * of rows, not a volume. Each row still carries its unit type label, so no two
 * rows can be read as measuring the same thing.
 *
 * RULE J (invent no business or legal rules). The concept note describes the
 * information a project page must carry (section 6); the migration builds the
 * gate from it and records, in its own comment, that WHICH items should block
 * publication and which should only warn is an open decision for the client.
 * This screen therefore treats all ten as blocking - which is what the database
 * currently does - and prints that the split is undecided rather than guessing
 * it. Nothing here states what `withdrawn` or `archived` mean procedurally,
 * because the concept note does not say.
 */

/* ---------------------------------------------------------------------------
   Status
   --------------------------------------------------------------------------- */

/** proj.publication_status, exactly. */
export type PublicationStatus =
  | 'draft'
  | 'submitted_for_review'
  | 'changes_requested'
  | 'published'
  | 'withdrawn'
  | 'archived';

/** The order an operator reads them in: what needs attention first. */
export const STATUS_ORDER: readonly PublicationStatus[] = [
  'submitted_for_review',
  'changes_requested',
  'draft',
  'published',
  'withdrawn',
  'archived',
];

/**
 * A tint per status. Never read alone: every badge on this screen contains the
 * status word as well, and the existing `status.*` messages supply it.
 */
export const STATUS_TONE: Record<PublicationStatus, BadgeTone> = {
  draft: 'neutral',
  submitted_for_review: 'water',
  changes_requested: 'warning',
  published: 'bio',
  withdrawn: 'neutral',
  archived: 'neutral',
};

/* ---------------------------------------------------------------------------
   The publication gate
   --------------------------------------------------------------------------- */

/**
 * The ten codes `proj.publication_gaps()` can return, in the order the function
 * builds the array. Changing this list without changing that function is the
 * mistake this constant exists to make visible.
 */
export const GATE_ITEMS = [
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

export type GateCode = (typeof GATE_ITEMS)[number];

/** Database code -> the fragment of the i18n key that describes it. */
export const GATE_KEY: Record<GateCode, string> = {
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

/** The kinds of thing a gate item counts. Counts of ROWS, never of units. */
export type GateCountKey =
  | 'fields'
  | 'geometries'
  | 'rights'
  | 'indicators'
  | 'baselines'
  | 'commitments'
  | 'periods';

/**
 * What is recorded against an item. A missing item says so and nothing else -
 * there is no partial state, because the database has none: the function either
 * returns the code or it does not.
 */
export type GateDetail =
  | { kind: 'missing' }
  | { kind: 'count'; countKey: GateCountKey; count: number }
  /** An organisation name, printed as a name. */
  | { kind: 'name'; value: string }
  /** A document version, printed as an identifier. */
  | { kind: 'version'; value: string };

export interface GateEntry {
  code: GateCode;
  /** True when the database function would NOT return this code. */
  recorded: boolean;
  detail: GateDetail;
}

/* ---------------------------------------------------------------------------
   Projects
   --------------------------------------------------------------------------- */

export interface ReviewRow {
  /** The operator's reference for the project. A literal, as from the record. */
  reference: string;
  /** The project page address. Literal. */
  slug: string;
  /** Project title. Literal: a proper noun, not translated copy. */
  title: string;
  ownerOrgName: string;
  /** ISO 3166-1 alpha-2, matching the country message keys. */
  countryCode: 'DE' | 'FR' | 'PL' | 'IE' | 'ES' | 'LV' | 'HU';
  /** Scheme name as the scheme itself writes it. Null when none is recorded. */
  schemeName: string | null;
  /**
   * The unit type this project's volumes are measured in. Printed on every row
   * so that two rows can never be read as measuring the same thing. Null when
   * the project has not recorded one - which the gate does not currently check.
   */
  unitKey: 'hectareYears' | 'indexPoints' | null;
  status: PublicationStatus;
  submittedOn: string | null;
  publishedOn: string | null;
  lastChangeOn: string;
  /** Exactly ten entries, one per code in GATE_ITEMS order. */
  gate: readonly GateEntry[];
  /** True for the one project the review panel below the table is showing. */
  openInPanel?: boolean;
}

const entry = (
  code: GateCode,
  detail: GateDetail = { kind: 'missing' },
): GateEntry => ({ code, recorded: detail.kind !== 'missing', detail });

const missing = (code: GateCode): GateEntry => entry(code);

export const REVIEW_ROWS: readonly ReviewRow[] = [
  {
    reference: 'PRJ-2026-0003',
    slug: 'demo-oder-floodplain-reconnection',
    title: 'DEMO Oder Floodplain Reconnection',
    ownerOrgName: 'DEMO Moorland Trust gGmbH',
    countryCode: 'DE',
    schemeName: null,
    unitKey: null,
    status: 'submitted_for_review',
    submittedOn: '2026-09-18',
    publishedOn: null,
    lastChangeOn: '2026-09-22',
    openInPanel: true,
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 2 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 2 }),
      entry('claim_rights', { kind: 'count', countKey: 'rights', count: 2 }),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 3 }),
      missing('outcome_baseline'),
      entry('durability', { kind: 'count', countKey: 'commitments', count: 1 }),
      missing('verifier'),
      entry('project_idea_note', { kind: 'version', value: 'v1.0' }),
      missing('project_design_document'),
      entry('availability', { kind: 'count', countKey: 'periods', count: 2 }),
    ],
  },
  {
    reference: 'PRJ-2026-0004',
    slug: 'demo-wieprza-valley-peatland-rewetting',
    title: 'DEMO Wieprza Valley Peatland Rewetting',
    ownerOrgName: 'DEMO Torfowiska Fundacja',
    countryCode: 'PL',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitKey: 'hectareYears',
    status: 'submitted_for_review',
    submittedOn: '2026-09-20',
    publishedOn: null,
    lastChangeOn: '2026-09-23',
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 2 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 2 }),
      entry('claim_rights', { kind: 'count', countKey: 'rights', count: 3 }),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 4 }),
      entry('outcome_baseline', { kind: 'count', countKey: 'baselines', count: 4 }),
      entry('durability', { kind: 'count', countKey: 'commitments', count: 2 }),
      entry('verifier', { kind: 'name', value: 'DEMO Nordic Assurance AB' }),
      entry('project_idea_note', { kind: 'version', value: 'v1.1' }),
      entry('project_design_document', { kind: 'version', value: 'v1.0' }),
      missing('availability'),
    ],
  },
  {
    reference: 'PRJ-2026-0005',
    slug: 'demo-shannon-callows-floodplain-restoration',
    title: 'DEMO Shannon Callows Floodplain Restoration',
    ownerOrgName: 'DEMO Callows Habitat CLG',
    countryCode: 'IE',
    schemeName: 'DEMO Freshwater Index Scheme',
    unitKey: 'indexPoints',
    status: 'changes_requested',
    submittedOn: '2026-09-05',
    publishedOn: null,
    lastChangeOn: '2026-09-16',
    gate: [
      missing('english_page_text'),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 1 }),
      missing('claim_rights'),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 5 }),
      entry('outcome_baseline', { kind: 'count', countKey: 'baselines', count: 5 }),
      missing('durability'),
      entry('verifier', { kind: 'name', value: 'DEMO BioCert SARL' }),
      entry('project_idea_note', { kind: 'version', value: 'v1.0' }),
      entry('project_design_document', { kind: 'version', value: 'v0.9' }),
      entry('availability', { kind: 'count', countKey: 'periods', count: 3 }),
    ],
  },
  {
    reference: 'PRJ-2026-0006',
    slug: 'demo-ebro-delta-lagoon-restoration',
    title: 'DEMO Ebro Delta Lagoon Restoration',
    ownerOrgName: 'DEMO Aiguamolls Cooperativa',
    countryCode: 'ES',
    schemeName: null,
    unitKey: null,
    status: 'draft',
    submittedOn: null,
    publishedOn: null,
    lastChangeOn: '2026-09-21',
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 1 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 1 }),
      missing('claim_rights'),
      missing('outcomes'),
      missing('outcome_baseline'),
      missing('durability'),
      missing('verifier'),
      missing('project_idea_note'),
      missing('project_design_document'),
      missing('availability'),
    ],
  },
  {
    reference: 'PRJ-2026-0001',
    slug: 'demo-untere-havel-wetland-restoration',
    title: 'DEMO Untere Havel Wetland Restoration',
    ownerOrgName: 'DEMO Moorland Trust gGmbH',
    countryCode: 'DE',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitKey: 'hectareYears',
    status: 'published',
    submittedOn: '2026-08-28',
    publishedOn: '2026-09-12',
    lastChangeOn: '2026-09-12',
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 2 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 2 }),
      entry('claim_rights', { kind: 'count', countKey: 'rights', count: 3 }),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 5 }),
      entry('outcome_baseline', { kind: 'count', countKey: 'baselines', count: 5 }),
      entry('durability', { kind: 'count', countKey: 'commitments', count: 2 }),
      entry('verifier', { kind: 'name', value: 'DEMO Hydro-Verify GmbH' }),
      entry('project_idea_note', { kind: 'version', value: 'v1.0' }),
      entry('project_design_document', { kind: 'version', value: 'v2.1' }),
      entry('availability', { kind: 'count', countKey: 'periods', count: 3 }),
    ],
  },
  {
    reference: 'PRJ-2026-0002',
    slug: 'demo-marais-de-briere-restoration',
    title: 'DEMO Marais de Brière Restoration',
    ownerOrgName: 'DEMO Rivières Vivantes SAS',
    countryCode: 'FR',
    schemeName: 'DEMO Freshwater Index Scheme',
    unitKey: 'indexPoints',
    status: 'published',
    submittedOn: '2026-08-11',
    publishedOn: '2026-08-29',
    lastChangeOn: '2026-09-08',
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 2 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 2 }),
      entry('claim_rights', { kind: 'count', countKey: 'rights', count: 2 }),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 4 }),
      entry('outcome_baseline', { kind: 'count', countKey: 'baselines', count: 4 }),
      entry('durability', { kind: 'count', countKey: 'commitments', count: 1 }),
      entry('verifier', { kind: 'name', value: 'DEMO BioCert SARL' }),
      entry('project_idea_note', { kind: 'version', value: 'v1.0' }),
      entry('project_design_document', { kind: 'version', value: 'v1.4' }),
      entry('availability', { kind: 'count', countKey: 'periods', count: 2 }),
    ],
  },
  {
    reference: 'PRJ-2026-0007',
    slug: 'demo-lielupe-floodplain-restoration',
    title: 'DEMO Lielupe Floodplain Restoration',
    ownerOrgName: 'DEMO Upes Biedriba',
    countryCode: 'LV',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitKey: 'hectareYears',
    status: 'withdrawn',
    submittedOn: '2026-07-10',
    publishedOn: '2026-08-05',
    lastChangeOn: '2026-09-09',
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 2 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 1 }),
      entry('claim_rights', { kind: 'count', countKey: 'rights', count: 2 }),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 3 }),
      entry('outcome_baseline', { kind: 'count', countKey: 'baselines', count: 3 }),
      entry('durability', { kind: 'count', countKey: 'commitments', count: 1 }),
      entry('verifier', { kind: 'name', value: 'DEMO Nordic Assurance AB' }),
      entry('project_idea_note', { kind: 'version', value: 'v1.0' }),
      entry('project_design_document', { kind: 'version', value: 'v1.2' }),
      entry('availability', { kind: 'count', countKey: 'periods', count: 2 }),
    ],
  },
  {
    reference: 'PRJ-2026-0008',
    slug: 'demo-kis-balaton-reedbed-restoration',
    title: 'DEMO Kis-Balaton Reedbed Restoration',
    ownerOrgName: 'DEMO Nadas Alapitvany',
    countryCode: 'HU',
    schemeName: null,
    unitKey: null,
    status: 'archived',
    submittedOn: '2026-05-04',
    publishedOn: null,
    lastChangeOn: '2026-06-30',
    gate: [
      entry('english_page_text', { kind: 'count', countKey: 'fields', count: 2 }),
      entry('boundary', { kind: 'count', countKey: 'geometries', count: 1 }),
      entry('claim_rights', { kind: 'count', countKey: 'rights', count: 1 }),
      entry('outcomes', { kind: 'count', countKey: 'indicators', count: 2 }),
      entry('outcome_baseline', { kind: 'count', countKey: 'baselines', count: 2 }),
      entry('durability', { kind: 'count', countKey: 'commitments', count: 1 }),
      missing('verifier'),
      entry('project_idea_note', { kind: 'version', value: 'v1.0' }),
      missing('project_design_document'),
      missing('availability'),
    ],
  },
];

/* ---------------------------------------------------------------------------
   Reading the rows. No function here adds anything but counts of rows.
   --------------------------------------------------------------------------- */

/** The codes `proj.publication_gaps()` would return for this project. */
export function gapsOf(row: ReviewRow): GateCode[] {
  return row.gate.filter((g) => !g.recorded).map((g) => g.code);
}

/** How many of the ten items are recorded. A count of checklist items. */
export function recordedCount(row: ReviewRow): number {
  return row.gate.filter((g) => g.recorded).length;
}

/**
 * Whether the database would refuse a change into `published` right now.
 * Not "whether the operator should publish" - that is a judgement, and this
 * screen does not make it.
 */
export function isBlocked(row: ReviewRow): boolean {
  return gapsOf(row).length > 0;
}

/** A count of PROJECTS per status. Not a volume. */
export function countByStatus(
  rows: readonly ReviewRow[],
): Record<PublicationStatus, number> {
  const counts: Record<PublicationStatus, number> = {
    draft: 0,
    submitted_for_review: 0,
    changes_requested: 0,
    published: 0,
    withdrawn: 0,
    archived: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** The project the review panel is showing, and the rest. */
export function openRow(rows: readonly ReviewRow[]): ReviewRow | null {
  return rows.find((r) => r.openInPanel) ?? null;
}

/**
 * Where the figures on this screen come from. The dates and the states are read
 * from the platform's own project record; the gate list is read from the
 * database function that enforces it. Two sources, two stamps.
 */
export const RECORD_SOURCE = {
  labelKey: 'adminProjects.source.projectRecord',
  locator: 'proj.project',
  asOfDate: '2026-09-24',
} as const;

export const GATE_SOURCE = {
  labelKey: 'adminProjects.source.gateFunction',
  locator: 'proj.publication_gaps()',
  asOfDate: '2026-09-24',
} as const;

/** The error the trigger raises. Printed so an operator can recognise it. */
export const GATE_ERROR_CODE = 'SY008';
