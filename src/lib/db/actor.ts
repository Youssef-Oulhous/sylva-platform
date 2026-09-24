/**
 * Who is making a request, expressed in the only terms the database accepts.
 *
 * The database enforces two things separately and by different mechanisms:
 *
 *   role          current_user, set with SET LOCAL ROLE. Not forgeable: a role
 *                 cannot SET ROLE to a role it is not a member of.
 *   organisation  a signed context in a GUC, verified by sylva.actor_ctx().
 *                 Not forgeable: see db/migrations/0019 and FINDING-001.
 *
 * Nothing in this file may accept a role name from user input. The mappings
 * below are the complete, closed set.
 */

export type ActorRole = 'buyer' | 'project_owner' | 'investor';

export type Actor =
  | { kind: 'anonymous' }
  | { kind: 'member'; role: ActorRole; orgId: string; personRef: string }
  | { kind: 'operator'; orgId: string; personRef: string }
  | { kind: 'auditor'; orgId: string; personRef: string };

export const ANONYMOUS: Actor = { kind: 'anonymous' };

/** Which connection pool - i.e. which LOGIN role - serves this actor. */
export type PoolName = 'public' | 'app' | 'operator' | 'auditor';

/**
 * The privilege role the transaction runs as. A LOGIN role is only ever a
 * member of the roles listed here for its pool, so an actor cannot be served
 * by a pool that could escalate it.
 */
const PLAN: Record<Actor['kind'], { pool: PoolName; dbRole: string }> = {
  anonymous:    { pool: 'public',   dbRole: 'sylva_web_anon' },
  member:       { pool: 'app',      dbRole: '' /* resolved per role below */ },
  operator:     { pool: 'operator', dbRole: 'sylva_operator' },
  auditor:      { pool: 'auditor',  dbRole: 'sylva_auditor' },
};

const MEMBER_ROLE: Record<ActorRole, string> = {
  buyer:         'sylva_buyer',
  project_owner: 'sylva_project_owner',
  investor:      'sylva_investor',
};

export function planFor(actor: Actor): { pool: PoolName; dbRole: string } {
  if (actor.kind === 'member') {
    const dbRole = MEMBER_ROLE[actor.role];
    if (!dbRole) throw new Error(`unknown actor role: ${String(actor.role)}`);
    return { pool: 'app', dbRole };
  }
  return PLAN[actor.kind];
}

/** Every database role this application will ever SET LOCAL ROLE to. */
export const ALL_DB_ROLES = Object.freeze([
  'sylva_web_anon',
  ...Object.values(MEMBER_ROLE),
  'sylva_operator',
  'sylva_auditor',
]);
