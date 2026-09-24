/**
 * The identifiers the row-level security matrix is written against.
 *
 * Pure data, no imports. Both the test suite and the markdown generator read
 * this file, which is what stops docs/SECURITY-MATRIX.md drifting away from
 * what is actually asserted.
 *
 * Everything here is DEMO data from db/seed/*.sql, plus the fixture rows
 * tests/rls/fixtures.ts creates through the operator's real write path.
 */

// ---------------------------------------------------------------- principals

export const ORG = {
  ownerA:    '0a000000-0000-0000-0000-00000000000a', // DEMO Moorland Trust gGmbH
  ownerB:    '0b000000-0000-0000-0000-00000000000b', // DEMO Rivières Vivantes SAS
  buyerA:    '0c000000-0000-0000-0000-00000000000c', // DEMO Nordbräu AG
  buyerB:    '0d000000-0000-0000-0000-00000000000d', // DEMO Verdant Foods NV
  investorA: '0e000000-0000-0000-0000-00000000000e', // DEMO Rheinbank Nachhaltigkeit AG
  investorB: '0f000000-0000-0000-0000-00000000000f', // DEMO Fonds Bleu SA
  operator:  '10000000-0000-0000-0000-000000000010', // DEMO Sylva Operations
  auditor:   '11000000-0000-0000-0000-000000000011', // DEMO Nordic Assurance AB
  verifierDE:'12000000-0000-0000-0000-000000000012', // DEMO Hydro-Verify GmbH
  verifierFR:'13000000-0000-0000-0000-000000000013', // DEMO BioCert SARL
  unvetted:  '14000000-0000-0000-0000-000000000014', // DEMO Unvetted Trading Ltd
} as const;

export const PERSON = {
  ownerA:    'b0000000-0000-0000-0000-0000000000b1',
  ownerB:    'b0000000-0000-0000-0000-0000000000b2',
  buyerA:    'b0000000-0000-0000-0000-0000000000b3',
  buyerB:    'b0000000-0000-0000-0000-0000000000b4',
  investorA: 'b0000000-0000-0000-0000-0000000000b5',
  investorB: 'b0000000-0000-0000-0000-0000000000b6',
  operator:  'b0000000-0000-0000-0000-0000000000b7',
  auditor:   'b0000000-0000-0000-0000-0000000000b8',
  unvetted:  'b0000000-0000-0000-0000-0000000000b9',
} as const;

/**
 * Ten principals, in the order the client would read them: the two of each
 * kind that must not see each other, then the privileged pair, then the two
 * edge cases that carry the most risk.
 */
export const PRINCIPAL_IDS = [
  'buyerA', 'buyerB',
  'ownerA', 'ownerB',
  'investorA', 'investorB',
  'operator', 'auditor',
  'unvetted', 'anonymous',
] as const;

export type PrincipalId = (typeof PRINCIPAL_IDS)[number];

export type PrincipalKind =
  | 'buyer' | 'project_owner' | 'investor' | 'operator' | 'auditor' | 'anonymous';

export interface PrincipalMeta {
  readonly id: PrincipalId;
  /** How the matrix names it on screen and in the document. */
  readonly label: string;
  readonly kind: PrincipalKind;
  /** The PostgreSQL privilege role the transaction actually runs as. */
  readonly dbRole: string;
  /** null for the anonymous visitor, which carries no organisation context. */
  readonly org: string | null;
  readonly person: string | null;
  readonly note: string;
}

