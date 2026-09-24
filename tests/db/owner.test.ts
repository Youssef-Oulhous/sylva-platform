import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { withActor } from '@/lib/db/session';
import {
  getOwnerProjectRecord, getOwnerReference, listOwnerInterest,
  listOwnerProjects, listOwnerQuestions,
} from '@/lib/owner/queries';
import {
  addClaimRight, answerQuestion, createProject, insertSource,
  ownProjectIdBySlug, saveText, submitForReview,
} from '@/lib/owner/record';
import { IncomparableUnitsError, sumSameUnit } from '@/lib/units/qty';
import { ownerCodeForDatabaseError } from '@/lib/owner/errors';

/**
 * The owner's flows, against the real database, as the real role.
 *
 * Every call goes through withActor(), so each statement runs as
 * sylva_project_owner with an HMAC-signed organisation context. Nothing here
 * opens a raw client except the housekeeping helper below, and that one exists
 * to read back what the application wrote - which is the property being
 * asserted, not a shortcut around it.
 *
 * ON NOT CLEANING UP. Project content is append-only: UPDATE and DELETE are
 * revoked AND blocked by ENABLE ALWAYS triggers, so these tests cannot remove
 * what they write, and a helper that disabled the triggers to tidy up would be
 * a helper that can leave the database with R4 switched off if a test throws
 * halfway. So the fixture project is created ONCE, by slug, and every later run
 * appends versions to it exactly as a real owner would. Growth is bounded to
 * versions, which is the shape the system is built around anyway.
 */

const ORG_A = '0a000000-0000-0000-0000-00000000000a';   // DEMO Moorland Trust
const PERSON_A = 'b0000000-0000-0000-0000-0000000000b1';
const ORG_B = '0b000000-0000-0000-0000-00000000000b';   // DEMO Rivieres Vivantes
const PERSON_B = 'b0000000-0000-0000-0000-0000000000b2';

const PROJECT_A_PUBLISHED = 'demo-untere-havel-wetland-restoration';
const PROJECT_A_DRAFT = 'demo-oder-floodplain-reconnection';
const PROJECT_B = 'demo-marais-de-briere-restoration';

const FIXTURE_SLUG = 'test-owner-flow-fixture';

const ownerA: Actor = {
  kind: 'member', role: 'project_owner', orgId: ORG_A, personRef: PERSON_A,
};
const ownerB: Actor = {
  kind: 'member', role: 'project_owner', orgId: ORG_B, personRef: PERSON_B,
};

/** Housekeeping only. The application has no such connection, by design. */
async function asSuperuser<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER ?? 'postgres',
  });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

const today = new Date().toISOString().slice(0, 10);

function source(label: string) {
  return {
    kind: 'project_owner_statement' as const,
    label,
    locator: null,
    sourceUrl: null,
    asOfDate: today,
  };
}

let fixtureId = '';

beforeAll(async () => {
  fixtureId = await withActor(ownerA, async (tx) => {
    const existing = await ownProjectIdBySlug(tx, FIXTURE_SLUG);
    if (existing) return existing.id;
    const src = await insertSource(tx, source('Test fixture, created by tests/db/owner.test.ts'));
    const id = await createProject(tx, { slug: FIXTURE_SLUG, countryCode: 'DE' });
    await saveText(tx, id, {
      fieldCode: 'title', locale: 'en',
      body: 'TEST Owner flow fixture', status: 'human_draft',
    }, src);
    await saveText(tx, id, {
      fieldCode: 'summary', locale: 'en',
      body: 'A project created by the owner-flow tests. Not a real wetland.',
      status: 'human_draft',
    }, src);
    return id;
  });
  // The submit test moves this project's status; put it back so a rerun starts
  // from the same place. proj.project is not append-only, so this is an
  // ordinary UPDATE rather than anything that needs a trigger switched off.
  await asSuperuser((c) =>
    c.query("UPDATE proj.project SET status = 'draft' WHERE slug = $1 AND status <> 'draft'",
      [FIXTURE_SLUG]));
});

