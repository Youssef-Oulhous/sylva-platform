import { afterAll, describe, expect, it } from 'vitest';
import { ANONYMOUS, type Actor } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { readAs } from '@/lib/db/session';
import { ERROR, recordErrorLabel } from '@/lib/record/labels';
import { parseRecordParams, recordHref } from '@/lib/record/params';
import {
  readRecordExtract,
  readRecordFilterOptions,
} from '@/lib/record/queries';
import type { RecordEntry } from '@/lib/record/types';
import { inRolledBackTransaction, refusalOf } from './rollback';

afterAll(async () => { await closeAllPools(); });

/**
 * The public transaction record, read the way the page reads it.
 *
 * The test that matters most here is the last one in the first block: an
 * anonymous visitor must not be able to reach a real organisation name for a
 * deal that was not disclosed. Everything else on this page is presentation;
 * that one is the product's promise.
 *
 * The data is db/seed/0007_demo_public_record.sql. It is built so that the
 * three cases that can go wrong are all present: a buyer that is never named,
 * a buyer that chose to be named part-way through its deal, and one
 * organisation holding two deals that must not be linkable to each other.
 */

const OPERATOR: Actor = {
  kind: 'operator',
  orgId: '10000000-0000-0000-0000-000000000010',
  personRef: 'b0000000-0000-0000-0000-0000000000b7',
};

/** DEMO Nordbräu AG. Holds the Untere Havel deal it later disclosed. */
const BUYER_A: Actor = {
  kind: 'member', role: 'buyer',
  orgId: '0c000000-0000-0000-0000-00000000000c',
  personRef: 'b0000000-0000-0000-0000-0000000000b3',
};
/** DEMO Verdant Foods NV. Two deals, neither disclosed. */
const BUYER_B: Actor = {
  kind: 'member', role: 'buyer',
  orgId: '0d000000-0000-0000-0000-00000000000d',
  personRef: 'b0000000-0000-0000-0000-0000000000b4',
};

/** Every entry in the record, as `actor` sees it. */
async function allAs(actor: Actor): Promise<RecordEntry[]> {
  const out: RecordEntry[] = [];
  for (let page = 1; ; page++) {
    const x = await readRecordExtract(actor, {
      locale: 'en', projectSlug: null, eventType: null, page, pageSize: 200,
    });
    out.push(...x.entries);
    if (page >= x.pageCount) break;
  }
  return out;
}

/** Every entry in the record, as the anonymous visitor sees it. */
function allAsAnonymous(): Promise<RecordEntry[]> {
  return allAs(ANONYMOUS);
}

/** Every string an entry puts on the page, so a leak cannot hide in a corner. */
function textOf(e: RecordEntry): string {
  return [
    e.counterpartyLabel, e.projectTitle, e.projectSlug, e.entryType,
    e.entryLabelEn, e.sectorLabel, e.sizeBandLabel, e.correctionReason,
  ].filter(Boolean).join(' | ');
}

const HAVEL = 'demo-untere-havel-wetland-restoration';
const BRIERE = 'demo-marais-de-briere-restoration';
/** DEMO Verdant Foods NV holds two deals and disclosed neither. */
const NEVER_DISCLOSED_BUYER = 'DEMO Verdant Foods NV';
/** DEMO Nordbräu AG disclosed its Untere Havel deal on 13 September 2026. */
const DISCLOSED_BUYER = 'DEMO Nordbräu AG';
const DISCLOSED_ON = Date.parse('2026-09-13T09:00:00+02:00');