export const PRINCIPALS: Readonly<Record<PrincipalId, PrincipalMeta>> = {
  buyerA: {
    id: 'buyerA', label: 'Buyer A', kind: 'buyer', dbRole: 'sylva_buyer',
    org: ORG.buyerA, person: PERSON.buyerA,
    note: 'DEMO Nordbräu AG — approved buyer, two registered sites, one deal.',
  },
  buyerB: {
    id: 'buyerB', label: 'Buyer B', kind: 'buyer', dbRole: 'sylva_buyer',
    org: ORG.buyerB, person: PERSON.buyerB,
    note: 'DEMO Verdant Foods NV — approved buyer. Must never see Buyer A.',
  },
  ownerA: {
    id: 'ownerA', label: 'Owner A', kind: 'project_owner', dbRole: 'sylva_project_owner',
    org: ORG.ownerA, person: PERSON.ownerA,
    note: 'DEMO Moorland Trust — owns project 1 (published) and project 3 (draft).',
  },
  ownerB: {
    id: 'ownerB', label: 'Owner B', kind: 'project_owner', dbRole: 'sylva_project_owner',
    org: ORG.ownerB, person: PERSON.ownerB,
    note: 'DEMO Rivières Vivantes — owns project 2 (published).',
  },
  investorA: {
    id: 'investorA', label: 'Investor A', kind: 'investor', dbRole: 'sylva_investor',
    org: ORG.investorA, person: PERSON.investorA,
    note: 'DEMO Rheinbank — vetted investor.',
  },
  investorB: {
    id: 'investorB', label: 'Investor B', kind: 'investor', dbRole: 'sylva_investor',
    org: ORG.investorB, person: PERSON.investorB,
    note: 'DEMO Fonds Bleu — vetted investor.',
  },
  operator: {
    id: 'operator', label: 'Operator', kind: 'operator', dbRole: 'sylva_operator',
    org: ORG.operator, person: PERSON.operator,
    note: 'DEMO Sylva Operations — the platform operator.',
  },
  auditor: {
    id: 'auditor', label: 'Auditor', kind: 'auditor', dbRole: 'sylva_auditor',
    org: ORG.auditor, person: PERSON.auditor,
    note: 'DEMO Nordic Assurance — reads everything, writes nothing, ever.',
  },
  unvetted: {
    id: 'unvetted', label: 'Unvetted', kind: 'buyer', dbRole: 'sylva_buyer',
    org: ORG.unvetted, person: PERSON.unvetted,
    note:
      'DEMO Unvetted Trading — registered, submitted its questionnaire, never ' +
      'decided. Holds the buyer role but no approval, so R6 refuses it a deal.',
  },
  anonymous: {
    id: 'anonymous', label: 'Anonymous', kind: 'anonymous', dbRole: 'sylva_web_anon',
    org: null, person: null,
    note: 'A visitor with no account. Served by a login role that is a member of nothing.',
  },
};

// ------------------------------------------------------------------- objects

export const PROJECT = {
  p1: 'a1000000-0000-0000-0000-000000000001', // DEMO Untere Havel  · owner A · published
  p2: 'a1000000-0000-0000-0000-000000000002', // DEMO Marais de Brière · owner B · published
  p3: 'a1000000-0000-0000-0000-000000000003', // DEMO Oder floodplain · owner A · DRAFT
} as const;

export const UNIT_TYPE = {
  p1: '91000000-0000-0000-0000-000000000001', // hectare-years
  p2: '91000000-0000-0000-0000-000000000002', // index points
} as const;

export const PERIOD = {
  p1: 'c1000000-0000-0000-0000-000000000001', // project 1, 2028
  p2: 'c1000000-0000-0000-0000-000000000004', // project 2, 2029
} as const;

export const SITE = {
  buyerA1: 'd1000000-0000-0000-0000-000000000001',
  buyerA2: 'd1000000-0000-0000-0000-000000000002',
  buyerB1: 'd1000000-0000-0000-0000-000000000003',
} as const;

export const DOCUMENT = {
  pinP1: 'b1000000-0000-0000-0000-000000000001',
  pddP1: 'b1000000-0000-0000-0000-000000000002',
  monP1: 'b1000000-0000-0000-0000-000000000003',
  finP1: 'b1000000-0000-0000-0000-000000000004',
  pinP2: 'b1000000-0000-0000-0000-000000000005',
  pddP2: 'b1000000-0000-0000-0000-000000000006',
  monP2: 'b1000000-0000-0000-0000-000000000007',
  finP2: 'b1000000-0000-0000-0000-000000000008',
} as const;

export const VETTING_SUBMISSION = {
  ownerA:    '70000000-0000-0000-0000-000000000001',
  ownerB:    '70000000-0000-0000-0000-000000000002',
  buyerA:    '70000000-0000-0000-0000-000000000003',
  buyerB:    '70000000-0000-0000-0000-000000000004',
  investorA: '70000000-0000-0000-0000-000000000005',
  investorB: '70000000-0000-0000-0000-000000000006',
  unvetted:  '70000000-0000-0000-0000-000000000007',
} as const;

export const QUESTIONNAIRE = {
  buyer:        '60000000-0000-0000-0000-000000000001',
  investor:     '60000000-0000-0000-0000-000000000002',
  projectOwner: '60000000-0000-0000-0000-000000000003',
} as const;

// ------------------------------------------------- fixture rows (fixtures.ts)

/** Provenance for every figure the fixtures insert. source_ref_id is NOT NULL. */
export const FIXTURE_SOURCE_REF = '5f000000-0000-0000-0000-0000000000f1';

