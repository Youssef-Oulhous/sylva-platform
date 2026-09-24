import type { PoolClient } from 'pg';
import { planFor, type Actor } from '@/lib/db/actor';
import { poolFor } from '@/lib/db/pool';
import type { Tx } from '@/lib/db/session';

/**
 * withActor(), but it always rolls back.
 *
 * This file exists for one reason, and it is a property of the schema rather
 * than a convenience:
 *
 *   org.vetting_submission, org.vetting_answer and org.vetting_decision are
 *   append-only. UPDATE and DELETE are revoked from every application role AND
 *   blocked by ENABLE ALWAYS triggers, which fire for the table owner and for a
 *   superuser too. A test that submits a questionnaire can therefore never
 *   remove it, and a test that records a vetting decision would put an
 *   approval on a real demo organisation's permanent record - changing what
 *   every other test and every other agent sees, for ever.
 *
 * So the write tests run inside a transaction that is rolled back. What they
 * exercise is not a mock: it is the same SQL, through the same functions, as
 * the real login role, with a real HMAC-signed actor context, against the real
 * triggers. The append-only triggers, the R6 trigger and every row-level policy
 * all fire exactly as they would in production. Only the COMMIT is missing.
 *
 * The five steps below are withActor()'s, in the same order and for the same
 * reasons - see src/lib/db/session.ts. Step 2 must precede step 4: sylva_buyer
 * has no EXECUTE on sylva.mint_actor_ctx, by design.
 *
 * Nothing in src/ may import this.
 */

function wrap(client: PoolClient): Tx {
  return {
    async query<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<R[]> {
      const res = await client.query(text, params as unknown[]);
      return res.rows as R[];
    },
    async one<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<R> {
      const rows = await this.query<R>(text, params);
      if (rows.length !== 1) throw new Error(`expected exactly 1 row, got ${rows.length}`);
      return rows[0]!;
    },
    async maybe<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<R | null> {
      const rows = await this.query<R>(text, params);
      if (rows.length > 1) throw new Error(`expected at most 1 row, got ${rows.length}`);
      return rows[0] ?? null;
    },
  };
}

export async function inRolledBackTransaction<T>(
  actor: Actor,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const { pool, dbRole } = planFor(actor);
  const client = await poolFor(pool).connect();
  try {
    await client.query('BEGIN');

    if (actor.kind !== 'anonymous') {
      const { rows } = await client.query(
        'SELECT sylva.mint_actor_ctx($1::uuid, $2::uuid, $3::interval) AS ctx',
        [actor.orgId, actor.personRef, '15 minutes'],
      );
      await client.query('SELECT set_config($1, $2, true)', [
        'sylva.actor_ctx',
        rows[0].ctx as string,
      ]);
    }

    await client.query(`SET LOCAL ROLE ${dbRole}`);
    return await work(wrap(client));
  } finally {
    // ALWAYS. Not in a catch: a test that passes must leave no trace either.
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    client.release();
  }
}

/** The SQLSTATE and message of a refusal, so a test can name which rule fired. */
export interface Refusal {
  readonly code: string;
  readonly message: string;
}

export async function refusalOf(fn: () => Promise<unknown>): Promise<Refusal> {
  try {
    await fn();
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { code: e.code ?? '', message: e.message ?? String(err) };
  }
  throw new Error('expected the database to refuse, but it allowed the statement');
}