afterAll(async () => {
  await asSuperuser((c) =>
    c.query("UPDATE proj.project SET status = 'draft' WHERE slug = $1 AND status <> 'draft'",
      [FIXTURE_SLUG]));
  await closeAllPools();
});

/* ------------------------------------------------------------- THE READS */

describe('the owner dashboard', () => {
  it('lists this organisation\'s projects and nobody else\'s', async () => {
    const ps = await listOwnerProjects(ownerA, 'en');
    const slugs = ps.map((p) => p.slug);
    expect(slugs).toContain(PROJECT_A_PUBLISHED);
    expect(slugs).toContain(PROJECT_A_DRAFT);
    expect(slugs).toContain(FIXTURE_SLUG);
    // Owner B's published project is readable on the public index. It is not
    // this organisation's project, so it is not on this organisation's desk.
    expect(slugs).not.toContain(PROJECT_B);
  });

  it('shows a draft that the public index does not', async () => {
    const ps = await listOwnerProjects(ownerA, 'en');
    const draft = ps.find((p) => p.slug === PROJECT_A_DRAFT);
    expect(draft).toBeDefined();
    expect(draft!.isPublished).toBe(false);
    expect(draft!.status).toBe('draft');
  });

  it('reads the publication gate from the database, not from a copy of it', async () => {
    const ps = await listOwnerProjects(ownerA, 'en');
    const published = ps.find((p) => p.slug === PROJECT_A_PUBLISHED)!;
    const draft = ps.find((p) => p.slug === PROJECT_A_DRAFT)!;

    // A published project passed the gate, so by definition it has no gaps.
    expect(published.gaps).toEqual([]);
    // An empty draft is missing everything the gate checks.
    expect(draft.gaps).toContain('english_page_text');
    expect(draft.gaps).toContain('boundary');
    expect(draft.gaps).toContain('availability');

    // The screen's list and the database's list are the same list.
    const fromDb = await asSuperuser(async (c) => {
      const r = await c.query<{ gaps: string[] }>(
        'SELECT proj.publication_gaps(id) AS gaps FROM proj.project WHERE slug = $1',
        [PROJECT_A_DRAFT],
      );
      return r.rows[0]!.gaps;
    });
    expect([...draft.gaps].sort()).toEqual([...fromDb].sort());
  });

  it('stamps every availability figure with a source and a date', async () => {
    const ps = await listOwnerProjects(ownerA, 'en');
    for (const p of ps) {
      if (!p.nearestPeriod) continue;
      expect(p.nearestPeriod.source.label).toBeTruthy();
      expect(p.nearestPeriod.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.nearestPeriod.unitLabel).toBeTruthy();
    }
  });

  it('RULE 7: the dashboard holds no figure that spans two projects', async () => {
    const a = await listOwnerProjects(ownerA, 'en');
    const b = await listOwnerProjects(ownerB, 'en');
    const mine = a.map((p) => p.nearestPeriod).filter((x) => x !== null);
    const theirs = b.map((p) => p.nearestPeriod).filter((x) => x !== null);
    const across = [...mine, ...theirs].map((x) => x!.remaining);
    expect(across.length).toBeGreaterThan(1);
    expect(() => sumSameUnit(across)).toThrow(IncomparableUnitsError);
  });

  it('serves German without hiding a project that has no German title', async () => {
    const de = await listOwnerProjects(ownerA, 'de');
    const en = await listOwnerProjects(ownerA, 'en');
    expect(de.length).toBe(en.length);
    const fixture = de.find((p) => p.slug === FIXTURE_SLUG)!;
    expect(fixture.titleIsFallback).toBe(true);
    expect(fixture.title).toBe('TEST Owner flow fixture');
  });
});

