import type { ActorRole } from '@/lib/db/actor';

/**
 * Which roles have a questionnaire at all.
 *
 * Not a list this file invented: org.actor_role.is_transacting is the database's
 * answer, and org.vetting_submission enforces it with a composite foreign key
 * to (code, is_transacting) rather than a CHECK - so applying as an auditor is
 * a foreign-key violation, not a code path. This constant is the copy that
 * produces a readable page before the round trip, in the same spirit as
 * isRegistrableRole() in src/lib/auth/roles.ts.
 */
export const TRANSACTING_ROLES = ['buyer', 'project_owner', 'investor'] as const;

export function isTransactingRole(value: string): value is ActorRole {
  return (TRANSACTING_ROLES as readonly string[]).includes(value);
}
