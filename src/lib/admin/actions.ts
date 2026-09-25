'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirectTo } from '@/lib/i18n/navigate';
import type { Actor } from '@/lib/db/actor';
import { getViewer } from '@/lib/auth/session';
import { primaryRole } from '@/lib/auth/roles';
import { logAuthFailure } from '@/lib/auth/errors';
import { codeForAdminError, missingFromGateError, type AdminErrorCode } from './errors';
import type { CorrectionErrorCode } from './labels';
import {
  AlreadyPublishedError,
  UnknownApplicationError,
  UnknownProjectError,
  publishProject,
  recordDecision,
} from './queries';
import { correctionErrorCode, isRecordScope, recordCorrection } from './record';
import { ADMIN_DECISION_CHOICES } from './types';

/**
 * The two mutations the operator's screens need, as Server Actions.
 *
 * The shape follows src/lib/auth/actions.ts and src/lib/vetting/actions.ts
 * exactly, and for the same reasons:
 *
 * - Every input is validated with zod HERE, on the server, from the FormData.
 *   The `required` attributes on the form help the person typing; they are not
 *   a check, and nothing below trusts them.
 * - The ONLY things taken from the form are an id and a choice from a closed
 *   set. The organisation, the role, the operator's own organisation and the
 *   person recorded against the entry all come from the session or are read
 *   back out of the row being decided. A crafted form cannot approve a
 *   different organisation, and it cannot sign an entry as somebody else.
 * - Failure ends in a redirect back to the screen with an error CODE, never a
 *   raw database message and never a value the person typed. A recorded reason
 *   must not travel in a URL into a server log.
 * - So neither form needs client JavaScript.
 *
 * NONE OF THIS IS THE SECURITY BOUNDARY. The boundary is that these statements
 * run as `sylva_operator`, which is the only role holding INSERT on
 * `org.vetting_decision` and `UPDATE (status, published_at)` on `proj.project`.
 * A buyer who posted this form would be served by the app pool as
 * `sylva_buyer` and refused by PostgreSQL with 42501, which the error table
 * turns into "You don't have access to this information".
 *
 * redirect() works by throwing, so it is never called inside a try that would
 * catch it. Each action computes its outcome first and navigates last.
 */

const DecisionForm = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(['approve', 'decline', 'suspend']),
  // Ten characters is not a quality bar; it is the difference between a reason
  // and an accidental keypress. The record is append-only, so an entry without
  // one is permanently unexplained.
  reason: z.string().trim().min(10).max(4000),
});

const PublishForm = z.object({
  projectId: z.string().uuid(),
});

/**
 * A correcting entry on the transaction record.
 *
 * `entry` is the public_id of the entry being corrected - a uuid, so a slug or
 * an entry_no is rejected before it reaches a statement. Ten characters of
 * reason for the same reason a decision needs one: the record is append-only,
 * so an entry recorded without an explanation can never be edited to add one.
 */
const CorrectionForm = z.object({
  entry: z.string().uuid(),
  reason: z.string().trim().min(10).max(4000),
});

interface Operator {
  readonly locale: string;
  readonly actor: Actor;
  readonly orgId: string;
  readonly personRef: string;
}

/**
 * Signed in AND an operator, or a redirect. Returns `never` on the unhappy
 * paths, so the caller needs no null checks.
 *
 * `primaryRole` is the same closed mapping the session uses to pick a
 * connection pool, so an account without the operator role is not merely shown
 * less - it is served by a pool that cannot become `sylva_operator` at all.
 */
async function requireOperator(returnTo: string): Promise<Operator> {
  const locale = await getLocale();
  const viewer = await getViewer();
  if (!viewer) {
    redirectTo({ href: { pathname: '/sign-in', query: { next: returnTo } }, locale });
  }
  if (primaryRole(viewer.roles) !== 'operator') {
    redirectTo({ href: { pathname: '/sign-in', query: { error: 'wrong_role' } }, locale });
  }
  return {
    locale,
    actor: viewer.actor,
    orgId: viewer.orgId,
    personRef: viewer.personRef,
  };
}

function fail(
  locale: string,
  pathname: '/admin/vetting' | '/admin/projects' | '/admin/record',
  error: AdminErrorCode | CorrectionErrorCode,
  extra: Record<string, string> = {},
): never {
  redirectTo({ href: { pathname, query: { error, ...extra } }, locale });
}

/* ------------------------------------------------------------- VETTING --- */

/**
 * Record one vetting decision.
 *
 * There is no "set approved" here and there cannot be: `org.org_role_approval`
 * is written only by the SECURITY DEFINER trigger on `org.vetting_decision`,
 * and `ci.assert_approval_is_derived()` fails the build if any application role
 * gains a privilege on it. This action inserts an entry; the state follows.
 */
