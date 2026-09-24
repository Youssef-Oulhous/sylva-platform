'use server';

import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirectTo } from '@/lib/i18n/navigate';
import { withActor } from '@/lib/db/session';
import { getViewer } from '@/lib/auth/session';
import { codeForDatabaseError, logAuthFailure, type AuthErrorCode } from '@/lib/auth/errors';

/**
 * The one mutation the project page owns: a private question to the project
 * owner and to Sylva.
 *
 * Shape follows src/lib/auth/actions.ts, for the same reasons: zod on the
 * server against the FormData, failure as a redirect carrying an error CODE and
 * never a message or a body, so the form needs no client JavaScript and nothing
 * a person typed ends up in a server access log.
 *
 * What this action does NOT decide:
 *
 *   who may ask      the INSERT policy on deal.project_question is
 *                    `asker_org_id = sylva.actor_org_id()`, and only the buyer
 *                    and investor roles hold INSERT at all (migration 0016).
 *                    Sending another organisation's id here does not work.
 *   who may read it  the policies again: the asker's organisation, the project
 *                    owner, the operator and the auditor. There is no public
 *                    comment feed and no way to make one from this table.
 *   whether it stays the table is append-only. A question cannot be edited or
 *                    deleted, by anyone, including the person who asked it.
 */

const Ask = z.object({
  // The page passes these; both are checked again server-side because a form
  // field is user input whatever rendered it.
  project_id: z.string().uuid(),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/),
  // A closed list. It is prefixed to the body rather than stored in a column,
  // because there is no column for it and inventing one is a schema decision.
  subject: z
    .enum(['outcomes', 'claims', 'durability', 'availability', 'documents', 'other'])
    .optional(),
  question: z.string().trim().min(10).max(4000),
});

const SUBJECT_PREFIX: Record<string, string> = {
  outcomes: 'Outcomes',
  claims: 'Claim rights',
  durability: 'Long-term protection',
  availability: 'Availability',
  documents: 'Documents',
  other: 'Other',
};

/**
 * Back to the project page, at the questions section, with the outcome as a
 * code. The fragment matters: the form is section ten of a long document and
 * landing at the top of it would look like nothing happened.
 */
function back(locale: string, slug: string, query: Record<string, string>): never {
  const qs = new URLSearchParams(query).toString();
  redirectTo({ href: `/projects/${slug}${qs ? `?${qs}` : ''}#questions`, locale });
}

export async function askProjectQuestionAction(formData: FormData): Promise<void> {
  const locale = await getLocale();

  const parsed = Ask.safeParse({
    project_id: formData.get('project_id'),
    slug: formData.get('slug'),
    subject: formData.get('subject') || undefined,
    question: formData.get('question'),
  });
  if (!parsed.success) {
    const slug = String(formData.get('slug') ?? '');
    // No slug means no page to go back to; the sign-in form is not the right
    // place either, so this is the one case that ends on the index.
    if (!/^[a-z0-9-]+$/.test(slug)) redirectTo({ href: '/projects', locale });
    back(locale, slug, { qerror: 'invalid_input' });
  }
  const d = parsed.data;

  const viewer = await getViewer();
  if (!viewer) back(locale, d.slug, { qerror: 'not_signed_in' });

  const actor = viewer.actor;
  const mayAsk =
    actor.kind === 'operator'
    || (actor.kind === 'member' && (actor.role === 'buyer' || actor.role === 'investor'));
  if (!mayAsk) back(locale, d.slug, { qerror: 'wrong_role' });

  const body = d.subject
    ? `[${SUBJECT_PREFIX[d.subject]}] ${d.question}`
    : d.question;

  let failure: AuthErrorCode | null = null;
  try {
    await withActor(actor, async (tx) => {
      // owner_org_id is read from the project rather than taken from the form:
      // the composite foreign key (project_id, owner_org_id) would refuse a
      // mismatch anyway, and reading it means the form cannot carry it at all.
      const project = await tx.maybe<{ owner_org_id: string }>(
        'SELECT owner_org_id FROM proj.project WHERE id = $1',
        [d.project_id],
      );
      if (!project) {
        failure = 'no_access';
        return;
      }
      await tx.query(
        `INSERT INTO deal.project_question
           (project_id, owner_org_id, asker_org_id, asker_person_ref, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [d.project_id, project.owner_org_id, actor.orgId, actor.personRef, body],
      );
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logAuthFailure('askProjectQuestion', err);
    failure = codeForDatabaseError(err);
  }

  if (failure) back(locale, d.slug, { qerror: failure });

  // The page itself is force-dynamic, so there is no full route cache to clear.
  // This drops the CLIENT router cache entry, without which a back-navigation
  // would show the thread list as it was before the question was sent.
  revalidatePath(`/${locale}/projects/${d.slug}`);
  back(locale, d.slug, { qsent: '1' });
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
