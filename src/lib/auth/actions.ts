'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirectTo } from '@/lib/i18n/navigate';
import { deriveFromPrefix, hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './password';
import { authSaltFor, authenticate, registerOrganisation } from './queries';
import { endSession, startSession } from './session';
import { homePathFor, isRegistrableRole } from './roles';
import { codeForDatabaseError, logAuthFailure, type AuthErrorCode } from './errors';

/**
 * The three mutations authentication needs, as Server Actions.
 *
 * Shape, and why it is this one:
 *
 * - Every input is validated with zod HERE, on the server, from the FormData.
 *   The client-side `required` attributes are a convenience for the person
 *   typing; they are not a check, and nothing in this file trusts them.
 * - Failure ends in a redirect back to the form with an error CODE in the
 *   query string, never a message and never the email address. The form renders
 *   the sentence from the code, so the wording stays in the message catalogue
 *   and the URL carries no personal data into a server log.
 * - The forms therefore need no client JavaScript at all. That is the same
 *   reasoning as the rest of this codebase: server-rendered, no bundle.
 *
 * redirect() works by throwing, so it is never called inside a try block that
 * would catch it. Each action computes an outcome first and navigates last.
 */

const SignIn = z.object({
  email: z.string().trim().min(3).max(320).email(),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  // Only a path on this site. An absolute URL here would turn the sign-in form
  // into an open redirect, which is how phishing links get their credibility.
  next: z.string().regex(/^\/(?!\/)[\w\-/]*$/).optional(),
});

function failSignIn(locale: string, error: AuthErrorCode): never {
  redirectTo({ href: { pathname: '/sign-in', query: { error } }, locale });
}

export async function signInAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = SignIn.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  });
  if (!parsed.success) {
    failSignIn(locale, 'invalid_credentials');
  }
  const { email, password, next } = parsed.data;

  let destination: string;
  try {
    // Step 1: parameters and salt. A decoy comes back for an unknown address,
    // so the scrypt below costs the same and the two failures are not
    // distinguishable by how long they take.
    const prefix = await authSaltFor(email);
    if (prefix === null) failSignIn(locale, 'invalid_credentials');

    // Step 2: derive, and let the database compare. The stored verifier is
    // never sent here, whether or not the password was right.
    const candidate = await deriveFromPrefix(prefix, password);
    const account = await authenticate(email, candidate);
    if (account === null) failSignIn(locale, 'invalid_credentials');

    if (account.status !== 'active') {
      failSignIn(locale, 'account_not_active');
    }

    const session = await startSession(account.userId);
    destination = next ?? homePathFor(session?.roles ?? []);
  } catch (err) {
    // redirect() signals by throwing; rethrow it rather than reporting it as a
    // database failure.
    if (isRedirectError(err)) throw err;
    logAuthFailure('signIn', err);
    failSignIn(locale, codeForDatabaseError(err));
  }

  redirectTo({ href: destination, locale });
}

const Register = z.object({
  role: z.string().refine(isRegistrableRole, 'not a registrable role'),
  legal_name: z.string().trim().min(2).max(200),
  registration_number: z.string().trim().max(100).optional().or(z.literal('')),
  registered_address: z.string().trim().max(500).optional().or(z.literal('')),
  // Two uppercase letters. The database has the authoritative list and will
  // refuse anything that is not in it.
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  sector: z.string().trim().min(1).max(64),
  size_band: z.string().trim().min(1).max(64),
  full_name: z.string().trim().min(2).max(200),
  job_title: z.string().trim().max(200).optional().or(z.literal('')),
  email: z.string().trim().min(3).max(320).email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function registerAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = Register.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    // Which field, so the form can point at it, but no values echoed back.
    const field = parsed.error.issues[0]?.path.join('.') ?? 'form';
    redirectTo({
      href: { pathname: '/register', query: { error: 'invalid_input', field } },
      locale,
    });
  }
  const d = parsed.data;

  let destination: string;
  try {
    const passwordHash = await hashPassword(d.password);
    const account = await registerOrganisation({
      roleCode: d.role,
      legalName: d.legal_name,
      registrationNumber: d.registration_number || null,
      registeredAddress: d.registered_address || null,
      countryCode: d.country,
      sectorCode: d.sector,
      sizeBandCode: d.size_band,
      fullName: d.full_name,
      jobTitle: d.job_title || null,
      email: d.email,
      passwordHash,
      locale,
    });

    // Signed in immediately, and NOT approved: registering and being approved
    // are different things (R6). The next page says so.
    const session = await startSession(account.userId);
    destination = homePathFor(session?.roles ?? []);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logAuthFailure('register', err);
    redirectTo({
      href: { pathname: '/register', query: { error: codeForDatabaseError(err) } },
      locale,
    });
  }

  redirectTo({ href: destination, locale });
}

export async function signOutAction(): Promise<void> {
  const locale = await getLocale();
  await endSession();
  redirectTo({ href: '/', locale });
}

/**
 * next/navigation signals a redirect by throwing an error carrying the digest
 * "NEXT_REDIRECT". Swallowing it would turn every successful sign-in into
 * "this service is not available at the moment".
 */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
