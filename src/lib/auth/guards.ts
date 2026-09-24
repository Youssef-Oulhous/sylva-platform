import { getLocale } from 'next-intl/server';
import { redirectTo } from '@/lib/i18n/navigate';
import { readAs } from '@/lib/db/session';
import { getViewer, type Viewer } from './session';
import { primaryRole, type PlatformRole } from './roles';
import { type AuthErrorCode } from './errors';

/**
 * Guards for server components and server actions.
 *
 * Two shapes, on purpose:
 *
 *   requireX()  REDIRECTS or returns. Use at the top of a page. A visitor who
 *               is not signed in lands on the sign-in form with a `next` so
 *               they come back where they were - not on a stack trace, and not
 *               on an empty page that quietly omits half its sections.
 *   checkX()    returns a plain result. Use where the page should RENDER the
 *               state rather than navigate away: "Sylva has not yet approved
 *               this organisation" is information, not an error.
 *
 * None of this is the security boundary. The security boundary is the database
 * role the query runs as and the row-level policy that filters it; these guards
 * decide what a page SHOWS, and a bug in them cannot hand anybody another
 * organisation's rows. Read docs/FINDING-001 for why that separation is the
 * whole design.
 */

export interface Denied {
  readonly ok: false;
  readonly reason: AuthErrorCode;
}
export interface Allowed {
  readonly ok: true;
  readonly viewer: Viewer;
}
export type GuardResult = Allowed | Denied;

/** Signed in, or off to the sign-in form. */
export async function requireActor(returnTo?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;
  const locale = await getLocale();
  const query = returnTo ? { next: returnTo } : undefined;
  redirectTo({ href: { pathname: '/sign-in', query }, locale });
}

/** Signed in AND holding this platform role, or off to the sign-in form. */
export async function requireRole(
  role: PlatformRole,
  returnTo?: string,
): Promise<Viewer> {
  const viewer = await requireActor(returnTo);
  if (viewer.roles.includes(role)) return viewer;
  const locale = await getLocale();
  redirectTo({ href: { pathname: '/sign-in', query: { error: 'wrong_role' } }, locale });
}

/**
 * Approved by Sylva for this role - rule 6. Returns a result rather than
 * redirecting, because "registered but not yet approved" is a real state with a
 * page of its own (/vetting/status) and a sentence to show, not a dead end.
 *
 * The answer comes from sylva.is_vetted(), which reads org.org_role_approval -
 * the trigger-maintained cache of the vetting decision chain. The application
 * never decides this; it asks.
 */
export async function requireApprovedOrg(role: PlatformRole): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: 'not_signed_in' };
  if (!viewer.roles.includes(role)) return { ok: false, reason: 'wrong_role' };

  const approved = await readAs(viewer.actor, async (tx) => {
    const row = await tx.one<{ ok: boolean }>(
      'SELECT sylva.is_vetted($1::text, $2::uuid) AS ok',
      [role, viewer.orgId],
    );
    return row.ok;
  });

  return approved ? { ok: true, viewer } : { ok: false, reason: 'not_approved' };
}

/** Signed in, without navigating away. For chrome that adapts to the viewer. */
export async function checkActor(): Promise<GuardResult> {
  const viewer = await getViewer();
  return viewer ? { ok: true, viewer } : { ok: false, reason: 'not_signed_in' };
}

/** The viewer's primary role, or null when nobody is signed in. */
export async function currentRole(): Promise<PlatformRole | null> {
  const viewer = await getViewer();
  return viewer ? primaryRole(viewer.roles) : null;
}
