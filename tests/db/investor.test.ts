import { afterAll, describe, expect, it } from 'vitest';
import {
  financingProjects, investorInterests, investorOrganisation, investorStanding,
} from '@/lib/investor/queries';
import { ANONYMOUS, type Actor } from '@/lib/db/actor';
import { readAs } from '@/lib/db/session';
import { closeAllPools } from '@/lib/db/pool';
import { INVESTOR_TEXT_KEYS } from '@/lib/investor/messages';
import { actorFor } from '../rls/principals';
import { ORG, PERSON } from '../rls/catalog';

/**
 * The investor workspace, against the real database, as the real roles.
 *
 * Four questions, in this order of importance:
 *
 *   1. Does the vetting gate hold - is financing information returned to an
 *      approved investor and to nobody else?
 *   2. Does an UNAPPROVED investor get an empty list rather than an error, so
 *      the page can say why instead of ending in a 500?
 *   3. Does any of it state a return, a yield, an IRR or a projection?
 *   4. Can an investor read another organisation's record?
 *
 * The first is enforced by the row-level policy on proj.project_financials, not
 * by the query, and these tests exist to prove that the query has not quietly
 * taken the decision over.
 */

const INVESTOR_A = actorFor('investorA');
const INVESTOR_B = actorFor('investorB');
const BUYER_A = actorFor('buyerA');
const OWNER_A = actorFor('ownerA');

/**
 * An organisation with NO investor approval, asked for as an investor.
 *
 * DEMO Unvetted Trading Ltd registered as a buyer and was never decided on, so
 * it holds no approval for any role. Serving it as sylva_investor is exactly
 * what the application does for an account whose platform role is investor and
 * whose organisation Sylva has not yet approved, and it is the state neither
 * demo investor account can show - both of those are approved.
 */
const UNAPPROVED_INVESTOR: Actor = {
  kind: 'member', role: 'investor', orgId: ORG.unvetted, personRef: PERSON.unvetted,
};

afterAll(async () => { await closeAllPools(); });

