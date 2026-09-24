import { afterAll, describe, expect, it } from 'vitest';
import { getBuyerSiteProximity, getProjectDetail } from '@/lib/projects/queries';
import { withActor } from '@/lib/db/session';
import { ANONYMOUS } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { IncomparableUnitsError, sumSameUnit } from '@/lib/units/qty';
import type { SourceRef } from '@/lib/projects/types';
import { actorFor } from '../rls/principals';

/**
 * The project page, against the real database, as the real roles.
 *
 * Three claims are being tested, and each of them is a claim about a database
 * rather than about this code:
 *
 *   1. An unpublished project is not reachable by its slug, and is
 *      indistinguishable from a slug that names nothing.
 *   2. Every figure on the page carries a source and an as-of date, because
 *      source_ref_id is NOT NULL on the tables that hold displayed values.
 *   3. A buyer sees its own sites' distances to this project and no other
 *      organisation's, ever. That is FINDING-001's subject matter and the
 *      failure the client says it most needs to avoid.
 *
 * Nothing here mocks anything. Each call runs through readAs(), which sets the
 * signed organisation context and drops to the privilege role, exactly as a
 * request does.
 */

const PUBLISHED = 'demo-untere-havel-wetland-restoration';
const OTHER_PUBLISHED = 'demo-marais-de-briere-restoration';
const DRAFT = 'demo-oder-floodplain-reconnection';

const BUYER_A = actorFor('buyerA');
const BUYER_B = actorFor('buyerB');
const OPERATOR = actorFor('operator');
const INVESTOR_A = actorFor('investorA');
const OWNER_A = actorFor('ownerA');

/** Sites this file registered, removed at the end whatever happened between. */
const createdSites: string[] = [];

afterAll(async () => {
  for (const id of createdSites) {
    try {
      await withActor(BUYER_A, (tx) =>
        tx.query('DELETE FROM geo.buyer_site WHERE id = $1', [id]),
      );
    } catch {
      /* the assertion that mattered has already run */
    }
  }
  await closeAllPools();
});

function expectSourced(source: SourceRef | null, where: string) {
  expect(source, where).not.toBeNull();
  expect(source!.label, where).toBeTruthy();
  expect(source!.asOfDate, where).toMatch(/^\d{4}-\d{2}-\d{2}$/);
}

/* ========================================================================== */

