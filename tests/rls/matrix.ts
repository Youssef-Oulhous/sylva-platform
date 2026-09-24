/**
 * THE ROW-LEVEL SECURITY MATRIX.
 *
 * "One buyer seeing another buyer's prices or terms is the failure we most need
 * to avoid." - concept note, section 8. This file is the executable statement of
 * what each of the ten principals may and may not do to each sensitive table,
 * and it is the single source both tests/rls/matrix.test.ts and
 * docs/SECURITY-MATRIX.md are generated from, so the document cannot drift away
 * from what is asserted.
 *
 * How to read a specification:
 *
 *   read        one statement, run as each principal, returning a set of
 *               readable row keys. The expectation is either 'denied' - the
 *               database refused on privilege - or the exact set of keys that
 *               principal may see. An extra key in an actual result is a leak;
 *               a missing one is a page that will render empty.
 *
 *   insert      ONE statement, the same for every principal, aimed at Buyer A /
 *               Owner A / Project 1 / Deal A and stamped with the acting
 *               principal's own organisation where a policy requires it. It is
 *               written this way on purpose: the interesting question is not
 *               "can Buyer B write its own rows" but "can Buyer B write into
 *               Buyer A's deal", and this shape asks exactly that. Two tables
 *               deviate and say so in their `describe`.
 *
 *   update,
 *   remove      aimed at a named existing row. For almost every table here the
 *               expectation is 'denied' for all ten, because the table is
 *               append-only: R4 says a mistake is corrected by a new entry and
 *               the wrong one stays visible.
 *
 * No read probe filters by organisation, by status or by visibility. Each one
 * is restricted to the matrix's own set of object ids and is otherwise
 * unqualified, so what comes back is whatever row-level security decided to hand
 * over and not whatever the test remembered to ask for. The reason for that one
 * restriction is written out over ALL_ORG_IDS in catalog.ts: this database is
 * shared with seven other work streams that create rows while this suite runs.
 */
import {
  ALL_DEAL_IDS, ALL_DOCUMENT_IDS, ALL_ORGS, ALL_ORG_IDS, ALL_PROJECT_IDS,
  ALL_RECORD_IDS, ALL_SITE_IDS, ALL_SUBMISSION_IDS, ALL_TERMS_IDS,
  DEAL, DEAL_DOCUMENT, DOCUMENT, FIXTURE_SOURCE_REF, ORG, PERIOD,
  PRINCIPALS, PRINCIPAL_IDS, PROJECT, PUBLIC_DOCS, QUESTIONNAIRE, RECORD_ENTRY,
  SITE, TERMS, UNIT_TYPE, VETTING_SUBMISSION,
  dealKey, documentKey, orgKey, projectKey,
  type PrincipalId,
} from './catalog';
import type { ReadOutcome, Row, WriteOutcome } from './probe';

// ------------------------------------------------------------------ helpers

/** Every principal gets `value`, except the ones named in `overrides`. */
function forAll<T>(value: T, overrides: Partial<Record<PrincipalId, T>> = {}): Record<PrincipalId, T> {
  const out = {} as Record<PrincipalId, T>;
  for (const id of PRINCIPAL_IDS) out[id] = overrides[id] ?? value;
  return out;
}

const DENIED = 'denied' as const;
const NONE: readonly string[] = [];

/** The organisation a principal stamps its own writes with. */
function org(p: PrincipalId): string {
  return PRINCIPALS[p].org ?? ORG.buyerA;
}
function person(p: PrincipalId): string | null {
  return PRINCIPALS[p].person;
}
/** The role name frozen into a record entry. Anonymous never gets that far. */
function roleSnapshot(p: PrincipalId): string {
  const k = PRINCIPALS[p].kind;
  return k === 'anonymous' ? 'buyer' : k;
}

function invert(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[v] = k;
  return out;
}
const SITE_BY_ID = invert(SITE);
const SUBMISSION_BY_ID = invert(VETTING_SUBMISSION);
const RECORD_BY_ID = invert(RECORD_ENTRY);

function text(r: Row, col: string): string {
  const v = r[col];
  return v === null || v === undefined ? '' : String(v);
}

// -------------------------------------------------------------------- types

export interface Statement { sql: string; params: readonly unknown[] }

export interface ReadSpec {
  /**
   * Restricted to the matrix's own population and to nothing else - see
   * `ALL_*_IDS` in catalog.ts for why. Within that population the statement is
   * unqualified: no WHERE on an organisation, a status or a visibility, so what
   * comes back is whatever row-level security decided to hand over rather than
   * whatever the test remembered to ask for.
   */
  sql: string;
  params?: readonly unknown[];
  key: (r: Row) => string;
  expect: Record<PrincipalId, ReadOutcome>;
}

export interface WriteSpec {
  describe: string;
  stmt: (p: PrincipalId) => Statement;
  expect: Record<PrincipalId, WriteOutcome>;
}

export interface TableSpec {
  /** The table, or the table and the one column being probed. */
  id: string;
  /** One line: what it holds and why it is on this list. */
  holds: string;
  read: ReadSpec;
  insert?: WriteSpec;
  update?: WriteSpec;
  remove?: WriteSpec;
  /**
   * A result that is asserted because it is what the database does today, and
   * that a reviewer should look at. Printed by the test run and carried into
   * docs/SECURITY-MATRIX.md under "Known weaknesses".
   */
  finding?: string;
  /**
   * Set where seeing another organisation's row is the DESIGN and not a leak:
   * the public record shows every counterparty's sector, country and size band
   * beside its pseudonym, so those attributes have to be world-readable. The
   * standing "no principal reaches its counterpart" test skips these, and the
   * per-cell expectations carry the real rule instead.
   */
  counterpartyAttributesArePublic?: true;
}

