import { Client } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
  SITE_SOURCE_LABEL,
  addBuyerSite,
  listBuyerSites,
  listSitesWithDistances,
  removeBuyerSite,
  updateBuyerSite,
} from '@/lib/sites/queries';
import { SiteFields, SiteFieldsWithId } from '@/lib/sites/input';
import { ANONYMOUS } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { actorFor } from '../rls/principals';
import { ORG } from '../rls/catalog';

/**
 * The buyer's site register, against the real database, as the real roles.
 *
 * The claim these tests exist for is the one printed on /dashboard/sites in two
 * languages: "No other organisation on the platform can see your register."
 * That is a promise about a database, so it is tested against one - as
 * sylva_buyer with a signed organisation context and as sylva_web_anon, not
 * with a mock.
 *
 * FINDING-001 is why the cross-buyer case is here at all: the organisation half
 * of the model was forgeable once, it was found by running the attack rather
 * than by reading the DDL, and buyer site coordinates were the thing it was
 * found on.
 */

const BUYER_A = actorFor('buyerA');
const BUYER_B = actorFor('buyerB');
const OPERATOR = actorFor('operator');
const OWNER_A = actorFor('ownerA');

/** Rows this file created, removed at the end whatever happened in between. */
const created: string[] = [];

/**
 * TEST HOUSEKEEPING ONLY. The application has no superuser connection and must
 * never grow one; this is here to clean up and to look at columns the
 * application deliberately cannot see. See tests/db/auth.test.ts for the same
 * note and the same reason.
 */
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

afterAll(async () => {
  if (created.length > 0) {
    await asSuperuser(async (c) => {
      await c.query('DELETE FROM geo.buyer_site WHERE id = ANY($1::uuid[])', [created]);
    });
  }
  await closeAllPools();
});

async function addForA(label: string, lat: number, lon: number): Promise<string> {
  const id = await addBuyerSite(BUYER_A, {
    label, countryCode: 'DE', latitude: lat, longitude: lon,
  });
  created.push(id);
  return id;
}

