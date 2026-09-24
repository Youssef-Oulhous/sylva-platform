import { ANONYMOUS, type Actor, type ActorRole } from '@/lib/db/actor';
import type { ResolvedSession } from './queries';

/**
 * Turning a resolved session into an Actor.
 *
 * Kept pure and kept out of session.ts so it can be tested without a request.
 * Nothing here accepts a role name from user input: the role comes from
 * identity.user_platform_role, whose role_code is a foreign key to
 * org.actor_role, and the maps below are closed.
 *
 * The ORDER is the whole of the logic. A person may hold more than one platform
 * role, and the actor that results decides which connection pool serves the
 * request. So the most privileged wins - an operator who is also listed as a
 * buyer is served as an operator - and anything unrecognised falls through to
 * anonymous rather than to a guess.
 */

export const PLATFORM_ROLES = [
  'operator', 'auditor', 'buyer', 'project_owner', 'investor',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

const MEMBER_ROLES: readonly ActorRole[] = ['buyer', 'project_owner', 'investor'];

export function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value);
}

/** The role the interface should treat as primary, in order of privilege. */
export function primaryRole(roles: readonly string[]): PlatformRole | null {
  for (const candidate of PLATFORM_ROLES) {
    if (roles.includes(candidate)) return candidate;
  }
  return null;
}

/**
 * The Actor a session produces. ANONYMOUS for a session whose account holds no
 * platform role: such an account exists but has nothing to be, and serving it
 * as a buyer because that is the common case would be exactly the kind of
 * guess FINDING-001 was about.
 */
export function actorFromSession(session: ResolvedSession): Actor {
  const role = primaryRole(session.roles);
  if (role === null) return ANONYMOUS;
  if (role === 'operator') {
    return { kind: 'operator', orgId: session.orgId, personRef: session.personRef };
  }
  if (role === 'auditor') {
    return { kind: 'auditor', orgId: session.orgId, personRef: session.personRef };
  }
  const member = MEMBER_ROLES.find((r) => r === role);
  if (!member) return ANONYMOUS;
  return { kind: 'member', role: member, orgId: session.orgId, personRef: session.personRef };
}

/**
 * Where signing in takes you. Each of these routes already exists; a role with
 * no home of its own lands on the projects index, which every account can read.
 */
export function homePathFor(roles: readonly string[]): string {
  switch (primaryRole(roles)) {
    case 'operator':      return '/admin/vetting';
    // /auditor, not /record: the public record is a strict subset of what an
    // auditor is there to read, and sending the role to it would look like the
    // whole of its access.
    case 'auditor':       return '/auditor';
    case 'project_owner': return '/owner';
    case 'buyer':         return '/dashboard';
    case 'investor':      return '/dashboard';
    default:              return '/projects';
  }
}

/**
 * Only a transacting role can be registered for through the public form.
 * Operator and auditor accounts are created by Sylva. The database says the
 * same thing - org.actor_role.is_transacting, checked inside identity.register
 * - and this is the copy that produces a readable message before the round trip.
 */
export function isRegistrableRole(value: string): value is ActorRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}
