import {
  authMessage,
  codeForDatabaseError,
  isAuthErrorCode,
  type AuthErrorCode,
  type AuthMessage,
} from '@/lib/auth/errors';
import { isGateCode, type PublicationGateCode } from './types';

/**
 * Operator failures, turned into sentences a person can act on.
 *
 * Built on src/lib/auth/errors.ts rather than beside it: the SQLSTATE table
 * there is the platform's, and a second copy would drift. This file adds the
 * four outcomes only the operator's screens have, and then defers.
 *
 * The rule, restated from the design contract: a reader gets "You don't have
 * access to this information", never "Something went wrong" and never
 * "error: permission denied for table org.vetting_decision". The third tells a
 * stranger what tables exist.
 *
 * SY008 is the interesting one. `proj.enforce_publication_gate()` raises it
 * with the missing items named, and that list is the most useful thing the
 * operator can be told - so it is not thrown away. `missingFromGateError()`
 * lifts the codes out of the message; the screen then renders them with the
 * same labels the gate checklist uses, in the reader's own language. The raw
 * database sentence is never shown, because it also carries a table name and a
 * project UUID.
 */

export type AdminErrorCode =
  | AuthErrorCode
  | 'gate_blocked'
  | 'already_published'
  | 'reason_required'
  | 'unknown_application';

const EXTRA: Record<string, AuthMessage> = {
  gate_blocked: {
    code: 'rule_violation' as AuthErrorCode,
    key: 'adminUi.error.gateBlocked',
    fallbackEn:
      'The database refused to publish this project because the publication '
      + 'gate is not complete. The items still missing are listed below. '
      + 'Recording them happens on the project’s own screens.',
  },
  already_published: {
    code: 'rule_violation' as AuthErrorCode,
    key: 'adminUi.error.alreadyPublished',
    fallbackEn:
      'This project is already on the public index, so nothing was changed. '
      + 'Reload the page to see its current state.',
  },
  reason_required: {
    code: 'invalid_input' as AuthErrorCode,
    key: 'adminUi.error.reasonRequired',
    fallbackEn:
      'A decision needs a reason of at least ten characters. The record is '
      + 'append-only, so an entry recorded without one can never be edited to '
      + 'explain itself.',
  },
  unknown_application: {
    code: 'unknown_reference' as AuthErrorCode,
    key: 'adminUi.error.unknownApplication',
    fallbackEn:
      'That application is not one this queue holds. It may have been replaced '
      + 'by a newer application from the same organisation.',
  },
};

export function isAdminErrorCode(value: unknown): value is AdminErrorCode {
  return (
    typeof value === 'string'
    && (Object.hasOwn(EXTRA, value) || isAuthErrorCode(value))
  );
}

export function adminMessage(code: AdminErrorCode): AuthMessage {
  return EXTRA[code] ?? authMessage(code as AuthErrorCode);
}

/**
 * Renders with next-intl when the key is in the catalogue and with the English
 * sentence when it is not. src/messages/*.json is owned by another agent, so
 * until the keys land a person reads a real sentence rather than a key.
 */
export function resolveAdminMessage(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: AdminErrorCode,
): string {
  const m = adminMessage(code);
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.fallbackEn;
}

interface PgError { code?: unknown; message?: unknown }

/**
 * The gate items named in an SY008 refusal.
 *
 * `proj.enforce_publication_gate()` raises
 *
 *   project <uuid> cannot be published; missing: boundary, availability
 *
 * and those codes are the same strings `proj.publication_gaps()` returns, so
 * they resolve against the gate checklist's own labels. Anything unrecognised
 * is dropped rather than printed raw: a code this release cannot name is a
 * migration this release has not seen, and showing it untranslated would be
 * showing a reader a database identifier.
 */
export function missingFromGateError(err: unknown): PublicationGateCode[] {
  const e = err as PgError | null;
  if (e?.code !== 'SY008' || typeof e.message !== 'string') return [];
  const at = e.message.indexOf('missing:');
  if (at < 0) return [];
  return e.message
    .slice(at + 'missing:'.length)
    .split(',')
    .map((part) => part.trim())
    .filter(isGateCode);
}

/**
 * The SQLSTATEs the operator's screens can provoke on top of the shared table.
 *
 *   SY008  the publication gate refused an incomplete project
 *   23514  the project CHECK that ties status='published' to published_at,
 *          which is what a DISABLED gate trigger would surface as
 *   23503  a submission id that is not in org.vetting_submission
 *   42501  RLS or a missing grant refused it - this account is not an operator
 */
export function codeForAdminError(err: unknown): AdminErrorCode {
  const e = err as PgError | null;
  if (e?.code === 'SY008') return 'gate_blocked';
  if (e?.code === '23503') return 'unknown_application';
  return codeForDatabaseError(err);
}
