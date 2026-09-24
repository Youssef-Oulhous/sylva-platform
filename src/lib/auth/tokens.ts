import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Session tokens.
 *
 * The token is 32 bytes of CSPRNG output, base64url so it survives a cookie
 * without escaping. It is an OPAQUE handle: it carries no claims, so nothing
 * about it can be tampered with, and revoking it is deleting one row.
 *
 * The database stores sha256(token) in identity.user_session.token_sha256 - a
 * sylva.sha256 domain, 32 bytes, which already existed. The raw token is never
 * sent to the database, so it cannot appear in a statement log or a parameter
 * trace. A database backup that leaks therefore hands nobody a usable session.
 */

const TOKEN_BYTES = 32;

export interface SessionToken {
  /** Goes in the cookie. Never stored anywhere. */
  readonly raw: string;
  /** Goes to identity.open_session. */
  readonly digest: Buffer;
}

export function newSessionToken(): SessionToken {
  const raw = randomBytes(TOKEN_BYTES).toString('base64url');
  return { raw, digest: digestOf(raw) };
}

export function digestOf(rawToken: string): Buffer {
  return createHash('sha256').update(rawToken, 'utf8').digest();
}

/**
 * A cookie value has to look like one of ours before it is worth a database
 * round trip. 32 bytes base64url is 43 characters; anything else is junk or a
 * probe and is rejected without touching the pool.
 */
export function looksLikeToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Constant-time equality for two digests. Used by the tests. */
export function digestsEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
