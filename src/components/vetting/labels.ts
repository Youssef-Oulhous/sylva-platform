import type { VettingQuestion } from '@/lib/vetting/types';

/**
 * Where a question's words come from.
 *
 * The question SET is the database's: org.question holds the code, the order,
 * whether it is required, and `prompt_en`. What the database does not hold is a
 * GERMAN prompt - org.question has one text column and no translation table,
 * unlike units.unit_type, which has units.unit_type_translation beside it.
 *
 * Rather than invent a schema change the client has not asked for, or serve a
 * German page with English questions and pretend that is fine, each question
 * may be translated in the message catalogue under its own code:
 *
 *     vettingForm.question.<question_code>.label     the prompt
 *     vettingForm.question.<question_code>.hint      what to include
 *     vettingForm.question.<question_code>.why       why it is asked
 *     vettingForm.question.<question_code>.short     the index entry
 *
 * The catalogue wins when the key exists; `prompt_en` from the database is the
 * fallback. So:
 *
 *   - adding a question in the database makes it appear immediately, in
 *     English, with no code change. It is never missing.
 *   - translating it is adding four keys, with no code change either.
 *   - a question whose key is missing shows the English prompt rather than the
 *     string "vettingForm.question.foo.label", which is the failure mode
 *     README §11 exists because of.
 *
 * `hint` and `why` have NO fallback on purpose. The concept note's contract is
 * that every question "states why it is asked, on the page, next to the field".
 * The database has nowhere to put that sentence, so an untranslated question
 * simply does not show one - inventing a reason for a question Sylva wrote
 * would be the platform speaking for the operator.
 *
 * This is written up as a finding rather than silently worked around: see the
 * summary returned with this change.
 */

type Translator = {
  (key: string): string;
  has?: (key: string) => boolean;
};

function lookup(t: Translator, key: string): string | null {
  try {
    if (typeof t.has === 'function' && t.has(key)) return t(key);
  } catch {
    /* a catalogue that cannot answer is the same as one that has no key */
  }
  return null;
}

export interface QuestionLabels {
  readonly label: string;
  readonly hint: string | null;
  readonly why: string | null;
  readonly short: string;
  /** True when the label is the database's English prompt, not a translation. */
  readonly labelIsSourceLanguage: boolean;
}

export function questionLabels(
  t: Translator,
  question: VettingQuestion,
): QuestionLabels {
  const base = `question.${question.questionCode}`;
  const label = lookup(t, `${base}.label`);
  const short = lookup(t, `${base}.short`);
  return {
    label: label ?? question.promptEn,
    hint: lookup(t, `${base}.hint`),
    why: lookup(t, `${base}.why`),
    short: short ?? label ?? question.promptEn,
    labelIsSourceLanguage: label === null,
  };
}

/** A message that may not be in the catalogue yet, with an English sentence. */
export function orFallback(t: Translator, key: string, fallbackEn: string): string {
  return lookup(t, key) ?? fallbackEn;
}

/**
 * The same, for a message that takes arguments. The fallback takes none, so it
 * is written without them: an English sentence with a {count} left in it is
 * worse than an English sentence that does not mention the count.
 */
export function orFallbackWith(
  t: Translator,
  key: string,
  values: Record<string, unknown>,
  fallbackEn: string,
): string {
  try {
    if (typeof t.has === 'function' && t.has(key)) {
      // next-intl's translator takes ICU arguments as a second parameter. The
      // narrow Translator type above is what every call site can satisfy -
      // useTranslations(), getTranslations() and a plain function in a test -
      // so the argument-taking form is reached through one cast, here, rather
      // than by widening the type every caller has to match.
      const withValues = t as unknown as (k: string, v: Record<string, unknown>) => string;
      return withValues(key, values);
    }
  } catch {
    /* fall through */
  }
  return fallbackEn;
}