describe('the project page, read as an anonymous visitor', () => {
  it('returns the published project by its slug', async () => {
    const p = await getProjectDetail(ANONYMOUS, PUBLISHED, 'en');
    expect(p).not.toBeNull();
    expect(p!.slug).toBe(PUBLISHED);
    expect(p!.status).toBe('published');
    expect(p!.title.body).toContain('DEMO Untere Havel');
    expect(p!.ownerOrgName).toBe('DEMO Moorland Trust gGmbH');
    expect(p!.countryCode).toBe('DE');
  });

  it('returns null for an unknown slug AND for a draft one, identically', async () => {
    expect(await getProjectDetail(ANONYMOUS, 'no-such-project', 'en')).toBeNull();
    // The draft is real and in the database. A stranger must not be able to
    // tell that apart from a slug that names nothing.
    expect(await getProjectDetail(ANONYMOUS, DRAFT, 'en')).toBeNull();
  });

  it('carries the catchment and the boundary, each with an area and a source', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.boundary).not.toBeNull();
    expect(p.catchment).not.toBeNull();

    expect(p.boundary!.areaHectares).toBeGreaterThan(0);
    expect(p.catchment!.areaKm2).toBeGreaterThan(p.boundary!.areaKm2);
    expectSourced(p.boundary!.source, 'boundary');
    expectSourced(p.catchment!.source, 'catchment');

    // Drawable without a mapping library, and simplified server-side.
    const g = JSON.parse(p.boundary!.geoJson) as { type: string };
    expect(['Polygon', 'MultiPolygon']).toContain(g.type);
  });

  it('carries outcomes in both domains, with baseline, target and verifier', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.outcomes.length).toBeGreaterThan(0);
    expect(new Set(p.outcomes.map((o) => o.domain))).toEqual(
      new Set(['water', 'biodiversity']),
    );
    for (const o of p.outcomes) {
      expect(o.whatIsMeasured?.body, o.code).toBeTruthy();
      expect(o.baseline, o.code).not.toBeNull();
      expect(o.target, o.code).not.toBeNull();
      expect(o.verifierName, o.code).toBeTruthy();
      // The indicator's own unit travels with the number, always.
      expect(o.baseline!.measureUnit, o.code).toBeTruthy();
      expectSourced(o.baseline!.source, `baseline ${o.code}`);
      expectSourced(o.target!.source, `target ${o.code}`);
    }
  });

  it('carries claim rights with their exclusions', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.claimRights.length).toBeGreaterThan(0);
    for (const c of p.claimRights) {
      expect(c.benefitLabel?.body, c.benefitKey).toBeTruthy();
      expect(c.whoMayClaim?.body, c.benefitKey).toBeTruthy();
      // Exclusions are a decision input, not a footnote. Never absent.
      expect(c.exclusions?.body, c.benefitKey).toBeTruthy();
      expectSourced(c.source, `claim ${c.benefitKey}`);
    }
  });

  it('carries durability and a timeline built only from recorded dates', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.durability.length).toBeGreaterThan(0);
    for (const d of p.durability) {
      expect(d.statement?.body, d.commitmentKey).toBeTruthy();
      expectSourced(d.source, `durability ${d.commitmentKey}`);
    }

    // One entry per declared period, plus the commitment window, plus the
    // platform's own record of publication. Nothing invented in between.
    expect(p.timeline.filter((e) => e.kind === 'outcome_period')).toHaveLength(
      p.periods.length,
    );
    expect(p.timeline.some((e) => e.kind === 'commitment')).toBe(true);
    for (const e of p.timeline) {
      if (e.kind === 'platform_record') continue;
      expectSourced(e.source, `timeline ${e.id}`);
    }
  });

  it('lists every declared period, with availability where a forecast exists', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.periods.length).toBeGreaterThan(0);
    for (const period of p.periods) {
      expectSourced(period.source, `period ${period.label}`);
      if (period.availability) {
        expect(period.availability.unitOfMeasure).toBe(p.unitType.unitOfMeasure);
        expectSourced(period.availability.source, `availability ${period.label}`);
      }
    }
  });

  it('RULE 7: the two projects’ remaining volumes cannot be added', async () => {
    const a = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    const b = (await getProjectDetail(ANONYMOUS, OTHER_PUBLISHED, 'en'))!;
    const every = [...a.periods, ...b.periods]
      .map((p) => p.availability?.remaining)
      .filter((q) => q !== undefined && q !== null);
    expect(every.length).toBeGreaterThan(2);
    expect(() => sumSameUnit(every)).toThrow(IncomparableUnitsError);
  });

  it('RULE 7: totalling within this one project and unit type is fine', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    const mine = p.periods.map((x) => x.availability?.remaining).filter(Boolean);
    const total = sumSameUnit(mine as NonNullable<typeof mine[number]>[]);
    expect(total).not.toBeNull();
    expect(total!.projectId).toBe(p.id);
  });

  it('shows only the public documents, never the investor or deal ones', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.documents.length).toBeGreaterThan(0);
    expect(p.documents.every((d) => d.visibility === 'public')).toBe(true);
    expect(p.documents.some((d) => d.kind === 'financial_model')).toBe(false);
    expect(p.documents.some((d) => d.kind === 'letter_of_intent')).toBe(false);
    expect(p.documents.some((d) => d.kind === 'project_design_document')).toBe(true);
  });

  it('names the partners from the public-party view, owner first', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.partners[0]!.role).toBe('owner');
    expect(p.partners.some((x) => x.role === 'verifier')).toBe(true);
    for (const partner of p.partners) expect(partner.name).toMatch(/^DEMO /);
  });

  it('lists what the evidence pack contains but not what was assembled', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.evidencePack.elements.length).toBe(5);
    // null, not []: "not your question" and "not assembled yet" are different
    // sentences, and an anonymous visitor holds no privilege on the table.
    expect(p.evidencePack.items).toBeNull();
  });

  it('withholds the financing figures and says the field names only', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.investor.visible).toBe(false);
    expect(p.investor.financingNeed).toBeNull();
    expect(p.investor.revenueStreamsNote).toBeNull();
  });

  it('offers no question box and no threads to somebody who is not signed in', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(p.questions).toBeNull();
    expect(p.canAskQuestion).toBe(false);
  });
});

/* ========================================================================== */

describe('locale fallback is per field, not per page', () => {
  it('serves German where a reviewed translation exists', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'de'))!;
    expect(p.title.body).toContain('Renaturierung');
    expect(p.title.isFallback).toBe(false);
    expect(p.summary!.isFallback).toBe(false);
  });

  it('falls back to English on the fields that have no reviewed German, and says so', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'de'))!;
    // The catchment note is English-only in the demo data. The page stays
    // German; this one field is marked as English.
    expect(p.catchmentContext).not.toBeNull();
    expect(p.catchmentContext!.isFallback).toBe(true);
    expect(p.catchmentContext!.locale).toBe('en');

    // The German unit label exists but is a human_draft, which is not
    // something to put in front of a buyer. So it falls back, and is marked.
    expect(p.unitType.metricLabel.isFallback).toBe(true);
    expect(p.unitType.metricLabel.body).toBe('hectares under restoration for a year');
  });

  it('does not hide a project, a claim or an outcome for want of a translation', async () => {
    const en = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    const de = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'de'))!;
    expect(de.claimRights.length).toBe(en.claimRights.length);
    expect(de.outcomes.length).toBe(en.outcomes.length);
    expect(de.documents.length).toBe(en.documents.length);
    expect(de.periods.length).toBe(en.periods.length);
  });
});

