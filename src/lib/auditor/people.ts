import type { AuditActor } from './types';

/**
 * How a person is shown to an auditor, and what it means when there is no name.
 *
 * The concept note grants an auditor "real names, where permitted". After
 * erasure it is no longer permitted, and the mechanism is the one described in
 * docs/DECISIONS.md D3: record.entry.actor_person_ref is a UUID with NO
 * foreign key into identity, so deleting the account leaves the entry intact
 * and the lookup simply fails. ci.assert_no_fk_into_identity() proves the
 * invariant has not eroded.
 *
 * That means an auditor WILL see rows whose person cannot be named, and the
 * difference between "erased" and "tampered with" is invisible unless the page
 * says which it is. So this function never invents a name, never falls back to
 * the email address, and never leaves a blank cell: it returns the
 * organisation and the role, which is exactly what survives, plus a flag the
 * page uses to attach the explanation.
 *
 * Kept pure and separate from the queries so it can be tested without a
 * database - which matters here, because the demo data has no erased person
 * and the case that most needs a test is the one the data cannot produce.
 */

export type PersonResolution =
  /** identity.user_account still holds this person. */
  | { kind: 'named'; name: string; label: string }
  /**
   * The entry names a person_ref that no account resolves. Under D3 this is
   * erasure. It is NOT evidence that the record was altered - the entry is
   * byte-for-byte what it always was.
   */
  | { kind: 'erased'; label: string; orgName: string | null }
  /** The entry carries no person at all: a system or trigger-written entry. */
  | { kind: 'none'; label: string };

export function resolvePerson(actor: AuditActor): PersonResolution {
  if (actor.personName !== null && actor.personName.trim() !== '') {
    return { kind: 'named', name: actor.personName, label: actor.personLabel };
  }
  if (actor.personRef === null) {
    return { kind: 'none', label: actor.personLabel };
  }
  return { kind: 'erased', label: actor.personLabel, orgName: actor.orgName };
}

/**
 * The sentence that replaces a name. "Former member — DEMO Nordbräu AG" is the
 * wording D3 settled on; the organisation is what remains attributable.
 */
export function formerMemberText(
  formerMember: string,
  orgName: string | null,
  unknownOrg: string,
): string {
  return `${formerMember} — ${orgName ?? unknownOrg}`;
}

/** A UUID is unreadable in a dense table; its first block is not. */
export function shortRef(id: string): string {
  return id.slice(0, 8);
}