export async function recordVettingDecisionAction(formData: FormData): Promise<void> {
  const op = await requireOperator('/admin/vetting');

  const parsed = DecisionForm.safeParse({
    submissionId: formData.get('submissionId'),
    decision: formData.get('decision'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    // Which of the two failed decides the sentence: a missing choice and a
    // missing reason are different mistakes and the form points at each.
    const reasonFailed = parsed.error.issues.some((i) => i.path[0] === 'reason');
    const id = formData.get('submissionId');
    fail(
      op.locale,
      '/admin/vetting',
      reasonFailed ? 'reason_required' : 'invalid_input',
      typeof id === 'string' && id.length > 0 && id.length <= 64
        ? { application: id }
        : {},
    );
  }

  const { submissionId, decision, reason } = parsed.data;

  let recorded: string;
  try {
    const result = await recordDecision(op.actor, {
      submissionId,
      choice: ADMIN_DECISION_CHOICES.find((c) => c === decision)!,
      reason,
      decidedByOrgId: op.orgId,
      decidedByPersonRef: op.personRef,
    });
    recorded = result.recorded;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnknownApplicationError) {
      fail(op.locale, '/admin/vetting', 'unknown_application');
    }
    logAuthFailure('admin.recordDecision', err);
    fail(op.locale, '/admin/vetting', codeForAdminError(err), {
      application: submissionId,
    });
  }

  redirectTo({
    href: {
      pathname: '/admin/vetting',
      // `recorded` is the enum member the database actually stored, so the
      // confirmation says "reinstated" where that is what happened.
      query: { application: submissionId, recorded },
    },
    locale: op.locale,
  });
}

/* ------------------------------------------------------------ PUBLISH ---- */

/**
 * Publish one project.
 *
 * The screen disables this control while the gate is incomplete, but the
 * refusal that counts is the database's. If the trigger says no, the codes it
 * names are lifted out of the SQLSTATE SY008 message and carried back as a
 * list, so the screen can print them with the same labels the gate checklist
 * uses. The raw database sentence is never shown: it also carries a table name
 * and a project UUID.
 */
export async function publishProjectAction(formData: FormData): Promise<void> {
  const op = await requireOperator('/admin/projects');

  const parsed = PublishForm.safeParse({ projectId: formData.get('projectId') });
  if (!parsed.success) fail(op.locale, '/admin/projects', 'invalid_input');

  const { projectId } = parsed.data;

  let slug: string;
  try {
    const result = await publishProject(op.actor, projectId);
    slug = result.slug;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnknownProjectError) {
      fail(op.locale, '/admin/projects', 'unknown_reference');
    }
    if (err instanceof AlreadyPublishedError) {
      fail(op.locale, '/admin/projects', 'already_published', { project: projectId });
    }
    logAuthFailure('admin.publishProject', err);
    const missing = missingFromGateError(err);
    fail(op.locale, '/admin/projects', codeForAdminError(err), {
      project: projectId,
      ...(missing.length > 0 ? { missing: missing.join(',') } : {}),
    });
  }

  redirectTo({
    href: { pathname: '/admin/projects', query: { project: slug, published: '1' } },
    locale: op.locale,
  });
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

/* --------------------------------------------------------- THE RECORD ----- */

/**
 * A correcting entry on the transaction record.
 *
 * R4: the record is append-only. Nothing is edited and nothing is deleted; a
 * mistake is corrected by a new entry that points at the wrong one, and the
 * wrong one stays visible. That is not a convention this action follows - three
 * ALWAYS triggers on record.entry refuse UPDATE, DELETE and TRUNCATE, so it is
 * the only thing this action COULD do.
 *
 * The form contributes two values: which entry, and why. Everything else -
 * which project, which deal, which counterparties, the operator's organisation
 * and the non-personal label the entry is signed with - is copied from the row
 * being corrected or read from the session inside one statement. So a crafted
 * post cannot attach a correction to a project it was not sent from, and cannot
 * sign it as somebody else.
 *
 * The reason is NOT carried back in the query string on failure. A recorded
 * reason is somebody's words about a transaction and must not end up in a
 * server log; the person retypes it, which is the cheaper mistake.
 */
export async function recordCorrectionAction(formData: FormData): Promise<void> {
  const op = await requireOperator('/admin/record');

  const parsed = CorrectionForm.safeParse({
    entry: formData.get('entry'),
    reason: formData.get('reason'),
  });

  // The filter the form was sent from, so the redirect lands on the same view
  // the operator was looking at rather than resetting it.
  const view = readView(formData);

  if (!parsed.success) {
    const reasonFailed = parsed.error.issues.some((i) => i.path[0] === 'reason');
    fail(
      op.locale,
      '/admin/record',
      reasonFailed ? 'reason_required' : 'invalid_input',
      view,
    );
  }

  let corrected: string;
  try {
    const result = await recordCorrection(op.actor, {
      targetPublicId: parsed.data.entry,
      reason: parsed.data.reason,
    });
    corrected = result.shortRef;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logAuthFailure('admin.recordCorrection', err);
    fail(op.locale, '/admin/record', correctionErrorCode(err), view);
  }

  redirectTo({
    href: { pathname: '/admin/record', query: { ...view, corrected } },
    locale: op.locale,
  });
}

/**
 * The filter fields the correction form carries so the redirect returns to the
 * same view. Each is re-validated on the way out: a scope that is not one of
 * the three is dropped rather than echoed back into a URL.
 */
function readView(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  const project = formData.get('project');
  const event = formData.get('event');
  const scope = formData.get('scope');
  const page = formData.get('page');
  if (typeof project === 'string' && project.length > 0 && project.length <= 120) {
    out.project = project;
  }
  if (typeof event === 'string' && event.length > 0 && event.length <= 64) {
    out.event = event;
  }
  if (isRecordScope(scope)) out.scope = scope;
  if (typeof page === 'string' && /^[1-9][0-9]{0,3}$/.test(page)) out.page = page;
  return out;
}
