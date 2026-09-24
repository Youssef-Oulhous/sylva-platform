import type { UnitQty } from '@/lib/units/qty';

/**
 * What a project owner sees, in the shapes the database actually returns.
 *
 * Two conventions run through every type here and both are rules, not style.
 *
 * PROVENANCE. Anything that is a figure carries a `source`. There is no type in
 * this file that holds a displayed number without one, because `source_ref_id`
 * is NOT NULL on every table these rows come from and a type that could drop it
 * would be a type that lets a figure reach a screen bare.
 *
 * RULE 7. Every volume is a `UnitQty`, which carries the project and unit type
 * it was measured in, and every one of them is rendered through formatQty()
 * with `unitLabel` beside it. Nothing in this file is a total, and no type here
 * has a field that could hold a figure spanning two projects: availability
 * hangs off one project and one period, and the question and interest types
 * carry no volume at all.
 */

export interface SourceRefView {
  /** The document or statement the figure came from. Never translated. */
  readonly label: string;
  /** Page, section or table inside that document. */
  readonly locator: string | null;
  /** ISO date the figure is stated as of. */
  readonly asOfDate: string;
  readonly kind: string;
}

/* -------------------------------------------------------- PUBLICATION GATE */

/**
 * The ten codes proj.publication_gaps() can return, in the order that function
 * builds its array. Kept in the order the database uses so the screen and the
 * gate cannot disagree about what a project still needs.
 */
export const PUBLICATION_GATE_CODES = [
  'english_page_text',
  'boundary',
  'claim_rights',
  'outcomes',
  'outcome_baseline',
  'durability',
  'verifier',
  'project_idea_note',
  'project_design_document',
  'availability',
] as const;

export type PublicationGateCode = (typeof PUBLICATION_GATE_CODES)[number];

/** Gate code to the i18n key fragment under owner.gate.item.<fragment>. */
export const GATE_ITEM_KEY: Record<PublicationGateCode, string> = {
  english_page_text: 'englishPageText',
  boundary: 'boundary',
  claim_rights: 'claimRights',
  outcomes: 'outcomes',
  outcome_baseline: 'outcomeBaseline',
  durability: 'durability',
  verifier: 'verifier',
  project_idea_note: 'projectIdeaNote',
  project_design_document: 'projectDesignDocument',
  availability: 'availability',
};

export function isGateCode(value: string): value is PublicationGateCode {
  return (PUBLICATION_GATE_CODES as readonly string[]).includes(value);
}

/* ---------------------------------------------------------------- PROJECTS */

export type PublicationStatus =
  | 'draft'
  | 'submitted_for_review'
  | 'changes_requested'
  | 'published'
  | 'withdrawn'
  | 'archived';

/** The `status.*` namespace the whole platform uses for these six words. */
export function statusKey(status: string): string {
  return `status.${status}`;
}

/**
 * Availability for ONE period of ONE project, in that project's own unit type.
 * There is deliberately no field for a figure covering several periods and none
 * for a figure covering several projects.
 */
export interface OwnerPeriod {
  readonly periodId: string;
  readonly periodLabel: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly unitTypeId: string;
  /** Already localised, from units.unit_type_translation where one exists. */
  readonly unitLabel: string;
  readonly unitOfMeasure: string;
  readonly expected: UnitQty;
  readonly buffer: UnitQty;
  readonly reserved: UnitQty;
  readonly committed: UnitQty;
  readonly remaining: UnitQty;
  readonly source: SourceRefView;
}

export interface OwnerProject {
  readonly id: string;
  readonly slug: string;
  /** The project's own title, in the caller's locale where one exists. */
  readonly title: string;
  readonly titleIsFallback: boolean;
  readonly countryCode: string;
  readonly status: PublicationStatus;
  readonly isPublished: boolean;
  /** Scheme name, a proper noun. Null until a unit type is declared. */
  readonly schemeName: string | null;
  /** Unit label for this project, localised. Null until one is declared. */
  readonly unitLabel: string | null;
  /** ISO date of the last content the owner recorded. */
  readonly lastChangeOn: string;
  /** ISO date the gate below was evaluated - which is now. */
  readonly gateCheckedOn: string;
  /** Straight from proj.publication_gaps(). Empty means the gate would pass. */
  readonly gaps: readonly PublicationGateCode[];
  /** The nearest period with availability recorded, or null when none is. */
  readonly nearestPeriod: OwnerPeriod | null;
  readonly openQuestions: number;
  readonly openInterest: number;
}

/* --------------------------------------------------- THE OTHER ORGANISATION */

