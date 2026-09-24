import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing: scrypt, from node:crypto and nothing else.
 *
 * Not argon2 and not bcrypt. Both are native addons and this codebase has no
 * compiler available, so `npm install` of either fails on the machine the
 * platform is built on. scrypt is memory-hard, is in the standard library, and
 * adds no dependency - which also means nothing here has to be audited for EU
 * data residency.
 *
 * The stored record is one self-describing string:
 *
 *     scrypt$N=16384,r=8,p=1,len=64$<salt base64>$<derived key base64>
 *
 * Parameters travel WITH the hash, so raising the cost later is a new record
 * format for new passwords and not a migration of the old ones.
 *
 * Two halves, and the split matters:
 *
 *   hashPassword()      used at registration and when setting a demo password.
 *   deriveFromPrefix()  used at sign-in. The database hands back the
 *                       parameters and salt (identity.auth_salt) - never the
 *                       stored key - this derives the candidate, and
 *                       identity.authenticate does the comparison inside the
 *                       database. The application therefore never holds the
 *                       verifier for an account it failed to authenticate.
 *
 * verifyPassword() compares locally with crypto.timingSafeEqual. It is used by
 * the tests and as a second opinion; it is not the path sign-in takes.
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export interface ScryptParams {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly len: number;
}

/**
 * ~16 MiB and ~50-80 ms per attempt on a small EU VM. High enough to make
 * offline cracking expensive, low enough that a sign-in still feels immediate.
 */
export const DEFAULT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1, len: 64 };

/** Upper bounds, so a malformed or hostile prefix cannot ask for gigabytes. */
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_LEN = 128;
const SALT_BYTES = 16;

export class PasswordFormatError extends Error {
  constructor(what: string) {
    super(`password record: ${what}`);
    this.name = 'PasswordFormatError';
  }
}

function formatParams(p: ScryptParams): string {
  return `N=${p.N},r=${p.r},p=${p.p},len=${p.len}`;
}

function parseParams(text: string): ScryptParams {
  const out: Record<string, number> = {};
  for (const part of text.split(',')) {
    const [k, v] = part.split('=');
    if (!k || !v || !/^\d+$/.test(v)) throw new PasswordFormatError(`bad parameter "${part}"`);
    out[k] = Number(v);
  }
  const { N, r, p, len } = out;
  if (!N || !r || !p || !len) throw new PasswordFormatError('missing a parameter');
  // Powers of two only, and inside the bounds above.
  if (N < 2 || N > MAX_N || (N & (N - 1)) !== 0) throw new PasswordFormatError('N out of range');
  if (r < 1 || r > MAX_R) throw new PasswordFormatError('r out of range');
  if (p < 1 || p > MAX_P) throw new PasswordFormatError('p out of range');
  if (len < 16 || len > MAX_LEN) throw new PasswordFormatError('len out of range');
  return { N, r, p, len };
}

/** The parameters-and-salt half of a record: everything but the derived key. */
export interface SaltPrefix {
  readonly text: string;
  readonly params: ScryptParams;
  readonly salt: Buffer;
}

export function parseSaltPrefix(prefix: string): SaltPrefix {
  const parts = prefix.split('$');
  if (parts.length !== 3) throw new PasswordFormatError('prefix must have three fields');
  const [scheme, params, saltB64] = parts as [string, string, string];
  if (scheme !== 'scrypt') throw new PasswordFormatError(`unsupported scheme "${scheme}"`);
  const salt = Buffer.from(saltB64, 'base64');
  if (salt.length < 8) throw new PasswordFormatError('salt too short');
  return { text: prefix, params: parseParams(params), salt };
}

/** The first three fields of a stored record. Safe to hand to a client. */
export function saltPrefixOf(record: string): string {
  const parts = record.split('$');
  if (parts.length !== 4) throw new PasswordFormatError('record must have four fields');
  return parts.slice(0, 3).join('$');
}

/**
 * Derive the candidate record for a password against a prefix the database
 * supplied. The result is byte-for-byte what a correct password would have
 * been stored as, which is why the database can compare the two directly.
 */
export async function deriveFromPrefix(prefix: string, password: string): Promise<string> {
  const { text, params, salt } = parseSaltPrefix(prefix);
  const dk = await scrypt(normalise(password), salt, params.len, {
    N: params.N,
    r: params.r,
    p: params.p,
    // 128 * N * r is scrypt's working set; give it headroom or node throws.
    maxmem: 256 * params.N * params.r + 32 * 1024 * 1024,
  });
  return `${text}$${dk.toString('base64')}`;
}

/** A fresh record for a new password: random 16-byte salt, default parameters. */
export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const prefix = `scrypt$${formatParams(params)}$${salt.toString('base64')}`;
  return deriveFromPrefix(prefix, password);
}

/**
 * Local verification, in constant time. Both buffers are the same length
 * because both are `len` bytes of scrypt output, so timingSafeEqual never
 * throws on a length mismatch that itself leaks something.
 */
export async function verifyPassword(record: string, password: string): Promise<boolean> {
  let candidate: string;
  try {
    candidate = await deriveFromPrefix(saltPrefixOf(record), password);
  } catch {
    return false;
  }
  const a = Buffer.from(record.split('$')[3] ?? '', 'base64');
  const b = Buffer.from(candidate.split('$')[3] ?? '', 'base64');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Unicode normalisation before hashing. Without it the same password typed on
 * a Mac and on Windows can produce different bytes - a real support ticket,
 * not a theoretical one, on a platform with German and French users.
 */
function normalise(password: string): string {
  return password.normalize('NFKC');
}

/**
 * The one policy rule applied to a new password. Length, and nothing else: a
 * composition rule ("one capital, one digit") makes passwords shorter and more
 * guessable, and the hint on the registration form already asks for a phrase.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 512;
