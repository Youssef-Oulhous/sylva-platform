import { afterAll, describe, expect, it } from 'vitest';
import { listProjects } from '@/lib/projects/queries';
import { ANONYMOUS } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { IncomparableUnitsError, sumSameUnit } from '@/lib/units/qty';

afterAll(async () => { await closeAllPools(); });

describe('projects index, read as an anonymous visitor', () => {
  it('returns only published projects', async () => {
    const ps = await listProjects(ANONYMOUS, 'en');
    expect(ps.length).toBe(2);
    expect(ps.map((p) => p.slug).sort()).toEqual([
      'demo-marais-de-briere-restoration',
      'demo-untere-havel-wetland-restoration',
    ]);
    // the third demo project is a draft and must not be reachable
    expect(ps.find((p) => p.slug.includes('oder-floodplain'))).toBeUndefined();
  });

  it('carries each project its own unit type, not a shared one', async () => {
    const ps = await listProjects(ANONYMOUS, 'en');
    const units = new Set(ps.flatMap((p) => p.availability.map((a) => a.unitOfMeasure)));
    expect(units).toEqual(new Set(['ha_yr', 'index_point']));
  });

  it('carries the vintage semantics, which differ between the two projects', async () => {
    const ps = await listProjects(ANONYMOUS, 'en');
    const v = new Set(ps.flatMap((p) => p.availability.map((a) => a.vintageSemantics)));
    expect(v).toEqual(new Set(['period_of_outcome', 'period_of_issuance']));
  });

  it('stamps every availability figure with a source and a date', async () => {
    const ps = await listProjects(ANONYMOUS, 'en');
    for (const p of ps) {
      for (const a of p.availability) {
        expect(a.source.label).toBeTruthy();
        expect(a.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('RULE 7: a platform-wide total over the index throws', async () => {
    const ps = await listProjects(ANONYMOUS, 'en');
    const every = ps.flatMap((p) => p.availability.map((a) => a.remaining));
    expect(every.length).toBeGreaterThan(2);
    expect(() => sumSameUnit(every)).toThrow(IncomparableUnitsError);
  });

  it('RULE 7: totalling within one project and unit type is fine', async () => {
    const ps = await listProjects(ANONYMOUS, 'en');
    for (const p of ps) {
      const total = sumSameUnit(p.availability.map((a) => a.remaining));
      expect(total).not.toBeNull();
      expect(total!.amount).toBeGreaterThan(0);
    }
  });

  it('serves German, falling back per field rather than hiding a project', async () => {
    const de = await listProjects(ANONYMOUS, 'de');
    expect(de.length).toBe(2);
    expect(de.some((p) => p.title.includes('Renaturierung'))).toBe(true);
  });
});