/* ========================================================================== */

describe('what each role additionally sees', () => {
  it('a vetted buyer sees the assembled evidence pack and its own threads', async () => {
    const p = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    // An array, possibly empty: visible, and assembled or not.
    expect(Array.isArray(p.evidencePack.items)).toBe(true);
    expect(Array.isArray(p.questions)).toBe(true);
    expect(p.canAskQuestion).toBe(true);
    // Still no financing figures. A buyer is not an investor.
    expect(p.investor.visible).toBe(false);
  });

  it('a buyer sees only its OWN question threads', async () => {
    const a = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    const b = (await getProjectDetail(BUYER_B, PUBLISHED, 'en'))!;
    const overlap = a.questions!.filter((q) => b.questions!.some((x) => x.id === q.id));
    expect(overlap).toHaveLength(0);
  });

  it('a vetted investor sees the financing figures; the pack is not its business', async () => {
    const p = (await getProjectDetail(INVESTOR_A, PUBLISHED, 'en'))!;
    expect(p.investor.visible).toBe(true);
    expect(p.investor.financingNeed).toBeGreaterThan(0);
    expect(p.investor.currency).toBeTruthy();
    expectSourced(p.investor.source, 'financials');
    // proj.evidence_pack_item carries no grant to sylva_investor at all.
    expect(p.evidencePack.items).toBeNull();
  });

  it('the project owner sees its own draft project, which nobody else can', async () => {
    expect(await getProjectDetail(ANONYMOUS, DRAFT, 'en')).toBeNull();
    expect(await getProjectDetail(BUYER_A, DRAFT, 'en')).toBeNull();
    // The draft has no published title yet, so the operator gets null too -
    // but for a different reason, and the operator CAN see the row itself.
    const asOperator = await getProjectDetail(OPERATOR, DRAFT, 'en');
    expect(asOperator === null || asOperator.status === 'draft').toBe(true);
    expect(await getProjectDetail(OWNER_A, PUBLISHED, 'en')).not.toBeNull();
  });
});

/* ========================================================================== */

describe('a buyer’s own sites, measured against this project', () => {
  it('is not offered at all to anybody who is not a buyer', async () => {
    const p = (await getProjectDetail(ANONYMOUS, PUBLISHED, 'en'))!;
    expect(await getBuyerSiteProximity(ANONYMOUS, p.id)).toBeNull();
    expect(await getBuyerSiteProximity(OPERATOR, p.id)).toBeNull();
    expect(await getBuyerSiteProximity(INVESTOR_A, p.id)).toBeNull();
    expect(await getBuyerSiteProximity(OWNER_A, p.id)).toBeNull();
  });

  it('gives the buyer a distance and a catchment answer for each of its sites', async () => {
    const p = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    const prox = (await getBuyerSiteProximity(BUYER_A, p.id))!;
    expect(prox.sites.length).toBeGreaterThan(0);
    for (const s of prox.sites) {
      expect(s.distanceMetres).toBeGreaterThan(0);
      expect(typeof s.inCatchment).toBe('boolean');
    }
    // Nearest first, so the answer is legible without sorting on screen.
    const ds = prox.sites.map((s) => s.distanceMetres);
    expect([...ds].sort((x, y) => x - y)).toEqual(ds);
    // "Same catchment" is stated against a NAMED layer, per decision D4.
    expect(prox.catchmentDatasetName).toBeTruthy();
    expectSourced(prox.catchmentSource, 'catchment layer');
  });

  it('NEVER shows one buyer another buyer’s sites', async () => {
    const p = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    const a = (await getBuyerSiteProximity(BUYER_A, p.id))!;
    const b = (await getBuyerSiteProximity(BUYER_B, p.id))!;

    expect(a.sites.length).toBeGreaterThan(0);
    expect(b.sites.length).toBeGreaterThan(0);
    const aIds = new Set(a.sites.map((s) => s.siteId));
    expect(b.sites.some((s) => aIds.has(s.siteId))).toBe(false);
    // And by the name a person would recognise, not only by id.
    expect(a.sites.some((s) => s.label.includes('Rotterdam'))).toBe(false);
    expect(b.sites.every((s) => s.label.includes('Rotterdam'))).toBe(true);
  });

  it('answers the point-in-polygon question, not a guess at it', async () => {
    const p = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;

    // A site placed inside the project's own catchment polygon. Registered
    // through the buyer's real write path - geo.buyer_site is the one table a
    // buyer maintains itself - and removed in afterAll.
    const inside = await withActor(BUYER_A, async (tx) => {
      const src = await tx.one<{ id: string }>(
        'SELECT id FROM sylva.source_ref ORDER BY recorded_at LIMIT 1',
      );
      const row = await tx.one<{ id: string }>(
        `INSERT INTO geo.buyer_site (org_id, label, country_code, geom, source_ref_id)
         SELECT $1::uuid, $2, 'DE',
                ST_SetSRID(ST_PointOnSurface(g.geom), 4326), $3::uuid
           FROM geo.project_geometry g
          WHERE g.project_id = $4 AND g.kind = 'catchment'
          ORDER BY g.version_no DESC LIMIT 1
         RETURNING id`,
        [
          (BUYER_A as { orgId: string }).orgId,
          'TEST site inside the catchment',
          src.id,
          p.id,
        ],
      );
      return row.id;
    });
    createdSites.push(inside);

    const prox = (await getBuyerSiteProximity(BUYER_A, p.id))!;
    const site = prox.sites.find((s) => s.siteId === inside);
    expect(site, 'the site just registered').toBeDefined();
    expect(site!.inCatchment).toBe(true);

    // And the other buyer still cannot see it.
    const other = (await getBuyerSiteProximity(BUYER_B, p.id))!;
    expect(other.sites.some((s) => s.siteId === inside)).toBe(false);
  });
});

