/**
 * Database errors, turned into sentences a person can act on.
 *
 * The rule from the concept note's design contract, restated: a reader gets
 * "You don't have access to this information", never "Something went wrong" and
 * never "error: permission denied for table geo.buyer_site". The second is
 * useless and the third tells a stranger what tables exist.
 *
 * Each code maps to a message KEY plus an English fallback. The fallback is
 * there because src/messages/*.json is owned by another agent: until the keys
 * land, a person sees a real sentence rather than "authError.notApproved".
 * `resolveAuthMessage` below is what pages should call.
 */

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'invalid_input'
  | 'account_not_active'
  | 'email_taken'
  | 'unknown_reference'
  | 'role_not_registrable'
  | 'not_signed_in'
  | 'wrong_role'
  | 'not_approved'
  | 'no_access'
  | 'rule_violation'
  | 'unavailable';

export interface AuthMessage {
  readonly code: AuthErrorCode;
  /** next-intl key. See the i18nKeys returned with this change. */
  readonly key: string;
  /** Used when the key is not in the message catalogue yet. */
  readonly fallbackEn: string;
}

const MESSAGES: Record<AuthErrorCode, AuthMessage> = {
  invalid_credentials: {
    code: 'invalid_credentials',
    key: 'authError.invalidCredentials',
    // Deliberately does not say which of the two was wrong. An error that
    // distinguishes them turns the sign-in form into a way to find out who has
    // an account here, and on this platform that is commercially sensitive.
    fallbackEn: 'That email address and password do not match an account.',
  },
  invalid_input: {
    code: 'invalid_input',
    key: 'authError.invalidInput',
    // Form-level, not field-level. The action reports WHICH field failed in the
    // query string so the form can point at it; a sentence per field is copy
    // that does not exist yet, and inventing it would mean throwing it away.
    fallbackEn: 'Some of the details were not accepted. Check the highlighted section and try again.',
  },
  account_not_active: {
    code: 'account_not_active',
    key: 'authError.accountNotActive',
    fallbackEn: 'This account is not active. Contact Sylva to have it reopened.',
  },
  email_taken: {
    code: 'email_taken',
    key: 'authError.emailTaken',
    fallbackEn: 'An account already exists for this email address. Sign in instead.',
  },
  unknown_reference: {
    code: 'unknown_reference',
    key: 'authError.unknownReference',
    fallbackEn: 'One of the selected values is not one this platform recognises. Choose again.',
  },
  role_not_registrable: {
    code: 'role_not_registrable',
    key: 'authError.roleNotRegistrable',
    fallbackEn: 'Accounts for that role are created by Sylva, not through this form.',
  },
  not_signed_in: {
    code: 'not_signed_in',
    key: 'authError.notSignedIn',
    fallbackEn: 'Sign in to see this page.',
  },
  wrong_role: {
    code: 'wrong_role',
    key: 'authError.wrongRole',
    fallbackEn: 'This page belongs to a different kind of account.',
  },
  not_approved: {
    code: 'not_approved',
    key: 'authError.notApproved',
    fallbackEn:
      'Sylva has not yet approved this organisation, so this step is not open to it. '
      + 'Approval follows the vetting questionnaire.',
  },
  no_access: {
    code: 'no_access',
    key: 'authError.noAccess',
    fallbackEn: "You don't have access to this information.",
  },
  rule_violation: {
    code: 'rule_violation',
    key: 'authError.ruleViolation',
    fallbackEn: 'The platform refused this change because it would break one of its rules.',
  },
  unavailable: {
    code: 'unavailable',
    key: 'authError.unavailable',
    fallbackEn: 'This service is not available at the moment. Try again shortly.',
  },
};

export function authMessage(code: AuthErrorCode): AuthMessage {
  return MESSAGES[code];
}

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && Object.hasOwn(MESSAGES, value);
}

/**
 * Renders an error with next-intl if the key exists and with the English
 * fallback if it does not. `t` is the function from useTranslations() or
 * getTranslations(); next-intl exposes `.has()` on it.
 */
export function resolveAuthMessage(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: AuthErrorCode,
): string {
  const m = authMessage(code);
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.fallbackEn;
}

interface PgError { code?: unknown; message?: unknown }

/**
 * The SQLSTATEs this application can actually provoke, and what each one means
 * to a person. Anything not listed becomes 'unavailable' - an honest "not now"
 * rather than a guess at what went wrong.
 *
 *   SY001  R1: the period has no capacity left
 *   SY005  a stale deal stage change
 *   SY006  R6: the organisation is not approved
 *   SY007  R7: units of different projects were added
 *   SY008  the publication gate refused an incomplete project
 *   SY020  registration: the email is already in use
 *   SY021  registration: that role is not registrable
 *   SY022  registration: unknown sector, size band or country
 *   SY024  sign-in: the account is not active
 *   42501  insufficient_privilege - RLS or a missing grant said no
 */
export function codeForDatabaseError(err: unknown): AuthErrorCode {
  const sqlstate = (err as PgError | null)?.code;
  switch (sqlstate) {
    case 'SY020': return 'email_taken';
    case 'SY021': return 'role_not_registrable';
    case 'SY022': return 'unknown_reference';
    case 'SY024': return 'account_not_active';
    case 'SY006': return 'not_approved';
    case '42501': return 'no_access';
    case 'SY001':
    case 'SY003':
    case 'SY004':
    case 'SY005':
    case 'SY007':
    case 'SY008':
    case 'SY009':
      return 'rule_violation';
    case '23505': return 'email_taken';
    case '23503': return 'unknown_reference';
    default: return 'unavailable';
  }
}

/**
 * What goes in the server log when a request fails. The person gets a sentence;
 * the operator gets the SQLSTATE. Never the other way round, and never the
 * email address - this line is not the place for personal data.
 */
export function logAuthFailure(where: string, err: unknown): void {
  const e = err as PgError | null;
  console.error(JSON.stringify({
    level: 'error',
    msg: 'auth failure',
    where,
    sqlstate: typeof e?.code === 'string' ? e.code : null,
    detail: typeof e?.message === 'string' ? e.message : String(err),
  }));
}
