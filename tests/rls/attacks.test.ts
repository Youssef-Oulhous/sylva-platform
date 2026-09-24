/**
 * The attacks, each one named and each one actually run.
 *
 * FINDING-001 was found by running the attack, not by reading the DDL. A
 * schema that looks right and a schema that behaves right are different
 * claims, and only one of them can be tested.
 *
 * Every test here connects as a real PostgreSQL role. None uses the superuser.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeAllPools } from '@/lib/db/pool';
import type { Actor } from '@/lib/db/actor';
import { withActor } from '@/lib/db/session';
import {
  ORG, PERSON, PROJECT, PRINCIPALS, QUESTIONNAIRE, DEAL, FIXTURE_SOURCE_REF,
} from './catalog';
import { actorFor } from './principals';
import { ensureFixtures } from './fixtures';
import { attemptWrite, probe, readKeys } from './probe';
import { expectFailure, inShell, mintContext, swapOrganisation } from './context';
import { TABLES } from './matrix';
import { ATTACKS } from './render';

beforeAll(async () => { await ensureFixtures(); }, 60_000);
afterAll(async () => { await closeAllPools(); });

/** Names a test after an entry in the attack list, and records that it exists. */
const covered = new Set<string>();
function attack(id: string): string {
  const a = ATTACKS.find((x) => x.id === id);
  if (!a) throw new Error(`no attack registered with id "${id}"`);
  covered.add(id);
  return a.attack;
}

const unvettedInvestor: Actor = {
  kind: 'member', role: 'investor', orgId: ORG.unvetted, personRef: PERSON.unvetted,
};

async function countAs(actor: Actor, sql: string, params: readonly unknown[] = []): Promise<number> {
  return probe(actor, async (tx) => {
    const rows = await tx.query<{ n: string }>(sql, params);
    return Number(rows[0]?.n ?? 0);
  });
}

// ===================================================== the signed context ===

