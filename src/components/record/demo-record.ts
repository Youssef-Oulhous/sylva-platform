/**
 * DEMO DATA for the public transaction record.
 *
 * Nothing here comes from the database. It mirrors the shape of
 * record.v_public_entry (db/migrations/0015) so that the page can be built,
 * reviewed and translated before the data layer is wired in.
 *
 * Every organisation name begins with "DEMO". No entry below describes a real
 * transaction, a real buyer or a real environmental result.
 *
 * Prose a reader sees is held as an i18n KEY, not an English string, so the
 * German site is not silently served English. Proper nouns (organisation
 * names, project names, entry references) stay as literals, which is how they
 * will arrive from the database.
 *
 * RULE 7. There is no volume field and no price field on DemoRecordEntry, and
 * there is no field anywhere in this module that could hold a quantity. That
 * matches the database: record.entry carries no volume column and no price
 * column, deliberately, which removes the summable surface entirely. A total
 * across these rows is therefore not something this page declines to render -
 * it is something the data cannot express.
 */

/** Section 8 of the concept note names the first nine. */
export type NotedEventCode =
  | 'listed'
  | 'offered'
  | 'interest_expressed'
  | 'terms_proposed'
  | 'agreed'
  | 'credits_issued'
  | 'allocated'
  | 'retired'
  | 'cancelled';

/**
 * Event types the concept note does not name. They exist because the record
 * needs them - rule 4 cannot be satisfied without a way to point at a wrong
 * entry - and they are labelled as proposals on screen until the client
 * confirms the vocabulary. record.entry_type carries the same flag.
 */
export type ProposedEventCode =
  | 'transferred'
  | 'correction'
  | 'deal_withdrawn'
  | 'deal_declined'
  | 'deal_lapsed';

export type RecordEventCode = NotedEventCode | ProposedEventCode;

export const NOTED_EVENT_CODES: readonly NotedEventCode[] = [
  'listed',
  'offered',
  'interest_expressed',
  'terms_proposed',
  'agreed',
  'credits_issued',
  'allocated',
  'retired',
  'cancelled',
];

export const PROPOSED_EVENT_CODES: readonly ProposedEventCode[] = [
  'transferred',
  'correction',
  'deal_withdrawn',
  'deal_declined',
  'deal_lapsed',
];

/**
 * Event types whose meaning the concept note states. The rest are shown with
 * an explicit "the note names this event but does not define it" line rather
 * than a definition we invented.
 */
export const EVENT_CODES_WITHOUT_A_DEFINITION: readonly RecordEventCode[] = ['allocated'];

export type DemoSectorCode = 'food_bev' | 'utilities' | 'finance' | 'chemicals' | 'public';
export type DemoSizeBandCode = 'sme' | 'large';

/**
 * How the counterparty appears publicly, resolved as at the entry's own date.
 *  - 'label'       a per-deal pseudonym; the organisation is not named
 *  - 'named_buyer' the counterparty chose disclosure for this deal
 *  - 'named_owner' the project owner, already named on its own project page
 */
export type DemoPartyKind = 'label' | 'named_buyer' | 'named_owner';

export interface DemoCounterparty {
  kind: DemoPartyKind;
  /** A pseudonym label or a legal name. Never translated. */
  display: string;
  sectorCode: DemoSectorCode;
  countryCode: string;
  sizeBandCode: DemoSizeBandCode;
}

export interface DemoRecordProject {
  slug: string;
  name: string;
  countryCode: string;
}

export interface DemoRecordEntry {
  /**
   * The entry's public reference. In the database this is a UUID
   * (record.entry.public_id); a short printable form stands in for it here so
   * that a correction can cite the entry it corrects in running text.
   */
  ref: string;
  /** ISO date the event occurred. */
  occurredOn: string;
  projectSlug: string;
  eventCode: RecordEventCode;
  counterparty: DemoCounterparty;
  /** Set on a correction entry: the earlier entry it points at. */
  correctsRef: string | null;
  /** i18n key for the reason. Present exactly when correctsRef is present. */
  correctionReasonKey: string | null;
  /** Set on an entry that a later correction points at. It is never removed. */
  supersededByRef: string | null;
}

export const DEMO_RECORD_PROJECTS: readonly DemoRecordProject[] = [
  {
    slug: 'demo-untere-havel-wetland-restoration',
    name: 'DEMO Untere Havel Wetland Restoration',
    countryCode: 'DE',
  },
  {
    slug: 'demo-marais-de-briere-restoration',
    name: 'DEMO Marais de Brière Restoration',
    countryCode: 'FR',
  },
  {
    slug: 'demo-oder-floodplain-reconnection',
    name: 'DEMO Oder Floodplain Reconnection',
    countryCode: 'DE',
  },
];

const MOORLAND: DemoCounterparty = {
  kind: 'named_owner',
  display: 'DEMO Moorland Trust gGmbH',
  sectorCode: 'public',
  countryCode: 'DE',
  sizeBandCode: 'sme',
};

const RIVIERES: DemoCounterparty = {
  kind: 'named_owner',
  display: 'DEMO Rivières Vivantes SAS',
  sectorCode: 'public',
  countryCode: 'FR',
  sizeBandCode: 'sme',
};

/**
 * The same deal on the Untere Havel project, before and after the buyer chose
 * to be named. Disclosure applies from the date of the choice onward: entries
 * published before it keep the label they were published with, because nothing
 * already published is rewritten.
 */
