/**
 * A quantity of units, carrying the project and unit type it belongs to.
 *
 * This mirrors sylva.unit_qty in the database, and exists for the same reason:
 * Rule 7 says no screen, query, export or chart may add unit volumes across
 * different projects. The database refuses such a sum inside
 * sylva.sum_same_unit. This is the other half - the application must not be
 * able to express it either.
 *
 * The honest limit: the database has a greppable escape hatch, `(qty).amount`,
 * and so does this module, `.amount`. Neither can be closed completely. What
 * both can do is make the unsafe thing visible: a reviewer scanning for
 * `.amount` outside a formatter, or for `+` between two quantities, sees the
 * mistake. That, plus the tests in tests/rule7, is what Rule 7 actually is.
 */

declare const brand: unique symbol;

export interface UnitQty {
  readonly projectId: string;
  readonly unitTypeId: string;
  /** Raw number. Only ever read by a formatter, or by addSameUnit below. */
  readonly amount: number;
  readonly [brand]?: 'UnitQty';
}

export class IncomparableUnitsError extends Error {
  constructor(
    readonly a: UnitQty,
    readonly b: UnitQty,
    readonly reason: 'project' | 'unitType',
  ) {
    super(
      reason === 'project'
        ? `R7: refusing to add unit volumes across projects (${a.projectId} and ${b.projectId}). ` +
          `Units of different projects are not interchangeable.`
        : `R7: refusing to add unit volumes across unit types (${a.unitTypeId} and ${b.unitTypeId}). ` +
          `Units of different unit types are not interchangeable.`,
    );
    this.name = 'IncomparableUnitsError';
  }
}

export function qty(projectId: string, unitTypeId: string, amount: number): UnitQty {
  return { projectId, unitTypeId, amount };
}

/** Build a UnitQty from the three columns a query must always select together. */
export function qtyFromRow(row: {
  project_id: string;
  unit_type_id: string;
  amount: string | number;
}): UnitQty {
  return {
    projectId: row.project_id,
    unitTypeId: row.unit_type_id,
    amount: typeof row.amount === 'string' ? Number(row.amount) : row.amount,
  };
}

/**
 * The only addition permitted anywhere in this codebase.
 * Throws rather than returning an error, because a cross-project total must
 * never be quietly rendered as something plausible.
 */
export function addSameUnit(a: UnitQty, b: UnitQty): UnitQty {
  if (a.projectId !== b.projectId) throw new IncomparableUnitsError(a, b, 'project');
  if (a.unitTypeId !== b.unitTypeId) throw new IncomparableUnitsError(a, b, 'unitType');
  return { projectId: a.projectId, unitTypeId: a.unitTypeId, amount: a.amount + b.amount };
}

export function sumSameUnit(xs: readonly UnitQty[]): UnitQty | null {
  if (xs.length === 0) return null;
  return xs.reduce(addSameUnit);
}

/** True when two quantities are even comparable. Use before showing a delta. */
export function isComparable(a: UnitQty, b: UnitQty): boolean {
  return a.projectId === b.projectId && a.unitTypeId === b.unitTypeId;
}

/**
 * Format for display. The unit label always travels with the number, because a
 * bare "12,400" on a screen invites exactly the comparison Rule 7 forbids.
 */
export function formatQty(
  q: UnitQty,
  unitLabel: string,
  locale: string,
  decimals = 0,
): string {
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(q.amount);
  return `${n} ${unitLabel}`;
}
