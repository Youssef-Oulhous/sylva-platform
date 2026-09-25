import { Client } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  authSaltFor, authenticate, closeSession, openSession, registerOrganisation, resolveSession,
} from '@/lib/auth/queries';
import { deriveFromPrefix, hashPassword } from '@/lib/auth/password';
import { digestOf, looksLikeToken, newSessionToken } from '@/lib/auth/tokens';
import { actorFromSession, homePathFor, primaryRole } from '@/lib/auth/roles';
import { closeAllPools } from '@/lib/db/pool';

/**
 * Authentication, against the real database, through the real functions.
 *
 * Every call below goes through src/lib/auth/queries.ts, which runs as
 * sylva_login_public and can only reach identity through the SECURITY DEFINER
 * functions in db/migrations/0040. If a change breaks the seal, these tests
 * stop working rather than quietly start reading personal data directly.
 *
 * The demo password is in db/seed/0006_demo_passwords.sql, in plain text, on
 * purpose.
 */

const DEMO_PASSWORD = 'demo-password-not-for-production';
const BUYER = 'buyer.a@demo.sylva.example';
const OPERATOR = 'operator@demo.sylva.example';

/**
 * A superuser connection, for TEST HOUSEKEEPING ONLY: reading back what the
 * application wrote and deleting the organisations a registration test creates.
 * The application has no such connection and must never grow one - see
 * src/lib/db/session.ts. It is here because asserting "the raw token is not in
 * the database" requires looking at a table the application cannot see, which
 * is exactly the property being asserted.
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

const createdOrgs: string[] = [];

afterAll(async () => {
  if (createdOrgs.length > 0) {
    await asSuperuser(async (c) => {
      await c.query('DELETE FROM identity.user_platform_role WHERE user_id IN (SELECT id FROM identity.user_account WHERE org_id = ANY($1::uuid[]))', [createdOrgs]);
      await c.query('DELETE FROM identity.user_session WHERE user_id IN (SELECT id FROM identity.user_account WHERE org_id = ANY($1::uuid[]))', [createdOrgs]);
      await c.query('DELETE FROM identity.person_label WHERE org_id = ANY($1::uuid[])', [createdOrgs]);
      await c.query('DELETE FROM identity.user_account WHERE org_id = ANY($1::uuid[])', [createdOrgs]);
      await c.query('DELETE FROM org.organisation WHERE id = ANY($1::uuid[])', [createdOrgs]);
    });
  }
  await closeAllPools();
});

describe('identity.auth_salt', () => {
  it('returns parameters and salt, and never the stored key', async () => {
    const prefix = await authSaltFor(BUYER);
    expect(prefix).not.toBeNull();
    expect(prefix!.split('$')).toHaveLength(3);
    expect(prefix!.startsWith('scrypt$')).toBe(true);

    // The full stored record has four fields. What the application is given has
    // three: the verifier stays in the database.
    const stored = await asSuperuser(async (c) => {
      const r = await c.query<{ password_hash: string }>(
        'SELECT password_hash FROM identity.user_account WHERE email = $1::citext', [BUYER]);
      return r.rows[0]!.password_hash;
    });
    expect(stored.split('$')).toHaveLength(4);
    expect(stored.startsWith(prefix!)).toBe(true);
    expect(prefix).not.toContain(stored.split('$')[3]);
  });

  it('returns a decoy of the same shape for an address with no account', async () => {
    const decoy = await authSaltFor('nobody.at.all@demo.sylva.example');
    expect(decoy).not.toBeNull();
    expect(decoy).toMatch(/^scrypt\$N=16384,r=8,p=1,len=64\$[^$]+$/);
    // Stable for that address, so repeated probing looks like a real account.
    expect(await authSaltFor('nobody.at.all@demo.sylva.example')).toBe(decoy);
    // And different per address, as a real salt would be.
    expect(await authSaltFor('someone.else@demo.sylva.example')).not.toBe(decoy);
  });
});

describe('identity.authenticate', () => {
  it('accepts the correct password', async () => {
    const prefix = await authSaltFor(BUYER);
    const account = await authenticate(BUYER, await deriveFromPrefix(prefix!, DEMO_PASSWORD));
    expect(account).not.toBeNull();
    expect(account!.status).toBe('active');
    expect(account!.orgId).toBe('0c000000-0000-0000-0000-00000000000c');
    expect(account!.locale).toBe('de');
  });

  it('is case-insensitive on the address, because email is citext', async () => {
    const prefix = await authSaltFor(BUYER);
    const dk = await deriveFromPrefix(prefix!, DEMO_PASSWORD);
    const account = await authenticate(BUYER.toUpperCase(), dk);
    expect(account).not.toBeNull();
  });

  it('refuses the wrong password', async () => {
    const prefix = await authSaltFor(BUYER);
    const wrong = await deriveFromPrefix(prefix!, 'not the demo password');
    expect(await authenticate(BUYER, wrong)).toBeNull();
  });

  it('refuses an unknown email', async () => {
    const prefix = await authSaltFor('ghost@demo.sylva.example');
    const dk = await deriveFromPrefix(prefix!, DEMO_PASSWORD);
    expect(await authenticate('ghost@demo.sylva.example', dk)).toBeNull();
  });

  it('refuses a salt prefix borrowed from another account', async () => {
    // The stored record is salted per account, so a key derived under one
    // account's salt cannot authenticate another even with the right password.
    const otherPrefix = await authSaltFor(OPERATOR);
    const dk = await deriveFromPrefix(otherPrefix!, DEMO_PASSWORD);
    expect(await authenticate(BUYER, dk)).toBeNull();
  });

  it('does not obviously differ in timing between a wrong password and a wrong email', async () => {
    const attempt = async (email: string, password: string) => {
      const t0 = process.hrtime.bigint();
      const prefix = await authSaltFor(email);
      await authenticate(email, await deriveFromPrefix(prefix!, password));
      return Number(process.hrtime.bigint() - t0) / 1e6;
    };

    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

    // Warm the pool and the scrypt path before measuring anything.
    await attempt(BUYER, 'warm up');

    const wrongPassword: number[] = [];
    const wrongEmail: number[] = [];
    for (let i = 0; i < 7; i++) {
      // Interleaved, so a machine that gets busy halfway through skews both.
      wrongPassword.push(await attempt(BUYER, 'definitely not the password'));
      wrongEmail.push(await attempt(`no.such.person.${i}@demo.sylva.example`, 'definitely not the password'));
    }

    const ratio = median(wrongEmail) / median(wrongPassword);
    // The decoy salt makes both paths do one query, one scrypt and one query.
    // A generous band: this is an assertion that the decoy exists and works,
    // not a constant-time proof, and a shared CI machine is noisy.
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(2.5);
  });
});

describe('sessions', () => {
  it('opens, resolves and closes a session', async () => {
    const prefix = await authSaltFor(BUYER);
    const account = await authenticate(BUYER, await deriveFromPrefix(prefix!, DEMO_PASSWORD));
    const token = newSessionToken();
    expect(looksLikeToken(token.raw)).toBe(true);

    const opened = await openSession(account!.userId, token.digest, 3600);
    expect(opened.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(opened.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const resolved = await resolveSession(token.digest);
    expect(resolved).not.toBeNull();
    expect(resolved!.personRef).toBe(account!.personRef);
    expect(resolved!.orgId).toBe(account!.orgId);
    expect(resolved!.roles).toEqual(['buyer']);

    await closeSession(token.digest);
    expect(await resolveSession(token.digest)).toBeNull();
  });

  it('never stores the raw token', async () => {
    const prefix = await authSaltFor(BUYER);
    const account = await authenticate(BUYER, await deriveFromPrefix(prefix!, DEMO_PASSWORD));
    const token = newSessionToken();
    const opened = await openSession(account!.userId, token.digest, 3600);

    const row = await asSuperuser(async (c) => {
      const r = await c.query<{ token_sha256: Buffer }>(
        'SELECT token_sha256 FROM identity.user_session WHERE id = $1::uuid', [opened.sessionId]);
      return r.rows[0]!;
    });

    // What is stored is 32 bytes, and it is sha256 of the cookie value.
    expect(row.token_sha256.length).toBe(32);
    expect(row.token_sha256.equals(createHash('sha256').update(token.raw, 'utf8').digest())).toBe(true);
    // And the raw token appears nowhere in that table, in any column.
    const hits = await asSuperuser(async (c) => {
      const r = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM identity.user_session s
          WHERE s::text LIKE '%' || $1 || '%'`, [token.raw]);
      return Number(r.rows[0]!.n);
    });
    expect(hits).toBe(0);

    await closeSession(token.digest);
  });

  it('resolves an expired session to nothing', async () => {
    const prefix = await authSaltFor(BUYER);
    const account = await authenticate(BUYER, await deriveFromPrefix(prefix!, DEMO_PASSWORD));
    const token = newSessionToken();
    await openSession(account!.userId, token.digest, 1);

    expect(await resolveSession(token.digest)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 1400));
    expect(await resolveSession(token.digest)).toBeNull();

    await closeSession(token.digest);
  });

  it('resolves an unknown digest to nothing rather than erroring', async () => {
    expect(await resolveSession(digestOf('a token that was never issued'))).toBeNull();
  });

  it('refuses to open a session for an account that is not active', async () => {
    // The seed has no suspended account, so one is made and put back.
    const userId = await asSuperuser(async (c) => {
      const r = await c.query<{ id: string }>(
        `UPDATE identity.user_account SET status = 'suspended'
          WHERE email = 'unvetted@demo.sylva.example'::citext RETURNING id`);
      return r.rows[0]!.id;
    });
    try {
      await expect(openSession(userId, newSessionToken().digest, 3600))
        .rejects.toMatchObject({ code: 'SY024' });
    } finally {
      await asSuperuser((c) => c.query(
        `UPDATE identity.user_account SET status = 'active'
          WHERE email = 'unvetted@demo.sylva.example'::citext`));
    }
  });
});

describe('identity.register', () => {
  it('creates an organisation, an account, a record label and a role - and no approval', async () => {
    const email = `test.${Date.now()}@demo.sylva.example`;
    const account = await registerOrganisation({
      roleCode: 'buyer',
      legalName: 'DEMO Registration Test BV',
      registrationNumber: '000 000 (DEMO)',
      registeredAddress: 'Teststraat 1, 1011 Amsterdam, NL',
      countryCode: 'NL',
      sectorCode: 'food_bev',
      sizeBandCode: 'large',
      fullName: 'DEMO Test Person',
      jobTitle: 'Tester',
      email,
      passwordHash: await hashPassword('a sufficiently long passphrase'),
      locale: 'en',
    });
    createdOrgs.push(account.orgId);

    // Signing in works straight away.
    const prefix = await authSaltFor(email);
    const signedIn = await authenticate(email, await deriveFromPrefix(prefix!, 'a sufficiently long passphrase'));
    expect(signedIn).not.toBeNull();
    expect(signedIn!.orgId).toBe(account.orgId);

    const state = await asSuperuser(async (c) => {
      const label = await c.query(
        'SELECT ordinal, label FROM identity.person_label WHERE person_ref = $1::uuid',
        [account.personRef]);
      const role = await c.query(
        'SELECT role_code FROM identity.user_platform_role WHERE user_id = $1::uuid',
        [account.userId]);
      const approval = await c.query(
        'SELECT status FROM org.org_role_approval WHERE org_id = $1::uuid', [account.orgId]);
      return { label: label.rows[0], role: role.rows[0], approvals: approval.rowCount };
    });

    expect(state.label).toMatchObject({ ordinal: 1, label: 'representative #1' });
    expect(state.role).toMatchObject({ role_code: 'buyer' });
    // R6: registering is not being approved. No vetting decision exists, so the
    // approval cache has no row and a deal is impossible.
    expect(state.approvals).toBe(0);
  });

  it('refuses a second account on the same email address', async () => {
    await expect(registerOrganisation({
      roleCode: 'buyer',
      legalName: 'DEMO Duplicate BV',
      registrationNumber: null,
      registeredAddress: null,
      countryCode: 'NL',
      sectorCode: 'food_bev',
      sizeBandCode: 'large',
      fullName: 'DEMO Duplicate Person',
      jobTitle: null,
      email: BUYER,
      passwordHash: await hashPassword('a sufficiently long passphrase'),
      locale: 'en',
    })).rejects.toMatchObject({ code: 'SY020' });
  });

  it('refuses a role that is not a transacting role', async () => {
    await expect(registerOrganisation({
      // Deliberately past the TypeScript type: this is the server-side check,
      // and the point is that the DATABASE refuses it.
      roleCode: 'operator' as 'buyer',
      legalName: 'DEMO Operator Impostor BV',
      registrationNumber: null,
      registeredAddress: null,
      countryCode: 'NL',
      sectorCode: 'food_bev',
      sizeBandCode: 'large',
      fullName: 'DEMO Impostor',
      jobTitle: null,
      email: `impostor.${Date.now()}@demo.sylva.example`,
      passwordHash: await hashPassword('a sufficiently long passphrase'),
      locale: 'en',
    })).rejects.toMatchObject({ code: 'SY021' });
  });

  it('refuses an unknown sector code', async () => {
    await expect(registerOrganisation({
      roleCode: 'buyer',
      legalName: 'DEMO Bad Sector BV',
      registrationNumber: null,
      registeredAddress: null,
      countryCode: 'NL',
      sectorCode: 'food_beverage',   // the old hard-coded UI value; not a real code
      sizeBandCode: 'large',
      fullName: 'DEMO Bad Sector Person',
      jobTitle: null,
      email: `badsector.${Date.now()}@demo.sylva.example`,
      passwordHash: await hashPassword('a sufficiently long passphrase'),
      locale: 'en',
    })).rejects.toMatchObject({ code: 'SY022' });
  });
});

describe('a session becomes an Actor', () => {
  it('maps each demo account to the role the database gave it', async () => {
    const cases: [string, string, string][] = [
      [BUYER, 'buyer', '/dashboard'],
      ['owner.a@demo.sylva.example', 'project_owner', '/owner'],
      // /investor, not /dashboard. Sign-in used to send an investor to the
      // BUYER's workspace, which greeted them with "Buyer dashboard" and offered
      // site registration - a buyer's feature. The investor area exists now.
      ['investor.a@demo.sylva.example', 'investor', '/investor'],
      [OPERATOR, 'operator', '/admin/vetting'],
      // /auditor since the auditor's own area exists. The public record is a
      // strict subset of what that role is there to read.
      ['auditor@demo.sylva.example', 'auditor', '/auditor'],
    ];

    for (const [email, role, home] of cases) {
      const prefix = await authSaltFor(email);
      const account = await authenticate(email, await deriveFromPrefix(prefix!, DEMO_PASSWORD));
      expect(account, email).not.toBeNull();
      const token = newSessionToken();
      await openSession(account!.userId, token.digest, 3600);
      const session = await resolveSession(token.digest);
      expect(primaryRole(session!.roles), email).toBe(role);
      expect(homePathFor(session!.roles), email).toBe(home);

      const actor = actorFromSession(session!);
      expect(actor.kind, email).toBe(
        role === 'operator' ? 'operator' : role === 'auditor' ? 'auditor' : 'member');
      if (actor.kind === 'member') expect(actor.role).toBe(role);
      if (actor.kind !== 'anonymous') expect(actor.orgId).toBe(account!.orgId);

      await closeSession(token.digest);
    }
  });

  it('the operator wins when a person holds more than one role', () => {
    expect(primaryRole(['buyer', 'operator'])).toBe('operator');
    expect(primaryRole(['investor', 'buyer'])).toBe('buyer');
    expect(primaryRole([])).toBeNull();
  });

  it('an account with no platform role is anonymous, not a guessed buyer', () => {
    const actor = actorFromSession({
      userId: 'u', personRef: 'p', orgId: 'o', locale: 'en', status: 'active',
      roles: [], expiresAt: new Date(),
    });
    expect(actor.kind).toBe('anonymous');
  });
});
