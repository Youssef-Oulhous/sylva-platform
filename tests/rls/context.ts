/**
 * The attacker's shell.
 *
 * Everywhere else in this suite, and everywhere in the application, a statement
 * runs through withActor(). This file deliberately does not, because the whole
 * point of these tests is to do what withActor() will not: present a context it
 * did not mint, present one that has expired, replace one half way through a
 * transaction, and ask for a role the connection is not entitled to.
 *
 * It still uses the real connection pools, so it is the real login roles that
 * are being tested - sylva_login_app really does hold EXECUTE on
 * sylva.mint_actor_ctx, and sylva_login_public really is a member of nothing
 * but sylva_web_anon.
 *
 * Nothing outside tests/rls may import this.
 */
import type { PoolName } from '@/lib/db/actor';
import { poolFor } from '@/lib/db/pool';

export type Q = (
  sql: string,
  params?: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Mint a genuine signed context as the LOGIN role, before any SET ROLE.
 *
 * This is step 2 of withActor(), on its own. A negative ttl mints a context
 * that is already expired, which is the only honest way to test expiry without
 * waiting fifteen minutes.
 */
export async function mintContext(
  pool: PoolName,
  orgId: string,
  personRef: string | null,
  ttl = '15 minutes',
): Promise<string> {
  const client = await poolFor(pool).connect();
  try {
    const { rows } = await client.query(
      'SELECT sylva.mint_actor_ctx($1::uuid, $2::uuid, $3::interval) AS ctx',
      [orgId, personRef, ttl],
    );
    return rows[0].ctx as string;
  } finally {
    client.release();
  }
}

/** Swap the organisation in a signed context and keep everything else, MAC included. */
export function swapOrganisation(ctx: string, newOrgId: string): string {
  const parts = ctx.split(':');
  if (parts.length !== 4) throw new Error(`not a signed context: ${ctx}`);
  return [newOrgId, parts[1], parts[2], parts[3]].join(':');
}

export interface Shell {
  pool: PoolName;
  /** Omit to stay as the login role, which is what the escalation test needs. */
  dbRole?: string;
  /** The value put into sylva.actor_ctx. null sets nothing at all. */
  ctx?: string | null;
}

/**
 * Open a transaction, optionally set a context and a role, run the work, and
 * ALWAYS roll back.
 */
export async function inShell<T>(shell: Shell, work: (q: Q) => Promise<T>): Promise<T> {
  const client = await poolFor(shell.pool).connect();
  try {
    await client.query('BEGIN');
    if (shell.ctx != null) {
      await client.query('SELECT set_config($1, $2, true)', ['sylva.actor_ctx', shell.ctx]);
    }
    if (shell.dbRole) {
      await client.query(`SET LOCAL ROLE ${shell.dbRole}`);
    }
    const q: Q = async (sql, params = []) => {
      const res = await client.query(sql, params as unknown[]);
      return res.rows as Record<string, unknown>[];
    };
    return await work(q);
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    client.release();
  }
}

export interface PgFailure { code: string; message: string }

/** Run and report the failure rather than throwing, so a test can name it. */
export async function expectFailure(
  shell: Shell,
  sql: string,
  params: readonly unknown[] = [],
): Promise<PgFailure> {
  try {
    await inShell(shell, (q) => q(sql, params));
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { code: e.code ?? '', message: e.message ?? String(err) };
  }
  throw new Error(`expected the database to refuse, but it allowed: ${sql}`);
}
