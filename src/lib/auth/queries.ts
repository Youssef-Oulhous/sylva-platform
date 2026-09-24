import { withLoginRole } from '@/lib/db/session';

/**
 * Every authentication call the application can make, and there are exactly
 * six. Each one is a SECURITY DEFINER function from db/migrations/0040: no
 * statement in this file names a table in schema identity, because no role this
 * application connects as may.
 *
 * All six run through withLoginRole(), i.e. as sylva_login_public, before any
 * actor exists. See the comment on that function for why that is the safe
 * choice and not a shortcut.
 */

export interface AuthenticatedAccount {
  readonly userId: string;
  readonly personRef: string;
  readonly orgId: string;
  readonly locale: string;
  /** 'invited' | 'pending_verification' | 'active' | 'suspended'. */
  readonly status: string;
}

export interface ResolvedSession extends AuthenticatedAccount {
  /** Platform roles from identity.user_platform_role. May be empty. */
  readonly roles: readonly string[];
  readonly expiresAt: Date;
}

/**
 * Step 1 of sign-in: the scrypt parameters and salt for an email address.
 *
 * Returns a decoy of the same shape for an address with no account, so the
 * caller does the same work and the two failures cost the same. Treat the
 * result as opaque: it is not evidence that the account exists.
 */
export async function authSaltFor(email: string): Promise<string | null> {
  return withLoginRole(async (tx) => {
    const row = await tx.maybe<{ salt: string | null }>(
      'SELECT identity.auth_salt($1::citext) AS salt',
      [email],
    );
    return row?.salt ?? null;
  });
}

/**
 * Step 2 of sign-in: the database compares the candidate with the stored
 * verifier and answers with the account, or with nothing. The stored verifier
 * never comes back over the wire.
 */
export async function authenticate(
  email: string,
  derivedKey: string,
): Promise<AuthenticatedAccount | null> {
  return withLoginRole(async (tx) => {
    const row = await tx.maybe<{
      user_id: string; person_ref: string; org_id: string; locale: string; status: string;
    }>(
      `SELECT user_id, person_ref, org_id, locale, status
         FROM identity.authenticate($1::citext, $2::text)`,
      [email, derivedKey],
    );
    if (!row) return null;
    return {
      userId: row.user_id,
      personRef: row.person_ref,
      orgId: row.org_id,
      locale: row.locale,
      status: row.status,
    };
  });
}

export interface OpenedSession {
  readonly sessionId: string;
  readonly expiresAt: Date;
}

/**
 * `digest` is sha256(token). The raw token never reaches the database.
 *
 * The lifetime is in seconds rather than hours so a test can open a session
 * that expires while the test is still running. Production passes
 * SYLVA_SESSION_TTL_HOURS converted here.
 */
export async function openSession(
  userId: string,
  digest: Buffer,
  ttlSeconds: number,
): Promise<OpenedSession> {
  return withLoginRole(async (tx) => {
    const row = await tx.one<{ session_id: string; expires_at: Date }>(
      `SELECT session_id, expires_at
         FROM identity.open_session($1::uuid, $2::bytea, make_interval(secs => $3::int))`,
      [userId, digest, Math.max(1, Math.trunc(ttlSeconds))],
    );
    return { sessionId: row.session_id, expiresAt: row.expires_at };
  });
}

/** Null for an unknown, expired or suspended session - never an error. */
export async function resolveSession(digest: Buffer): Promise<ResolvedSession | null> {
  return withLoginRole(async (tx) => {
    const row = await tx.maybe<{
      user_id: string; person_ref: string; org_id: string; locale: string;
      status: string; roles: string[]; expires_at: Date;
    }>(
      `SELECT user_id, person_ref, org_id, locale, status, roles, expires_at
         FROM identity.resolve_session($1::bytea)`,
      [digest],
    );
    if (!row) return null;
    return {
      userId: row.user_id,
      personRef: row.person_ref,
      orgId: row.org_id,
      locale: row.locale,
      status: row.status,
      roles: row.roles ?? [],
      expiresAt: row.expires_at,
    };
  });
}

export async function closeSession(digest: Buffer): Promise<void> {
  await withLoginRole(async (tx) => {
    await tx.query('SELECT identity.close_session($1::bytea)', [digest]);
  });
}

export interface RegistrationInput {
  readonly roleCode: 'buyer' | 'project_owner' | 'investor';
  readonly legalName: string;
  readonly registrationNumber: string | null;
  readonly registeredAddress: string | null;
  readonly countryCode: string;
  readonly sectorCode: string;
  readonly sizeBandCode: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly email: string;
  /** The full scrypt record from hashPassword(). Never a plain password. */
  readonly passwordHash: string;
  readonly locale: string;
}

export interface RegisteredAccount {
  readonly userId: string;
  readonly personRef: string;
  readonly orgId: string;
}

/**
 * Creates the organisation, the account, the record label and the role in one
 * transaction. It does NOT approve anything: R6 still refuses this
 * organisation a deal until Sylva records a vetting decision.
 */
export async function registerOrganisation(
  input: RegistrationInput,
): Promise<RegisteredAccount> {
  return withLoginRole(async (tx) => {
    const row = await tx.one<{ user_id: string; person_ref: string; org_id: string }>(
      `SELECT user_id, person_ref, org_id
         FROM identity.register($1::text, $2::text, $3::text, $4::text, $5::text,
                                $6::text, $7::text, $8::text, $9::text,
                                $10::citext, $11::text, $12::text)`,
      [
        input.roleCode, input.legalName, input.registrationNumber,
        input.registeredAddress, input.countryCode, input.sectorCode,
        input.sizeBandCode, input.fullName, input.jobTitle, input.email,
        input.passwordHash, input.locale,
      ],
    );
    return { userId: row.user_id, personRef: row.person_ref, orgId: row.org_id };
  });
}
