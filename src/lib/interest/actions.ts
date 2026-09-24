'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirectTo } from '@/lib/i18n/navigate';
import { getViewer } from '@/lib/auth/session';
import { getInterestProject, recordInterest } from './queries';
import { parseVolume } from './volume';
import {
  codeForInterestError,
  logInterestFailure,
  type InterestErrorCode,
} from './errors';
import type { DealShapeChoice } from './types';

/**
 * Express interest, as a Server Action.
 *
 * The shape follows src/lib/auth/actions.ts, deliberately:
 *
 * - Every field is validated HERE, on the server, from the FormData. The
 *   client-side attributes are a convenience for the person typing; nothing in
 *   this file trusts them.
 * - NOTHING that identifies what is being written comes from the client except
 *   the slug. project_id, owner_org_id and unit_type_id are re-read from the
 *   database, so a hand-made POST cannot open a deal against a project the
 *   form was not showing, or attach a volume to another project's unit type.
 * - Failure ends in a redirect back to the form with an error CODE in the
 *   query string - never a message, never a database string, never a volume.
 *   The form renders the sentence from the code.
 * - So the form needs no client JavaScript at all.
 *
 * redirect() navigates by throwing, so it is never called inside a try that
 * would swallow it. The outcome is computed first and the navigation is last.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DEAL_SHAPES = ['spot', 'forward', 'co_investment', 'undecided'] as const;

const Enquiry = z.object({
  slug: z.string().trim().min(1).max(200).regex(SLUG),
  dealShape: z.enum(DEAL_SHAPES),
  // Long enough for a real question, short enough that the box is a question
  // box and not a document upload by other means.
  message: z.string().trim().max(4000),
  disclose: z.boolean(),
});

function fail(locale: string, slug: string, error: InterestErrorCode): never {
  redirectTo({
    href: { pathname: `/projects/${slug}/express-interest`, query: { error } },
    locale,
  });
}

export async function expressInterestAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = Enquiry.safeParse({
    slug: formData.get('slug'),
    dealShape: formData.get('dealShape') ?? 'undecided',
    message: formData.get('message') ?? '',
    disclose: formData.get('disclose') === 'on',
  });
  if (!parsed.success) {
    // Without a usable slug there is no form to send them back to.
    const raw = formData.get('slug');
    const slug = typeof raw === 'string' && SLUG.test(raw) ? raw : null;
    if (!slug) redirectTo({ href: '/projects', locale });
    fail(locale, slug, 'invalid_input');
  }
  const { slug, dealShape, message, disclose } = parsed.data;

  // Signed in? An interest event is recorded against an organisation, so there
  // is nothing to record it against otherwise. Back here afterwards.
  const viewer = await getViewer();
  if (!viewer) {
    redirectTo({
      href: {
        pathname: '/sign-in',
        query: { next: `/projects/${slug}/express-interest` },
      },
      locale,
    });
  }
  if (!viewer.roles.includes('buyer')) {
    fail(locale, slug, 'wrong_role');
  }

  let publicId: string;
  try {
    // Re-read the project as this actor. Row-level security decides whether
    // they may see it at all, and the ids below come from the database rather
    // than from the POST body.
    const project = await getInterestProject(viewer.actor, slug, locale);
    if (!project) fail(locale, slug, 'project_not_open');

    const volumes: { periodId: string; amount: number }[] = [];
    for (const period of project.periods) {
      const raw = formData.get(`volume-${period.periodId}`);
      if (typeof raw !== 'string') continue;
      const value = parseVolume(raw);
      if (value === 'invalid') fail(locale, slug, 'invalid_input');
      if (value !== null) volumes.push({ periodId: period.periodId, amount: value });
    }
    // A period list read off the project, not off the form: a period id the
    // form did not show is simply never looked at.
    if (volumes.length === 0) fail(locale, slug, 'no_periods');

    const recorded = await recordInterest(viewer.actor, {
      projectId: project.id,
      ownerOrgId: project.ownerOrgId,
      unitTypeId: project.unitTypeId,
      dealShape: dealShape as DealShapeChoice,
      volumes,
      message: message.length > 0 ? message : null,
      disclose,
    });
    publicId = recorded.publicId;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    // R6, the one-live-deal index and a privilege refusal all arrive here as
    // SQLSTATEs. They are expected answers, not faults, and ./errors.ts turns
    // each into a sentence.
    logInterestFailure('expressInterest', err);
    fail(locale, slug, codeForInterestError(err));
  }

  redirectTo({
    href: {
      pathname: `/projects/${slug}/express-interest`,
      query: { recorded: publicId },
    },
    locale,
  });
}

/**
 * next/navigation signals a redirect by throwing an error carrying the digest
 * "NEXT_REDIRECT". Swallowing it would turn every recorded interest into
 * "this service is not available at the moment".
 */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