describe('the record', () => {
  it('returns the owner\'s own project', async () => {
    const r = await getOwnerProjectRecord(ownerA, PROJECT_A_PUBLISHED, 'en');
    expect(r).not.toBeNull();
    expect(r!.slug).toBe(PROJECT_A_PUBLISHED);
    expect(r!.gaps).toEqual([]);
    expect(r!.unitLabel).toBeTruthy();
    expect(r!.periods.length).toBeGreaterThan(0);
  });

  it('gives the same answer for another owner\'s project as for one that does not exist', async () => {
    const other = await getOwnerProjectRecord(ownerA, PROJECT_B, 'en');
    const nothing = await getOwnerProjectRecord(ownerA, 'no-such-project-at-all', 'en');
    expect(other).toBeNull();
    expect(nothing).toBeNull();
  });

  it('offers reference data read from the database, not hard-coded', async () => {
    const ref = await getOwnerReference(ownerA, 'en');
    expect(ref.schemes.length).toBeGreaterThan(0);
    expect(ref.unitTypes.length).toBeGreaterThan(0);
    expect(ref.countries.some((c) => c.code === 'DE')).toBe(true);
    expect(ref.textFields.some((f) => f.code === 'title' && f.required)).toBe(true);
    expect(ref.partyRoles.some((r) => r.code === 'verifier')).toBe(true);
    // The only route to another organisation's name this role has. It names
    // declared parties and owners of already-public projects, and nobody else.
    expect(ref.nameableOrgs.length).toBeGreaterThan(0);
    expect(ref.nameableOrgs.every((o) => o.name.startsWith('DEMO'))).toBe(true);
  });
});

/* ------------------------------------------------------------ THE WRITES */

