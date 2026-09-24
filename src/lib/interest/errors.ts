/**
 * What stopped an enquiry, said in a way a person can act on.
 *
 * The rule from the design contract: "You don't have access to this
 * information", never "Something went wrong" and never
 * "error: duplicate key value violates unique constraint
 * ux_one_live_deal_per_buyer_project". The third is the one this module exists
 * for - the database refusing a second live deal is a NORMAL, expected answer
 * to a buyer clicking twice, and it deserves a sentence, not a stack trace.
 *
 * Each code maps to a message key plus an English fallback, the same shape as
 * src/lib/auth/errors.ts, and for the same reason: src/messages/*.json is owned
 * by another agent, so until the keys land a person sees a real sentence.
 */

export type InterestErrorCode =
  | 'not_signed_in'
  | 'wrong_role'
  | 'not_approved'
  | 'already_open'
  | 'project_not_open'
  | 'no_access'
  | 'invalid_input'
  | 'no_periods'
  | 'unavailable';

export interface InterestMessage {
  readonly code: InterestErrorCode;
  readonly key: string;
  readonly fallbackEn: string;
}

const MESSAGES: Record<InterestErrorCode, InterestMessage> = {
  not_signed_in: {
    code: 'not_signed_in',
    key: 'expressInterest.error.notSignedIn',
    fallbackEn:
      'An interest event is recorded against an organisation, so you need to be signed in to send this enquiry.',
  },
  wrong_role: {
    code: 'wrong_role',
    key: 'expressInterest.error.wrongRole',
    fallbackEn:
      'Express interest is for buyer accounts. This account is registered for something else.',
  },
  not_approved: {
    code: 'not_approved',
    key: 'expressInterest.error.notApproved',
    fallbackEn:
      'Sylva has not yet approved your organisation as a buyer, and no deal is created for an organisation we have not approved.',
  },
  already_open: {
    code: 'already_open',
    key: 'expressInterest.error.alreadyOpen',
    fallbackEn:
      'You already have an open interest in this project. Everything from here happens in that conversation rather than in a second one.',
  },
  project_not_open: {
    code: 'project_not_open',
    key: 'expressInterest.error.projectNotOpen',
    fallbackEn:
      'This project is not open to enquiries at the moment. Its page stays readable, and the public record shows why its status changed.',
  },
  no_access: {
    code: 'no_access',
    key: 'expressInterest.error.noAccess',
    fallbackEn: "You don't have access to this information.",
  },
  invalid_input: {
    code: 'invalid_input',
    key: 'expressInterest.error.invalidInput',
    fallbackEn:
      'A volume was not accepted. Give each period a whole number of units, or leave it blank.',
  },
  no_periods: {
    code: 'no_periods',
    key: 'expressInterest.error.noPeriods',
    fallbackEn:
      'Tell the project owner which period you are interested in: at least one period needs a volume.',
  },
  unavailable: {
    code: 'unavailable',
    key: 'expressInterest.error.unavailable',
    fallbackEn: 'This service is not available at the moment. Try again shortly.',
  },
};

export function interestMessage(code: InterestErrorCode): InterestMessage {
  return MESSAGES[code];
}

export function isInterestErrorCode(value: unknown): value is InterestErrorCode {
  return typeof value === 'string' && Object.hasOwn(MESSAGES, value);
}

/** Renders with next-intl if the key exists, with the English sentence if not. */
export function resolveInterestMessage(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: InterestErrorCode,
): string {
  const m = interestMessage(code);
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.fallbackEn;
}

interface PgError {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
}

/** The unique PARTIAL index that makes a second live room impossible. */
export const ONE_LIVE_DEAL_INDEX = 'ux_one_live_deal_per_buyer_project';

/**
 * Database error -> code.
 *
 * The three that matter here are refusals by design, not faults:
 *
 *   23505 on ux_one_live_deal_per_buyer_project
 *                the buyer already has a live deal on this project
 *   SY006        R6: the organisation is not an approved buyer
 *   SY009        the project is not published
 *
 * Anything unrecognised becomes 'unavailable' - an honest "not now" rather than
 * a guess at what went wrong, and never the driver's message, which names
 * tables and constraints a stranger has no business learning.
 */
export function codeForInterestError(err: unknown): InterestErrorCode {
  const e = err as PgError | null;
  if (e?.code === '23505' && e.constraint === ONE_LIVE_DEAL_INDEX) return 'already_open';
  switch (e?.code) {
    case 'SY006': return 'not_approved';
    case 'SY009': return 'project_not_open';
    case '42501': return 'no_access';
    // A unique or FK violation that is not the one above is a genuine fault on
    // our side, not something the person typed. Say so honestly.
    case '23505':
    case '23503':
    case '23514':
      return 'unavailable';
    default: return 'unavailable';
  }
}

export function logInterestFailure(where: string, err: unknown): void {
  const e = err as PgError | null;
  console.error(JSON.stringify({
    level: 'error',
    msg: 'express interest failure',
    where,
    sqlstate: typeof e?.code === 'string' ? e.code : null,
    constraint: typeof e?.constraint === 'string' ? e.constraint : null,
    detail: typeof e?.message === 'string' ? e.message : String(err),
  }));
}