/**
 * How a counterparty appears to the project owner.
 *
 * The concept note makes the pseudonym the default and naming the buyer's own
 * choice, deal by deal. So this type has no field for a legal name unless one
 * was disclosed, and the query that builds it never selects
 * org.organisation.legal_name - no public-facing role holds the column
 * privilege to do so, which is what makes R5 real rather than a convention.
 *
 * `label` is null where no pseudonym has been allocated for the project yet:
 * org.allocate_pseudonym is executable only by sylva_operator, so an owner
 * cannot mint one, and inventing a stand-in on screen would invent an identity.
 */
export interface OwnerParty {
  readonly kind: 'pseudonym' | 'named' | 'unlabelled';
  /** The per-project pseudonym, or null where none has been allocated. */
  readonly label: string | null;
  /** Present only where the counterparty chose disclosure for that deal. */
  readonly legalName: string | null;
  /** Already localised, from platform.sector. */
  readonly sectorLabel: string;
  readonly countryCode: string;
  /** Already localised, from platform.size_band. */
  readonly sizeBandLabel: string;
}

/* ------------------------------------------------- THE PRIVATE QUESTION BOX */

export interface OwnerAnswer {
  readonly id: string;
  readonly body: string;
  /** The organisation that answered. Named because it is a party to the page. */
  readonly byOrgName: string | null;
  readonly answeredOn: string;
}

export interface OwnerQuestion {
  readonly id: string;
  readonly projectId: string;
  readonly projectSlug: string;
  readonly projectTitle: string;
  readonly projectCountryCode: string;
  readonly asker: OwnerParty;
  readonly body: string;
  readonly askedOn: string;
  /** Whole days open, as at the moment the page was rendered. */
  readonly daysWaiting: number;
  /** An answer is a new append-only row, never an edit of the question. */
  readonly answers: readonly OwnerAnswer[];
}

export function isAnswered(q: OwnerQuestion): boolean {
  return q.answers.length > 0;
}

/* ----------------------------------------------------- EXPRESSED INTEREST */

/**
 * One expressed interest. No volume field and no price field, which is what the
 * database holds: in release one a deal exists only at stage
 * 'interest_expressed' and carries no volume, so expressing interest opens a
 * private room rather than reserving anything.
 */
export interface OwnerInterest {
  readonly id: string;
  readonly projectId: string;
  readonly projectTitle: string;
  readonly buyer: OwnerParty;
  readonly shapeCode: string | null;
  readonly shapeLabel: string | null;
  readonly stageCode: string;
  readonly stageLabel: string;
  readonly receivedOn: string;
  readonly daysWaiting: number;
}

/* -------------------------------------------------------- THE RECORD FORM */

export interface TextFieldValue {
  readonly fieldCode: string;
  readonly locale: string;
  readonly body: string;
  readonly versionNo: number;
  readonly status: string;
}

export interface RecordEntryView {
  readonly key: string;
  readonly versionNo: number;
  readonly label: string;
  readonly detail: string;
  readonly source: SourceRefView;
}

/** The whole record, as the edit form needs it. */
export interface OwnerProjectRecord {
  readonly id: string;
  readonly slug: string;
  readonly countryCode: string;
  readonly status: PublicationStatus;
  readonly createdAt: string;
  readonly lastChangeOn: string;
  readonly gaps: readonly PublicationGateCode[];
  readonly text: readonly TextFieldValue[];
  readonly schemeName: string | null;
  readonly unitLabel: string | null;
  readonly unitTypeId: string | null;
  readonly boundaryVersions: number;
  readonly claimRights: readonly RecordEntryView[];
  readonly outcomes: readonly RecordEntryView[];
  readonly durability: readonly RecordEntryView[];
  readonly parties: readonly RecordEntryView[];
  readonly periods: readonly OwnerPeriod[];
  readonly documents: number;
}

/** Reference data the form needs, read as the owner, never hard-coded. */
export interface OwnerReference {
  readonly schemes: readonly { id: string; name: string }[];
  readonly unitTypes: readonly {
    id: string;
    schemeId: string;
    code: string;
    label: string;
    unitOfMeasure: string;
    vintageSemantics: string;
  }[];
  readonly countries: readonly { code: string; label: string }[];
  readonly textFields: readonly {
    code: string;
    labelEn: string;
    required: boolean;
    maxChars: number | null;
  }[];
  readonly partyRoles: readonly { code: string; labelEn: string }[];
  /** Organisations this owner may legitimately name: public project parties. */
  readonly nameableOrgs: readonly { id: string; name: string }[];
}

/** Text field body for one (field, locale), or '' when there is none yet. */
export function bodyOf(
  text: readonly TextFieldValue[],
  fieldCode: string,
  locale: string,
): string {
  return text.find((t) => t.fieldCode === fieldCode && t.locale === locale)?.body ?? '';
}

export function wholeDaysSince(iso: string, now = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
