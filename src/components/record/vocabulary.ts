/**
 * The event vocabulary, as an ORDER.
 *
 * The entry types themselves live in record.entry_type and are read from it -
 * see src/lib/record/queries.ts. What the database does not hold, and what
 * this file exists for, is the sequence the concept note uses. Section 8 lists
 * its nine events in a deliberate order: a project is listed, then offered,
 * then interest is expressed, and so on to retirement. Sorting them
 * alphabetically would throw away the one thing about the list that teaches a
 * reader how a transaction runs.
 *
 * So: the codes come from the database, the ORDER comes from the note, and a
 * code the database has that this file does not is shown last rather than
 * dropped. Nothing here decides which types exist.
 *
 * (This file replaced src/components/record/demo-record.ts, which held a demo
 * extract as a const. The record now reads record.v_public_entry.)
 */

/** Section 8 of the concept note names these nine, in this order. */
export const NOTED_EVENT_CODES: readonly string[] = [
  'listed',
  'offered',
  'interest_expressed',
  'terms_proposed',
  'agreed',
  'credits_issued',
  'allocated',
  'retired',
  'cancelled',
];

/**
 * Event types the concept note does not name. They exist because the record
 * needs them - rule 4 cannot be satisfied without a way to point at a wrong
 * entry - and they are labelled as proposals on screen until the client
 * confirms the vocabulary. record.entry_type.is_proposed_addition carries the
 * same flag, and it is the flag, not this list, that decides.
 */
export const PROPOSED_EVENT_CODES: readonly string[] = [
  'transferred',
  'correction',
  'deal_withdrawn',
  'deal_declined',
  'deal_lapsed',
];

/**
 * Event types whose meaning the concept note states. The rest are shown with
 * an explicit "the note names this event but does not define it" line rather
 * than a definition we invented.
 */
export const EVENT_CODES_WITHOUT_A_DEFINITION: readonly string[] = ['allocated'];

/** The note's order, with anything the note does not mention appended. */
export function inNoteOrder(codes: readonly string[]): string[] {
  const rank = new Map<string, number>();
  [...NOTED_EVENT_CODES, ...PROPOSED_EVENT_CODES].forEach((c, i) => rank.set(c, i));
  return [...codes].sort(
    (a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
}