describe('the signed actor context', () => {
  it(attack('forged-context'), async () => {
    // Control first: the query and the fixture are real, so a zero later means
    // the forgery failed and not that the table is empty.
    const genuineB = await mintContext('app', ORG.buyerB, PERSON.buyerB);
    const real = await inShell({ pool: 'app', dbRole: 'sylva_buyer', ctx: genuineB }, (q) =>
      q('SELECT count(*)::int AS n FROM geo.buyer_site'));
    expect(real[0]!.n).toBe(1);

    // The attack: take a context Buyer A is entitled to and rewrite the
    // organisation, keeping the MAC that was computed over the original.
    const mine = await mintContext('app', ORG.buyerA, PERSON.buyerA);
    const forged = swapOrganisation(mine, ORG.buyerB);
    expect(forged).not.toBe(mine);
    expect(forged.split(':')[3]).toBe(mine.split(':')[3]); // same signature

    const rows = await inShell({ pool: 'app', dbRole: 'sylva_buyer', ctx: forged }, (q) =>
      q(`SELECT sylva.actor_org_id() AS org,
                (SELECT count(*)::int FROM geo.buyer_site) AS n`));
    // Degrades to "no organisation", never to someone else's organisation.
    expect(rows[0]!.org).toBeNull();
    expect(rows[0]!.n).toBe(0);
  });

  it(attack('expired-context'), async () => {
    const stale = await mintContext('app', ORG.buyerA, PERSON.buyerA, '-1 second');
    const rows = await inShell({ pool: 'app', dbRole: 'sylva_buyer', ctx: stale }, (q) =>
      q(`SELECT sylva.actor_org_id() AS org,
                (SELECT count(*)::int FROM geo.buyer_site) AS n`));
    expect(rows[0]!.org).toBeNull();
    expect(rows[0]!.n).toBe(0);
  });

  it(attack('reset-context-mid-transaction'), async () => {
    // FINDING-001, test 2: still connected as sylva_buyer with a valid context
    // for organisation A, re-SET the variable to organisation B.
    const mine = await mintContext('app', ORG.buyerA, PERSON.buyerA);
    const forged = swapOrganisation(mine, ORG.buyerB);

    const seen = await inShell({ pool: 'app', dbRole: 'sylva_buyer', ctx: mine }, async (q) => {
      const before = await q('SELECT count(*)::int AS n FROM geo.buyer_site');

      // (a) the pre-0019 shape: a bare organisation id
      await q('SELECT set_config($1, $2, true)', ['sylva.actor_ctx', ORG.buyerB]);
      const bare = await q('SELECT count(*)::int AS n FROM geo.buyer_site');

      // (b) a well-formed context with another organisation's id in it
      await q('SELECT set_config($1, $2, true)', ['sylva.actor_ctx', forged]);
      const signed = await q('SELECT count(*)::int AS n FROM geo.buyer_site');

      return { before: before[0]!.n, bare: bare[0]!.n, signed: signed[0]!.n };
    });

    expect(seen.before).toBe(2);   // Buyer A's own two sites
    expect(seen.bare).toBe(0);
    expect(seen.signed).toBe(0);
  });

  it(attack('mint-own-context'), async () => {
    const f = await expectFailure(
      { pool: 'app', dbRole: 'sylva_buyer' },
      'SELECT sylva.mint_actor_ctx($1::uuid, $2::uuid, $3::interval)',
      [ORG.buyerB, PERSON.buyerB, '15 minutes'],
    );
    expect(f.code).toBe('42501');
    expect(f.message).toMatch(/permission denied/i);
  });

  it(attack('read-signing-key'), async () => {
    for (const dbRole of ['sylva_buyer', 'sylva_project_owner', 'sylva_investor']) {
      const f = await expectFailure({ pool: 'app', dbRole }, 'SELECT key FROM sylva.context_key');
      expect(f.code, dbRole).toBe('42501');
    }
    for (const [pool, dbRole] of [['operator', 'sylva_operator'], ['auditor', 'sylva_auditor'],
                                  ['public', 'sylva_web_anon']] as const) {
      const f = await expectFailure({ pool, dbRole }, 'SELECT key FROM sylva.context_key');
      expect(f.code, dbRole).toBe('42501');
    }
  });

  it(attack('privilege-role-cannot-authenticate'), async () => {
    // The authentication functions run as the LOGIN role, before any actor
    // exists. No privilege role may call them: a compromised query surface
    // inside a signed-in session must not be able to hand itself a salt, test a
    // password, open a session for someone else or register an organisation.
    const fns = [
      "identity.auth_salt('buyer.a@demo.sylva.example')",
      "identity.authenticate('buyer.a@demo.sylva.example', 'x')",
      "identity.resolve_session(sha256('x'::bytea))",
      "identity.close_session(sha256('x'::bytea))",
    ];
    const shells = [
      { pool: 'app', dbRole: 'sylva_buyer' },
      { pool: 'app', dbRole: 'sylva_project_owner' },
      { pool: 'app', dbRole: 'sylva_investor' },
      { pool: 'operator', dbRole: 'sylva_operator' },
      { pool: 'auditor', dbRole: 'sylva_auditor' },
      { pool: 'public', dbRole: 'sylva_web_anon' },
    ] as const;
    for (const shell of shells) {
      for (const fn of fns) {
        const f = await expectFailure(shell, `SELECT ${fn}`);
        expect(f.code, `${shell.dbRole} → ${fn}`).toBe('42501');
      }
    }
  }, 60_000);

  it(attack('pool-escalation'), async () => {
    // An authorization bug in application code cannot turn a visitor into a
    // buyer, because the connection serving the visitor is not a member of
    // sylva_buyer and PostgreSQL refuses the SET ROLE outright.
    const f = await expectFailure({ pool: 'public' }, 'SET LOCAL ROLE sylva_buyer');
    expect(f.message).toMatch(/permission denied|is not a member/i);
  });
});

// ================================================= cross-organisation reads ==

