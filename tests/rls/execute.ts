/**
 * Runs the matrix against the real database and reports cell by cell.
 *
 * Kept separate from the test file so the same run can be printed as a grid,
 * asserted on, and diffed by hand during development, without three copies of
 * the loop.
 */
import { actorFor } from './principals';
import { PRINCIPAL_IDS, type PrincipalId } from './catalog';
import { attemptWrite, readKeys, type ReadOutcome, type WriteOutcome } from './probe';
import { TABLES, type TableSpec } from './matrix';

export type Verb = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
export const VERBS: readonly Verb[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

export interface Cell {
  table: string;
  verb: Verb;
  principal: PrincipalId;
  expected: ReadOutcome | WriteOutcome;
  actual: ReadOutcome | WriteOutcome;
  ok: boolean;
}

function sameOutcome(a: Cell['expected'], b: Cell['actual']): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function writeSpec(t: TableSpec, verb: Verb) {
  switch (verb) {
    case 'INSERT': return t.insert;
    case 'UPDATE': return t.update;
    case 'DELETE': return t.remove;
    default: return undefined;
  }
}

/** Run every cell of one table. Sequential on purpose: no races between roles. */
export async function runTable(t: TableSpec): Promise<Cell[]> {
  const cells: Cell[] = [];

  for (const p of PRINCIPAL_IDS) {
    const expected = t.read.expect[p];
    const actual = await readKeys(actorFor(p), t.read.sql, t.read.key, t.read.params ?? []);
    cells.push({ table: t.id, verb: 'SELECT', principal: p, expected, actual, ok: sameOutcome(expected, actual) });
  }

  for (const verb of ['INSERT', 'UPDATE', 'DELETE'] as const) {
    const spec = writeSpec(t, verb);
    if (!spec) continue;
    for (const p of PRINCIPAL_IDS) {
      const expected = spec.expect[p];
      const { sql, params } = spec.stmt(p);
      const actual: WriteOutcome = await attemptWrite(actorFor(p), sql, params);
      cells.push({ table: t.id, verb, principal: p, expected, actual, ok: expected === actual });
    }
  }

  return cells;
}

export async function runMatrix(tables: readonly TableSpec[] = TABLES): Promise<Cell[]> {
  const out: Cell[] = [];
  for (const t of tables) out.push(...(await runTable(t)));
  return out;
}