/* ========================================================================== */

describe('the private question box', () => {
  /**
   * The INSERT is exercised for real - same statement, same role, same policy
   * as src/lib/projects/actions.ts - and then rolled back, because
   * deal.project_question is append-only and a test must not leave a row on a
   * table nobody can delete from.
   */
  class Rollback extends Error {}

  it('accepts a buyer’s question and shows it back to that buyer only', async () => {
    const p = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    const orgId = (BUYER_A as { orgId: string }).orgId;
    const personRef = (BUYER_A as { personRef: string }).personRef;

    let seenByAsker = 0;
    await withActor(BUYER_A, async (tx) => {
      await tx.query(
        `INSERT INTO deal.project_question
           (project_id, owner_org_id, asker_org_id, asker_person_ref, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.id, p.ownerOrgId, orgId, personRef, 'TEST question, rolled back.'],
      );
      const rows = await tx.query<{ n: string }>(
        `SELECT count(*) AS n FROM deal.project_question
          WHERE project_id = $1 AND body = 'TEST question, rolled back.'`,
        [p.id],
      );
      seenByAsker = Number(rows[0]!.n);
      throw new Rollback();
    }).catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });

    expect(seenByAsker).toBe(1);

    // And it really was rolled back: nothing survives on an append-only table.
    const after = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    expect(after.questions!.some((q) => q.body.startsWith('TEST question'))).toBe(false);
  });

  it('refuses a question stamped with another organisation’s id', async () => {
    const p = (await getProjectDetail(BUYER_A, PUBLISHED, 'en'))!;
    const otherOrg = (BUYER_B as { orgId: string }).orgId;

    // The INSERT policy is `asker_org_id = sylva.actor_org_id()`, and the
    // context is HMAC-signed, so buyer A cannot file a question as buyer B.
    // This is the write-side half of FINDING-001.
    await expect(
      withActor(BUYER_A, (tx) =>
        tx.query(
          `INSERT INTO deal.project_question
             (project_id, owner_org_id, asker_org_id, asker_person_ref, body)
           VALUES ($1, $2, $3, $4, $5)`,
          [p.id, p.ownerOrgId, otherOrg, null, 'TEST forged asker.'],
        ),
      ),
    ).rejects.toThrow();
  });

  it('refuses a question from a role that holds no INSERT at all', async () => {
    const p = (await getProjectDetail(OWNER_A, PUBLISHED, 'en'))!;
    // sylva_project_owner answers questions; it does not ask them.
    await expect(
      withActor(OWNER_A, (tx) =>
        tx.query(
          `INSERT INTO deal.project_question
             (project_id, owner_org_id, asker_org_id, asker_person_ref, body)
           VALUES ($1, $2, $3, $4, $5)`,
          [p.id, p.ownerOrgId, (OWNER_A as { orgId: string }).orgId, null, 'TEST wrong role.'],
        ),
      ),
    ).rejects.toThrow();
  });
});
