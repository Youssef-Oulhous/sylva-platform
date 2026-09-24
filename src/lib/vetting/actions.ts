'use server';

import { getLocale } from 'next-intl/server';
import { redirectTo } from '@/lib/i18n/navigate';
import type { Actor, ActorRole } from '@/lib/db/actor';
import { getViewer } from '@/lib/auth/session';
import { primaryRole } from '@/lib/auth/roles';
import { logAuthFailure } from '@/lib/auth/errors';
import {
  MissingRequiredAnswersError,
  loadQuestionnaire,
  saveDraft,
  submitVetting,
} from './queries';
import { AnswerTooLongError, collectAnswers } from './answers';
import { codeForVettingError, type VettingErrorCode } from './errors';
import { isTransactingRole } from './roles';

/**
 * The two mutations the questionnaire needs, as Server Actions.
 *
 * The shape follows src/lib/auth/actions.ts exactly, and for the same reasons:
 *
 * - Every input is validated with zod HERE, on the server, from the FormData.
 *   The `required` attributes in the form help the person typing; they are not
 *   a check and nothing below trusts them.
 * - NOTHING about the questionnaire comes from the client. The role comes from
 *   the session, and the questionnaire is re-read from the database inside the
 *   action. A hidden field claiming a different questionnaire, a different
 *   organisation or that a required question is optional changes nothing: the
 *   form supplies answers and only answers.
 * - Failure ends in a redirect back to the form with an error CODE, never a
 *   message and never a value the person typed. The URL must not carry an
 *   answer into a server log.
 * - So the form needs no client JavaScript. Same reasoning as the rest of the
 *   codebase: server-rendered, no bundle.
 *
 * redirect() works by throwing, so it is never called inside a try that would
 * catch it. Each action computes its outcome first and navigates last.
 *
 * Reading the posted form - the zod validation, the answer_kind dispatch and
 * the refusal of an over-long answer - is src/lib/vetting/answers.ts. It is a
 * plain module because a 'use server' file may only export async functions, and
 * the parsing is the part with the decisions in it, so it is the part that
 * needs a unit test.
 */

interface Ready {
  readonly locale: string;
  readonly actor: Actor;
  readonly roleCode: ActorRole;
  readonly personRef: string;
  readonly questionnaireId: string;
  readonly questions: readonly { questionCode: string; answerKind: string }[];
}

/**
 * Everything both actions need before they can do anything, or a redirect.
 * Returns `never` on the unhappy paths, so the caller needs no null checks.
 */
async function prepare(): Promise<Ready> {
  const locale = await getLocale();
  const viewer = await getViewer();
  if (!viewer) {
    redirectTo({ href: { pathname: '/sign-in', query: { next: '/vetting' } }, locale });
  }

  const role = primaryRole(viewer.roles);
  if (role === null || !isTransactingRole(role)) {
    // An operator or an auditor does not have a questionnaire to fill in. This
    // is not a failure of theirs; it is a page that does not apply to them.
    redirectTo({ href: { pathname: '/vetting', query: { error: 'wrong_role' } }, locale });
  }

  const questionnaire = await loadQuestionnaire(viewer.actor, role);
  if (!questionnaire) {
    redirectTo({
      href: { pathname: '/vetting', query: { error: 'no_questionnaire' } },
      locale,
    });
  }

  return {
    locale,
    actor: viewer.actor,
    roleCode: role,
    personRef: viewer.personRef,
    questionnaireId: questionnaire.id,
    questions: questionnaire.questions.map((q) => ({
      questionCode: q.questionCode,
      answerKind: q.answerKind,
    })),
  };
}

function failVetting(locale: string, error: VettingErrorCode, missing?: readonly string[]): never {
  // `missing` is a list of question CODES - 'intended_claim', 'offset_use'.
  // Identifiers from the database, never anything the person typed.
  const query: Record<string, string> = { error };
  if (missing && missing.length > 0) query.missing = missing.join(',');
  redirectTo({ href: { pathname: '/vetting', query }, locale });
}

/** Save what has been typed so far. No completeness check: it is a draft. */
export async function saveVettingDraftAction(formData: FormData): Promise<void> {
  const ready = await prepare();

  try {
    const answers = collectAnswers(formData, ready.questions);
    await saveDraft(ready.actor, {
      questionnaireId: ready.questionnaireId,
      roleCode: ready.roleCode,
      personRef: ready.personRef,
      answers,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof AnswerTooLongError) {
      // Not logged: somebody pasting too much is a normal outcome, not a fault.
      // The draft they already had is untouched - saveDraft was never reached.
      failVetting(ready.locale, 'answer_too_long', err.questionCodes);
    }
    logAuthFailure('vetting.saveDraft', err);
    failVetting(ready.locale, codeForVettingError(err));
  }

  redirectTo({ href: { pathname: '/vetting', query: { saved: '1' } }, locale: ready.locale });
}

/** Submit. The completeness check is the database's question list, not the form's. */
export async function submitVettingAction(formData: FormData): Promise<void> {
  const ready = await prepare();

  try {
    const answers = collectAnswers(formData, ready.questions);
    await submitVetting(ready.actor, {
      questionnaireId: ready.questionnaireId,
      roleCode: ready.roleCode,
      personRef: ready.personRef,
      answers,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof AnswerTooLongError) {
      failVetting(ready.locale, 'answer_too_long', err.questionCodes);
    }
    if (err instanceof MissingRequiredAnswersError) {
      // Not logged: an unanswered question is a normal outcome, not a fault.
      failVetting(ready.locale, 'incomplete', err.missing);
    }
    logAuthFailure('vetting.submit', err);
    failVetting(ready.locale, codeForVettingError(err));
  }

  redirectTo({
    href: { pathname: '/vetting/status', query: { submitted: '1' } },
    locale: ready.locale,
  });
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