describe('the vetting gate on financing information', () => {
  it('returns the financing rows to an approved investor', async () => {
    const ps = await financingProjects(INVESTOR_A, 'en');
    expect(ps.length).toBe(2);
    expect(ps.map((p) => p.slug).sort()).toEqual([
      'demo-marais-de-briere-restoration',
      'demo-untere-havel-wetland-restoration',
    ]);
    for (const p of ps) {
      expect(p.financingNeed).toBeGreaterThan(0);
      expect(p.currency).toMatch(/^[A-Z]{3}$/);
      expect(p.revenueStreamsNote).toBeTruthy();
      // G: every figure carries its source and its date.
      expect(p.source.label).toBeTruthy();
      expect(p.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('returns NOTHING to an investor whose organisation is not approved', async () => {
    const ps = await financingProjects(UNAPPROVED_INVESTOR, 'en');
    // Empty, not an error: the page renders the reason, and a 42501 here would
    // have ended the request in a 500 instead.
    expect(ps).toEqual([]);
    const standing = await investorStanding(UNAPPROVED_INVESTOR);
    expect(standing.vettedInvestor).toBe(false);
  });

  it('the standing the page prints is the predicate the policy calls', async () => {
    for (const [actor, expected] of [
      [INVESTOR_A, true], [INVESTOR_B, true], [UNAPPROVED_INVESTOR, false],
    ] as const) {
      const standing = await investorStanding(actor);
      const row = await readAs(actor, (tx) =>
        tx.one<{ ok: boolean }>('SELECT sylva.is_vetted_investor() AS ok'));
      expect(standing.vettedInvestor).toBe(expected);
      expect(standing.vettedInvestor).toBe(row.ok);
      // And it agrees with the list the policy actually returned.
      const ps = await financingProjects(actor, 'en');
      expect(ps.length > 0).toBe(expected);
    }
  });

  it('is a GRANT, not only a policy: no other role can read the table at all',
    async () => {
      for (const actor of [BUYER_A, ANONYMOUS]) {
        await expect(
          readAs(actor, (tx) => tx.query('SELECT 1 FROM proj.project_financials')),
        ).rejects.toMatchObject({ code: '42501' });
      }
      // The project owner holds the grant, and its policy admits its OWN
      // projects only - so it is not a route to another project's figures.
      const own = await readAs(OWNER_A, (tx) =>
        tx.query<{ project_id: string }>('SELECT project_id FROM proj.project_financials'));
      expect(own.length).toBe(1);
      expect(own[0]!.project_id).toBe('a1000000-0000-0000-0000-000000000001');
    });
});

describe('what the investor area may never state', () => {
  it('has no column a return, a yield or an IRR could live in', async () => {
    // Read as the auditor's superset would be pointless here: the question is
    // about the SHAPE of the table, so ask the catalogue.
    const cols = await readAs(INVESTOR_A, (tx) =>
      tx.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'proj' AND table_name = 'project_financials'`));
    const names = cols.map((c) => c.column_name).join(' ');
    expect(names).not.toMatch(/return|yield|irr|npv|payback|discount|projection|forecast/i);
  });

  it('states no return in any sentence this area can render', () => {
    // Every sentence the area owns, swept for a claim about future performance.
    // The platform's own DENIALS are allowed to name what they deny, so the
    // sweep looks for the affirmative shapes only.
    const forbidden = [
      /\bexpected return\b/i, /\bprojected\b/i, /\bwe (?:expect|forecast|project)\b/i,
      /\binternal rate of return\b/i, /\breturn of \d/i, /\b\d+\s?% (?:return|yield|irr)\b/i,
      /\bguarantee[ds]?\b/i,
    ];
    for (const [key, sentence] of Object.entries(INVESTOR_TEXT_KEYS)) {
      for (const pattern of forbidden) {
        expect(sentence, key).not.toMatch(pattern);
      }
    }
  });

  it('RULE 7: no quantity of units appears in a financing row at all', async () => {
    const ps = await financingProjects(INVESTOR_A, 'en');
    for (const p of ps) {
      // The unit is carried as a NAME, which is what makes the two projects
      // visibly incomparable. There is no numeric unit field to add up.
      expect(typeof p.unitLabel).toBe('string');
      expect(Object.keys(p)).not.toContain('volume');
      expect(Object.keys(p)).not.toContain('units');
    }
    // The two projects issue different units, so no total over them could mean
    // anything - which is why the list carries none.
    expect(new Set(ps.map((p) => p.unitLabel)).size).toBe(2);
  });
});

describe('an investor reads its own record and no other', () => {
  it('reads its own legal name, which no column grant allows', async () => {
    const org = await investorOrganisation(INVESTOR_A, 'en');
    expect(org).not.toBeNull();
    expect(org!.orgId).toBe(ORG.investorA);
    expect(org!.legalName).toContain('Rheinbank');
  });

  it('gets its OWN row from the same argument-less function, not a shared one',
    async () => {
      const a = await investorOrganisation(INVESTOR_A, 'en');
      const b = await investorOrganisation(INVESTOR_B, 'en');
      expect(a!.orgId).toBe(ORG.investorA);
      expect(b!.orgId).toBe(ORG.investorB);
      expect(a!.legalName).not.toBe(b!.legalName);
    });

  it('cannot select another organisation from org.organisation directly', async () => {
    await expect(
      readAs(INVESTOR_A, (tx) => tx.query('SELECT legal_name FROM org.organisation')),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('sees only its own vetting submissions', async () => {
    const a = await investorStanding(INVESTOR_A);
    expect(a.submissions.length).toBeGreaterThan(0);
    for (const s of a.submissions) expect(s.roleCode).toBe('investor');
    // The approval in force comes from sylva.is_vetted(), not from the decision
    // text, so the two must agree for an approved organisation.
    expect(a.submissions.some((s) => s.approvedNow)).toBe(true);
  });

  it('has no interest entries, and the refusal is a missing INSERT not a filter',
    async () => {
      expect(await investorInterests(INVESTOR_A, 'en')).toEqual([]);
      // sylva_investor holds no privilege on deal.deal at all, which is why the
      // interests list is not joined to it - see the note on the query.
      await expect(
        readAs(INVESTOR_A, (tx) => tx.query('SELECT 1 FROM deal.deal')),
      ).rejects.toMatchObject({ code: '42501' });
    });
});

describe('the financing list serves German without hiding a project', () => {
  it('translates the project title and says when it could not', async () => {
    const de = await financingProjects(INVESTOR_A, 'de');
    expect(de.length).toBe(2);
    for (const p of de) {
      expect(p.title).toBeTruthy();
      // A title that fell back to English is flagged rather than passed off as
      // a translation.
      expect(typeof p.titleIsFallback).toBe('boolean');
    }
    expect(de.some((p) => p.title.includes('Renaturierung'))).toBe(true);
  });
});
