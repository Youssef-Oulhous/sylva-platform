import { z } from 'zod';
import type { AnswerInput } from './queries';

/**
 * Turning a posted form into answers, and the reasons it is its own module.
 *
 * It lives beside actions.ts rather than inside it for two reasons:
 *
 *   1  a 'use server' file may only export async functions, so nothing in
 *      actions.ts can be unit tested directly. This is the part with the
 *      decisions in it, so this is the part that needs a test.
 *   2  it is pure. Given a FormData and the question list the DATABASE
 *      returned, it produces answers - no session, no connection, no locale.
 *
 * What it is not: a validator of whether an answer is GOOD. Whether a required
 * question has been answered is decided by submitVettingIn() against
 * org.question, inside the same transaction as the insert. Nothing here can be
 * talked out of that by a hidden field.
 */

/**
 * Answers arrive as `answer.<question_code>`, where the code is matched against
 * the question codes the DATABASE returns for this questionnaire. A field with
 * an invented name is read and dropped rather than trusted, and how a value is
 * interpreted comes from org.question.answer_kind - so the form cannot decide
 * that a boolean question is really a text one.
 */
const FIELD = /^answer\.([a-z0-9_]{1,64})$/;

/**
 * The longest answer this platform will store.
 *
 * org.vetting_answer.answer_text is `text`, so PostgreSQL imposes no limit at
 * all; this is the limit, and it is enforced server-side because the `maxlength`
 * attribute on a textarea is a courtesy to the person typing and nothing more.
 * 20,000 characters is about eight pages - far more than any question here asks
 * for, and short enough that a submission cannot be used to push megabytes into
 * an append-only table that can never be pruned.
 */
export const MAX_ANSWER_CHARS = 20_000;

const AnswerText = z.string().max(MAX_ANSWER_CHARS);

/** A number is stored as numeric. Anything else is not a number. */
const NUMERIC = /^-?\d+(\.\d+)?$/;

export interface QuestionShape {
  readonly questionCode: string;
  readonly answerKind: string;
}

/**
 * At least one answer was longer than the platform stores.
 *
 * Thrown rather than truncated, and thrown rather than dropped. Truncating
 * edits what an organisation said about itself in a record it cannot later
 * correct in place; dropping tells the person "you did not answer this
 * question", which is both false and unactionable - they typed eight pages and
 * the page says it is blank. Naming the questions lets the form point at them.
 */
export class AnswerTooLongError extends Error {
  readonly questionCodes: readonly string[];
  constructor(questionCodes: readonly string[]) {
    super(`vetting: ${questionCodes.length} answer(s) longer than ${MAX_ANSWER_CHARS} characters`);
    this.name = 'AnswerTooLongError';
    this.questionCodes = questionCodes;
  }
}

/**
 * The answers in a posted form, in the shape the queries take.
 *
 * @throws AnswerTooLongError if any typed answer exceeds MAX_ANSWER_CHARS.
 */
export function collectAnswers(
  formData: FormData,
  questions: readonly QuestionShape[],
): AnswerInput[] {
  const kindOf = new Map(questions.map((q) => [q.questionCode, q.answerKind]));

  // Keyed by question code, so one question can only produce one answer.
  //
  // A FormData may legitimately carry the same name twice - a duplicated field
  // in a stale tab, a replayed post, a form assembled by something other than
  // this page - and pushing both into the array made the INSERT violate the
  // primary key of org.vetting_draft. The person then saw a unique-violation
  // mapped to "An account already exists for this email address", on a
  // questionnaire. The later value wins, which is the one the form would show.
  const byCode = new Map<string, AnswerInput>();
  const tooLong: string[] = [];

  for (const [name, raw] of formData.entries()) {
    const m = FIELD.exec(name);
    if (!m) continue;
    const code = m[1]!;
    const kind = kindOf.get(code);
    // A field for a question this questionnaire does not have. Dropped, not
    // rejected: a tab left open across a questionnaire version is the likely
    // cause, and that person deserves their other answers kept.
    if (kind === undefined) continue;
    if (typeof raw !== 'string') continue;

    const parsed = AnswerText.safeParse(raw);
    if (!parsed.success) {
      // Only a question the person TYPES into can overflow meaningfully. An
      // over-long value on a yes/no or a number field is not a long answer, it
      // is junk, and the branches below already treat it as unanswered.
      if (kind === 'text' || kind === 'longtext') tooLong.push(code);
      continue;
    }
    const value = parsed.data;

    if (kind === 'boolean') {
      if (value === 'yes') byCode.set(code, { questionCode: code, boolean: true });
      else if (value === 'no') byCode.set(code, { questionCode: code, boolean: false });
      // anything else: no answer. Not an error - it is an unanswered question,
      // and submit() will say so if the question is required.
    } else if (kind === 'number') {
      // A number is stored as numeric. Anything that is not one is treated as
      // unanswered rather than guessed at.
      if (NUMERIC.test(value.trim())) {
        byCode.set(code, { questionCode: code, numeric: value.trim() });
      }
    } else {
      byCode.set(code, { questionCode: code, text: value });
    }
  }

  if (tooLong.length > 0) throw new AnswerTooLongError([...new Set(tooLong)]);

  return [...byCode.values()];
}
