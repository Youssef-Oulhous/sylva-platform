/**
 * The public transaction record, as the page needs it.
 *
 * Every field here comes from record.v_public_entry or from reference data
 * joined beside it. Nothing is derived in TypeScript that the database is
 * capable of deciding, and in particular NOTHING here decides whether a
 * counterparty is named: that is resolved inside the view, as at each entry's
 * own timestamp, and reimplementing it in the application is how the two
 * answers drift apart.
 *
 * RULE 7 is structural on this surface. record.entry has no volume column and
 * no price column, so there is no field below that could hold a quantity and
 * nothing on the page that could be totalled across projects. The one number
 * the page prints - how many entries match the filter - counts entries and
 * says so.
 */

/** How a counterparty appears publicly, resolved as at the entry's own date. */
export type CounterpartyKind =
  /** a per-deal pseudonym; the organisation is not named */
  | 'label'
  /** the counterparty chose disclosure for this deal, before this entry */
  | 'named'
  /** the project owner, already named on its own project page */
  | 'owner'
  /** pseudonymous, and the label could not be resolved - see withheld below */
  | 'withheld';

/**
 * Where an entry came from, and as at when.
 *
 * record.entry.source_ref_id is NOT NULL, so no entry exists without one of
 * these. The view carries it, and a page that dropped it would be showing
 * evidence with the evidence taken off: "every figure on screen carries its
 * source and date" is not satisfied by one stamp at the top of the page saying
 * where the whole table came from.
 *
 * Null only where the reader's role cannot read sylva.source_ref at all, which
 * the table says out loud rather than leaving the cell empty.
 */
export interface RecordEntrySource {
  /** sylva.source_ref.kind - operator_statement, document, … */
  kind: string;
  /** The human sentence: "DEMO transaction record, recorded by Sylva…". */
  label: string;
  /** A page, a clause, a registry id. Usually null. */
  locator: string | null;
  /** ISO date. The date the source is as of, NOT the date this page loaded. */
  asOfDate: string;
}

export interface RecordEntry {
  /** record.entry.public_id. Stable, citable, and the anchor for deep links. */
  publicId: string;
  /** A short printable form of publicId for a dense table. */
  shortRef: string;
  /** ISO 8601 instant. */
  occurredAt: string;
  entryType: string;
  /** The English label held on record.entry_type; the UI prefers its own
   *  translation and falls back to this. */
  entryLabelEn: string;
  projectId: string;
  projectSlug: string;
  /** The project's title in the reader's locale, or the slug if no published
   *  text is readable for it. */
  projectTitle: string;
  counterpartyKind: CounterpartyKind;
  /** A label such as "Buyer 004", or a legal name. Never translated. Null when
   *  the kind is 'withheld'. */
  counterpartyLabel: string | null;
  sectorCode: string | null;
  /** Sector in the reader's locale, from platform.sector. */
  sectorLabel: string | null;
  countryCode: string | null;
  sizeBandCode: string | null;
  sizeBandLabel: string | null;
  /** Set on a correction entry: the earlier entry it points at. */
  correctsPublicId: string | null;
  correctsShortRef: string | null;
  correctionReason: string | null;
  /** True where a later correction points at this entry. Never hidden. */
  isSuperseded: boolean;
  /** The entry that superseded this one, so the link reads in both directions
   *  even when the correction is on another page of the extract. */
  supersededByPublicId: string | null;
  supersededByShortRef: string | null;
  /** Provenance for this one entry. See RecordEntrySource. */
  source: RecordEntrySource | null;
}

export interface RecordProjectOption {
  slug: string;
  title: string;
}

export interface RecordEventTypeOption {
  code: string;
  labelEn: string;
  /** record.entry_type.is_proposed_addition: an event the concept note's
   *  vocabulary does not name, shown as a proposal until the client confirms. */
  isProposedAddition: boolean;
}

export interface RecordFilterOptions {
  projects: RecordProjectOption[];
  eventTypes: RecordEventTypeOption[];
}

export interface RecordExtract {
  entries: RecordEntry[];
  /** Entries matching the filter, across all pages. Counts ENTRIES. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** 1-based index of the first row on this page, or 0 when there are none. */
  from: number;
  to: number;
}

/**
 * How the sector and size-band classifications are described on screen.
 * The concept note requires every figure to carry its source; a coded value is
 * no different, and which classification is in use is an open decision.
 */
export interface RecordClassifications {
  sector: string | null;
  sizeBandBasis: string | null;
}
