/**
 * The ten principals as Actor values.
 *
 * Kept apart from catalog.ts so that the markdown generator - which must run
 * without a database - can read the matrix without pulling in the connection
 * pools.
 */
import { ANONYMOUS, type Actor } from '@/lib/db/actor';
import { PRINCIPALS, PRINCIPAL_IDS, type PrincipalId, type PrincipalMeta } from './catalog';

export { PRINCIPALS, PRINCIPAL_IDS };
export type { PrincipalId, PrincipalMeta };

export function actorFor(id: PrincipalId): Actor {
  const p = PRINCIPALS[id];
  if (p.kind === 'anonymous') return ANONYMOUS;
  const orgId = p.org!;
  const personRef = p.person!;
  switch (p.kind) {
    case 'operator': return { kind: 'operator', orgId, personRef };
    case 'auditor':  return { kind: 'auditor',  orgId, personRef };
    default:         return { kind: 'member', role: p.kind, orgId, personRef };
  }
}

/**
 * The organisation a statement is stamped with when this principal writes.
 *
 * The anonymous visitor has none. It is still given one here so that an INSERT
 * probe can be built for it at all - the statement is refused on privilege long
 * before the value is looked at, and asserting that refusal is the point.
 */
export function claimedOrg(id: PrincipalId): string {
  return PRINCIPALS[id].org ?? PRINCIPALS.buyerA.org!;
}

export function claimedPerson(id: PrincipalId): string | null {
  return PRINCIPALS[id].person;
}