describe('an owner writing its own project', () => {
  it('appends a new version rather than editing the old one', async () => {
    const body = `TEST summary, revision ${Date.now()}`;

    const before = await asSuperuser(async (c) => {
      const r = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM proj.project_text
          WHERE project_id = $1 AND field_code = 'summary' AND locale = 'en'`,
        [fixtureId],
      );
      return Number(r.rows[0]!.n);
    });

    const wrote = await withActor(ownerA, async (tx) => {
      const src = await insertSource(tx, source('TEST revision'));
      return saveText(tx, fixtureId,
        { fieldCode: 'summary', locale: 'en', body, status: 'human_draft' }, src);
    });
    expect(wrote).toBe(true);

    const after = await asSuperuser(async (c) => {
      const r = await c.query<{ n: string; latest: string; versions: string }>(
        `SELECT count(*) AS n,
                max(version_no)::text AS versions,
                (SELECT body FROM proj.project_text
                  WHERE project_id = $1 AND field_code = 'summary' AND locale = 'en'
                  ORDER BY version_no DESC LIMIT 1) AS latest
           FROM proj.project_text
          WHERE project_id = $1 AND field_code = 'summary' AND locale = 'en'`,
        [fixtureId],
      );
      return r.rows[0]!;
    });

    // One more row, not one changed row: the previous version is still there.
    expect(Number(after.n)).toBe(before + 1);
    expect(Number(after.versions)).toBe(before + 1);
    expect(after.latest).toBe(body);
  });

  it('writes nothing when the text has not changed', async () => {
    const body = 'TEST unchanged body, written once';
    await withActor(ownerA, async (tx) => {
      const src = await insertSource(tx, source('TEST unchanged'));
      await saveText(tx, fixtureId,
        { fieldCode: 'catchment_context', locale: 'en', body, status: 'human_draft' }, src);
    });
    const again = await withActor(ownerA, async (tx) => {
      const src = await insertSource(tx, source('TEST unchanged'));
      return saveText(tx, fixtureId,
        { fieldCode: 'catchment_context', locale: 'en', body, status: 'human_draft' }, src);
    });
    expect(again).toBe(false);
  });

  it('cannot edit a content row in place, even trying directly', async () => {
    await expect(withActor(ownerA, async (tx) => {
      await tx.query(
        `UPDATE proj.project_text SET body = 'tampered' WHERE project_id = $1`,
        [fixtureId],
      );
    })).rejects.toThrow();
  });

  it('records a claim right with its provenance', async () => {
    const key = `test-benefit-${Date.now().toString(36)}`;
    const version = await withActor(ownerA, async (tx) => {
      const src = await insertSource(tx, source('TEST claim right statement'));
      return addClaimRight(tx, fixtureId, {
        benefitKey: key,
        locale: 'en',
        benefitLabel: 'TEST benefit',
        whoMayClaim: 'TEST: the buyer named on the deal.',
        forWhat: 'TEST: reporting against its own water target.',
        exclusions: 'TEST: not transferable, not usable as a carbon claim.',
      }, src);
    });
    expect(version).toBe(1);

    const record = await getOwnerProjectRecord(ownerA, FIXTURE_SLUG, 'en');
    const entry = record!.claimRights.find((c) => c.key === key);
    expect(entry).toBeDefined();
    // source_ref_id is NOT NULL on the table, so a figure without provenance is
    // not representable. This asserts it arrives on screen too.
    expect(entry!.source.label).toBe('TEST claim right statement');
    expect(entry!.source.asOfDate).toBe(today);
  });
});

describe('what an owner may not do', () => {
  it('cannot write content for another organisation\'s project', async () => {
    const targetId = await asSuperuser(async (c) => {
      const r = await c.query<{ id: string }>(
        'SELECT id FROM proj.project WHERE slug = $1', [PROJECT_B],
      );
      return r.rows[0]!.id;
    });

    // Owner A knows the id - the project is published, so it is readable. The
    // row policy is what stops the write, not ignorance of the id.
    let code = '';
    try {
      await withActor(ownerA, async (tx) => {
        const src = await insertSource(tx, source('TEST cross-organisation attempt'));
        await saveText(tx, targetId,
          { fieldCode: 'summary', locale: 'en', body: 'TEST tampering', status: 'human_draft' },
          src);
      });
    } catch (err) {
      code = (err as { code?: string }).code ?? '';
      expect(ownerCodeForDatabaseError(err)).toBe('no_access');
    }
    expect(code).toBe('42501');

    const untouched = await asSuperuser(async (c) => {
      const r = await c.query<{ n: string }>(
        `SELECT count(*) AS n FROM proj.project_text
          WHERE project_id = $1 AND body = 'TEST tampering'`, [targetId],
      );
      return Number(r.rows[0]!.n);
    });
    expect(untouched).toBe(0);
  });

  it('cannot publish its own project', async () => {
    // Two things refuse this, and both are asserted: the row policy admits only
    // 'submitted_for_review' as a target, and the owner holds no privilege on
    // published_at, so the CHECK on proj.project could not be satisfied either.
    await expect(withActor(ownerA, async (tx) => {
      await tx.query("UPDATE proj.project SET status = 'published' WHERE id = $1", [fixtureId]);
    })).rejects.toThrow();

    const privilege = await asSuperuser(async (c) => {
      const r = await c.query<{ ok: boolean }>(
        `SELECT has_column_privilege('sylva_project_owner', 'proj.project', 'published_at', 'UPDATE') AS ok`,
      );
      return r.rows[0]!.ok;
    });
    expect(privilege).toBe(false);

    const status = await asSuperuser(async (c) => {
      const r = await c.query<{ status: string }>(
        'SELECT status::text AS status FROM proj.project WHERE id = $1', [fixtureId],
      );
      return r.rows[0]!.status;
    });
    expect(status).not.toBe('published');
  });

  it('cannot move another organisation\'s project at all', async () => {
    const moved = await withActor(ownerB, async (tx) => {
      const target = await asSuperuser(async (c) => {
        const r = await c.query<{ id: string }>(
          'SELECT id FROM proj.project WHERE slug = $1', [FIXTURE_SLUG],
        );
        return r.rows[0]!.id;
      });
      return submitForReview(tx, target);
    });
    // Zero rows, not an exception: the row is simply not one this owner may
    // update, which is what a row policy means.
    expect(moved).toBe(false);
  });
});

describe('submitting for review', () => {
  it('moves a draft to submitted_for_review and no further', async () => {
    const first = await withActor(ownerA, (tx) => submitForReview(tx, fixtureId));
    expect(first).toBe(true);

    const status = await asSuperuser(async (c) => {
      const r = await c.query<{ status: string }>(
        'SELECT status::text AS status FROM proj.project WHERE id = $1', [fixtureId],
      );
      return r.rows[0]!.status;
    });
    expect(status).toBe('submitted_for_review');

    // Submitting again does nothing: the policy's USING clause admits only a
    // draft or a project Sylva has sent back for changes.
    const second = await withActor(ownerA, (tx) => submitForReview(tx, fixtureId));
    expect(second).toBe(false);

    await asSuperuser((c) =>
      c.query("UPDATE proj.project SET status = 'draft' WHERE id = $1", [fixtureId]));
  });
});

/* ------------------------------------------------- THE PRIVATE QUESTION BOX */

describe('the question inbox', () => {
  it('shows the questions asked of this organisation and nobody else\'s', async () => {
    const mine = await listOwnerQuestions(ownerA, 'en');
    const theirs = await listOwnerQuestions(ownerB, 'en');
    expect(mine.length).toBeGreaterThan(0);
    expect(theirs.length).toBeGreaterThan(0);

    const overlap = mine.filter((q) => theirs.some((t) => t.id === q.id));
    expect(overlap).toEqual([]);
    for (const q of mine) expect(q.projectSlug).not.toBe(PROJECT_B);
  });

  it('names no buyer: the counterparty is a label and three attributes', async () => {
    const mine = await listOwnerQuestions(ownerA, 'en');
    for (const q of mine) {
      expect(q.asker.legalName).toBeNull();
      expect(q.asker.sectorLabel).toBeTruthy();
      expect(q.asker.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(q.asker.sizeBandLabel).toBeTruthy();
      expect(['pseudonym', 'unlabelled']).toContain(q.asker.kind);
    }
    // The demo fixture has one asker with a pseudonym allocated and one without,
    // so both branches of the screen are exercised by real data.
    expect(mine.some((q) => q.asker.label !== null)).toBe(true);
  });

  it('records an answer as a new row and shows it', async () => {
    const before = await listOwnerQuestions(ownerA, 'en');
    const target = before[0]!;
    const body = `TEST answer written at ${new Date().toISOString()}`;

    const id = await withActor(ownerA, (tx) =>
      answerQuestion(tx, target.id, body, PERSON_A));
    expect(id).not.toBeNull();

    const after = await listOwnerQuestions(ownerA, 'en');
    const updated = after.find((q) => q.id === target.id)!;
    expect(updated.answers.length).toBe(target.answers.length + 1);
    expect(updated.answers.at(-1)!.body).toBe(body);
    // The question itself is untouched: an answer is a new row, never an edit.
    expect(updated.body).toBe(target.body);
  });

  it('cannot answer a question asked of another organisation', async () => {
    const mine = await listOwnerQuestions(ownerA, 'en');
    const target = mine[0]!;
    // Owner B is a legitimate project owner with a valid context. The row
    // policy is the only thing standing between it and this question.
    let refused = false;
    try {
      const id = await withActor(ownerB, (tx) =>
        answerQuestion(tx, target.id, 'TEST answer from the wrong owner', PERSON_B));
      refused = id === null;
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);

    const after = await listOwnerQuestions(ownerA, 'en');
    const q = after.find((x) => x.id === target.id)!;
    expect(q.answers.some((a) => a.body.includes('wrong owner'))).toBe(false);
  });
});

describe('expressed interest', () => {
  it('reads live deals on this organisation\'s projects, with no volume', async () => {
    const rows = await listOwnerInterest(ownerA, 'en');
    for (const r of rows) {
      expect(r.stageCode).toBeTruthy();
      expect(r.buyer.legalName).toBeNull();
      // A deal at first interest carries no volume, so there is no field here
      // that could hold one and nothing to add across projects.
      expect(Object.keys(r)).not.toContain('volume');
    }
    const theirs = await listOwnerInterest(ownerB, 'en');
    const overlap = rows.filter((r) => theirs.some((t) => t.id === r.id));
    expect(overlap).toEqual([]);
  });
});
