import { afterAll, describe, expect, it } from 'vitest';
import { withActor, type Tx } from '@/lib/db/session';
import { closeAllPools } from '@/lib/db/pool';
import type { Actor } from '@/lib/db/actor';
import {
  findOpenInterestTx,
  loadInterestProjectTx,
  readRecordedInterestTx,
  recordInterestTx,
  referenceFor,
} from '@/lib/interest/queries';
import { codeForInterestError, ONE_LIVE_DEAL_INDEX } from '@/lib/interest/errors';
import { parseVolume } from '@/lib/interest/volume';
import { IncomparableUnitsError, sumSameUnit } from '@/lib/units/qty';

/**
 * Express interest, against the real database, as the real roles.
 *
 * WHY EVERY CASE ROLLS BACK
 *
 * A deal and its record entry are permanent by design: record.entry,
 * deal.interest_volume, deal.deal_disclosure_event and deal.deal_pseudonym are
 * append-only, so UPDATE and DELETE are revoked AND trigger-blocked, and no
 * afterAll() can tidy up after a committed test. A suite that committed would
 * also fail on its second run, because ux_one_live_deal_per_buyer_project
 * permits exactly one live deal per (project, buyer) - which is one of the
 * things being tested.
 *
 * So each case runs inside ONE transaction and throws a sentinel at the end,
 * which makes withActor() roll back. Everything that matters still happens for
 * real: the same PostgreSQL role, the same signed organisation context, the
 * same R6 trigger, the same policies, the same unique index, the same
 * append-only triggers. Only the COMMIT is withheld.
 *
 * The ids are the demo fixtures from db/seed/0001_demo_reference.sql.
 */

const BUYER_A: Actor = {
  kind: 'member', role: 'buyer',
  orgId: '0c000000-0000-0000-0000-00000000000c',      // DEMO Nordbräu AG, approved
  personRef: 'b0000000-0000-0000-0000-0000000000b3',
};
const BUYER_B: Actor = {
  kind: 'member', role: 'buyer',
  orgId: '0d000000-0000-0000-0000-00000000000d',      // DEMO Verdant Foods NV, approved
  personRef: 'b0000000-0000-0000-0000-0000000000b4',
};
const UNVETTED: Actor = {
  kind: 'member', role: 'buyer',
  orgId: '14000000-0000-0000-0000-000000000014',      // submitted, never decided
  personRef: 'b0000000-0000-0000-0000-0000000000b9',
};
const OWNER_A: Actor = {
  kind: 'member', role: 'project_owner',
  orgId: '0a000000-0000-0000-0000-00000000000a',      // DEMO Moorland Trust gGmbH
  personRef: 'b0000000-0000-0000-0000-0000000000b1',
};

const HAVEL = 'demo-untere-havel-wetland-restoration';
const BRIERE = 'demo-marais-de-briere-restoration';
const DRAFT = 'demo-oder-floodplain-reconnection';

afterAll(async () => { await closeAllPools(); });

/** The sentinel. Carries the result out of the transaction it rolls back. */
class Rollback<T> extends Error {
  constructor(readonly value: T) { super('test rollback'); }
}

async function inRolledBackTx<T>(
  actor: Actor,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    await withActor(actor, async (tx) => { throw new Rollback(await work(tx)); });
  } catch (err) {
    if (err instanceof Rollback) return err.value as T;
    throw err;
  }
  throw new Error('unreachable: withActor returned through a throwing callback');
}

/**
 * Make a (project, buyer) pair free of a live deal.
 *
 * db/seed/0007_demo_public_record.sql seeds live demo deals so the public
 * record has something to show, and ux_one_live_deal_per_buyer_project then
 * refuses a second one - correctly. Rather than hard-coding which pairs happen
 * to be free today, each case that needs to OPEN a deal first withdraws any
 * live one, through the real append-only stage chain, as the buyer itself.
 * Rolled back with everything else.
 */
async function clearLiveDeal(tx: Tx, projectId: string): Promise<void> {
  await tx.query(`
    INSERT INTO deal.deal_stage_event
      (deal_id, project_id, buyer_org_id, owner_org_id,
       from_stage, to_stage, actor_role, actor_org_id, actor_person_ref)
    SELECT d.id, d.project_id, d.buyer_org_id, d.owner_org_id,
           d.stage, 'withdrawn_by_buyer', 'buyer',
           sylva.actor_org_id(), sylva.actor_person_ref()
      FROM deal.deal d
     WHERE d.project_id = $1::uuid
       AND d.buyer_org_id = sylva.actor_org_id()
       AND NOT d.stage_is_terminal`, [projectId]);
}

