import { Pool, type PoolConfig } from 'pg';
import type { PoolName } from './actor';

/**
 * One connection pool per LOGIN role.
 *
 * The separation is the point, not an optimisation. sylva_login_public is a
 * member of sylva_web_anon only, so a request served by the public pool cannot
 * SET LOCAL ROLE to sylva_buyer even if application code asked it to - Postgres
 * refuses. An authorization bug in this codebase therefore cannot turn an
 * anonymous visitor into a buyer.
 *
 * None of these roles holds BYPASSRLS and none is a superuser; ci.assert_*
 * proves it on every migration run.
 */

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing environment variable ${name}`);
  return v;
}

function base(): Omit<PoolConfig, 'user' | 'password'> {
  return {
    host: need('PGHOST'),
    port: Number(need('PGPORT')),
    database: need('PGDATABASE'),
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Every statement is expected to be short. A project page that needs more
    // than this is a bug, not a slow query.
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 5_000),
    application_name: 'sylva',
    ssl: process.env.PGSSLMODE === 'disable' ? undefined : { rejectUnauthorized: true },
  };
}

const ROLE_ENV: Record<PoolName, { user: string; password: string }> = {
  public:   { user: 'SYLVA_DB_PUBLIC_USER',   password: 'SYLVA_DB_PUBLIC_PASSWORD' },
  app:      { user: 'SYLVA_DB_APP_USER',      password: 'SYLVA_DB_APP_PASSWORD' },
  operator: { user: 'SYLVA_DB_OPERATOR_USER', password: 'SYLVA_DB_OPERATOR_PASSWORD' },
  auditor:  { user: 'SYLVA_DB_AUDITOR_USER',  password: 'SYLVA_DB_AUDITOR_PASSWORD' },
};

const pools = new Map<PoolName, Pool>();

export function poolFor(name: PoolName): Pool {
  let p = pools.get(name);
  if (!p) {
    const env = ROLE_ENV[name];
    p = new Pool({
      ...base(),
      user: need(env.user),
      password: process.env[env.password] ?? undefined,
    });
    p.on('error', (err) => {
      // An idle client erroring must not take the process down.
      console.error(JSON.stringify({ level: 'error', msg: 'pg idle client error', pool: name, err: err.message }));
    });
    pools.set(name, p);
  }
  return p;
}

export async function closeAllPools(): Promise<void> {
  await Promise.all([...pools.values()].map((p) => p.end()));
  pools.clear();
}
