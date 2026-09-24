import { label, labelFor, type Label } from '@/lib/projects/labels';

/**
 * Sentences the public record needs that the message catalogue does not have
 * yet.
 *
 * src/messages/*.json is owned by another agent, so this module follows the
 * pattern src/lib/projects/labels.ts established: every label is a KEY plus
 * the English sentence to show until that key lands, and label() asks
 * next-intl whether the key exists rather than rendering "record.page.next" at
 * a reader. The keys are returned with this change in i18nKeys, in English and
 * in German.
 *
 * Keys are passed to t() as VALUES, not literals, so npm run check:i18n counts
 * them as runtime keys rather than failing on keys that are not in the
 * catalogue yet. When they land, nothing here changes.
 */

export { label, labelFor };
export type { Label };

const mk = (key: string, fallbackEn: string): Label => ({ key, fallbackEn });

/* ------------------------------------------------------------- the filter */

export const FILTER = {
  apply: mk('record.filters.applyNow', 'Apply filter'),
  clear: mk('record.filters.clear', 'Clear filter'),
  allProjects: mk('record.filters.allProjects', 'All projects'),
  allEvents: mk('record.filters.allEvents', 'All event types'),
  note: mk(
    'record.filters.inUrlNote',
    'The filter is part of the address of this page, so a filtered view can be sent to somebody and will open the same way for them.',
  ),
  /** Whole option text, so the brackets are part of the translated string. */
  proposedOption: mk('record.filters.proposedOption', '{name} (proposed)'),
  proposedSuffix: mk('record.filters.proposedSuffix', 'proposed'),
  ignoredProject: mk(
    'record.filters.ignoredProject',
    'The address asked for a project that is not in this record, so the project filter was not applied.',
  ),
  ignoredEvent: mk(
    'record.filters.ignoredEvent',
    'The address asked for an event type that does not exist, so the event filter was not applied.',
  ),
} as const;

/* --------------------------------------------------------------- the table */

export const TABLE = {
  withheld: mk('record.party.withheld', 'Label not available'),
  withheldNote: mk(
    'record.party.withheldNote',
    'This entry’s counterparty has no published label. It is not named here and nothing else on this page identifies it.',
  ),
  refTitle: mk('record.col.entryFull', 'Full entry reference'),
  /** The provenance column. Every entry carries one; see RecordEntrySource. */
  sourceCol: mk('record.col.source', 'Source'),
  sourceUnavailable: mk(
    'record.source.unavailable',
    'The source of this entry could not be read.',
  ),
  /** "Reason" and its colon in one message: punctuation is not universal. */
  reasonLabel: mk('record.entryStatus.reasonLabel', 'Reason:'),
  refTitleFor: mk('record.col.entryFullFor', 'Full entry reference: {ref}'),
  empty: mk(
    'record.empty',
    'No entry in this record matches that filter. Nothing has been hidden; there is nothing there.',
  ),
  emptyAll: mk(
    'record.emptyAll',
    'There is no entry in the public record yet. Entries appear here as transactions progress.',
  ),
} as const;

/* ---------------------------------------------------------- the correction */

/**
 * The explainer beside a correction.
 *
 * record.correction.body and .close in the catalogue describe the ONE
 * correction the demo seed happens to contain - "One entry in this extract was
 * recorded against the wrong period", "Three entries, all visible". On a
 * filtered extract that contains no correction, or a different number of them,
 * both sentences are simply false, and this is the page whose entire subject is
 * evidence. These say the same thing about corrections in general, and the
 * panel is only rendered when the extract actually holds one.
 */
export const CORRECTION = {
  body: mk(
    'record.correction.general',
    'The record has no way to change an entry. A mistake is corrected by adding entries: a correction entry that points at the entry that was wrong and states why, and, where the event still has to be recorded, a further entry that records it correctly.',
  ),
  close: mk(
    'record.correction.generalClose',
    'All of them stay in this extract, in date order. The entry that was wrong is marked and names the entry that superseded it. Nothing is removed and nothing is edited.',
  ),
} as const;

/* ---------------------------------------------------------- the pagination */

export const PAGER = {
  label: mk('record.page.label', 'Record pages'),
  previous: mk('record.page.previous', 'Previous'),
  next: mk('record.page.next', 'Next'),
  position: mk('record.page.position', 'Page {page} of {pageCount}'),
  showing: mk('record.page.showing', 'Showing entries {from} to {to} of {total}'),
} as const;

/* ------------------------------------------------------------- when it fails */

export const ERROR = {
  unavailable: mk(
    'record.error.unavailable',
    'The public record cannot be read at the moment. Nothing has been changed or removed; this page could not reach the record. Please try again shortly.',
  ),
  denied: mk(
    'record.error.denied',
    'You don’t have access to this information.',
  ),
} as const;

type Translator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has?: (key: string) => boolean;
};

/**
 * label(), for a message that takes arguments.
 *
 * The fallback has to be interpolated by hand, because it is a plain English
 * sentence rather than a compiled ICU message. Only simple {name} placeholders
 * are substituted - a fallback is a stopgap for one release, not a second
 * message format, and anything that needs plurals or gender belongs in the
 * catalogue before it ships.
 */
export function labelWith(
  t: Translator,
  l: Label,
  values: Record<string, string | number>,
): string {
  try {
    if (typeof t.has === 'function' && t.has(l.key)) return t(l.key, values);
  } catch {
    /* fall through to the English sentence */
  }
  return l.fallbackEn.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * Which sentence a failed read gets.
 *
 * 42501 is PostgreSQL's "insufficient privilege" - the reader is not allowed
 * this, and saying so is more useful than "something went wrong". Everything
 * else, including the database being unreachable, is the same honest sentence:
 * the record could not be read, and nothing about it has changed.
 */
export function recordErrorLabel(err: unknown): Label {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  if (code === '42501') return ERROR.denied;
  return ERROR.unavailable;
}
