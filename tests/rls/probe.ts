/**
 * Running one statement as one principal, and naming what the database did.
 *
 * Two rules this file exists to keep:
 *
 *  1. Every statement goes through withActor(), exactly as application code
 *     does, so the matrix exercises POLICIES and PRIVILEGES and not a bespoke
 *     connection that happens to behave. No raw client is opened here. The one
 *     place that must open one is tests/rls/context.ts, which is the attacker's
 *     shell and says so.
 *
 *  2. A write probe must never survive. Every probe throws a sentinel out of
 *     the work function, so withActor() rolls the transaction back. The matrix
 *     can therefore attempt an INSERT as all ten principals without leaving ten
 *     rows behind - which matters more than usual here, because most of these
 *     tables are append-only and a stray row could not be removed afterwards.
 */
import type { Actor } from '@/lib/db/actor';
import { withActor, type Tx } from '@/lib/db/session';

class Rollback extends Error {
  constructor(readonly value: unknown) {
    super('rls probe: deliberate rollback');
    this.name = 'Rollback';
  }
}

/** Run work as `actor`, then roll the transaction back whatever happened. */
export async function probe<T>(actor: Actor, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    await withActor(actor, async (tx) => {
      throw new Rollback(await work(tx));
    });
  } catch (err) {
    if (err instanceof Rollback) return err.value as T;
    throw err;
  }
  /* c8 ignore next */
  throw new Error('rls probe: withActor returned without the rollback sentinel');
}

// ---------------------------------------------------------------- outcomes

/**
 * What a write attempt did, in the words a reviewer needs.
 *
 *   ok            the statement was permitted and changed at least one row
 *   no-rows       permitted, but row-level security left nothing to change
 *   denied        PostgreSQL refused on PRIVILEGE (42501, or no schema USAGE)
 *   blocked       permitted, but the row violated a row-level security policy
 *   refused:CODE  a rule trigger refused it - R4, R6, the publication gate
 */
export type WriteOutcome =
  | 'ok'
  | 'no-rows'
  | 'denied'
  | 'blocked'
  | `refused:${string}`;

/** What a read attempt returned: a privilege refusal, or a set of row keys. */
export type ReadOutcome = 'denied' | readonly string[];

interface PgError { code?: string; message?: string }

function pgErr(err: unknown): PgError | null {
  return typeof err === 'object' && err !== null ? (err as PgError) : null;
}

/**
 * Classify a failure.
 *
 * PostgreSQL uses 42501 for both "you hold no privilege on this table" and
 * "your row violated a row-level security policy". They are very different
 * findings - the first is a locked door, the second is a door that opened onto
 * a wall - so they are separated by message, which is the only thing that
 * distinguishes them on the wire.
 */
export function classifyWriteError(err: unknown): WriteOutcome {
  const e = pgErr(err);
  const code = e?.code ?? '';
  const msg = e?.message ?? String(err);
  if (code === '42501') {
    return /row-level security/i.test(msg) ? 'blocked' : 'denied';
  }
  // permission denied for schema <x> also arrives as 42501; anything else that
  // mentions permission is still a refusal and not a silent success.
  if (/permission denied/i.test(msg)) return 'denied';
  if (code) return `refused:${code}`;
  throw err;
}

export function classifyReadError(err: unknown): 'denied' {
  const e = pgErr(err);
  const msg = e?.message ?? String(err);
  if (e?.code === '42501' || /permission denied/i.test(msg)) return 'denied';
  throw err;
}

// ------------------------------------------------------------------ helpers

export type Row = Record<string, unknown>;

/**
 * Read as `actor` and return the sorted, de-duplicated set of row keys.
 *
 * De-duplicated because the question the matrix answers is "whose data can this
 * principal reach", not "how many rows". Two vetting answers belonging to the
 * same organisation are one fact about isolation.
 */
export async function readKeys(
  actor: Actor,
  sql: string,
  key: (r: Row) => string,
  params: readonly unknown[] = [],
): Promise<ReadOutcome> {
  return probe(actor, async (tx) => {
    try {
      const rows = await tx.query<Row>(sql, params);
      return [...new Set(rows.map(key))].sort();
    } catch (err) {
      return classifyReadError(err);
    }
  });
}

/**
 * Attempt a write as `actor`. The statement MUST end in RETURNING, so a
 * permitted-but-filtered UPDATE or DELETE can be told apart from a permitted
 * one that actually changed something.
 */
export async function attemptWrite(
  actor: Actor,
  sql: string,
  params: readonly unknown[] = [],
): Promise<WriteOutcome> {
  return probe(actor, async (tx) => {
    try {
      const rows = await tx.query(sql, params);
      return rows.length > 0 ? 'ok' : 'no-rows';
    } catch (err) {
      return classifyWriteError(err);
    }
  });
}
