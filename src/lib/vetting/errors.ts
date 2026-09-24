import {
  authMessage,
  codeForDatabaseError,
  isAuthErrorCode,
  type AuthErrorCode,
  type AuthMessage,
} from '@/lib/auth/errors';

/**
 * Vetting failures, turned into sentences a person can act on.
 *
 * Built on src/lib/auth/errors.ts rather than beside it: the SQLSTATE table
 * there is the platform's, not authentication's, and a second copy would drift.
 * This file adds the three outcomes that only the questionnaire has, and then
 * defers.
 *
 * The rule, restated from the design contract: a reader gets "You don't have
 * access to this information", never "Something went wrong" and never
 * "error: permission denied for table org.vetting_draft". The third tells a
 * stranger what tables exist.
 */

export type VettingErrorCode =
  | AuthErrorCode
  | 'incomplete'
  | 'already_submitted'
  | 'answer_too_long'
  | 'no_questionnaire';

const EXTRA: Record<string, AuthMessage> = {
  incomplete: {
    // Not an AuthErrorCode, but the same shape, so one renderer serves both.
    code: 'invalid_input' as AuthErrorCode,
    key: 'vettingForm.error.incomplete',
    fallbackEn:
      'Some required questions have not been answered yet. '
      + 'They are marked below; your other answers have been kept.',
  },
  already_submitted: {
    code: 'rule_violation' as AuthErrorCode,
    key: 'vettingForm.error.alreadySubmitted',
    // The honest description of a UNIQUE violation on supersedes_id: somebody
    // else in the organisation got there first. Telling the person to reload
    // is the only useful instruction, because their answers are now attached
    // to an application that has been replaced.
    fallbackEn:
      'This application has already been replaced by a newer one, '
      + 'probably from another person in your organisation. '
      + 'Reload the page to see the current application.',
  },
  answer_too_long: {
    code: 'invalid_input' as AuthErrorCode,
    key: 'vettingForm.error.answerTooLong',
    // Says what happened and what to do. The alternative - dropping the answer
    // and reporting the question as unanswered - tells somebody who typed eight
    // pages that the box is empty, which they cannot act on.
    fallbackEn:
      'One of the answers is longer than this platform stores (20,000 characters). '
      + 'It is marked below. Shorten it, or attach the detail as a document instead; '
      + 'nothing else you typed has been lost.',
  },
  no_questionnaire: {
    code: 'unavailable' as AuthErrorCode,
    key: 'vettingForm.error.noQuestionnaire',
    fallbackEn:
      'There is no published questionnaire for this kind of account yet. '
      + 'Sylva publishes it; nothing is wrong with your account.',
  },
};

export function isVettingErrorCode(value: unknown): value is VettingErrorCode {
  return (
    typeof value === 'string'
    && (Object.hasOwn(EXTRA, value) || isAuthErrorCode(value))
  );
}

export function vettingMessage(code: VettingErrorCode): AuthMessage {
  return EXTRA[code] ?? authMessage(code as AuthErrorCode);
}

/**
 * Renders with next-intl when the key is in the catalogue and with the English
 * sentence when it is not. src/messages/*.json is owned by another agent, so
 * until the keys land a person reads a real sentence rather than a key.
 */
export function resolveVettingMessage(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: VettingErrorCode,
): string {
  const m = vettingMessage(code);
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.fallbackEn;
}

/**
 * The SQLSTATEs the vetting flow can provoke on top of the shared table.
 *
 *   23505 on org.vetting_submission.supersedes_id  two people submitted at once
 *   23505 anywhere else                            a duplicate answer row
 *   23503 a question_code that is not in this questionnaire (a stale tab), or
 *         a supersedes_id outside this organisation - see migration 0072
 *   42501 RLS or a missing grant refused it - another organisation's draft
 *   SY0CI a CI assertion, which is a bug in us and not in the reader
 *
 * The shared mapping in src/lib/auth/errors.ts turns a bare 23505 into
 * "An account already exists for this email address", which is right for the
 * registration form it was written for and absurd on a questionnaire. So this
 * file decides 23505 itself and defers on everything else.
 */
export function codeForVettingError(err: unknown): VettingErrorCode {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code === '23505') {
    return String(e.constraint ?? '').includes('supersedes')
      ? 'already_submitted'
      // A duplicate key anywhere else in this flow means two rows for one
      // question. Nothing the person did causes it once collectAnswers() has
      // keyed the answers by question code, so it is ours, not theirs - and it
      // is certainly not an email address.
      : 'rule_violation';
  }
  // Everything else is the platform's shared mapping, which already turns
  // 42501 into "You don't have access to this information".
  return codeForDatabaseError(err);
}