export const DEAL = {
  /** Buyer A ↔ Owner A on project 1. */
  a: 'ea000000-0000-0000-0000-0000000000a1',
  /** Buyer B ↔ Owner B on project 2. */
  b: 'ea000000-0000-0000-0000-0000000000b1',
} as const;

export const TERMS = {
  a: 'eb000000-0000-0000-0000-0000000000a1',
  b: 'eb000000-0000-0000-0000-0000000000b1',
} as const;

export const DEAL_DOCUMENT = {
  a: 'ec000000-0000-0000-0000-0000000000a1',
  b: 'ec000000-0000-0000-0000-0000000000b1',
} as const;

export const DEAL_DOCUMENT_VERSION = {
  a: 'ed000000-0000-0000-0000-0000000000a1',
  b: 'ed000000-0000-0000-0000-0000000000b1',
} as const;

/**
 * record.entry has a generated entry_no, so the fixtures are pinned by their
 * public_id instead - which is also the column the public record shows.
 */
export const RECORD_ENTRY = {
  listedP1:     'ee000000-0000-0000-0000-0000000000e1',
  listedP2:     'ee000000-0000-0000-0000-0000000000e2',
  interestDealA:'ee000000-0000-0000-0000-0000000000e3',
  interestDealB:'ee000000-0000-0000-0000-0000000000e4',
} as const;

// --------------------------------------------------------- readable row keys
//
// Every probe returns a stable, human-readable key per row rather than a UUID,
// so a matrix cell reads "site1@buyerA, site2@buyerA" and a leak reads as an
// unexpected key appearing in someone else's row.

function invert(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[v] = k;
  return out;
}

const ORG_BY_ID = invert(ORG);
const PROJECT_BY_ID = invert(PROJECT);
const DEAL_BY_ID = invert(DEAL);
const DOCUMENT_BY_ID = invert(DOCUMENT);

export function orgKey(id: string | null): string {
  if (!id) return '-';
  return ORG_BY_ID[id] ?? id;
}
export function projectKey(id: string | null): string {
  if (!id) return '-';
  return PROJECT_BY_ID[id] ?? id;
}
export function dealKey(id: string | null): string {
  if (!id) return '-';
  const k = DEAL_BY_ID[id];
  return k ? `deal${k.toUpperCase()}` : id;
}
export function documentKey(id: string | null): string {
  if (!id) return '-';
  if (id === DEAL_DOCUMENT.a) return 'loi@dealA';
  if (id === DEAL_DOCUMENT.b) return 'loi@dealB';
  const k = DOCUMENT_BY_ID[id];
  if (!k) return id;
  // pinP1 -> pin@P1
  const m = /^([a-z]+)(P\d)$/.exec(k);
  return m ? `${m[1]}@${m[2]}` : k;
}

/** Every organisation in the demo seed, as row keys. */
export const ALL_ORGS = [
  'auditor', 'buyerA', 'buyerB', 'investorA', 'investorB', 'operator',
  'ownerA', 'ownerB', 'unvetted', 'verifierDE', 'verifierFR',
].sort();

/** The six project documents any visitor may read. */
export const PUBLIC_DOCS = [
  'mon@P1', 'mon@P2', 'pdd@P1', 'pdd@P2', 'pin@P1', 'pin@P2',
].sort();

// ------------------------------------------------------- the probe population
//
// Every read probe is restricted to the object ids listed below.
//
// It would be purer to leave each SELECT unqualified and take whatever
// row-level security hands back. In a shared development database that does not
// survive contact with reality: the other work streams create organisations,
// projects, documents and record entries while this suite is running, and an
// expectation written as "all eleven organisations" then fails for a reason that
// has nothing to do with security.
//
// So the matrix names its population. The isolation question it asks is
// unchanged - Buyer A must see Buyer A's rows out of this fixed set and must not
// see Buyer B's - and it is asked against a set that cannot move underneath it.

export const ALL_ORG_IDS = Object.values(ORG);
export const ALL_PROJECT_IDS = Object.values(PROJECT);
export const ALL_SITE_IDS = Object.values(SITE);
export const ALL_DEAL_IDS = Object.values(DEAL);
export const ALL_TERMS_IDS = Object.values(TERMS);
export const ALL_SUBMISSION_IDS = Object.values(VETTING_SUBMISSION);
export const ALL_RECORD_IDS = Object.values(RECORD_ENTRY);
export const ALL_DOCUMENT_IDS = [
  ...Object.values(DOCUMENT), ...Object.values(DEAL_DOCUMENT),
];
