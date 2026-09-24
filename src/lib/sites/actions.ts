'use server';

import { getLocale } from 'next-intl/server';
import { redirectTo } from '@/lib/i18n/navigate';
import { getViewer } from '@/lib/auth/session';
import {
  codeForDatabaseError,
  logAuthFailure,
  type AuthErrorCode,
} from '@/lib/auth/errors';
import {
  SiteFields,
  SiteFieldsWithId,
  SiteIdOnly,
  firstField,
} from './input';
import { addBuyerSite, removeBuyerSite, updateBuyerSite } from './queries';

/**
 * The three mutations the site register needs, as Server Actions.
 *
 * Shape, copied deliberately from src/lib/auth/actions.ts so there is one way
 * of doing this in the codebase:
 *
 *  - Every field is parsed with zod HERE, on the server, from the FormData. The
 *    `min`, `max` and `required` attributes on the form are a convenience for
 *    the person typing and are not a check. A POST from outside the page gets
 *    the same treatment.
 *  - Failure ends in a redirect back to the page with a CODE in the query
 *    string, never a message and never a value. So the form needs no client
 *    JavaScript, the wording stays in the message catalogue, and no coordinate
 *    of a company's plant is ever written into a URL - which would put it in
 *    every access log, proxy and Referer header between here and the browser.
 *  - Nothing in this file decides who may write. It asks for the actor and
 *    hands it to the query layer; geo.buyer_site's policy decides, and a bug
 *    here cannot reach another organisation's row. An account that is not a
 *    buyer holds no grant on the table, so a POST from one is refused by
 *    PostgreSQL with 42501 and becomes "You don't have access to this
 *    information" - not a check this file performs and not one it could skip.
 *
 * redirect() navigates by throwing, so it is never called inside a try block
 * that would swallow it.
 */

const SITES_PATH = '/dashboard/sites';

function back(locale: string, query: Record<string, string>): never {
  redirectTo({ href: { pathname: SITES_PATH, query }, locale });
}

function fail(locale: string, error: AuthErrorCode, field?: string): never {
  back(locale, field ? { error, field } : { error });
}

export async function addSiteAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = SiteFields.safeParse({
    label: formData.get('label'),
    country: formData.get('country'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  });
  if (!parsed.success) fail(locale, 'invalid_input', firstField(parsed.error));

  const viewer = await getViewer();
  if (!viewer) fail(locale, 'not_signed_in');

  try {
    await addBuyerSite(viewer.actor, {
      label: parsed.data.label,
      countryCode: parsed.data.country,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logAuthFailure('addSite', err);
    fail(locale, codeForDatabaseError(err));
  }

  back(locale, { done: 'added' });
}

export async function updateSiteAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = SiteFieldsWithId.safeParse({
    id: formData.get('id'),
    label: formData.get('label'),
    country: formData.get('country'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  });
  if (!parsed.success) fail(locale, 'invalid_input', firstField(parsed.error));

  const viewer = await getViewer();
  if (!viewer) fail(locale, 'not_signed_in');

  let changed = false;
  try {
    changed = await updateBuyerSite(viewer.actor, parsed.data.id, {
      label: parsed.data.label,
      countryCode: parsed.data.country,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logAuthFailure('updateSite', err);
    fail(locale, codeForDatabaseError(err));
  }

  // The policy matched no row. Saying "you don't have access to this
  // information" is the right sentence whether the row belongs to somebody
  // else or does not exist, and it is the only one that does not tell a
  // stranger which of the two it was.
  if (!changed) fail(locale, 'no_access');
  back(locale, { done: 'updated' });
}

export async function removeSiteAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = SiteIdOnly.safeParse({ id: formData.get('id') });
  if (!parsed.success) fail(locale, 'invalid_input', 'id');

  const viewer = await getViewer();
  if (!viewer) fail(locale, 'not_signed_in');

  let removed = false;
  try {
    removed = await removeBuyerSite(viewer.actor, parsed.data.id);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logAuthFailure('removeSite', err);
    fail(locale, codeForDatabaseError(err));
  }

  if (!removed) fail(locale, 'no_access');
  back(locale, { done: 'removed' });
}

/** next/navigation signals a redirect by throwing. See src/lib/auth/actions.ts. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
