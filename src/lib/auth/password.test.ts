import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  MIN_PASSWORD_LENGTH,
  PasswordFormatError,
  deriveFromPrefix,
  hashPassword,
  parseSaltPrefix,
  saltPrefixOf,
  verifyPassword,
} from './password';

/**
 * Password hashing, with no database in sight. These are the properties the
 * two-call sign-in protocol rests on; if one of them stops holding, the
 * database comparison in identity.authenticate compares the wrong things.
 */

describe('the stored record', () => {
  it('is self-describing, so the cost can be raised without a migration', async () => {
    const record = await hashPassword('correct horse battery staple');
    expect(record).toMatch(/^scrypt\$N=16384,r=8,p=1,len=64\$[^$]+\$[^$]+$/);
    const { params, salt } = parseSaltPrefix(saltPrefixOf(record));
    expect(params).toEqual(DEFAULT_PARAMS);
    expect(salt.length).toBe(16);
  });

  it('salts every record separately', async () => {
    const a = await hashPassword('correct horse battery staple');
    const b = await hashPassword('correct horse battery staple');
    // Same password, different salt, therefore a different record. Equal
    // records here would mean the salt was doing nothing.
    expect(a).not.toBe(b);
    expect(saltPrefixOf(a)).not.toBe(saltPrefixOf(b));
  });

  it('derives the identical record from the salt prefix alone', async () => {
    const record = await hashPassword('a long enough passphrase');
    // THIS is the protocol: the database can compare what the application
    // derived against what it stored, without handing over what it stored.
    expect(await deriveFromPrefix(saltPrefixOf(record), 'a long enough passphrase'))
      .toBe(record);
  });
});

describe('verification', () => {
  it('accepts the right password and refuses near misses', async () => {
    const record = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(record, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verifyPassword(record, 'correct horse battery stapl')).resolves.toBe(false);
    await expect(verifyPassword(record, 'Correct horse battery staple')).resolves.toBe(false);
    await expect(verifyPassword(record, '')).resolves.toBe(false);
  });

  it('refuses a malformed record rather than throwing at the caller', async () => {
    await expect(verifyPassword('not a record', 'anything')).resolves.toBe(false);
    await expect(verifyPassword('scrypt$N=16384,r=8,p=1,len=64$c2FsdA==', 'x')).resolves.toBe(false);
  });

  it('normalises unicode, so one phrase typed two ways is one password', async () => {
    const composed = 'Grünes Moor Passwort';        // ü as one code point
    const decomposed = 'Grünes Moor Passwort';     // u + combining diaeresis
    // A real support ticket on a platform with German and French users, not a
    // theoretical one.
    await expect(verifyPassword(await hashPassword(composed), decomposed)).resolves.toBe(true);
  });
});

describe('parameter parsing', () => {
  it('refuses parameters that would ask for an absurd amount of memory', () => {
    // The prefix comes from our own database today. It is validated anyway:
    // scrypt allocates 128 * N * r bytes, so an unchecked N is a way to take
    // the server down with one sign-in attempt.
    expect(() => parseSaltPrefix('scrypt$N=1073741824,r=8,p=1,len=64$c2FsdHNhbHRzYWx0')).toThrow(PasswordFormatError);
    expect(() => parseSaltPrefix('scrypt$N=16384,r=9999,p=1,len=64$c2FsdHNhbHRzYWx0')).toThrow(PasswordFormatError);
  });

  it('refuses an N that is not a power of two, which scrypt requires', () => {
    expect(() => parseSaltPrefix('scrypt$N=16383,r=8,p=1,len=64$c2FsdHNhbHRzYWx0')).toThrow(PasswordFormatError);
  });

  it('refuses another scheme, a short salt and a missing field', () => {
    expect(() => parseSaltPrefix('bcrypt$N=16384,r=8,p=1,len=64$c2FsdHNhbHRzYWx0')).toThrow(PasswordFormatError);
    expect(() => parseSaltPrefix('scrypt$N=16384,r=8,p=1,len=64$YQ==')).toThrow(PasswordFormatError);
    expect(() => parseSaltPrefix('scrypt$N=16384,r=8,p=1,len=64')).toThrow(PasswordFormatError);
    expect(() => saltPrefixOf('scrypt$N=16384,r=8,p=1,len=64$c2FsdA==')).toThrow(PasswordFormatError);
  });
});

describe('the policy', () => {
  it('is length and nothing else', () => {
    // A composition rule ("one capital, one digit") makes passwords shorter and
    // more guessable. The form's hint asks for a phrase instead.
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