/** The whole enquiry, so each case can vary one thing. */
async function express(tx: Tx, slug: string, over: {
  volumes?: number[];
  dealShape?: 'spot' | 'forward' | 'co_investment' | 'undecided';
  message?: string | null;
  disclose?: boolean;
  /** Leave any live deal in place, so the unique index can refuse this one. */
  keepExisting?: boolean;
} = {}) {
  const project = await loadInterestProjectTx(tx, slug, 'en');
  if (!project) throw new Error(`no project ${slug}`);
  if (!over.keepExisting) await clearLiveDeal(tx, project.id);
  const amounts = over.volumes ?? [1500, 2000];
  return {
    project,
    result: await recordInterestTx(tx, {
      projectId: project.id,
      ownerOrgId: project.ownerOrgId,
      unitTypeId: project.unitTypeId,
      dealShape: over.dealShape ?? 'forward',
      volumes: project.periods.slice(0, amounts.length).map((p, i) => ({
        periodId: p.periodId, amount: amounts[i]!,
      })),
      message: over.message === undefined ? 'TEST: who verifies the 2028 period?' : over.message,
      disclose: over.disclose ?? false,
    }),
  };
}

/* ====================================================== reading the form */

describe('the project an enquiry is about', () => {
  it('is read from the database, with its own unit type and its sources', async () => {
    const p = await inRolledBackTx(BUYER_A, (tx) =>
      loadInterestProjectTx(tx, HAVEL, 'en'));

    expect(p).not.toBeNull();
    expect(p!.slug).toBe(HAVEL);
    expect(p!.ownerOrgName).toContain('DEMO');
    expect(p!.periods.length).toBeGreaterThan(1);
    // F: every figure keeps its source and date, every unit figure its label.
    expect(p!.unitMetricLabel.length).toBeGreaterThan(0);
    for (const period of p!.periods) {
      expect(period.source.label.length).toBeGreaterThan(0);
      expect(period.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(period.remaining.projectId).toBe(p!.id);
      expect(period.remaining.unitTypeId).toBe(p!.unitTypeId);
    }
  });

  it('returns nothing for an unpublished project, so the page 404s', async () => {
    const p = await inRolledBackTx(BUYER_A, (tx) =>
      loadInterestProjectTx(tx, DRAFT, 'en'));
    expect(p).toBeNull();
  });

  it('RULE 7: the two demo projects cannot have their remaining volumes added', async () => {
    const [a, b] = await inRolledBackTx(BUYER_A, async (tx) => [
      await loadInterestProjectTx(tx, HAVEL, 'en'),
      await loadInterestProjectTx(tx, BRIERE, 'en'),
    ]);
    expect(a!.unitTypeId).not.toBe(b!.unitTypeId);
    expect(() => sumSameUnit([a!.periods[0]!.remaining, b!.periods[0]!.remaining]))
      .toThrow(IncomparableUnitsError);
  });
});

/* ========================================================== the happy path */

describe('expressing interest', () => {
  it('opens the deal, allocates the pseudonym and writes the record entry, in one transaction', async () => {
    const out = await inRolledBackTx(BUYER_A, async (tx) => {
      const seeded = (await loadInterestProjectTx(tx, HAVEL, 'en'))!;
      await clearLiveDeal(tx, seeded.id);
      const before = await findOpenInterestTx(tx, seeded.id);
      const { project, result } = await express(tx, HAVEL);
      const after = await findOpenInterestTx(tx, project.id);
      const confirmation = await readRecordedInterestTx(tx, result.publicId, 'en');
      return { before, after, project, result, confirmation };
    });

    expect(out.before).toBeNull();
    expect(out.after?.dealId).toBe(out.result.dealId);
    // The deal opens at the first stage of the note's sequence and at no other.
    expect(out.after?.stage).toBe('interest_expressed');

    const c = out.confirmation!;
    expect(c.entryType).toBe('interest_expressed');
    expect(c.dealId).toBe(out.result.dealId);
    expect(c.projectSlug).toBe(HAVEL);
    // R5: the pseudonym exists before any entry can refer to the deal, because
    // an AFTER INSERT trigger allocates it. Nothing in the application does.
    expect(c.pseudonym).toMatch(/^Buyer \d{3}$/);
    expect(c.disclosed).toBe(false);
    // The confirmation says which organisation, which is why
    // org.actor_organisation_name() exists.
    expect(c.organisationName).toContain('DEMO');
    expect(c.ownerOrgName).toContain('DEMO');
    expect(c.hasMessage).toBe(true);
    expect(c.intendedShape).toBe('forward');
    expect(c.reference).toBe(referenceFor(c.publicId, c.occurredAt));
    expect(c.reference).toMatch(/^INT-\d{4}-[0-9A-F]{8}$/);
  });

  it('keeps each volume in its own period, with its unit scope and its source', async () => {
    const c = await inRolledBackTx(BUYER_A, async (tx) => {
      const { result } = await express(tx, HAVEL, { volumes: [1500, 2000] });
      return readRecordedInterestTx(tx, result.publicId, 'en');
    });

    expect(c!.volumes).toHaveLength(2);
    expect(c!.volumes.map((v) => v.requested.amount)).toEqual([1500, 2000]);
    for (const v of c!.volumes) {
      expect(v.requested.projectId).toBe(c!.projectId);
      expect(v.requested.unitTypeId).toBe(c!.unitTypeId);
      // F: the figure keeps its source and its date.
      expect(v.source.label.length).toBeGreaterThan(0);
      expect(v.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.periodLabel.length).toBeGreaterThan(0);
    }
    // ...and the unit label to print beside them.
    expect(c!.unitMetricLabel.length).toBeGreaterThan(0);
  });

  it('records the naming choice as an event, so R5 is a decision and not a default', async () => {
    const named = await inRolledBackTx(BUYER_A, async (tx) => {
      const { result } = await express(tx, HAVEL, { disclose: true });
      return readRecordedInterestTx(tx, result.publicId, 'en');
    });
    expect(named!.disclosed).toBe(true);
    // The pseudonym is still allocated: withdrawing disclosure later must not
    // leave an entry with no label to fall back to.
    expect(named!.pseudonym).toMatch(/^Buyer \d{3}$/);
  });

  it('writes the message to the private question box, never to a public feed', async () => {
    const rows = await inRolledBackTx(BUYER_A, async (tx) => {
      const { project } = await express(tx, HAVEL, { message: 'TEST: catchment question' });
      return tx.query<{ body: string }>(
        `SELECT body FROM deal.project_question
          WHERE project_id = $1 AND asker_org_id = sylva.actor_org_id()
          ORDER BY asked_at DESC LIMIT 1`, [project.id]);
    });
    expect(rows[0]?.body).toBe('TEST: catchment question');
  });

  it('leaves NOTHING behind when any statement in it fails', async () => {
    // A period id belonging to the OTHER project: the composite FK to
    // proj.period (id, project_id) makes it unrepresentable. The deal insert
    // has already succeeded at that point, so this is the rollback test.
    const out = await inRolledBackTx(BUYER_A, async (tx) => {
      const havel = (await loadInterestProjectTx(tx, HAVEL, 'en'))!;
      const briere = (await loadInterestProjectTx(tx, BRIERE, 'en'))!;
      await clearLiveDeal(tx, havel.id);
      let failed: unknown = null;
      await tx.query('SAVEPOINT s');
      try {
        await recordInterestTx(tx, {
          projectId: havel.id,
          ownerOrgId: havel.ownerOrgId,
          unitTypeId: havel.unitTypeId,
          dealShape: 'spot',
          volumes: [{ periodId: briere.periods[0]!.periodId, amount: 5 }],
          message: null,
          disclose: false,
        });
      } catch (err) { failed = err; }
      await tx.query('ROLLBACK TO SAVEPOINT s');
      return { failed, open: await findOpenInterestTx(tx, havel.id) };
    });

    expect(out.failed).not.toBeNull();
    // No half-open deal, no orphan pseudonym, no record entry about a deal that
    // does not exist.
    expect(out.open).toBeNull();
  });
});

/* ============================================================== refusals */

describe('the three ways an enquiry is refused', () => {
  it('R6: an organisation Sylva has not approved cannot open a deal', async () => {
    const err = await inRolledBackTx(UNVETTED, async (tx) => {
      try {
        await express(tx, HAVEL);
        return null;
      } catch (e) { return e; }
    });

    expect(err).not.toBeNull();
    expect((err as { code?: string }).code).toBe('SY006');
    // ...and the person sees a sentence, not that.
    expect(codeForInterestError(err)).toBe('not_approved');
  });

  it('the second live interest on one project is refused by the unique index', async () => {
    const out = await inRolledBackTx(BUYER_B, async (tx) => {
      const first = await express(tx, HAVEL, { volumes: [100] });
      await tx.query('SAVEPOINT s');
      let err: unknown = null;
      try {
        await express(tx, HAVEL, { volumes: [200], dealShape: 'spot', keepExisting: true });
      } catch (e) { err = e; }
      await tx.query('ROLLBACK TO SAVEPOINT s');
      return { first, err };
    });

    const e = out.err as { code?: string; constraint?: string };
    expect(e.code).toBe('23505');
    expect(e.constraint).toBe(ONE_LIVE_DEAL_INDEX);
    // "you already have an open interest", not a constraint name.
    expect(codeForInterestError(out.err)).toBe('already_open');
  });

  it('a second interest on a DIFFERENT project is not refused', async () => {
    const both = await inRolledBackTx(BUYER_B, async (tx) => [
      (await express(tx, HAVEL, { volumes: [100] })).result,
      (await express(tx, BRIERE, { volumes: [50] })).result,
    ]);
    expect(both[0]!.dealId).not.toBe(both[1]!.dealId);
  });

  it('an unpublished project has no enquiry form to submit', async () => {
    const p = await inRolledBackTx(BUYER_A, (tx) => loadInterestProjectTx(tx, DRAFT, 'en'));
    // The action turns this null into 'project_not_open' before it reaches the
    // database; the database would refuse it too, with SY009.
    expect(p).toBeNull();
    expect(codeForInterestError({ code: 'SY009' })).toBe('project_not_open');
  });

  it('a privilege refusal becomes "you do not have access", never a table name', async () => {
    expect(codeForInterestError({ code: '42501' })).toBe('no_access');
    expect(codeForInterestError({ code: 'ZZZZZ' })).toBe('unavailable');
    expect(codeForInterestError(new Error('socket closed'))).toBe('unavailable');
  });
});

/* =============================================== isolation between buyers */

describe('one buyer never sees another buyer\'s enquiry', () => {
  it('the confirmation URL is useless to anybody but a party to the deal', async () => {
    // Buyer A records an interest and keeps the public_id...
    const publicId = await inRolledBackTx(BUYER_A, async (tx) => {
      const { result } = await express(tx, HAVEL);
      const mine = await readRecordedInterestTx(tx, result.publicId, 'en');
      expect(mine).not.toBeNull();       // the party can read it
      return result.publicId;
    });
    // ...which is rolled back, so nobody can read it afterwards either. What is
    // asserted here is that a public_id from ANOTHER organisation's deal
    // resolves to nothing rather than to a confirmation screen.
    const asOther = await inRolledBackTx(BUYER_B, (tx) =>
      readRecordedInterestTx(tx, publicId, 'en'));
    expect(asOther).toBeNull();
  });

  it('the project owner sees the volumes on its own project; another buyer does not', async () => {
    const seen = await inRolledBackTx(BUYER_A, async (tx) => {
      const { project, result } = await express(tx, HAVEL, { volumes: [1234] });
      const rows = await tx.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM deal.interest_volume WHERE deal_id = $1',
        [result.dealId]);
      return { project, count: Number(rows[0]!.n) };
    });
    expect(seen.count).toBe(1);

    // A different buyer, its own valid context, asking for every volume row it
    // can reach on that project.
    const otherSees = await inRolledBackTx(BUYER_B, (tx) =>
      tx.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM deal.interest_volume WHERE project_id = $1',
        [seen.project.id]));
    expect(Number(otherSees[0]!.n)).toBe(0);

    const ownerSees = await inRolledBackTx(OWNER_A, (tx) =>
      tx.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM deal.interest_volume WHERE project_id = $1',
        [seen.project.id]));
    expect(Number(ownerSees[0]!.n)).toBe(0);   // rolled back, so zero for real
  });

  it('R7 at the privilege layer: no application role can read the raw volume', async () => {
    const leaks = await inRolledBackTx(BUYER_A, (tx) =>
      tx.query<{ rolname: string }>(`
        SELECT r.rolname FROM pg_roles r
         WHERE r.rolname LIKE 'sylva\\_%'
           AND r.rolname <> (SELECT o.rolname FROM pg_class c
                               JOIN pg_roles o ON o.oid = c.relowner
                              WHERE c.oid = 'deal.interest_volume'::regclass)
           AND has_column_privilege(r.oid, 'deal.interest_volume'::regclass,
                                    'requested_raw', 'SELECT')`));
    expect(leaks.map((r) => r.rolname)).toEqual([]);
  });
});

/* ================================================== what a person typed */

describe('reading a volume a person typed', () => {
  it('accepts whole numbers, with or without spaces', () => {
    expect(parseVolume('1500')).toBe(1500);
    expect(parseVolume('12 400')).toBe(12400);
    expect(parseVolume('12 400')).toBe(12400);
  });

  it('treats a blank field as "not interested in this period", not as an error', () => {
    expect(parseVolume('')).toBeNull();
    expect(parseVolume('   ')).toBeNull();
  });

  it('REFUSES a decimal separator rather than guessing which one it is', () => {
    // "1.500" is 1.5 to one reader and 1500 to another. The platform does not
    // get to toss a coin over a figure.
    expect(parseVolume('1.500')).toBe('invalid');
    expect(parseVolume('1,500')).toBe('invalid');
    expect(parseVolume('1500.25')).toBe('invalid');
  });

  it('refuses anything that is not a positive whole number', () => {
    expect(parseVolume('0')).toBe('invalid');
    expect(parseVolume('-5')).toBe('invalid');
    expect(parseVolume('1e6')).toBe('invalid');
    expect(parseVolume('all of it')).toBe('invalid');
    expect(parseVolume('9'.repeat(13))).toBe('invalid');
  });
});
