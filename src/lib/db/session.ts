import type { PoolClient } from 'pg';
import { planFor, type Actor } from './actor';
import { poolFor } from './pool';

/**
 * Run a unit of work as a specific actor.
 *
 * Order matters and is load-bearing:
 *
 *   1  BEGIN                     everything below is LOCAL to this transaction
 *   2  mint the signed context   still as the LOGIN role, which may EXECUTE it
 *   3  SET LOCAL sylva.actor_ctx the verified-at-read-time organisation context
 *   4  SET LOCAL ROLE            drop to the privilege role for the whole query
 *   5  ... the caller's queries
 *   6  COMMIT / ROLLBACK         SET LOCAL unwinds with the transaction
 *
 * Step 2 must precede step 4: sylva_buyer has no EXECUTE on mint_actor_ctx, by
 * design, so that a compromised query surface cannot mint itself a context for
 * another organisation.
 *
 * SET LOCAL rather than SET is the whole reason a pooled connection is safe
 * here. Nothing survives into the next checkout of this client.
 */

export interface Tx {
  /** Parameterised query. Never interpolate values into the text. */
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<R[]>;
  /** Exactly one row, or an error. Use where zero rows is a bug. */
  one<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<R>;
  /** Zero or one row. */
  maybe<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<R | null>;
}

const CTX_TTL = process.env.SYLVA_CTX_TTL ?? '15 minutes';

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
      if (rows.length !== 1) {
        throw new Error(`expected exactly 1 row, got ${rows.length}`);
      }
      return rows[0]!;
    },
    async maybe<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<R | null> {
      const rows = await this.query<R>(text, params);
      if (rows.length > 1) {
        throw new Error(`expected at most 1 row, got ${rows.length}`);
      }
      return rows[0] ?? null;
    },
  };
}

export async function withActor<T>(
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
        [actor.orgId, actor.personRef, CTX_TTL],
      );
      // set_config with is_local = true is SET LOCAL, but parameterised.
      await client.query('SELECT set_config($1, $2, true)', [
        'sylva.actor_ctx',
        rows[0].ctx as string,
      ]);
    }

    // dbRole never comes from user input - see actor.ts. Identifiers cannot be
    // bound as parameters, so the closed mapping is what keeps this safe.
    await client.query(`SET LOCAL ROLE ${dbRole}`);

    const out = await work(wrap(client));
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw err;
  } finally {
    client.release();
  }
}

/** Read-only convenience: the same thing, but the transaction cannot write. */
export async function readAs<T>(
  actor: Actor,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return withActor(actor, async (tx) => {
    await tx.query('SET TRANSACTION READ ONLY');
    return work(tx);
  });
}