describe('cross-organisation reads', () => {
  it(attack('anonymous-reads-buyer-site'), async () => {
    const out = await readKeys(actorFor('anonymous'), 'SELECT id FROM geo.buyer_site', () => 'x');
    // Privilege, not policy: sylva_web_anon holds no grant on the table at all.
    expect(out).toBe('denied');
  });

  it(attack('unmask-pseudonym'), async () => {
    const out = await readKeys(
      actorFor('buyerA'),
      'SELECT deal_id, org_id FROM deal.deal_pseudonym',
      () => 'x',
    );
    expect(out).toBe('denied');

    // The label itself is public - that is what a pseudonym is for. Keyed by
    // deal, because the two labels are drawn from per-project counters and can
    // legitimately read the same.
    const labels = await readKeys(
      actorFor('buyerA'),
      'SELECT deal_id::text AS deal_id, label FROM deal.deal_pseudonym',
      (r) => `${String(r.deal_id)}=${String(r.label)}`,
    );
    expect(Array.isArray(labels)).toBe(true);
    // At least the two fixture deals. Not an exact count: db/seed/0007 adds a
    // third deal so that the public record can show one organisation holding
    // two deals under two unrelated labels, and a future seed may add more.
    // What this attack is about is the org_id refusal above; the number of
    // deals in the demo data is not part of it.
    expect((labels as readonly string[]).length).toBeGreaterThanOrEqual(2);
    for (const l of labels as readonly string[]) expect(l).toMatch(/=Buyer \d{3}$/);
  });

  it(attack('anonymous-reads-draft-project'), async () => {
    // Not "denied": the anonymous visitor may read proj.project. The draft is
    // filtered out by policy, which is the stronger result - the table is
    // readable and the row is still invisible.
    const n = await countAs(
      actorFor('anonymous'),
      'SELECT count(*)::int AS n FROM proj.project WHERE id = $1',
      [PROJECT.p3],
    );
    expect(n).toBe(0);

    const published = await countAs(
      actorFor('anonymous'),
      'SELECT count(*)::int AS n FROM proj.project WHERE id = $1',
      [PROJECT.p1],
    );
    expect(published).toBe(1);
  });

  it(attack('unvetted-investor-reads-financials'), async () => {
    // Control: a vetted investor sees both projects' financials.
    expect(await countAs(
      actorFor('investorA'),
      'SELECT count(*)::int AS n FROM proj.project_financials',
    )).toBe(2);

    // The same role, the same query, an organisation with no investor approval
    // on record. sylva.is_vetted_investor() is false, so the policy matches
    // nothing.
    expect(await countAs(
      unvettedInvestor,
      'SELECT count(*)::int AS n FROM proj.project_financials',
    )).toBe(0);
  });

  it('Buyer A cannot read Buyer B’s deal, messages, terms or letter of intent', async () => {
    const a = actorFor('buyerA');
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM deal.deal WHERE buyer_org_id = $1', [ORG.buyerB])).toBe(0);
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM deal.deal_message WHERE buyer_org_id = $1', [ORG.buyerB])).toBe(0);
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM deal.deal_terms_version WHERE buyer_org_id = $1', [ORG.buyerB])).toBe(0);
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM doc.document WHERE deal_buyer_org_id = $1', [ORG.buyerB])).toBe(0);
    // and its own are all there, so the zeros above mean isolation, not emptiness
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM deal.deal WHERE buyer_org_id = $1', [ORG.buyerA])).toBe(1);
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM deal.deal_message WHERE buyer_org_id = $1', [ORG.buyerA])).toBe(1);
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM deal.deal_terms_version WHERE buyer_org_id = $1', [ORG.buyerA])).toBe(1);
    expect(await countAs(a, 'SELECT count(*)::int AS n FROM doc.document WHERE deal_buyer_org_id = $1', [ORG.buyerA])).toBe(1);
  });

  it(attack('whoami-is-scoped'), async () => {
    // The table itself is unreachable, whatever else is true.
    const direct = await readKeys(
      actorFor('buyerA'), 'SELECT id FROM identity.user_account', () => 'x');
    expect(direct).toBe('denied');

    // FINDING-003. identity.whoami() is granted EXECUTE to sylva_buyer,
    // sylva_project_owner and sylva_investor, but none of them holds USAGE on
    // the identity schema, and USAGE is required to CALL a function in it. The
    // grant is therefore inert today and a buyer cannot read its own name.
    //
    // That is a gap in the auth work, not in row-level security, so the test
    // asserts the invariant that belongs to THIS suite - whoami never resolves
    // to another organisation - in whichever of the two states the schema is
    // in when it runs. It fails if a fix ever makes it resolve wrongly.
    const hasUsage = await probe(actorFor('buyerA'), async (tx) => {
      const rows = await tx.query<{ u: boolean }>(
        "SELECT has_schema_privilege(current_user, 'identity', 'USAGE') AS u");
      return rows[0]!.u;
    });

    if (!hasUsage) {
      const f = await probe(actorFor('buyerA'), async (tx) => {
        try {
          await tx.query('SELECT org_id FROM identity.whoami()');
          return 'allowed';
        } catch (err) {
          return (err as { code?: string }).code ?? 'unknown';
        }
      });
      expect(f, 'FINDING-003: whoami is unreachable without USAGE on identity').toBe('42501');
      return;
    }

    const rows = await withActor(actorFor('buyerA'), (tx) =>
      tx.query<{ org_id: string; email: string }>('SELECT org_id, email FROM identity.whoami()'));
    expect(rows.length).toBe(1);
    expect(rows[0]!.org_id).toBe(ORG.buyerA);
    expect(rows[0]!.email).toBe('buyer.a@demo.sylva.example');
  });

  it('the operator resolves only its own person through identity.whoami()', async () => {
    const rows = await withActor(actorFor('operator'), (tx) =>
      tx.query<{ org_id: string; email: string }>('SELECT org_id, email FROM identity.whoami()'));
    expect(rows.length).toBe(1);
    expect(rows[0]!.org_id).toBe(ORG.operator);
    expect(rows[0]!.email).toBe('operator@demo.sylva.example');
  });
});