// ------------------------------------------------------------------- tables

export const TABLES: readonly TableSpec[] = [
  // ======================================================== buyer sites ====
  {
    id: 'geo.buyer_site',
    holds:
      "A corporate's facilities and abstraction points. Commercially sensitive " +
      'on its own, and the input to the private distance figures on a project page.',
    read: {
      sql: 'SELECT id::text AS id FROM geo.buyer_site WHERE id = ANY($1::uuid[])',
      params: [ALL_SITE_IDS],
      key: (r) => SITE_BY_ID[text(r, 'id')] ?? text(r, 'id'),
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['buyerA1', 'buyerA2'],
        buyerB: ['buyerB1'],
        unvetted: NONE,
        operator: ['buyerA1', 'buyerA2', 'buyerB1'],
        auditor: ['buyerA1', 'buyerA2', 'buyerB1'],
      }),
    },
    insert: {
      describe: 'register a site for the principal’s own organisation',
      stmt: (p) => ({
        sql: `INSERT INTO geo.buyer_site (org_id, label, country_code, geom, source_ref_id)
              VALUES ($1, 'DEMO rls probe site', 'DE',
                      ST_SetSRID(ST_MakePoint(10.0, 52.0), 4326), $2)
              RETURNING id`,
        params: [org(p), FIXTURE_SOURCE_REF],
      }),
      // A registered but not-yet-vetted buyer CAN add sites. That is open
      // decision 5 in the README, recommended yes: sites are private and they
      // help an organisation decide whether to apply at all.
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', buyerB: 'ok', unvetted: 'ok',
      }),
    },
    update: {
      describe: "rename Buyer A's Bremen site",
      stmt: () => ({
        sql: 'UPDATE geo.buyer_site SET label = label WHERE id = $1 RETURNING id',
        params: [SITE.buyerA1],
      }),
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', buyerB: 'no-rows', unvetted: 'no-rows',
      }),
    },
    remove: {
      describe: "delete Buyer A's Bremen site",
      stmt: () => ({
        sql: 'DELETE FROM geo.buyer_site WHERE id = $1 RETURNING id',
        params: [SITE.buyerA1],
      }),
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', buyerB: 'no-rows', unvetted: 'no-rows',
      }),
    },
  },

  // ============================================================== deals ====
  {
    id: 'deal.deal',
    holds: 'The private room between one buyer and one project. R6 gates its creation.',
    read: {
      sql: 'SELECT id::text AS id FROM deal.deal WHERE id = ANY($1::uuid[])',
      params: [ALL_DEAL_IDS],
      key: (r) => dealKey(text(r, 'id')),
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['dealA'], buyerB: ['dealB'],
        ownerA: ['dealA'], ownerB: ['dealB'],
        unvetted: NONE,
        operator: ['dealA', 'dealB'], auditor: ['dealA', 'dealB'],
      }),
    },
    insert: {
      // Project 2, not project 1: Buyer A already has a live deal on project 1,
      // and `ux_one_live_deal_per_buyer_project` allows only one. Aiming at
      // project 2 gets a genuine "yes" out of Buyer A and, from Buyer B, the
      // uniqueness rule refusing a second room - both worth seeing.
      describe: 'open a deal on PROJECT 2 with the principal itself as the buyer',
      stmt: (p) => ({
        sql: `INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id, intended_shape)
              VALUES ($1, $2, $3, 'forward') RETURNING id`,
        params: [PROJECT.p2, ORG.ownerB, org(p)],
      }),
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok',
        // one live deal per buyer per project
        buyerB: 'refused:23505',
        // R6. Note there is no operator exemption: DEMO Sylva Operations has no
        // buyer approval on record, so the platform operator cannot make itself
        // a counterparty either.
        unvetted: 'refused:SY006',
        operator: 'refused:SY006',
      }),
    },
    update: {
      describe: "move Deal A's stage by writing the cache directly",
      stmt: () => ({
        sql: 'UPDATE deal.deal SET stage = stage WHERE id = $1 RETURNING id',
        params: [DEAL.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: 'delete Deal A',
      stmt: () => ({
        sql: 'DELETE FROM deal.deal WHERE id = $1 RETURNING id',
        params: [DEAL.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'deal.deal_message',
    holds: 'The correspondence inside a deal room. Free text, and the most direct leak there is.',
    read: {
      sql: `SELECT deal_id::text AS deal_id FROM deal.deal_message
             WHERE deal_id = ANY($1::uuid[])`,
      params: [ALL_DEAL_IDS],
      key: (r) => `msg@${dealKey(text(r, 'deal_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['msg@dealA'], ownerA: ['msg@dealA'],
        buyerB: ['msg@dealB'], ownerB: ['msg@dealB'],
        unvetted: NONE,
        operator: ['msg@dealA', 'msg@dealB'], auditor: ['msg@dealA', 'msg@dealB'],
      }),
    },
    insert: {
      describe: "post a message into Buyer A's deal room, signed by the principal",
      stmt: (p) => ({
        sql: `INSERT INTO deal.deal_message
                (deal_id, project_id, buyer_org_id, owner_org_id, sender_org_id, body)
              VALUES ($1, $2, $3, $4, $5, 'DEMO rls probe message') RETURNING id`,
        params: [DEAL.a, PROJECT.p1, ORG.buyerA, ORG.ownerA, org(p)],
      }),
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', ownerA: 'ok',
        buyerB: 'blocked', ownerB: 'blocked', unvetted: 'blocked',
        // The operator holds INSERT and its policy says WITH CHECK (true), and
        // it still cannot do this: a CHECK constraint on the table requires the
        // sender to be one of the two parties. Sylva can read a deal room; it
        // cannot speak in one under its own name.
        operator: 'refused:23514',
      }),
    },
    update: {
      describe: "edit a message in Buyer A's deal room",
      stmt: () => ({
        sql: 'UPDATE deal.deal_message SET body = body WHERE deal_id = $1 RETURNING id',
        params: [DEAL.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete a message in Buyer A's deal room",
      stmt: () => ({
        sql: 'DELETE FROM deal.deal_message WHERE deal_id = $1 RETURNING id',
        params: [DEAL.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'deal.deal_terms_version',
    holds:
      'The agreed volume, price and claim rights, versioned. This is literally ' +
      "the “another buyer's prices or terms” the client named as the worst case.",
    read: {
      sql: `SELECT deal_id::text AS deal_id, version_no, price_amount
              FROM deal.deal_terms_version WHERE id = ANY($1::uuid[])`,
      params: [ALL_TERMS_IDS],
      key: (r) => `terms@${dealKey(text(r, 'deal_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['terms@dealA'], ownerA: ['terms@dealA'],
        buyerB: ['terms@dealB'], ownerB: ['terms@dealB'],
        unvetted: NONE,
        operator: ['terms@dealA', 'terms@dealB'], auditor: ['terms@dealA', 'terms@dealB'],
      }),
    },
    insert: {
      describe: "propose version 2 of the terms on Buyer A's deal",
      stmt: (p) => ({
        sql: `INSERT INTO deal.deal_terms_version
                (deal_id, project_id, buyer_org_id, owner_org_id, version_no,
                 unit_type_id, period_id, deal_shape, amount_raw,
                 price_amount, price_basis, price_currency, proposed_by_org_id, source_ref_id)
              VALUES ($1, $2, $3, $4, 2, $5, $6, 'forward', 10,
                      39.00, 'per_unit', 'EUR', $7, $8) RETURNING id`,
        params: [DEAL.a, PROJECT.p1, ORG.buyerA, ORG.ownerA,
                 UNIT_TYPE.p1, PERIOD.p1, org(p), FIXTURE_SOURCE_REF],
      }),
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', ownerA: 'ok', operator: 'ok',
        buyerB: 'blocked', ownerB: 'blocked', unvetted: 'blocked',
      }),
    },
    update: {
      describe: "rewrite the price on Buyer A's terms in place",
      stmt: () => ({
        sql: 'UPDATE deal.deal_terms_version SET price_amount = price_amount WHERE id = $1 RETURNING id',
        params: [TERMS.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete Buyer A's terms",
      stmt: () => ({
        sql: 'DELETE FROM deal.deal_terms_version WHERE id = $1 RETURNING id',
        params: [TERMS.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'deal.deal_terms_version.amount_raw',
    holds:
      'R7. The bare volume behind the unit_qty composite. No role anywhere holds ' +
      'SELECT on a *_raw column, because the composite is what carries the scope ' +
      'that makes the number mean anything.',
    read: {
      sql: 'SELECT amount_raw FROM deal.deal_terms_version WHERE id = ANY($1::uuid[])',
      params: [ALL_TERMS_IDS],
      key: () => 'amount_raw',
      expect: forAll<ReadOutcome>(DENIED),
    },
  },

  {
    id: 'deal.project_question',
    holds:
      'The private question box. "Questions go to the project owner and to us, ' +
      'not to a public comment feed."',
    read: {
      sql: `SELECT project_id::text AS project_id, asker_org_id::text AS asker_org_id
              FROM deal.project_question
             WHERE project_id = ANY($1::uuid[]) AND asker_org_id = ANY($2::uuid[])`,
      params: [ALL_PROJECT_IDS, ALL_ORG_IDS],
      key: (r) => `q@${projectKey(text(r, 'project_id'))}:${orgKey(text(r, 'asker_org_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['q@p1:buyerA'],
        buyerB: ['q@p2:buyerB'],
        investorA: ['q@p1:investorA'],
        investorB: NONE,
        ownerA: ['q@p1:buyerA', 'q@p1:investorA'],
        ownerB: ['q@p2:buyerB'],
        unvetted: NONE,
        operator: ['q@p1:buyerA', 'q@p1:investorA', 'q@p2:buyerB'],
        auditor: ['q@p1:buyerA', 'q@p1:investorA', 'q@p2:buyerB'],
      }),
    },
    insert: {
      describe: 'ask project 1 a private question as the principal',
      stmt: (p) => ({
        sql: `INSERT INTO deal.project_question (project_id, owner_org_id, asker_org_id, body)
              VALUES ($1, $2, $3, 'DEMO rls probe question') RETURNING id`,
        params: [PROJECT.p1, ORG.ownerA, org(p)],
      }),
      // Any registered buyer or investor may ask; the project owner answers and
      // does not ask, so sylva_project_owner holds no INSERT here at all.
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', buyerB: 'ok', investorA: 'ok', investorB: 'ok',
        unvetted: 'ok', operator: 'ok',
      }),
    },
    update: {
      describe: "edit Buyer A's question",
      stmt: () => ({
        sql: 'UPDATE deal.project_question SET body = body WHERE asker_org_id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete Buyer A's question",
      stmt: () => ({
        sql: 'DELETE FROM deal.project_question WHERE asker_org_id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  // ========================================================= pseudonyms ====
  {
    id: 'deal.deal_pseudonym',
    holds:
      'R5. The label the public record shows instead of a name. One per DEAL, so ' +
      'naming one deal does not name the others. The label itself is public - that ' +
      'is what a pseudonym is for.',
    read: {
      sql: `SELECT deal_id::text AS deal_id, label FROM deal.deal_pseudonym
             WHERE deal_id = ANY($1::uuid[])`,
      params: [ALL_DEAL_IDS],
      key: (r) => `pseud@${dealKey(text(r, 'deal_id'))}`,
      expect: forAll<ReadOutcome>(['pseud@dealA', 'pseud@dealB']),
    },
    update: {
      describe: "rewrite Deal A's label",
      stmt: () => ({
        sql: 'UPDATE deal.deal_pseudonym SET seq = seq WHERE deal_id = $1 RETURNING deal_id',
        params: [DEAL.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "recycle Deal A's label by deleting it",
      stmt: () => ({
        sql: 'DELETE FROM deal.deal_pseudonym WHERE deal_id = $1 RETURNING deal_id',
        params: [DEAL.a],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'deal.deal_pseudonym.org_id',
    holds:
      'R5. WHICH organisation a label belongs to. This one column is the whole ' +
      'pseudonym: it is withheld by column-level grant from every role that can ' +
      'read the public record.',
    read: {
      sql: `SELECT deal_id::text AS deal_id, org_id::text AS org_id FROM deal.deal_pseudonym
             WHERE deal_id = ANY($1::uuid[])`,
      params: [ALL_DEAL_IDS],
      key: (r) => `pseud@${dealKey(text(r, 'deal_id'))}→${orgKey(text(r, 'org_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        operator: ['pseud@dealA→buyerA', 'pseud@dealB→buyerB'],
        auditor: ['pseud@dealA→buyerA', 'pseud@dealB→buyerB'],
      }),
    },
  },

  // ========================================================== documents ====
  {
    id: 'doc.document',
    holds:
      'Idea notes, design documents, monitoring plans, financial models and the ' +
      'letters of intent inside a deal room. Six visibility classes on one table. ' +
      'Since migration 0055 an owner may attach a document to its own project, in ' +
      'the three classes that are its to choose; since 0056 the admin and auditor ' +
      'classes are withheld from the owner on read as well as on write, because ' +
      'they hold material ABOUT the owner rather than the owner\'s own.',
    read: {
      sql: 'SELECT id::text AS id FROM doc.document WHERE id = ANY($1::uuid[])',
      params: [ALL_DOCUMENT_IDS],
      key: (r) => documentKey(text(r, 'id')),
      expect: forAll<ReadOutcome>([...PUBLIC_DOCS], {
        buyerA: [...PUBLIC_DOCS, 'loi@dealA'].sort(),
        buyerB: [...PUBLIC_DOCS, 'loi@dealB'].sort(),
        investorA: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2'].sort(),
        investorB: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2'].sort(),
        ownerA: [...PUBLIC_DOCS, 'fin@P1', 'loi@dealA'].sort(),
        ownerB: [...PUBLIC_DOCS, 'fin@P2', 'loi@dealB'].sort(),
        operator: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2', 'loi@dealA', 'loi@dealB'].sort(),
        auditor: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2', 'loi@dealA', 'loi@dealB'].sort(),
      }),
    },
    insert: {
      describe: 'attach a new public document to project 1',
      stmt: () => ({
        sql: `INSERT INTO doc.document (scope, kind, visibility, project_id)
              VALUES ('project', 'other', 'public', $1) RETURNING id`,
        params: [PROJECT.p1],
      }),
      // Owner A owns project 1, so migration 0055 admits it here and Owner B
      // is still refused. An owner attaching a document to ANOTHER owner's
      // project is the case this row exists to keep denied.
      expect: forAll<WriteOutcome>('denied', {
        operator: 'ok', ownerA: 'ok', ownerB: 'blocked',
      }),
    },
    update: {
      describe: "widen a document's visibility in place",
      stmt: () => ({
        sql: 'UPDATE doc.document SET visibility = visibility WHERE id = $1 RETURNING id',
        params: [DOCUMENT.finP1],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: 'delete a document',
      stmt: () => ({
        sql: 'DELETE FROM doc.document WHERE id = $1 RETURNING id',
        params: [DOCUMENT.finP1],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'doc.document_version',
    holds:
      'The bytes: storage region, bucket, key and content hash. A version is ' +
      'visible exactly where its document is, minus anything withdrawn. The ' +
      'insert probe below targets a DEAL-room document, which migration 0055 ' +
      'withholds from an owner on purpose: an owner may add a version to a ' +
      "document on its own PROJECT, never to one inside somebody's deal room.",
    read: {
      sql: `SELECT document_id::text AS document_id FROM doc.document_version
             WHERE document_id = ANY($1::uuid[])`,
      params: [ALL_DOCUMENT_IDS],
      key: (r) => `ver@${documentKey(text(r, 'document_id'))}`,
      expect: forAll<ReadOutcome>(PUBLIC_DOCS.map((d) => `ver@${d}`).sort(), {
        buyerA: [...PUBLIC_DOCS, 'loi@dealA'].map((d) => `ver@${d}`).sort(),
        buyerB: [...PUBLIC_DOCS, 'loi@dealB'].map((d) => `ver@${d}`).sort(),
        investorA: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2'].map((d) => `ver@${d}`).sort(),
        investorB: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2'].map((d) => `ver@${d}`).sort(),
        ownerA: [...PUBLIC_DOCS, 'fin@P1', 'loi@dealA'].map((d) => `ver@${d}`).sort(),
        ownerB: [...PUBLIC_DOCS, 'fin@P2', 'loi@dealB'].map((d) => `ver@${d}`).sort(),
        operator: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2', 'loi@dealA', 'loi@dealB'].map((d) => `ver@${d}`).sort(),
        auditor: [...PUBLIC_DOCS, 'fin@P1', 'fin@P2', 'loi@dealA', 'loi@dealB'].map((d) => `ver@${d}`).sort(),
      }),
    },
    insert: {
      describe: "upload version 2 of the letter of intent in Buyer A's deal room",
      stmt: (p) => ({
        // version_no is computed rather than hard-coded, the same way
        // src/lib/documents/service.ts computes it. A literal 2 made this
        // probe depend on nobody ever adding a version to that document, and
        // the moment one was added the operator's expected 'ok' became a
        // duplicate-key error that looked like a policy change.
        sql: `INSERT INTO doc.document_version
                (document_id, version_no, storage_region, storage_bucket, storage_key,
                 content_sha256, byte_size, media_type, uploaded_by_org_id)
              SELECT $1,
                     COALESCE((SELECT max(v.version_no) FROM doc.document_version v
                                WHERE v.document_id = $1), 0) + 1,
                     'eu-central-1', 'sylva-demo-documents', 'demo/probe.pdf',
                     sha256(convert_to('demo/probe.pdf', 'UTF8')), 1000,
                     'application/pdf', $2
              RETURNING id`,
        params: [DEAL_DOCUMENT.a, org(p)],
      }),
      // 'blocked' rather than 'denied' for the two owners since migration
      // 0055: they now hold the INSERT privilege, and it is the row policy
      // that refuses this particular row because the document is a deal
      // room's. A locked door became a door that opens onto a wall, which is
      // the stronger of the two statements.
      expect: forAll<WriteOutcome>('denied', {
        operator: 'ok', ownerA: 'blocked', ownerB: 'blocked',
      }),
    },
    update: {
      describe: 'repoint a stored document at other bytes',
      stmt: () => ({
        sql: 'UPDATE doc.document_version SET storage_key = storage_key WHERE document_id = $1 RETURNING id',
        params: [DOCUMENT.finP1],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: 'delete a stored version',
      stmt: () => ({
        sql: 'DELETE FROM doc.document_version WHERE document_id = $1 RETURNING id',
        params: [DOCUMENT.finP1],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  // ====================================================== organisations ====
  {
    id: 'org.organisation',
    counterpartyAttributesArePublic: true,
    holds:
      'Counterparty attributes: country, sector, size band. These are public by ' +
      'design - they are what the public record shows beside a pseudonym.',
    read: {
      sql: `SELECT id::text AS id, country_code, sector_code, size_band_code
              FROM org.organisation WHERE id = ANY($1::uuid[])`,
      params: [ALL_ORG_IDS],
      key: (r) => orgKey(text(r, 'id')),
      expect: forAll<ReadOutcome>([...ALL_ORGS]),
    },
    insert: {
      describe: 'create an organisation',
      stmt: () => ({
        sql: `INSERT INTO org.organisation
                (legal_name, registration_number, registered_address, country_code,
                 sector_code, size_band_code)
              VALUES ('DEMO rls probe org', 'X (DEMO)', 'Somewhere, DE', 'DE', 'public', 'sme')
              RETURNING id`,
        params: [],
      }),
      expect: forAll<WriteOutcome>('denied', { operator: 'ok' }),
    },
    update: {
      describe: "rename Buyer A's organisation",
      stmt: () => ({
        sql: 'UPDATE org.organisation SET legal_name = legal_name WHERE id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied', { operator: 'ok' }),
    },
    remove: {
      describe: "delete Buyer A's organisation",
      stmt: () => ({
        sql: 'DELETE FROM org.organisation WHERE id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'org.organisation.legal_name',
    counterpartyAttributesArePublic: true,
    holds:
      'R5. The real name. Withheld by COLUMN privilege rather than by policy, so ' +
      'no bug in any template can leak it: the query fails with 42501 instead.',
    read: {
      sql: `SELECT id::text AS id, legal_name FROM org.organisation
             WHERE id = ANY($1::uuid[])`,
      params: [ALL_ORG_IDS],
      key: (r) => orgKey(text(r, 'id')),
      expect: forAll<ReadOutcome>(DENIED, {
        operator: [...ALL_ORGS],
        auditor: [...ALL_ORGS],
      }),
    },
  },

  // ============================================================ vetting ====
  {
    id: 'org.vetting_submission',
    holds:
      'What an organisation told Sylva about its intended claim, its operations ' +
      'and its approach to sustainability. Competitively sensitive.',
    read: {
      sql: `SELECT id::text AS id FROM org.vetting_submission
             WHERE id = ANY($1::uuid[])`,
      params: [ALL_SUBMISSION_IDS],
      key: (r) => `vsub@${SUBMISSION_BY_ID[text(r, 'id')] ?? text(r, 'id')}`,
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['vsub@buyerA'], buyerB: ['vsub@buyerB'],
        ownerA: ['vsub@ownerA'], ownerB: ['vsub@ownerB'],
        investorA: ['vsub@investorA'], investorB: ['vsub@investorB'],
        unvetted: ['vsub@unvetted'],
        operator: ['vsub@buyerA', 'vsub@buyerB', 'vsub@investorA', 'vsub@investorB',
                   'vsub@ownerA', 'vsub@ownerB', 'vsub@unvetted'],
        auditor: ['vsub@buyerA', 'vsub@buyerB', 'vsub@investorA', 'vsub@investorB',
                  'vsub@ownerA', 'vsub@ownerB', 'vsub@unvetted'],
      }),
    },
    insert: {
      describe: 'submit a buyer questionnaire for the principal’s own organisation',
      stmt: (p) => ({
        sql: `INSERT INTO org.vetting_submission (org_id, role_code, questionnaire_id)
              VALUES ($1, 'buyer', $2) RETURNING id`,
        params: [org(p), QUESTIONNAIRE.buyer],
      }),
      expect: forAll<WriteOutcome>('ok', { auditor: 'denied', anonymous: 'denied' }),
    },
    update: {
      describe: "rewrite Buyer A's submission",
      stmt: () => ({
        sql: 'UPDATE org.vetting_submission SET submitted_at = submitted_at WHERE id = $1 RETURNING id',
        params: [VETTING_SUBMISSION.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete Buyer A's submission",
      stmt: () => ({
        sql: 'DELETE FROM org.vetting_submission WHERE id = $1 RETURNING id',
        params: [VETTING_SUBMISSION.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'org.vetting_answer',
    holds: 'The answers themselves. Reachable only through a submission the principal owns.',
    read: {
      sql: `SELECT submission_id::text AS submission_id FROM org.vetting_answer
             WHERE submission_id = ANY($1::uuid[])`,
      params: [ALL_SUBMISSION_IDS],
      key: (r) => `vans@${SUBMISSION_BY_ID[text(r, 'submission_id')] ?? text(r, 'submission_id')}`,
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['vans@buyerA'], buyerB: ['vans@buyerB'],
        ownerA: NONE, ownerB: NONE, investorA: NONE, investorB: NONE, unvetted: NONE,
        operator: ['vans@buyerA', 'vans@buyerB'],
        auditor: ['vans@buyerA', 'vans@buyerB'],
      }),
    },
    insert: {
      // The one probe that does not aim at Buyer A: Buyer A's submission has an
      // answer to every question already, so there is no free slot in it. Buyer
      // B's submission is missing water_dependence, which makes it the row that
      // can actually be written - and aiming at B asks the same question the
      // other way round.
      describe: "add an answer to BUYER B's vetting submission",
      stmt: () => ({
        sql: `INSERT INTO org.vetting_answer
                (submission_id, questionnaire_id, question_code, answer_text)
              VALUES ($1, $2, 'water_dependence', 'DEMO rls probe answer')
              RETURNING submission_id`,
        params: [VETTING_SUBMISSION.buyerB, QUESTIONNAIRE.buyer],
      }),
      expect: forAll<WriteOutcome>('blocked', {
        buyerB: 'ok', operator: 'ok', auditor: 'denied', anonymous: 'denied',
      }),
    },
    update: {
      describe: "rewrite an answer in Buyer A's submission",
      stmt: () => ({
        sql: 'UPDATE org.vetting_answer SET answer_text = answer_text WHERE submission_id = $1 RETURNING submission_id',
        params: [VETTING_SUBMISSION.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete an answer in Buyer A's submission",
      stmt: () => ({
        sql: 'DELETE FROM org.vetting_answer WHERE submission_id = $1 RETURNING submission_id',
        params: [VETTING_SUBMISSION.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'org.vetting_decision',
    holds:
      'R6. Approval is DERIVED from these rows by trigger and never written ' +
      'directly, which is what makes R6 auditable rather than merely true.',
    read: {
      sql: `SELECT org_id::text AS org_id FROM org.vetting_decision
             WHERE org_id = ANY($1::uuid[])`,
      params: [ALL_ORG_IDS],
      key: (r) => `vdec@${orgKey(text(r, 'org_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['vdec@buyerA'], buyerB: ['vdec@buyerB'],
        ownerA: ['vdec@ownerA'], ownerB: ['vdec@ownerB'],
        investorA: ['vdec@investorA'], investorB: ['vdec@investorB'],
        unvetted: NONE,
        operator: ['vdec@buyerA', 'vdec@buyerB', 'vdec@investorA', 'vdec@investorB',
                   'vdec@ownerA', 'vdec@ownerB'],
        auditor: ['vdec@buyerA', 'vdec@buyerB', 'vdec@investorA', 'vdec@investorB',
                  'vdec@ownerA', 'vdec@ownerB'],
      }),
    },
    insert: {
      describe: 'approve the unvetted organisation as a buyer',
      stmt: (p) => ({
        sql: `INSERT INTO org.vetting_decision
                (submission_id, org_id, role_code, decision, reason,
                 decided_by_org_id, decided_by_person_ref)
              VALUES ($1, $2, 'buyer', 'approved', 'DEMO rls probe', $3, $4) RETURNING id`,
        params: [VETTING_SUBMISSION.unvetted, ORG.unvetted, org(p), person(p)],
      }),
      expect: forAll<WriteOutcome>('denied', { operator: 'ok' }),
    },
    update: {
      describe: "reverse Buyer A's approval in place",
      stmt: () => ({
        sql: 'UPDATE org.vetting_decision SET reason = reason WHERE org_id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete Buyer A's approval",
      stmt: () => ({
        sql: 'DELETE FROM org.vetting_decision WHERE org_id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  // =========================================================== projects ====
  {
    id: 'proj.project',
    holds:
      'Draft versus published, and who may move a project between the two. A ' +
      'draft project is an unannounced piece of commercial activity and must ' +
      'not be reachable before Sylva publishes it. Since migration 0050 an ' +
      'owner may create its own project and hand it to Sylva for review; ' +
      'publishing it remains an operator act, refused to an owner both by the ' +
      'policy below and by the withheld published_at column privilege that ' +
      "proj.project's CHECK makes indispensable.",
    read: {
      sql: `SELECT id::text AS id, status FROM proj.project
             WHERE id = ANY($1::uuid[])`,
      params: [ALL_PROJECT_IDS],
      key: (r) => `${projectKey(text(r, 'id'))}:${text(r, 'status')}`,
      expect: forAll<ReadOutcome>(['p1:published', 'p2:published'], {
        ownerA: ['p1:published', 'p2:published', 'p3:draft'],
        operator: ['p1:published', 'p2:published', 'p3:draft'],
        auditor: ['p1:published', 'p2:published', 'p3:draft'],
      }),
    },
    insert: {
      describe: 'create a project owned by the principal',
      stmt: (p) => ({
        sql: `INSERT INTO proj.project (slug, owner_org_id, country_code, status)
              VALUES ('demo-rls-probe-project', $1, 'DE', 'draft') RETURNING id`,
        params: [org(p)],
      }),
      // An owner creates its own drafts (migration 0050). The policy sets the
      // owner from the signed context, so 'ok' here means "owned by itself":
      // an insert naming another organisation is blocked, which
      // tests/db/owner.test.ts proves separately.
      expect: forAll<WriteOutcome>('denied', {
        operator: 'ok', ownerA: 'ok', ownerB: 'ok',
      }),
    },
    update: {
      describe: 'hand the draft project to Sylva for review',
      stmt: () => ({
        sql: `UPDATE proj.project SET status = 'submitted_for_review'
               WHERE id = $1 RETURNING id`,
        params: [PROJECT.p3],
      }),
      // p3 is Owner A's draft. Owner A may submit it; Owner B is not refused
      // on privilege but finds no row to update, which is the difference
      // between 'denied' and 'no-rows' and the reason both words exist.
      expect: forAll<WriteOutcome>('denied', {
        operator: 'ok', ownerA: 'ok', ownerB: 'no-rows',
      }),
    },
    remove: {
      describe: 'delete the draft project',
      stmt: () => ({
        sql: 'DELETE FROM proj.project WHERE id = $1 RETURNING id',
        params: [PROJECT.p3],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'proj.project_financials',
    holds:
      '"Financing need, revenue streams, the financial model. Visible only to ' +
      'investors we have vetted." Deny by default: no policy exists for the ' +
      'public or buyer roles at all.',
    read: {
      sql: `SELECT project_id::text AS project_id, financing_need
              FROM proj.project_financials WHERE project_id = ANY($1::uuid[])`,
      params: [ALL_PROJECT_IDS],
      key: (r) => `fin@${projectKey(text(r, 'project_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        investorA: ['fin@p1', 'fin@p2'], investorB: ['fin@p1', 'fin@p2'],
        ownerA: ['fin@p1'], ownerB: ['fin@p2'],
        operator: ['fin@p1', 'fin@p2'], auditor: ['fin@p1', 'fin@p2'],
      }),
    },
    insert: {
      describe: 'record a new version of project 1’s financials',
      stmt: () => ({
        sql: `INSERT INTO proj.project_financials
                (project_id, version_no, financing_need, currency, revenue_streams_note,
                 source_ref_id, as_of_date)
              VALUES ($1, 2, 1, 'EUR', 'DEMO rls probe', $2, DATE '2026-09-24')
              RETURNING project_id`,
        params: [PROJECT.p1, FIXTURE_SOURCE_REF],
      }),
      expect: forAll<WriteOutcome>('denied', { operator: 'ok' }),
    },
    update: {
      describe: "rewrite project 1's financing need in place",
      stmt: () => ({
        sql: 'UPDATE proj.project_financials SET currency = currency WHERE project_id = $1 RETURNING project_id',
        params: [PROJECT.p1],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete project 1's financials",
      stmt: () => ({
        sql: 'DELETE FROM proj.project_financials WHERE project_id = $1 RETURNING project_id',
        params: [PROJECT.p1],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  // ========================================================= the record ====
  {
    id: 'record.entry',
    holds:
      'R4. The permanent record. web_anon has no privilege on it at all and reads ' +
      'record.v_public_entry instead, which resolves the pseudonym as at the time ' +
      'of each entry. Since migration 0076 an entry may only be appended by a ' +
      'party to the deal it names, or by the owner of the project it names: the ' +
      'record is append-only and published, so a row written about somebody else ' +
      'is a permanent public statement they never made.',
    read: {
      sql: `SELECT public_id::text AS public_id FROM record.entry
             WHERE public_id = ANY($1::uuid[])`,
      params: [ALL_RECORD_IDS],
      key: (r) => RECORD_BY_ID[text(r, 'public_id')] ?? text(r, 'public_id'),
      expect: forAll<ReadOutcome>(DENIED, {
        buyerA: ['interestDealA'], buyerB: ['interestDealB'],
        ownerA: ['interestDealA', 'listedP1'], ownerB: ['interestDealB', 'listedP2'],
        investorA: NONE, investorB: NONE, unvetted: NONE,
        operator: ['interestDealA', 'interestDealB', 'listedP1', 'listedP2'],
        auditor: ['interestDealA', 'interestDealB', 'listedP1', 'listedP2'],
      }),
    },
    insert: {
      describe: "append an entry about Buyer A's deal, stamped with the principal’s own organisation",
      stmt: (p) => ({
        sql: `INSERT INTO record.entry
                (entry_type, project_id, deal_id, deal_buyer_org_id, deal_owner_org_id,
                 actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
                 source_ref_id, detail)
              VALUES ('interest_expressed', $1, $2, $3, $4, $5, $6, $7,
                      'representative #1', $8, '{"probe":"tests/rls"}'::jsonb)
              RETURNING entry_no`,
        params: [PROJECT.p1, DEAL.a, ORG.buyerA, ORG.ownerA,
                 org(p), roleSnapshot(p), person(p), FIXTURE_SOURCE_REF],
      }),
      // FINDING-002, closed by migration 0076. Buyer B, Owner B and the
      // unvetted organisation are now 'blocked' rather than 'ok': the WITH
      // CHECK asks whether the writer is a party to the deal the entry names,
      // not merely whether the row carries the writer's own organisation.
      // Buyer A and Owner A are parties to deal A and still pass; the operator
      // writes under its own policy and is unaffected.
      expect: forAll<WriteOutcome>('denied', {
        buyerA: 'ok', ownerA: 'ok', operator: 'ok',
        buyerB: 'blocked', ownerB: 'blocked', unvetted: 'blocked',
      }),
    },
    update: {
      describe: 'correct a record entry by editing it',
      stmt: () => ({
        sql: 'UPDATE record.entry SET detail = detail WHERE public_id = $1 RETURNING entry_no',
        params: [RECORD_ENTRY.interestDealA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: 'delete a record entry',
      stmt: () => ({
        sql: 'DELETE FROM record.entry WHERE public_id = $1 RETURNING entry_no',
        params: [RECORD_ENTRY.interestDealA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  // =========================================================== identity ====
  {
    id: 'identity.user_account',
    holds:
      'Every piece of personal data on the platform, in one table. No application ' +
      'role holds USAGE on the schema; a person reads their own row through the ' +
      'SECURITY DEFINER function identity.whoami().',
    read: {
      sql: `SELECT org_id::text AS org_id FROM identity.user_account
             WHERE org_id = ANY($1::uuid[])`,
      params: [ALL_ORG_IDS],
      key: (r) => `user@${orgKey(text(r, 'org_id'))}`,
      expect: forAll<ReadOutcome>(DENIED, {
        operator: ['user@auditor', 'user@buyerA', 'user@buyerB', 'user@investorA',
                   'user@investorB', 'user@operator', 'user@ownerA', 'user@ownerB',
                   'user@unvetted'],
        auditor: ['user@auditor', 'user@buyerA', 'user@buyerB', 'user@investorA',
                  'user@investorB', 'user@operator', 'user@ownerA', 'user@ownerB',
                  'user@unvetted'],
      }),
    },
    insert: {
      describe: 'create a user account',
      stmt: (p) => ({
        sql: `INSERT INTO identity.user_account
                (person_ref, org_id, email, full_name, locale, status)
              VALUES (gen_random_uuid(), $1, 'rls.probe@demo.sylva.example',
                      'DEMO rls probe', 'en', 'active') RETURNING id`,
        params: [org(p)],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    update: {
      describe: "rename Buyer A's user",
      stmt: () => ({
        sql: 'UPDATE identity.user_account SET full_name = full_name WHERE org_id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
    remove: {
      describe: "delete Buyer A's user",
      stmt: () => ({
        sql: 'DELETE FROM identity.user_account WHERE org_id = $1 RETURNING id',
        params: [ORG.buyerA],
      }),
      expect: forAll<WriteOutcome>('denied'),
    },
  },

  {
    id: 'identity.user_account.password_hash',
    holds:
      'The scrypt credential record written by the authentication work. A ' +
      'secret, not a fact about a person, and nothing on the platform ever ' +
      'needs to display it. Read only inside identity.auth_salt() and ' +
      'identity.authenticate(), which are SECURITY DEFINER.',
    read: {
      sql: `SELECT org_id::text AS org_id, password_hash FROM identity.user_account
             WHERE org_id = ANY($1::uuid[])`,
      params: [ALL_ORG_IDS],
      key: (r) => `pw@${orgKey(text(r, 'org_id'))}`,
      // FINDING-004, closed by db/migrations/0042. The two table-level grants
      // in migration 0016 were replaced with column lists that omit
      // password_hash and mfa_secret, so NOBODY reads a credential - not the
      // operator, not the auditor. ci.assert_no_credential_grants() keeps it
      // that way and has a self-test for the exact mistake that caused it.
      expect: forAll<ReadOutcome>(DENIED),
    },
  },
];
