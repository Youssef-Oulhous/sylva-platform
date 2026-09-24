import { cookies } from 'next/headers';
import { cache } from 'react';
import { ANONYMOUS, type Actor } from '@/lib/db/actor';
import { digestOf, looksLikeToken, newSessionToken } from './tokens';
import { closeSession, openSession, resolveSession, type ResolvedSession } from './queries';
import { actorFromSession } from './roles';

/**
 * The session, as the rest of the application sees it.
 *
 *   getActor()   the thing every query needs. ANONYMOUS when there is no valid
 *                session, never a throw: a page that is readable by the public
 *                must stay readable when a cookie expires mid-visit.
 *   getViewer()  the same session with the things the INTERFACE needs - roles,
 *                locale, the person's organisation - for deciding what to show.
 *
 * Both are wrapped in React's cache(), so a page that asks fifteen components
 * "who is this?" makes one database round trip, and every component in that
 * render sees the same answer even if the session expires between them.
 *
 * The cookie:
 *   httpOnly   script cannot read it, so an XSS bug cannot steal the session
 *   secure     except on http://localhost, where the browser would drop it
 *   sameSite   'lax' - the session survives a project page shared by email,
 *              and does not ride along on a cross-site POST
 *   path '/'   one session for the whole site
 * The value is an opaque 32-byte token. The database holds sha256 of it.
 */

const COOKIE = process.env.SYLVA_SESSION_COOKIE ?? 'sylva_session';
const TTL_HOURS = Number(process.env.SYLVA_SESSION_TTL_HOURS ?? 12);
const TTL_SECONDS = Math.max(60, Math.trunc(TTL_HOURS * 3600));

export interface Viewer {
  readonly userId: string;
  readonly personRef: string;
  readonly orgId: string;
  readonly locale: string;
  readonly roles: readonly string[];
  readonly actor: Actor;
  readonly expiresAt: Date;
}

/** The raw session row, or null. Cached for the request. */
const currentSession = cache(async (): Promise<ResolvedSession | null> => {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  // A malformed cookie is junk or a probe; it does not deserve a round trip.
  if (!raw || !looksLikeToken(raw)) return null;
  try {
    return await resolveSession(digestOf(raw));
  } catch (err) {
    // A database that is down must not turn every public page into a 500. The
    // visitor becomes anonymous, which is what they were a moment ago anyway.
    console.error(JSON.stringify({
      level: 'error', msg: 'session resolve failed',
      detail: err instanceof Error ? err.message : String(err),
    }));
    return null;
  }
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const s = await currentSession();
  if (!s) return null;
  return {
    userId: s.userId,
    personRef: s.personRef,
    orgId: s.orgId,
    locale: s.locale,
    roles: s.roles,
    actor: actorFromSession(s),
    expiresAt: s.expiresAt,
  };
});

export const getActor = cache(async (): Promise<Actor> => {
  const v = await getViewer();
  return v?.actor ?? ANONYMOUS;
});

export async function isSignedIn(): Promise<boolean> {
  return (await getViewer()) !== null;
}

/**
 * Issues a session and sets the cookie. Callable only from a Server Action or
 * a Route Handler - Next.js refuses a cookie write during a render, and that
 * refusal is correct.
 *
 * Returns the resolved session, because the caller needs the account's roles to
 * decide where to send it and the roles live behind the same SECURITY DEFINER
 * wall as everything else. One extra round trip, once, at sign-in.
 */
export async function startSession(userId: string): Promise<ResolvedSession | null> {
  const token = newSessionToken();
  const { expiresAt } = await openSession(userId, token.digest, TTL_SECONDS);
  const jar = await cookies();
  jar.set(COOKIE, token.raw, {
    httpOnly: true,
    // localhost is served over http in development, where a Secure cookie is
    // dropped silently and sign-in appears to succeed and do nothing.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return resolveSession(token.digest);
}

/** Destroys the session row AND the cookie. Either alone is a bug. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw && looksLikeToken(raw)) {
    try {
      await closeSession(digestOf(raw));
    } catch (err) {
      // The cookie still goes, so the browser is signed out either way.
      console.error(JSON.stringify({
        level: 'error', msg: 'session close failed',
        detail: err instanceof Error ? err.message : String(err),
      }));
    }
  }
  jar.delete(COOKIE);
}
