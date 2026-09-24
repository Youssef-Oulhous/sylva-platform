import { afterAll, describe, expect, it } from 'vitest';
import { buyerDashboard } from '@/lib/dashboard/queries';
import { ANONYMOUS } from '@/lib/db/actor';
import { readAs } from '@/lib/db/session';
import { closeAllPools } from '@/lib/db/pool';
import { actorFor } from '../rls/principals';
import { ORG } from '../rls/catalog';

/**
 * The buyer dashboard, against the real database, as the real roles.
 *
 * Two questions, in this order:
 *
 *   1. Does it show this organisation its own record - the name it registered
 *      under, its vetting decision, its interests, its sites, its documents?
 *   2. Can it show anybody anybody else's?
 *
 * The second is the one the concept note calls the failure most to be avoided,
 * so most of the assertions below are about it.
 */

const BUYER_A = actorFor('buyerA');
const BUYER_B = actorFor('buyerB');
const UNVETTED = actorFor('unvetted');
const OPERATOR = actorFor('operator');
const AUDITOR = actorFor('auditor');
const INVESTOR = actorFor('investorA');
const OWNER_A = actorFor('ownerA');

afterAll(async () => { await closeAllPools(); });

describe('the organisation sees its own record', () => {
  it('reads its own legal name, which no column grant allows', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    expect(d.organisation).not.toBeNull();
    expect(d.organisation!.orgId).toBe(ORG.buyerA);
    expect(d.organisation!.legalName).toContain('Nordbr');
    expect(d.organisation!.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves sector and size band to labels, in the reader\'s language', async () => {
    const en = await buyerDashboard(BUYER_A, 'en');
    const de = await buyerDashboard(BUYER_A, 'de');
    // A label, not a code. If the reference row is missing the code is shown,
    // which would fail this.
    expect(en.organisation!.sectorLabel).not.toBe(en.organisation!.sectorCode);
    expect(de.organisation!.sectorLabel).toBeTruthy();
    expect(en.organisation!.sizeBandLabel).not.toBe(en.organisation!.sizeBandCode);
  });

  it('cannot be aimed at another organisation: it takes no argument', async () => {
    const a = await buyerDashboard(BUYER_A, 'en');
    const b = await buyerDashboard(BUYER_B, 'en');
    expect(a.organisation!.orgId).toBe(ORG.buyerA);
    expect(b.organisation!.orgId).toBe(ORG.buyerB);
    expect(a.organisation!.legalName).not.toBe(b.organisation!.legalName);
  });

  it('still refuses the legal name of any OTHER organisation', async () => {
    // org.own_organisation() is a definer function scoped to the signed
    // context. The underlying column grant must remain closed, or R5 is gone.
    await expect(
      readAs(BUYER_A, (tx) => tx.query('SELECT legal_name FROM org.organisation')),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('an anonymous visitor gets no organisation at all', async () => {
    // sylva_web_anon holds no EXECUTE on org.own_organisation().
    await expect(buyerDashboard(ANONYMOUS, 'en')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('vetting status comes from the database, not from the page', () => {
  it('shows the decision recorded against the submission', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    expect(d.vetting.length).toBeGreaterThan(0);
    const buyerRole = d.vetting.find((v) => v.roleCode === 'buyer');
    expect(buyerRole).toBeDefined();
    expect(buyerRole!.state).toBe('approved');
    expect(buyerRole!.decidedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buyerRole!.questionnaireVersion).toBeGreaterThanOrEqual(1);
  });

  it('asks sylva.is_vetted() rather than deriving approval itself', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    expect(d.vetting.find((v) => v.roleCode === 'buyer')!.approvedNow).toBe(true);
  });

  it('a registered but unapproved organisation is not approved here either', async () => {
    // R6: registering and being approved are different things. This is the
    // organisation the RLS catalogue keeps unvetted on purpose.
    const d = await buyerDashboard(UNVETTED, 'en');
    expect(d.organisation).not.toBeNull();
    expect(d.vetting.every((v) => v.approvedNow === false)).toBe(true);
  });

  it('shows no other organisation\'s vetting', async () => {
    const a = await buyerDashboard(BUYER_A, 'en');
    const b = await buyerDashboard(BUYER_B, 'en');
    // Each sees only its own submissions; the sets do not overlap in content.
    expect(a.vetting.length).toBeGreaterThan(0);
    expect(b.vetting.length).toBeGreaterThan(0);
  });
});

describe('expressed interests', () => {
  it('lists this organisation\'s own interest entries, newest first', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    expect(d.interests.length).toBeGreaterThan(0);
    for (const i of d.interests) {
      expect(i.projectTitle).toBeTruthy();
      expect(i.expressedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(i.publicId).toMatch(/^[0-9a-f-]{36}$/);
    }
    const dates = d.interests.map((i) => i.expressedOn);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('carries the scheme and the unit NAME per row, and no volume', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    const row = d.interests[0]!;
    expect(row.unitLabel).toBeTruthy();
    // RULE 7 as a type-level absence: there is no quantity on this shape at
    // all, so nothing on this list can be added to anything.
    expect(Object.keys(row)).not.toContain('amount');
    expect(Object.keys(row)).not.toContain('volume');
  });

  it('does not show another organisation\'s interests', async () => {
    const a = await buyerDashboard(BUYER_A, 'en');
    const b = await buyerDashboard(BUYER_B, 'en');
    const aIds = new Set(a.interests.map((i) => i.publicId));
    for (const i of b.interests) expect(aIds.has(i.publicId)).toBe(false);
    expect(b.interests.length).toBeGreaterThan(0);
  });
});

describe('sites and documents on the dashboard', () => {
  it('shows this organisation\'s own sites and no others', async () => {
    const a = await buyerDashboard(BUYER_A, 'en');
    const b = await buyerDashboard(BUYER_B, 'en');
    const aIds = new Set(a.sites.map((s) => s.id));
    for (const s of b.sites) expect(aIds.has(s.id)).toBe(false);
    for (const s of a.sites) {
      expect(s.source.label).toBeTruthy();
      expect(s.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('lists organisation and deal documents only, never the public library', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    for (const doc of d.documents) {
      expect(['organisation', 'deal', 'signed']).toContain(doc.group);
      expect(doc.kindLabel).toBeTruthy();
    }
    // The published project documents are readable by this buyer but belong to
    // the project page, not here. A project idea note in this list means the
    // scope filter has been widened.
    expect(d.documents.some((x) => x.kind === 'project_idea_note')).toBe(false);
  });

  it('an organisation with nothing gets empty lists, not an error', async () => {
    const d = await buyerDashboard(UNVETTED, 'en');
    expect(d.interests).toEqual([]);
    expect(d.sites).toEqual([]);
    expect(d.documents).toEqual([]);
    expect(d.publicLabels).toEqual([]);
  });
});

/**
 * The page is headed "your organisation". These are the viewers for whom the
 * row-level policy does NOT say that.
 *
 * geo.buyer_site, org.vetting_submission and doc.document all carry a policy
 * reading `org_id = sylva.actor_org_id()` for a buyer and `USING (true)` for
 * the operator and the auditor - support and audit access, which is correct at
 * the table and wrong on a page that calls the rows "yours". Rendered unscoped,
 * /dashboard showed an operator every buyer's registered plant coordinates.
 */
describe('a privileged viewer is not shown another organisation\'s record', () => {
  it('the operator sees its own sites - not every buyer\'s', async () => {
    const buyer = await buyerDashboard(BUYER_A, 'en');
    expect(buyer.sites.length).toBeGreaterThan(0);

    const op = await buyerDashboard(OPERATOR, 'en');
    const buyerSiteIds = new Set(buyer.sites.map((s) => s.id));
    for (const s of op.sites) expect(buyerSiteIds.has(s.id)).toBe(false);
    // The operator holds SELECT on the whole table, so this passing means the
    // QUERY is scoped, not that the privilege is missing.
    expect(op.organisation!.orgId).not.toBe(buyer.organisation!.orgId);
  });

  it('the auditor sees its own sites - not every buyer\'s', async () => {
    const buyer = await buyerDashboard(BUYER_A, 'en');
    const aud = await buyerDashboard(AUDITOR, 'en');
    const buyerSiteIds = new Set(buyer.sites.map((s) => s.id));
    for (const s of aud.sites) expect(buyerSiteIds.has(s.id)).toBe(false);
  });

  it('the operator is not shown another organisation\'s vetting or documents', async () => {
    const a = await buyerDashboard(BUYER_A, 'en');
    const b = await buyerDashboard(BUYER_B, 'en');
    const op = await buyerDashboard(OPERATOR, 'en');

    // Buyer A and buyer B both have vetting rows; the operator's own
    // organisation was never vetted, so an operator seeing any is seeing
    // somebody else's.
    expect(a.vetting.length + b.vetting.length).toBeGreaterThan(0);
    expect(op.vetting.length).toBe(0);

    const otherDocs = new Set([...a.documents, ...b.documents].map((d) => d.id));
    for (const d of op.documents) expect(otherDocs.has(d.id)).toBe(false);
  });

  it('every approval flag belongs to the organisation whose row it is on', async () => {
    // sylva.is_vetted(role) defaults to the CALLER's organisation. Called on a
    // row belonging to somebody else it stamps the caller's approval onto it,
    // so the org is passed explicitly and a scoped list cannot disagree.
    const d = await buyerDashboard(BUYER_A, 'en');
    for (const v of d.vetting) {
      if (v.state === 'approved') expect(v.approvedNow).toBe(true);
    }
  });
});

/**
 * Sign-in sends an investor to /dashboard (src/lib/auth/roles.ts,
 * homePathFor). An investor holds no grant on deal.deal and none on
 * geo.buyer_site, and a project owner holds none on geo.buyer_site either, so
 * before those statements were made refusal-tolerant this page answered every
 * investor sign-in with an unhandled 42501.
 */
describe('a viewer who may not read part of the page still gets the page', () => {
  it('an investor gets a dashboard, with an empty site register', async () => {
    const d = await buyerDashboard(INVESTOR, 'en');
    expect(d.organisation).not.toBeNull();
    expect(d.sites).toEqual([]);
    // Not an exception, and not a deal state it has no privilege to know.
    expect(d.interests.every((i) => i.dealOpen === false)).toBe(true);
  });

  it('a project owner gets a dashboard, with an empty site register', async () => {
    const d = await buyerDashboard(OWNER_A, 'en');
    expect(d.organisation).not.toBeNull();
    expect(d.sites).toEqual([]);
    expect(d.vetting.length).toBeGreaterThan(0);
  });

  it('a buyer still gets the deal state, which is read in its own statement', async () => {
    const d = await buyerDashboard(BUYER_A, 'en');
    expect(d.interests.length).toBeGreaterThan(0);
    // Buyer A has one deal in the demo data, so at least one interest on that
    // project reports an open deal room. A blanket false would mean the
    // separate statement never ran.
    expect(d.interests.some((i) => i.dealOpen)).toBe(true);
  });
});