describe('the public record, read as an anonymous visitor', () => {
  it('returns entries, with a source and a date on every one of them', async () => {
    const all = await allAsAnonymous();
    expect(all.length).toBeGreaterThan(0);
    for (const e of all) {
      expect(e.publicId).toMatch(/^[0-9a-f-]{36}$/);
      expect(e.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(e.projectSlug).toBeTruthy();
      expect(e.entryType).toBeTruthy();
    }
  });

  it('carries no volume and no price - rule 7 has no surface here', async () => {
    const all = await allAsAnonymous();
    const fields = new Set(all.flatMap((e) => Object.keys(e)));
    for (const f of fields) {
      expect(f).not.toMatch(/amount|volume|price|qty|quantity|units?$/i);
    }
  });

  it('shows the project owner by name: it is named on its own project page', async () => {
    const all = await allAsAnonymous();
    const listed = all.filter((e) => e.entryType === 'listed');
    expect(listed.length).toBeGreaterThan(0);
    for (const e of listed) {
      expect(e.counterpartyKind).toBe('owner');
      expect(e.counterpartyLabel).toMatch(/^DEMO /);
    }
  });

  it('shows a pseudonymous buyer as a label and nothing else', async () => {
    const all = await allAsAnonymous();
    const labelled = all.filter((e) => e.counterpartyKind === 'label');
    expect(labelled.length).toBeGreaterThan(0);
    for (const e of labelled) {
      // "Buyer 004" and nothing that could be a name.
      expect(e.counterpartyLabel).toMatch(/^Buyer \d{3}$/);
    }
  });

  /**
   * THE ONE THAT MATTERS.
   *
   * DEMO Verdant Foods NV has a deal on each published project and has never
   * filed a disclosure decision for either. Its legal name must appear nowhere
   * in anything this route returns - not in the counterparty column, not in a
   * project title, not in a correction reason.
   */
  it('never reveals the name of a buyer whose deal was not disclosed', async () => {
    const all = await allAsAnonymous();
    expect(all.length).toBeGreaterThan(0);

    for (const e of all) {
      expect(textOf(e)).not.toContain(NEVER_DISCLOSED_BUYER);
      expect(textOf(e)).not.toContain('Verdant');
    }

    // And it is genuinely in the record: the assertion above would pass
    // vacuously if this organisation had no entries at all.
    const itsDeals = await readAs(OPERATOR, (tx) =>
      tx.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM record.entry e
          WHERE e.deal_buyer_org_id = '0d000000-0000-0000-0000-00000000000d'::uuid`,
      ),
    );
    expect(Number(itsDeals[0]!.n)).toBeGreaterThan(0);
  });

  /**
   * The same organisation, two deals. R5 says naming is the buyer's choice
   * "deal by deal", so the two must not carry one label - that is what
   * migration 0075 fixed and this is what would catch it coming back.
   */
  it('gives one organisation a different label on each of its deals', async () => {
    const all = await allAsAnonymous();

    const labelsByDeal = await readAs(OPERATOR, (tx) =>
      tx.query<{ deal_id: string; label: string }>(
        `SELECT dp.deal_id::text, dp.label FROM deal.deal_pseudonym dp
          WHERE dp.org_id = '0d000000-0000-0000-0000-00000000000d'::uuid`,
      ),
    );
    expect(labelsByDeal.length).toBeGreaterThanOrEqual(2);

    const distinct = new Set(labelsByDeal.map((r) => r.label));
    expect(distinct.size).toBe(labelsByDeal.length);

    // Each of those labels is what the public actually sees for that deal.
    const publicLabels = new Set(
      all.filter((e) => e.counterpartyKind === 'label').map((e) => e.counterpartyLabel),
    );
    for (const r of labelsByDeal) {
      expect(publicLabels.has(r.label)).toBe(true);
    }
  });

  /**
   * Disclosure applies forward only. The entries made before the decision keep
   * the label they were published with; nothing already published is rewritten.
   * That is R4 and it is why the view resolves identity as at each entry's own
   * timestamp rather than as at now().
   */
  it('names a disclosed buyer only on entries after the disclosure decision', async () => {
    const all = await allAsAnonymous();
    const named = all.filter((e) => e.counterpartyLabel === DISCLOSED_BUYER);
    expect(named.length).toBeGreaterThan(0);
    for (const e of named) {
      expect(Date.parse(e.occurredAt)).toBeGreaterThanOrEqual(DISCLOSED_ON);
      expect(e.counterpartyKind).toBe('named');
    }

    // ...and the same deal's earlier entries are still labelled, in place.
    const before = all.filter(
      (e) => e.projectSlug === HAVEL
        && e.counterpartyKind === 'label'
        && Date.parse(e.occurredAt) < DISCLOSED_ON,
    );
    expect(before.length).toBeGreaterThan(0);
  });
});

describe('corrections stay visible', () => {
  it('returns the correction and the entry it corrects, and marks the wrong one', async () => {
    const all = await allAsAnonymous();

    const correction = all.find((e) => e.correctsPublicId !== null);
    expect(correction, 'the demo record must contain a correction').toBeDefined();
    expect(correction!.entryType).toBe('correction');
    expect(correction!.correctionReason).toBeTruthy();

    // The corrected entry is still in the record. Nothing is ever hidden.
    const corrected = all.find((e) => e.publicId === correction!.correctsPublicId);
    expect(corrected, 'the corrected entry must still be readable').toBeDefined();

    // ...and it is marked, and names the entry that superseded it, so the link
    // reads in both directions even across a page boundary.
    expect(corrected!.isSuperseded).toBe(true);
    expect(corrected!.supersededByPublicId).toBe(correction!.publicId);
    expect(corrected!.supersededByShortRef).toBe(correction!.shortRef);
  });

  it('keeps the superseded entry in date order rather than moving it', async () => {
    const all = await allAsAnonymous();
    const times = all.map((e) => Date.parse(e.occurredAt));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeLessThanOrEqual(times[i - 1]!);
    }
    expect(all.some((e) => e.isSuperseded)).toBe(true);
  });
});

describe('filters, server-side and in the URL', () => {
  it('filters by project', async () => {
    const x = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: HAVEL, eventType: null, page: 1, pageSize: 200,
    });
    expect(x.total).toBeGreaterThan(0);
    for (const e of x.entries) expect(e.projectSlug).toBe(HAVEL);

    const other = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: BRIERE, eventType: null, page: 1, pageSize: 200,
    });
    expect(other.total).toBeGreaterThan(0);
    for (const e of other.entries) expect(e.projectSlug).toBe(BRIERE);
  });

  it('filters by event type', async () => {
    const x = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: null, eventType: 'listed', page: 1, pageSize: 200,
    });
    expect(x.total).toBeGreaterThan(0);
    for (const e of x.entries) expect(e.entryType).toBe('listed');
  });

  it('combines the two filters', async () => {
    const x = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: HAVEL, eventType: 'listed', page: 1, pageSize: 200,
    });
    for (const e of x.entries) {
      expect(e.projectSlug).toBe(HAVEL);
      expect(e.entryType).toBe('listed');
    }
  });

  it('offers only projects that appear in the record', async () => {
    const options = await readRecordFilterOptions(ANONYMOUS, 'en');
    expect(options.projects.length).toBeGreaterThan(0);
    for (const p of options.projects) {
      const x = await readRecordExtract(ANONYMOUS, {
        locale: 'en', projectSlug: p.slug, eventType: null, page: 1, pageSize: 1,
      });
      expect(x.total).toBeGreaterThan(0);
    }
    // The draft project has no public entries and must not be offered.
    expect(options.projects.map((p) => p.slug))
      .not.toContain('demo-oder-floodplain-reconnection');
  });

  it('reports a filter it could not apply instead of silently ignoring it', async () => {
    const options = await readRecordFilterOptions(ANONYMOUS, 'en');

    const bad = parseRecordParams({ project: 'no-such-project' }, options);
    expect(bad.projectSlug).toBeNull();
    expect(bad.ignored).toContain('project');

    const badEvent = parseRecordParams({ event: 'not_an_event' }, options);
    expect(badEvent.eventType).toBeNull();
    expect(badEvent.ignored).toContain('event');

    // A malformed value is refused by shape, not passed to a query.
    const junk = parseRecordParams({ project: "'; DROP TABLE record.entry --" }, options);
    expect(junk.projectSlug).toBeNull();
    expect(junk.ignored).toContain('project');

    // A good one survives.
    const ok = parseRecordParams({ project: HAVEL, event: 'listed', page: '2' }, options);
    expect(ok).toMatchObject({ projectSlug: HAVEL, eventType: 'listed', page: 2, ignored: [] });
  });

  it('puts the filter in the URL so a filtered view is shareable', () => {
    expect(recordHref({})).toBe('/record');
    expect(recordHref({ page: 1 })).toBe('/record');
    expect(recordHref({ projectSlug: HAVEL })).toBe(`/record?project=${HAVEL}`);
    expect(recordHref({ projectSlug: HAVEL, eventType: 'listed', page: 3 }))
      .toBe(`/record?project=${HAVEL}&event=listed&page=3`);
  });
});

describe('pagination', () => {
  it('splits the record into pages that do not overlap or lose an entry', async () => {
    const all = await allAsAnonymous();
    expect(all.length).toBeGreaterThan(5);

    const seen: string[] = [];
    let pageCount = 0;
    for (let page = 1; ; page++) {
      const x = await readRecordExtract(ANONYMOUS, {
        locale: 'en', projectSlug: null, eventType: null, page, pageSize: 5,
      });
      pageCount = x.pageCount;
      expect(x.total).toBe(all.length);
      expect(x.page).toBe(page);
      expect(x.from).toBe((page - 1) * 5 + 1);
      expect(x.to).toBe((page - 1) * 5 + x.entries.length);
      seen.push(...x.entries.map((e) => e.publicId));
      if (page >= x.pageCount) break;
    }

    expect(pageCount).toBe(Math.ceil(all.length / 5));
    expect(seen.length).toBe(all.length);
    expect(new Set(seen).size).toBe(all.length);
    // Same order as one unpaginated read: the sort is stable across pages.
    expect(seen).toEqual(all.map((e) => e.publicId));
  });

  it('clamps a page number past the end rather than returning nothing', async () => {
    const x = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: null, eventType: null, page: 9999, pageSize: 5,
    });
    expect(x.page).toBe(x.pageCount);
    expect(x.entries.length).toBeGreaterThan(0);
  });
});

describe('the record in German', () => {
  it('serves German labels and falls back per field rather than hiding an entry', async () => {
    const en = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: null, eventType: null, page: 1, pageSize: 200,
    });
    const de = await readRecordExtract(ANONYMOUS, {
      locale: 'de', projectSlug: null, eventType: null, page: 1, pageSize: 200,
    });

    // Not one entry disappears because of a translation.
    expect(de.total).toBe(en.total);
    expect(de.entries.map((e) => e.publicId)).toEqual(en.entries.map((e) => e.publicId));

    // Reference data is localised where a German label exists.
    const deSectors = de.entries.map((e) => e.sectorLabel).filter(Boolean);
    expect(deSectors.length).toBeGreaterThan(0);

    // A label is a pseudonym, not prose: it is identical in both languages.
    for (let i = 0; i < de.entries.length; i++) {
      if (de.entries[i]!.counterpartyKind === 'label') {
        expect(de.entries[i]!.counterpartyLabel).toBe(en.entries[i]!.counterpartyLabel);
      }
    }
  });
});

/**
 * PROVENANCE.
 *
 * "Every figure on screen carries its source and date." record.entry.
 * source_ref_id is NOT NULL precisely so that this can be relied on, and the
 * page used to throw it away and print one stamp at the top saying where the
 * whole extract came from, dated the day the page was rendered. That is a
 * different claim, and on a record whose purpose is evidence it is the wrong
 * one.
 */
describe('every entry carries its own source', () => {
  it('gives each entry a source label, a kind and an as-of date', async () => {
    const all = await allAsAnonymous();
    expect(all.length).toBeGreaterThan(0);

    for (const e of all) {
      expect(e.source, `entry ${e.shortRef} has no source`).not.toBeNull();
      expect(e.source!.label.trim()).not.toBe('');
      expect(e.source!.kind.trim()).not.toBe('');
      // A date, not a timestamp: as at when the source says what it says.
      expect(e.source!.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("uses the entry's own source date, not the date the page was read", async () => {
    const all = await allAsAnonymous();
    const today = new Date().toISOString().slice(0, 10);
    // The demo record's sources are as of 2026-09-23/24 and are FIXED. If every
    // entry reported today's date, the page would be stamping itself rather
    // than reporting provenance - which is exactly the bug this replaced.
    expect(all.some((e) => e.source!.asOfDate !== today)).toBe(true);
  });
});

/**
 * R5, THROUGH THE ROUTE RATHER THAN THROUGH THE VIEW.
 *
 * Migration 0075 (FINDING-005) moved the public record onto the per-DEAL
 * pseudonym, because the per-ORGANISATION one links two deals by one buyer on
 * one project: name either and both are named.
 *
 * The test above it - "gives one organisation a different label on each of its
 * deals" - does NOT catch a regression of that, and it is worth saying why so
 * nobody trusts it to. DEMO Verdant Foods NV's two deals are on two DIFFERENT
 * projects, and the organisation-level labels for those two projects differ as
 * well ("Buyer 003" on Untere Havel, "Buyer 001" on Brière). So it passes
 * identically against the pre-0075 view. This one does not: it compares what
 * the public page prints against BOTH labels and requires the deal one.
 */
describe('the label the public sees is the deal label, not the organisation label', () => {
  interface LabelRow extends Record<string, unknown> {
    public_id: string; deal_label: string; org_label: string | null;
  }

  it('prints the deal label and never the organisation-level one', async () => {
    const all = await allAsAnonymous();

    const labels = await readAs(OPERATOR, (tx) =>
      tx.query<LabelRow>(`
        SELECT e.public_id::text AS public_id,
               dp.label          AS deal_label,
               op.label          AS org_label
          FROM record.entry e
          JOIN deal.deal_pseudonym dp
            ON dp.deal_id = e.deal_id
          LEFT JOIN org.organisation_pseudonym op
            ON op.project_id = e.project_id
           AND op.org_id     = e.deal_buyer_org_id
         WHERE e.deal_id IS NOT NULL`),
    );
    const byId = new Map(labels.map((r) => [r.public_id, r]));

    // Non-vacuity, first. If the two labels were equal everywhere, this whole
    // block would pass against the wrong join and prove nothing.
    const distinguishing = labels.filter(
      (r) => r.org_label !== null && r.org_label !== r.deal_label,
    );
    expect(
      distinguishing.length,
      'the fixture must contain a deal whose deal label differs from its ' +
      'organisation-level label, or this test cannot fail',
    ).toBeGreaterThan(0);

    let checked = 0;
    for (const e of all) {
      if (e.counterpartyKind !== 'label') continue;
      const row = byId.get(e.publicId);
      if (!row) continue;
      expect(e.counterpartyLabel, `entry ${e.shortRef}`).toBe(row.deal_label);
      if (row.org_label !== null && row.org_label !== row.deal_label) {
        expect(e.counterpartyLabel, `entry ${e.shortRef} shows the linkable label`)
          .not.toBe(row.org_label);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

/**
 * SIGNING IN MUST NOT UNMASK ANYBODY.
 *
 * record.v_public_entry is owned by sylva_record and is not a security_invoker
 * view, so it resolves every counterparty the same way whoever is reading. That
 * is the design, and "it is the design" is not evidence - so it is read here as
 * each of the two demo buyers and compared, entry by entry, with what an
 * anonymous visitor gets.
 *
 * The question this answers is the one the concept note calls the failure to
 * avoid, asked of this route: can buyer A learn who buyer B is?
 */
describe('one buyer cannot unmask another through this route', () => {
  it('shows a signed-in buyer exactly what an anonymous visitor sees', async () => {
    const anon = await allAsAnonymous();
    for (const [who, actor] of [['buyer A', BUYER_A], ['buyer B', BUYER_B]] as const) {
      const mine = await allAs(actor);
      expect(mine.map((e) => e.publicId), who).toEqual(anon.map((e) => e.publicId));
      expect(mine.map((e) => e.counterpartyLabel), who)
        .toEqual(anon.map((e) => e.counterpartyLabel));
      expect(mine.map((e) => e.counterpartyKind), who)
        .toEqual(anon.map((e) => e.counterpartyKind));
    }
  });

  it("never shows buyer A the name behind buyer B's undisclosed deals", async () => {
    const asBuyerA = await allAs(BUYER_A);
    expect(asBuyerA.length).toBeGreaterThan(0);
    for (const e of asBuyerA) {
      expect(textOf(e)).not.toContain(NEVER_DISCLOSED_BUYER);
      expect(textOf(e)).not.toContain('Verdant');
    }
  });

  it('does not let a buyer read record.entry rows belonging to another buyer', async () => {
    // Belt and braces under the view: the base table's own policy.
    const rows = await readAs(BUYER_A, (tx) =>
      tx.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM record.entry e
          WHERE e.deal_buyer_org_id = $1::uuid`,
        [BUYER_B.kind === 'member' ? BUYER_B.orgId : ''],
      ),
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });
});

/**
 * FINDING-002, closed by migration 0076.
 *
 * record.entry's INSERT policy used to check only that a row carried the
 * WRITER's own organisation, not that the writer was a party to the deal the
 * row named. Buyer B could therefore append a permanent entry carrying buyer
 * A's deal id - and record.v_public_entry resolves an entry's counterparty
 * against coalesce(deal_buyer_org_id, actor_org_id), so that row appeared on
 * THIS page against buyer A. R4 means it could never be removed.
 *
 * Every attempt below runs in a transaction that is rolled back, because the
 * one that is meant to succeed would otherwise leave a permanent entry about a
 * demo deal in a record that cannot be tidied up.
 */
describe('an entry may only be appended by a party to what it is about', () => {
  /** DEMO Nordbräu AG's Untere Havel deal. */
  const DEAL_OF_BUYER_A = 'ea000000-0000-0000-0000-0000000000a1';
  /** DEMO Verdant Foods NV's own deal, on the SAME project. */
  const DEAL_OF_BUYER_B = 'ea000000-0000-0000-0000-0000000000c1';
  const PROJECT_HAVEL = 'a1000000-0000-0000-0000-000000000001';
  const ORG_OWNER_A = '0a000000-0000-0000-0000-00000000000a';
  const ORG_BUYER_A = '0c000000-0000-0000-0000-00000000000c';
  const ORG_BUYER_B = '0d000000-0000-0000-0000-00000000000d';
  const SOURCE_REF = '5f000000-0000-0000-0000-0000000000f7';

  const APPEND = `
    INSERT INTO record.entry
      (entry_type, project_id, deal_id, deal_buyer_org_id, deal_owner_org_id,
       actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
       source_ref_id, detail)
    VALUES ('interest_expressed', $1::uuid, $2::uuid, $3::uuid, $4::uuid,
            sylva.actor_org_id(), 'buyer', sylva.actor_person_ref(),
            'representative #1', $5::uuid, '{"test":"record.test.ts"}'::jsonb)
    RETURNING public_id::text AS public_id`;

  it("refuses buyer B an entry carrying buyer A's deal", async () => {
    const refusal = await inRolledBackTransaction(BUYER_B, (tx) =>
      refusalOf(() =>
        tx.query(APPEND, [PROJECT_HAVEL, DEAL_OF_BUYER_A, ORG_BUYER_A, ORG_OWNER_A, SOURCE_REF]),
      ),
    );
    // A row-level refusal, not a privilege one: buyer B may write entries, just
    // not this one. 42501 covers both, so the message is what separates them.
    expect(refusal.code).toBe('42501');
    expect(refusal.message).toMatch(/row-level security/i);
  });

  it('still lets buyer B append an entry about its own deal on the same project', async () => {
    // The same project and the same statement. Only the deal changes, so a
    // failure here would mean 0076 refused the legitimate write too - which is
    // the way a fix like this usually goes wrong.
    const rows = await inRolledBackTransaction(BUYER_B, (tx) =>
      tx.query<{ public_id: string }>(
        APPEND,
        [PROJECT_HAVEL, DEAL_OF_BUYER_B, ORG_BUYER_B, ORG_OWNER_A, SOURCE_REF],
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.public_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses a buyer a deal-less entry about a project it does not own', async () => {
    // 'listed' is a statement about a project. Only the project's owner may
    // make one, or one buyer can put words about another organisation's project
    // into a permanent public record.
    const refusal = await inRolledBackTransaction(BUYER_B, (tx) =>
      refusalOf(() =>
        tx.query(
          `INSERT INTO record.entry
             (entry_type, project_id, actor_org_id, actor_role_snapshot,
              actor_person_ref, actor_person_label, source_ref_id, detail)
           VALUES ('listed', $1::uuid, sylva.actor_org_id(), 'buyer',
                   sylva.actor_person_ref(), 'representative #1', $2::uuid,
                   '{"test":"record.test.ts"}'::jsonb)
           RETURNING entry_no`,
          [PROJECT_HAVEL, SOURCE_REF],
        ),
      ),
    );
    expect(refusal.code).toBe('42501');
    expect(refusal.message).toMatch(/row-level security/i);
  });

  it('never permits an entry to be edited or deleted - R4 stands', async () => {
    const anyEntry = (await allAsAnonymous())[0]!;

    const edited = await inRolledBackTransaction(BUYER_A, (tx) =>
      refusalOf(() =>
        tx.query('UPDATE record.entry SET detail = detail WHERE public_id = $1::uuid',
          [anyEntry.publicId]),
      ),
    );
    expect(edited.code).toBeTruthy();

    const deleted = await inRolledBackTransaction(BUYER_A, (tx) =>
      refusalOf(() =>
        tx.query('DELETE FROM record.entry WHERE public_id = $1::uuid', [anyEntry.publicId]),
      ),
    );
    expect(deleted.code).toBeTruthy();
  });
});

/**
 * The correction explainer on the page is rendered only when the extract it
 * sits under actually contains a correction. This is the data half of that:
 * the two published projects differ, so the gate is not decorative.
 */
describe('the reference printed on a row identifies that row', () => {
  it('gives every entry in the extract a distinct short reference', async () => {
    const all = await allAsAnonymous();
    const shorts = all.map((e) => e.shortRef);
    // The correction cell prints "Corrects entry <shortRef>". If two entries
    // share one, that sentence names both and the record is not citable. The
    // demo ids are ec000000-0000-0000-0000-0000000000cN, so the first eight
    // characters alone would fail this outright.
    expect(new Set(shorts).size).toBe(shorts.length);
    for (const e of all) expect(e.publicId).toContain(e.shortRef.split('\u2026')[0]);
  });
});

describe('corrections belong to an extract, not to the page', () => {
  it('has a correction on one project and none on the other', async () => {
    const havel = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: HAVEL, eventType: null, page: 1, pageSize: 200,
    });
    const briere = await readRecordExtract(ANONYMOUS, {
      locale: 'en', projectSlug: BRIERE, eventType: null, page: 1, pageSize: 200,
    });

    const holdsOne = (x: { entries: RecordEntry[] }) =>
      x.entries.some((e) => e.correctsPublicId !== null || e.isSuperseded);

    expect(holdsOne(havel)).toBe(true);
    expect(holdsOne(briere)).toBe(false);
  });
});

/**
 * A DATABASE REFUSAL MUST READ AS A SENTENCE.
 *
 * This route is read-only, so the rule triggers that shout on the write paths -
 * R1, R6, the publication gate, SY007 - cannot fire here. What can is a
 * privilege refusal and a database that is not answering, and the difference
 * matters to a reader: one means "not for you", the other means "not right
 * now". Neither may reach the page as a stack trace, and neither may be
 * rendered as an empty table, which on a permanent record would read as
 * "entries were removed".
 */
describe('a failed read says what happened, in words', () => {
  it('calls an insufficient-privilege refusal what it is', () => {
    const l = recordErrorLabel({ code: '42501', message: 'permission denied for view v_public_entry' });
    expect(l).toBe(ERROR.denied);
    expect(l.fallbackEn).toMatch(/access/i);
    expect(l.fallbackEn).not.toMatch(/42501|permission denied|error|exception/i);
  });

  it('calls everything else a record that could not be read, and says nothing changed', () => {
    for (const err of [
      { code: '57014', message: 'canceling statement due to statement timeout' },
      { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' },
      new Error('boom'),
      null,
      undefined,
      'a string',
    ]) {
      const l = recordErrorLabel(err);
      expect(l).toBe(ERROR.unavailable);
    }
    // It must not imply the record is empty or was edited.
    expect(ERROR.unavailable.fallbackEn).toMatch(/nothing has been changed or removed/i);
    expect(ERROR.unavailable.fallbackEn).not.toMatch(/something went wrong/i);
  });
});