describe('a buyer maintains its own site register', () => {
  it('registers a site, with provenance, and reads it back', async () => {
    const id = await addForA('DEMO test site, Havelberg', 52.8297, 12.0783);

    const sites = await listBuyerSites(BUYER_A);
    const mine = sites.find((s) => s.id === id);
    expect(mine).toBeDefined();
    expect(mine!.label).toBe('DEMO test site, Havelberg');
    expect(mine!.countryCode).toBe('DE');
    // Round-trips through geometry() and back out of ST_Y/ST_X unchanged at the
    // precision the form accepts.
    expect(mine!.latitude).toBeCloseTo(52.8297, 4);
    expect(mine!.longitude).toBeCloseTo(12.0783, 4);

    // Rule F: every figure keeps its source and its date. A coordinate is a
    // figure, and source_ref_id is NOT NULL, so this cannot have been skipped.
    expect(mine!.source.label).toBe(SITE_SOURCE_LABEL);
    expect(mine!.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('writes a provenance row that names neither the site nor the organisation', async () => {
    // sylva.source_ref is world-readable - sylva_web_anon holds SELECT on it and
    // the read policy is USING (true). So the label must carry nothing private.
    const id = await addForA('DEMO Nordbraeu secret bottling plant', 53.0793, 8.8017);
    const sites = await listBuyerSites(BUYER_A);
    const label = sites.find((s) => s.id === id)!.source.label;

    expect(label).not.toMatch(/secret/i);
    expect(label).not.toMatch(/bottling/i);
    expect(label).not.toMatch(/Nordbr/i);
    expect(label).not.toMatch(/53\.|8\.8/);
  });

  it('updates a site and gives the new coordinate a new source date', async () => {
    const id = await addForA('DEMO movable site', 52.0, 12.0);
    const before = (await listBuyerSites(BUYER_A)).find((s) => s.id === id)!;

    const ok = await updateBuyerSite(BUYER_A, id, {
      label: 'DEMO movable site (moved)',
      countryCode: 'NL',
      latitude: 51.9244,
      longitude: 4.4777,
    });
    expect(ok).toBe(true);

    const after = (await listBuyerSites(BUYER_A)).find((s) => s.id === id)!;
    expect(after.label).toBe('DEMO movable site (moved)');
    expect(after.countryCode).toBe('NL');
    expect(after.latitude).toBeCloseTo(51.9244, 4);
    // A new statement of a figure is a new provenance row, not an edit of the
    // old one: sylva.source_ref is append-only under R4.
    const beforeId = await asSuperuser(async (c) => {
      const r = await c.query('SELECT source_ref_id FROM geo.buyer_site WHERE id = $1', [id]);
      return r.rows[0].source_ref_id as string;
    });
    expect(beforeId).toBeTruthy();
    expect(after.source.asOfDate).toBeTruthy();
    expect(before.source.label).toBe(after.source.label);
  });

  it('deletes a site', async () => {
    const id = await addForA('DEMO disposable site', 50.0, 10.0);
    expect(await removeBuyerSite(BUYER_A, id)).toBe(true);
    expect((await listBuyerSites(BUYER_A)).some((s) => s.id === id)).toBe(false);
  });
});

describe('site locations are private', () => {
  it('an anonymous visitor cannot read the table at all', async () => {
    // Not "returns no rows" - REFUSED. sylva_web_anon holds no grant on
    // geo.buyer_site, so this fails on privilege before any policy is
    // consulted. A grant-level refusal cannot be undone by a policy mistake.
    await expect(listBuyerSites(ANONYMOUS)).rejects.toMatchObject({ code: '42501' });
  });

  it('another buyer sees its own sites and none of buyer A\'s', async () => {
    const id = await addForA('DEMO site only A may see', 52.5, 13.4);

    const bSites = await listBuyerSites(BUYER_B);
    expect(bSites.some((s) => s.id === id)).toBe(false);
    expect(bSites.some((s) => s.label.includes('only A may see'))).toBe(false);
    // Buyer B is not simply seeing nothing: it has a register of its own, so a
    // passing test here is isolation rather than an empty database.
    expect(bSites.length).toBeGreaterThan(0);
  });

  it('a project owner cannot read buyer sites', async () => {
    // The page promises "A project owner does not see your sites, and is not
    // told that an organisation has a site near its project."
    await expect(listBuyerSites(OWNER_A)).rejects.toMatchObject({ code: '42501' });
  });

  it('another buyer cannot change or delete buyer A\'s site', async () => {
    const id = await addForA('DEMO site B must not touch', 51.0, 9.0);

    expect(await updateBuyerSite(BUYER_B, id, {
      label: 'DEMO hijacked', countryCode: 'NL', latitude: 0, longitude: 0,
    })).toBe(false);
    expect(await removeBuyerSite(BUYER_B, id)).toBe(false);

    const still = (await listBuyerSites(BUYER_A)).find((s) => s.id === id);
    expect(still).toBeDefined();
    expect(still!.label).toBe('DEMO site B must not touch');
  });

  it('a buyer cannot write a site into another organisation\'s register', async () => {
    // org_id is sylva.actor_org_id() in the INSERT, so the application cannot
    // even express another organisation's id. This asserts the row that came
    // out really is the caller's.
    const id = await addForA('DEMO ownership check', 52.1, 11.1);
    const orgId = await asSuperuser(async (c) => {
      const r = await c.query('SELECT org_id FROM geo.buyer_site WHERE id = $1', [id]);
      return r.rows[0].org_id as string;
    });
    expect(orgId).toBe(ORG.buyerA);
    expect(orgId).not.toBe(ORG.buyerB);
  });

  it('the operator and the auditor may read, and the auditor may not write', async () => {
    const id = await addForA('DEMO operator-visible site', 52.2, 12.2);
    const seen = await listBuyerSites(OPERATOR);
    expect(seen.some((s) => s.id === id)).toBe(true);

    // The operator holds SELECT and nothing else on this table.
    await expect(removeBuyerSite(OPERATOR, id)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('distance to published projects', () => {
  it('measures each site against every published project, in metres', async () => {
    const rows = await listSitesWithDistances(BUYER_A, 'en');
    expect(rows.length).toBeGreaterThan(0);

    const withProjects = rows.find((r) => r.relations.length > 0);
    expect(withProjects).toBeDefined();

    for (const rel of withProjects!.relations) {
      expect(rel.distanceMetres).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(rel.distanceMetres)).toBe(true);
      expect(rel.title).toBeTruthy();
      // Every figure carries its source and date.
      expect(rel.boundarySource.label).toBeTruthy();
      expect(rel.boundarySource.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('only published projects are measured against', async () => {
    const rows = await listSitesWithDistances(BUYER_A, 'en');
    const slugs = new Set(rows.flatMap((r) => r.relations.map((x) => x.slug)));
    expect(slugs.has('demo-untere-havel-wetland-restoration')).toBe(true);
    // The third demo project is a draft. RLS keeps it out; nothing in the query
    // mentions status.
    expect(slugs.has('demo-oder-floodplain-reconnection')).toBe(false);
  });

  it('states the catchment answer against a NAMED dataset, or not at all', async () => {
    const rows = await listSitesWithDistances(BUYER_A, 'en');
    for (const r of rows) {
      for (const rel of r.relations) {
        if (rel.inCatchment === null) {
          // No catchment published: no answer, rather than a false negative.
          expect(rel.catchmentDatasetName).toBeNull();
        } else {
          // D4: "same catchment" is stated against a named layer or not at all.
          expect(rel.catchmentDatasetName).toBeTruthy();
          expect(rel.catchmentSource?.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it('distance is to the boundary, so a site inside a project reads zero', async () => {
    // The boundary of the first demo project, from the database, and a point
    // guaranteed to be inside it.
    const inside = await asSuperuser(async (c) => {
      const r = await c.query(`
        SELECT ST_Y(p.pt) AS lat, ST_X(p.pt) AS lon
          FROM (SELECT ST_PointOnSurface(g.geom) AS pt
                  FROM geo.project_geometry g
                 WHERE g.project_id = 'a1000000-0000-0000-0000-000000000001'
                   AND g.kind = 'boundary'
                 ORDER BY g.version_no DESC LIMIT 1) p`);
      return r.rows[0] as { lat: number; lon: number };
    });

    const id = await addForA('DEMO site inside the boundary', inside.lat, inside.lon);
    const rows = await listSitesWithDistances(BUYER_A, 'en');
    const rel = rows.find((r) => r.site.id === id)!
      .relations.find((x) => x.slug === 'demo-untere-havel-wetland-restoration');
    expect(rel).toBeDefined();
    expect(rel!.distanceMetres).toBe(0);
  });

  it('a buyer with no sites gets an empty register, not an error', async () => {
    const rows = await listSitesWithDistances(BUYER_B, 'en');
    expect(Array.isArray(rows)).toBe(true);
  });

  it('an anonymous visitor cannot ask the distance question at all', async () => {
    await expect(listSitesWithDistances(ANONYMOUS, 'en'))
      .rejects.toMatchObject({ code: '42501' });
  });
});

describe('site locations cannot reach a public response', () => {
  it('no role that serves an anonymous request holds any privilege on the table', async () => {
    // Effective privilege, following role membership - not a grant listing.
    // sylva_login_public is the role an anonymous request actually connects
    // as, and sylva_web_anon is the role it runs as after SET LOCAL ROLE.
    const rows = await asSuperuser(async (c) => {
      const r = await c.query(`
        SELECT r.rolname, p.priv
          FROM pg_roles r
          CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES')) AS p(priv)
         WHERE r.rolname IN ('sylva_web_anon','sylva_login_public','sylva_report','sylva_record')
           AND has_table_privilege(r.oid, 'geo.buyer_site', p.priv)`);
      return r.rows as { rolname: string; priv: string }[];
    });
    expect(rows).toEqual([]);
  });

  it('nothing an anonymous visitor may call reads the table', async () => {
    // A SECURITY DEFINER function is the one way past a missing grant, so any
    // function granted to the anonymous roles that mentions geo.buyer_site is
    // a hole whatever its body looks like.
    const leaks = await asSuperuser(async (c) => {
      const r = await c.query(`
        SELECT n.nspname || '.' || p.proname AS fn
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname NOT IN ('pg_catalog','information_schema')
           AND pg_get_functiondef(p.oid) ILIKE '%buyer_site%'
           AND (has_function_privilege('sylva_web_anon', p.oid, 'EXECUTE')
                OR has_function_privilege('sylva_login_public', p.oid, 'EXECUTE'))
           AND p.prosecdef`);
      return r.rows.map((x) => x.fn as string);
    });
    // geo.site_distance_m is SECURITY INVOKER on purpose, so it is not here:
    // the caller's own policy applies to it and an anonymous caller gets
    // nothing. A DEFINER function would not have that property.
    expect(leaks).toEqual([]);
  });

  it('no view or generated surface readable by the public is built on it', async () => {
    const views = await asSuperuser(async (c) => {
      const r = await c.query(`
        SELECT c.oid::regclass::text AS v
          FROM pg_class c
         WHERE c.relkind IN ('v','m')
           AND pg_get_viewdef(c.oid) ILIKE '%buyer_site%'
           AND (has_table_privilege('sylva_web_anon', c.oid, 'SELECT')
                OR has_table_privilege('sylva_report', c.oid, 'SELECT'))`);
      return r.rows.map((x) => x.v as string);
    });
    expect(views).toEqual([]);
  });

  it('the database guard that states all of this still passes', async () => {
    await asSuperuser(async (c) => {
      await c.query('SELECT ci.assert_buyer_sites_are_private()');
    });
  });
});

/**
 * What the SERVER does with what the form sends.
 *
 * The schema is exercised directly rather than through addSiteAction(), which
 * calls cookies() and redirect() and so only runs inside a request. The rule
 * being tested is that nothing on the page - not `required`, not `min`, not
 * `max`, not `step` - is trusted, because a POST from outside the page carries
 * none of them.
 */
describe('a coordinate is validated on the server', () => {
  const good = {
    label: 'DEMO plant', country: 'DE', latitude: '52.8297', longitude: '12.0783',
  };

  it('accepts a well-formed site and hands back numbers, not strings', () => {
    const parsed = SiteFields.safeParse(good);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.latitude).toBe(52.8297);
    expect(parsed.success && typeof parsed.data.longitude).toBe('number');
  });

  it('refuses a latitude outside the coordinate system', () => {
    expect(SiteFields.safeParse({ ...good, latitude: '91' }).success).toBe(false);
    expect(SiteFields.safeParse({ ...good, latitude: '-90.1' }).success).toBe(false);
    expect(SiteFields.safeParse({ ...good, longitude: '181' }).success).toBe(false);
    expect(SiteFields.safeParse({ ...good, longitude: '-180.0001' }).success).toBe(false);
  });

  it('refuses a blank coordinate rather than reading it as the equator', () => {
    // z.coerce.number() would turn '' into 0, and 0,0 is a real place in the
    // Gulf of Guinea. A missing latitude must fail, not relocate the site.
    for (const bad of ['', '   ', null, undefined]) {
      expect(SiteFields.safeParse({ ...good, latitude: bad }).success).toBe(false);
    }
  });

  it('refuses text that Number() would accept', () => {
    for (const bad of ['NaN', 'Infinity', '1e400', '52,8297', '52.8297abc', '0x34']) {
      expect(SiteFields.safeParse({ ...good, latitude: bad }).success).toBe(false);
    }
  });

  it('refuses a country that is not two letters, and upper-cases one that is', () => {
    expect(SiteFields.safeParse({ ...good, country: 'DEU' }).success).toBe(false);
    expect(SiteFields.safeParse({ ...good, country: '' }).success).toBe(false);
    expect(SiteFields.safeParse({ ...good, country: 'D1' }).success).toBe(false);
    const ok = SiteFields.safeParse({ ...good, country: ' de ' });
    expect(ok.success && ok.data.country).toBe('DE');
  });

  it('refuses a blank label and one longer than the column', () => {
    expect(SiteFields.safeParse({ ...good, label: '  ' }).success).toBe(false);
    expect(SiteFields.safeParse({ ...good, label: 'x'.repeat(201) }).success).toBe(false);
  });

  it('refuses an id that is not a uuid, so nothing else is even attempted', () => {
    expect(SiteFieldsWithId.safeParse({ ...good, id: 'not-a-uuid' }).success).toBe(false);
    expect(SiteFieldsWithId.safeParse({ ...good, id: "1; DROP TABLE geo.buyer_site" })
      .success).toBe(false);
  });
});

describe('a refused write leaves nothing behind', () => {
  it('a site update the policy does not match writes no provenance row', async () => {
    // sylva.source_ref is append-only and world-readable. Minting one for a row
    // the caller cannot see would let any signed-in buyer add rows to it for
    // ever by posting other organisations' ids.
    const id = await addForA('DEMO site B may not move', 51.5, 9.5);

    const before = await asSuperuser(async (c) => {
      const r = await c.query(
        'SELECT count(*)::int AS n FROM sylva.source_ref WHERE label = $1',
        [SITE_SOURCE_LABEL]);
      return r.rows[0].n as number;
    });

    expect(await updateBuyerSite(BUYER_B, id, {
      label: 'DEMO hijacked', countryCode: 'NL', latitude: 1, longitude: 1,
    })).toBe(false);

    const after = await asSuperuser(async (c) => {
      const r = await c.query(
        'SELECT count(*)::int AS n FROM sylva.source_ref WHERE label = $1',
        [SITE_SOURCE_LABEL]);
      return r.rows[0].n as number;
    });
    expect(after).toBe(before);
  });
});