const HAVEL_DEAL_1_BEFORE_DISCLOSURE: DemoCounterparty = {
  kind: 'label',
  display: 'Buyer 001',
  sectorCode: 'food_bev',
  countryCode: 'DE',
  sizeBandCode: 'large',
};
const HAVEL_DEAL_1_AFTER_DISCLOSURE: DemoCounterparty = {
  kind: 'named_buyer',
  display: 'DEMO Nordbräu AG',
  sectorCode: 'food_bev',
  countryCode: 'DE',
  sizeBandCode: 'large',
};

const HAVEL_DEAL_2: DemoCounterparty = {
  kind: 'label',
  display: 'Buyer 002',
  sectorCode: 'food_bev',
  countryCode: 'NL',
  sizeBandCode: 'large',
};
const HAVEL_DEAL_3: DemoCounterparty = {
  kind: 'label',
  display: 'Buyer 003',
  sectorCode: 'chemicals',
  countryCode: 'DE',
  sizeBandCode: 'large',
};

/* Labels restart at 001 on every project. "Buyer 001" here is a different
   organisation from "Buyer 001" on the Untere Havel project. */
const BRIERE_DEAL_1: DemoCounterparty = {
  kind: 'label',
  display: 'Buyer 001',
  sectorCode: 'chemicals',
  countryCode: 'FR',
  sizeBandCode: 'large',
};
const BRIERE_DEAL_2: DemoCounterparty = {
  kind: 'label',
  display: 'Buyer 002',
  sectorCode: 'utilities',
  countryCode: 'FR',
  sizeBandCode: 'large',
};

const HAVEL = 'demo-untere-havel-wetland-restoration';
const BRIERE = 'demo-marais-de-briere-restoration';
const ODER = 'demo-oder-floodplain-reconnection';

/** The correction chain rendered by the page, cited in the explanation. */
export const DEMO_CORRECTION_CHAIN = {
  wrongRef: 'E-000141',
  correctionRef: 'E-000146',
  correctedRef: 'E-000147',
} as const;

/** Newest first. The order on screen is the order here; nothing is sorted away. */
export const DEMO_RECORD_ENTRIES: readonly DemoRecordEntry[] = [
  {
    ref: 'E-000148',
    occurredOn: '2026-09-22',
    projectSlug: HAVEL,
    eventCode: 'interest_expressed',
    counterparty: HAVEL_DEAL_3,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000147',
    occurredOn: '2026-09-18',
    projectSlug: HAVEL,
    eventCode: 'terms_proposed',
    counterparty: HAVEL_DEAL_2,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000146',
    occurredOn: '2026-09-18',
    projectSlug: HAVEL,
    eventCode: 'correction',
    counterparty: HAVEL_DEAL_2,
    correctsRef: 'E-000141',
    correctionReasonKey: 'record.demo.correctionReason',
    supersededByRef: null,
  },
  {
    ref: 'E-000145',
    occurredOn: '2026-09-17',
    projectSlug: BRIERE,
    eventCode: 'interest_expressed',
    counterparty: BRIERE_DEAL_2,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000144',
    occurredOn: '2026-09-16',
    projectSlug: ODER,
    eventCode: 'listed',
    counterparty: MOORLAND,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000143',
    occurredOn: '2026-09-15',
    projectSlug: HAVEL,
    eventCode: 'agreed',
    counterparty: HAVEL_DEAL_1_AFTER_DISCLOSURE,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000142',
    occurredOn: '2026-09-14',
    projectSlug: HAVEL,
    eventCode: 'terms_proposed',
    counterparty: HAVEL_DEAL_1_AFTER_DISCLOSURE,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000141',
    occurredOn: '2026-09-11',
    projectSlug: HAVEL,
    eventCode: 'terms_proposed',
    counterparty: HAVEL_DEAL_2,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: 'E-000146',
  },
  {
    ref: 'E-000140',
    occurredOn: '2026-09-08',
    projectSlug: BRIERE,
    eventCode: 'interest_expressed',
    counterparty: BRIERE_DEAL_1,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000139',
    occurredOn: '2026-09-04',
    projectSlug: HAVEL,
    eventCode: 'interest_expressed',
    counterparty: HAVEL_DEAL_2,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000138',
    occurredOn: '2026-08-28',
    projectSlug: HAVEL,
    eventCode: 'interest_expressed',
    counterparty: HAVEL_DEAL_1_BEFORE_DISCLOSURE,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000137',
    occurredOn: '2026-08-21',
    projectSlug: BRIERE,
    eventCode: 'offered',
    counterparty: RIVIERES,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000136',
    occurredOn: '2026-08-14',
    projectSlug: HAVEL,
    eventCode: 'offered',
    counterparty: MOORLAND,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000135',
    occurredOn: '2026-07-30',
    projectSlug: BRIERE,
    eventCode: 'listed',
    counterparty: RIVIERES,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
  {
    ref: 'E-000134',
    occurredOn: '2026-07-24',
    projectSlug: HAVEL,
    eventCode: 'listed',
    counterparty: MOORLAND,
    correctsRef: null,
    correctionReasonKey: null,
    supersededByRef: null,
  },
];

/** Provenance for the one figure on this page: how many entries are shown. */
export const DEMO_RECORD_EXTRACT = {
  asOfDate: '2026-09-23',
  sectorClassification: 'NACE Rev. 2 (DEMO mapping)',
  sizeBandBasis: 'employees',
} as const;