// ============================================================ write attacks ==

describe('cross-organisation writes', () => {
  it(attack('unvetted-opens-deal'), async () => {
    const out = await attemptWrite(
      actorFor('unvetted'),
      `INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id, intended_shape)
       VALUES ($1, $2, $3, 'forward') RETURNING id`,
      [PROJECT.p1, ORG.ownerA, ORG.unvetted],
    );
    // R6, raised by trigger with its own SQLSTATE so the UI can say why.
    expect(out).toBe('refused:SY006');
  });

  it(attack('cross-org-site'), async () => {
    const out = await attemptWrite(
      actorFor('buyerA'),
      `INSERT INTO geo.buyer_site (org_id, label, country_code, geom, source_ref_id)
       VALUES ($1, 'DEMO planted site', 'NL',
               ST_SetSRID(ST_MakePoint(4.47, 51.92), 4326), $2) RETURNING id`,
      [ORG.buyerB, FIXTURE_SOURCE_REF],
    );
    expect(out).toBe('blocked');
  });

  it(attack('cross-org-vetting'), async () => {
    const out = await attemptWrite(
      actorFor('buyerA'),
      `INSERT INTO org.vetting_submission (org_id, role_code, questionnaire_id)
       VALUES ($1, 'buyer', $2) RETURNING id`,
      [ORG.buyerB, QUESTIONNAIRE.buyer],
    );
    expect(out).toBe('blocked');
  });

  it(attack('cross-deal-message'), async () => {
    const out = await attemptWrite(
      actorFor('buyerB'),
      `INSERT INTO deal.deal_message
         (deal_id, project_id, buyer_org_id, owner_org_id, sender_org_id, body)
       VALUES ($1, $2, $3, $4, $5, 'DEMO intrusion') RETURNING id`,
      [DEAL.a, PROJECT.p1, ORG.buyerA, ORG.ownerA, ORG.buyerB],
    );
    expect(out).toBe('blocked');
  });

  it(attack('auditor-writes'), async () => {
    // "Read-only across everything including real names, and NOTHING else,
    // ever." Asserted against every write probe in the matrix rather than a
    // sample, because a single grant on a single table would undo it.
    const auditor = actorFor('auditor');
    const attempted: string[] = [];
    for (const t of TABLES) {
      for (const spec of [t.insert, t.update, t.remove]) {
        if (!spec) continue;
        const { sql, params } = spec.stmt('auditor');
        const out = await attemptWrite(auditor, sql, params);
        attempted.push(`${t.id}: ${out}`);
        expect(out, `${t.id} — ${spec.describe}`).toBe('denied');
      }
    }
    expect(attempted.length).toBeGreaterThan(30);
  }, 120_000);
});

describe('the attack list', () => {
  it('has a test for every attack it names, and names every test', () => {
    expect([...covered].sort()).toEqual(ATTACKS.map((a) => a.id).sort());
    expect(PRINCIPALS.anonymous.dbRole).toBe('sylva_web_anon');
  });
});
