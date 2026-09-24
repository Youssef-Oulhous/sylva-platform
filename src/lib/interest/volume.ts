/**
 * Reading a volume a person typed into the enquiry form.
 *
 * Whole numbers only, and spaces are tolerated because people type "12 400".
 *
 * A decimal separator is REFUSED rather than guessed. "1.500" is one and a half
 * to a British reader and one thousand five hundred to a German one, and this
 * platform's whole premise is that a figure on a screen means exactly one
 * thing. Guessing which of the two a buyer meant, on the form that opens a
 * commercial conversation, is not a convenience - it is the platform inventing
 * a number. The hint beside the field says whole numbers, and a buyer who needs
 * a fraction says so in the message, where a human reads it.
 *
 * Kept out of actions.ts so it can be unit-tested: a 'use server' module may
 * only export async functions.
 */

const DIGITS_ONLY = /^\d{1,12}$/;

export type ParsedVolume = number | null | 'invalid';

/** A number, `null` for a blank field, or 'invalid' for anything else. */
export function parseVolume(raw: string): ParsedVolume {
  // Ordinary space, no-break space, narrow no-break space: all three are what a
  // locale-aware keyboard or a paste from a spreadsheet actually produces.
  const cleaned = raw.replace(/[\s  ]/g, '');
  if (cleaned === '') return null;
  if (!DIGITS_ONLY.test(cleaned)) return 'invalid';
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n) || n <= 0) return 'invalid';
  return n;
}
