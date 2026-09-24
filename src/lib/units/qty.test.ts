import { describe, expect, it } from 'vitest';
import { addSameUnit, IncomparableUnitsError, qty, sumSameUnit } from './qty';

const PA = 'aaaaaaaa-0000-0000-0000-00000000000a';
const PB = 'bbbbbbbb-0000-0000-0000-00000000000b';
const UA = '11110000-0000-0000-0000-000000000001';
const UB = '22220000-0000-0000-0000-000000000002';

describe('Rule 7 — unit volumes are never added across projects or unit types', () => {
  it('adds two quantities of the same project and unit type', () => {
    expect(addSameUnit(qty(PA, UA, 12_400), qty(PA, UA, 4_800)).amount).toBe(17_200);
  });

  it('refuses to add across projects', () => {
    expect(() => addSameUnit(qty(PA, UA, 12_400), qty(PB, UA, 10_000)))
      .toThrow(IncomparableUnitsError);
  });

  it('refuses to add across unit types within one project', () => {
    expect(() => addSameUnit(qty(PA, UA, 12_400), qty(PA, UB, 300)))
      .toThrow(IncomparableUnitsError);
  });

  it('refuses a platform-wide total over the demo fixture', () => {
    // hectare-years and index points: the exact pairing the seed creates
    const all = [qty(PA, UA, 11_400), qty(PA, UA, 9_200), qty(PB, UB, 486)];
    expect(() => sumSameUnit(all)).toThrow(IncomparableUnitsError);
  });

  it('totals correctly once grouped by project and unit type', () => {
    expect(sumSameUnit([qty(PA, UA, 11_400), qty(PA, UA, 9_200)])!.amount).toBe(20_600);
    expect(sumSameUnit([qty(PB, UB, 486)])!.amount).toBe(486);
  });

  it('returns null for an empty set rather than zero', () => {
    // A zero would be a number a screen could render. Null cannot be.
    expect(sumSameUnit([])).toBeNull();
  });
});
