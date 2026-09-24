import type { BadgeTone } from '@/components/ui/Badge';

/**
 * DEMO DATA for the operator vetting queue.
 *
 * Nothing here reads a database. This is the shape a vetting application and
 * its recorded entries would have to have for the screen to be built, reviewed
 * and translated before the data layer exists.
 *
 * Every organisation below begins with "DEMO". No application, reference, date,
 * answer or recorded reason describes a real organisation, a real questionnaire
 * response or a real decision.
 *
 * Prose a reader sees is held as an i18n KEY, never an English string, so the
 * German site is not silently served English. Proper nouns - organisation
 * names, application and entry references - stay as literals, which is how they
 * will arrive from the database.
 *
 * THE POINT OF THIS MODULE'S SHAPE. `DerivedState` is not a field an operator
 * writes. It is a function of the entries recorded against an application, and
 * this module models it that way: `deriveState()` below reads the entry log and
 * returns the state. No `QueueRow` carries a writable status, and the decision
 * form writes an ENTRY, not a state. That is the whole subject of this screen,
 * so it is expressed in the types rather than only in the copy.
 *
 * RULE 7 (no unit volumes added across projects). There is no volume, quantity,
 * price or unit field anywhere in this module, and the screen renders none. A
 * vetting decision concerns an organisation, not a project, so there is no
 * quantity here that two projects' units could be summed into. The only figures
 * on the screen are dates and a count of APPLICATIONS, which says so beside
 * itself.
 *
 * RULE J (invent no business or legal rules). The concept note describes
 * approval and decline (section 7) and makes approval the condition for a deal
 * (section 8, rule 6). It does not say what a suspension does to deals already
 * agreed. That cell is therefore typed `'notSet'` and printed as an open
 * question rather than filled in with a guess.
 */

/* ---------------------------------------------------------------------------
   Roles, states and tones
   --------------------------------------------------------------------------- */

/** The roles the concept note names in section 4. */
export type RequestedRole = 'buyer' | 'investor' | 'projectOwner' | 'auditor';

export type DerivedState =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'declined'
  | 'suspended';

/** What an operator can record. Three decisions, each requiring a reason. */
export type DecisionKind = 'approve' | 'decline' | 'suspend';

/**
 * What can appear in an application's entry log. `correction` is the only way a
 * recorded entry is ever undone: it points at the earlier entry, the earlier
 * entry stays visible, and the state is recomputed (concept note section 8,
 * rule 4).
 */
export type EntryKind =
  | 'submitted'
  | 'review_opened'
  | 'approved'
  | 'declined'
  | 'suspended'
  | 'correction';

/**
 * Status is never colour alone: every state prints its word as well. Tints come
 * from the existing token set; no new colour is introduced.
 */
export const STATE_TONE: Readonly<Record<DerivedState, BadgeTone>> = {
  submitted: 'neutral',
  under_review: 'warning',
  approved: 'bio',
  declined: 'error',
  suspended: 'error',
};

/* ---------------------------------------------------------------------------
   Shapes
   --------------------------------------------------------------------------- */

/** A source label plus the date the figure was last true. See SourceStamp. */
export interface DemoSource {
  /** i18n key, resolved by the component that renders the stamp. */
  readonly labelKey: string;
  readonly locator: string | null;
  readonly asOfDate: string;
}

/** One entry in an application's append-only log. */
export interface LogEntry {
  readonly reference: string;
  readonly on: string;
  readonly kind: EntryKind;
  /** Who recorded it: the organisation itself, or a Sylva reviewer. */
  readonly byKey: string;
  /** The reason recorded with a decision. Null on entries that are not one. */
  readonly reasonKey: string | null;
  /** The earlier entry a correction points at. Null otherwise. */
  readonly pointsAt: string | null;
  /** True once a later correction points at this entry. It still stays visible. */
  readonly corrected: boolean;
}

export interface QueueRow {
  readonly reference: string;
  readonly organisationName: string;
  readonly role: RequestedRole;
  readonly sectorKey: string;
  readonly countryKey: string;
  readonly submittedOn: string;
  /** The date of the newest entry in the log. Not a decision date. */
  readonly lastEntryOn: string;
  /**
   * The application's log. The state is read from this and is deliberately not
   * stored beside it - see the module comment.
   */
  readonly log: readonly LogEntry[];
  /** True for the one application shown in the review panel below the queue. */
  readonly openInPanel: boolean;
}

/* ---------------------------------------------------------------------------
   Derivation. The single place a state comes from.
   --------------------------------------------------------------------------- */

const STATE_OF_ENTRY: Readonly<Partial<Record<EntryKind, DerivedState>>> = {
  submitted: 'submitted',
  review_opened: 'under_review',
  approved: 'approved',
  declined: 'declined',
  suspended: 'suspended',
};

/**
 * The state of an application, read from its entries.
 *
 * A corrected entry is skipped but not removed: it stays in the log and stays
 * on screen. Nothing in this file lets a caller set a state instead.
 */
export function deriveState(log: readonly LogEntry[]): DerivedState {
  let state: DerivedState = 'submitted';
  for (const entry of log) {
    if (entry.corrected || entry.kind === 'correction') continue;
    const next = STATE_OF_ENTRY[entry.kind];
    if (next) state = next;
  }
  return state;
}

/** How many applications sit in each state. Applications, never units. */
export function countByState(rows: readonly QueueRow[]): Readonly<Record<DerivedState, number>> {
  const counts: Record<DerivedState, number> = {
    submitted: 0,
    under_review: 0,
    approved: 0,
    declined: 0,
    suspended: 0,
  };
  for (const row of rows) counts[deriveState(row.log)] += 1;
  return counts;
}

/* ---------------------------------------------------------------------------
   The queue. Seven fictional applications, every state represented.
   --------------------------------------------------------------------------- */

const BY_ORG = 'adminVetting.by.organisation';
const BY_REVIEWER = 'adminVetting.by.reviewer';

export const DEMO_QUEUE: readonly QueueRow[] = [
  {
    reference: 'SYL-VET-2026-0045',
    organisationName: 'DEMO Rhône Agrisemences SAS',
    role: 'buyer',
    sectorKey: 'adminVetting.sector.agriculture',
    countryKey: 'adminVetting.country.fr',
    submittedOn: '2026-09-23',
    lastEntryOn: '2026-09-23',
    openInPanel: false,
    log: [
      {
        reference: 'SYL-VET-E-0332',
        on: '2026-09-23',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
    ],
  },
  {
    reference: 'SYL-VET-2026-0044',
    organisationName: 'DEMO Hafenstrom Energie AG',
    role: 'buyer',
    sectorKey: 'adminVetting.sector.energy',
    countryKey: 'adminVetting.country.de',
    submittedOn: '2026-09-19',
    lastEntryOn: '2026-09-22',
    openInPanel: false,
    log: [
      {
        reference: 'SYL-VET-E-0327',
        on: '2026-09-19',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0330',
        on: '2026-09-22',
        kind: 'review_opened',
        byKey: BY_REVIEWER,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
    ],
  },
  /* The application open in the review panel. Its log is the one the panel
     prints, and the panel's state badge is read from it. */
  {
    reference: 'SYL-VET-2026-0042',
    organisationName: 'DEMO Nordwasser Getränke GmbH',
    role: 'buyer',
    sectorKey: 'adminVetting.sector.beverages',
    countryKey: 'adminVetting.country.de',
    submittedOn: '2026-09-14',
    lastEntryOn: '2026-09-21',
    openInPanel: true,
    log: [
      {
        reference: 'SYL-VET-E-0301',
        on: '2026-09-14',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0318',
        on: '2026-09-21',
        kind: 'review_opened',
        byKey: BY_REVIEWER,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
    ],
  },
  {
    reference: 'SYL-VET-2026-0043',
    organisationName: 'DEMO Ostsee Pensionsfonds',
    role: 'investor',
    sectorKey: 'adminVetting.sector.pensions',
    countryKey: 'adminVetting.country.se',
    submittedOn: '2026-09-09',
    lastEntryOn: '2026-09-19',
    openInPanel: false,
    log: [
      {
        reference: 'SYL-VET-E-0288',
        on: '2026-09-09',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0295',
        on: '2026-09-15',
        kind: 'review_opened',
        byKey: BY_REVIEWER,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0310',
        on: '2026-09-19',
        kind: 'approved',
        byKey: BY_REVIEWER,
        reasonKey: 'adminVetting.reason.approvedFund',
        pointsAt: null,
        corrected: false,
      },
    ],
  },
  {
    reference: 'SYL-VET-2026-0039',
    organisationName: 'DEMO Donau Auen Stiftung',
    role: 'projectOwner',
    sectorKey: 'adminVetting.sector.foundation',
    countryKey: 'adminVetting.country.at',
    submittedOn: '2026-09-02',
    lastEntryOn: '2026-09-12',
    openInPanel: false,
    log: [
      {
        reference: 'SYL-VET-E-0261',
        on: '2026-09-02',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0270',
        on: '2026-09-12',
        kind: 'approved',
        byKey: BY_REVIEWER,
        reasonKey: 'adminVetting.reason.approvedOwner',
        pointsAt: null,
        corrected: false,
      },
    ],
  },
  {
    reference: 'SYL-VET-2026-0031',
    organisationName: 'DEMO Maasdelta Logistiek B.V.',
    role: 'buyer',
    sectorKey: 'adminVetting.sector.logistics',
    countryKey: 'adminVetting.country.nl',
    submittedOn: '2026-08-03',
    lastEntryOn: '2026-08-27',
    openInPanel: false,
    log: [
      {
        reference: 'SYL-VET-E-0188',
        on: '2026-08-03',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0201',
        on: '2026-08-14',
        kind: 'review_opened',
        byKey: BY_REVIEWER,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0224',
        on: '2026-08-27',
        kind: 'declined',
        byKey: BY_REVIEWER,
        reasonKey: 'adminVetting.reason.declinedLogistics',
        pointsAt: null,
        corrected: false,
      },
    ],
  },
  {
    reference: 'SYL-VET-2026-0028',
    organisationName: 'DEMO Vänern Kraft AB',
    role: 'investor',
    sectorKey: 'adminVetting.sector.energy',
    countryKey: 'adminVetting.country.se',
    submittedOn: '2026-07-21',
    lastEntryOn: '2026-09-02',
    openInPanel: false,
    log: [
      {
        reference: 'SYL-VET-E-0140',
        on: '2026-07-21',
        kind: 'submitted',
        byKey: BY_ORG,
        reasonKey: null,
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0152',
        on: '2026-07-29',
        kind: 'approved',
        byKey: BY_REVIEWER,
        reasonKey: 'adminVetting.reason.approvedKraft',
        pointsAt: null,
        corrected: false,
      },
      {
        reference: 'SYL-VET-E-0248',
        on: '2026-09-02',
        kind: 'suspended',
        byKey: BY_REVIEWER,
        reasonKey: 'adminVetting.reason.suspendedKraft',
        pointsAt: null,
        corrected: false,
      },
    ],
  },
];

/** The application the review panel is showing. */
export const PANEL_ROW: QueueRow =
  DEMO_QUEUE.find((row) => row.openInPanel) ?? DEMO_QUEUE[0]!;

export const QUEUE_SOURCE: DemoSource = {
  labelKey: 'adminVetting.queueSource',
  locator: null,
  asOfDate: '2026-09-23',
};

/** The submitted questionnaire is a versioned document, like any other here. */
export const QUESTIONNAIRE_SOURCE: DemoSource = {
  labelKey: 'adminVetting.answerSource',
  locator: 'v3',
  asOfDate: '2026-09-14',
};

export const LOG_SOURCE: DemoSource = {
  labelKey: 'adminVetting.logSource',
  locator: null,
  asOfDate: '2026-09-21',
};

/* ---------------------------------------------------------------------------
   The submitted questionnaire, as the reviewer reads it.

   The eight questions of the buyer questionnaire, in the order they were asked,
   with this organisation's fictional answers. The three conditions at the end
   are yes/no because they are conditions rather than descriptions.
   --------------------------------------------------------------------------- */

export interface Answer {
  readonly id: string;
  readonly n: number;
  /** Subkey under `adminVetting.q`. */
  readonly questionKey: string;
  readonly kind: 'long' | 'yesno';
  /** The word answered, for a condition question. Null on a long answer. */
  readonly yesNo: 'yes' | 'no' | null;
  /** Subkey under `adminVetting.answers`. */
  readonly answerKey: string;
}

export interface AnswerPart {
  readonly id: string;
  readonly titleKey: string;
  readonly noteKey: string;
  readonly answers: readonly Answer[];
}

export const DEMO_ANSWER_PARTS: readonly AnswerPart[] = [
  {
    id: 'part-claim',
    titleKey: 'adminVetting.parts.claim',
    noteKey: 'adminVetting.parts.claimNote',
    answers: [
      {
        id: 'benefit',
        n: 1,
        questionKey: 'benefit',
        kind: 'long',
        yesNo: null,
        answerKey: 'benefit',
      },
      {
        id: 'publication',
        n: 2,
        questionKey: 'publication',
        kind: 'long',
        yesNo: null,
        answerKey: 'publication',
      },
    ],
  },
  {
    id: 'part-operations',
    titleKey: 'adminVetting.parts.operations',
    noteKey: 'adminVetting.parts.operationsNote',
    answers: [
      {
        id: 'operations',
        n: 3,
        questionKey: 'operations',
        kind: 'long',
        yesNo: null,
        answerKey: 'operations',
      },
      {
        id: 'catchments',
        n: 4,
        questionKey: 'catchments',
        kind: 'long',
        yesNo: null,
        answerKey: 'catchments',
      },
      {
        id: 'sustainability',
        n: 5,
        questionKey: 'sustainability',
        kind: 'long',
        yesNo: null,
        answerKey: 'sustainability',
      },
    ],
  },
  {
    id: 'part-conditions',
    titleKey: 'adminVetting.parts.conditions',
    noteKey: 'adminVetting.parts.conditionsNote',
    answers: [
      {
        id: 'resale',
        n: 6,
        questionKey: 'resale',
        kind: 'yesno',
        yesNo: 'no',
        answerKey: 'resale',
      },
      {
        id: 'offset',
        n: 7,
        questionKey: 'offset',
        kind: 'yesno',
        yesNo: 'no',
        answerKey: 'offset',
      },
      {
        id: 'exclusivity',
        n: 8,
        questionKey: 'exclusivity',
        kind: 'yesno',
        yesNo: 'yes',
        answerKey: 'exclusivity',
      },
    ],
  },
];

export const ANSWER_TOTAL = DEMO_ANSWER_PARTS.reduce(
  (n, part) => n + part.answers.length,
  0,
);

/* ---------------------------------------------------------------------------
   The derivation table: recorded entry on the left, resulting state on the
   right. This is the screen's argument, so it is data rather than prose.
   --------------------------------------------------------------------------- */

/** 'notSet' where the pilot material does not settle the point. See RULE J. */
export type PermitValue = 'yes' | 'no' | 'notSet';

export interface DerivationRow {
  readonly id: string;
  /** Subkey under `adminVetting.entry`. */
  readonly entryKey: string;
  /** The state that follows from the entry, or 'recomputed' for a correction. */
  readonly state: DerivedState | 'recomputed';
  /** May a deal be created for the organisation in that state? Rule 6. */
  readonly mayDeal: PermitValue;
  /** Subkey under `adminVetting.derivation`, explaining the row. */
  readonly noteKey: string;
}

export const DERIVATION_ROWS: readonly DerivationRow[] = [
  {
    id: 'submitted',
    entryKey: 'submitted',
    state: 'submitted',
    mayDeal: 'no',
    noteKey: 'submittedNote',
  },
  {
    id: 'review_opened',
    entryKey: 'review_opened',
    state: 'under_review',
    mayDeal: 'no',
    noteKey: 'reviewNote',
  },
  {
    id: 'approved',
    entryKey: 'approved',
    state: 'approved',
    mayDeal: 'yes',
    noteKey: 'approvedNote',
  },
  {
    id: 'declined',
    entryKey: 'declined',
    state: 'declined',
    mayDeal: 'no',
    noteKey: 'declinedNote',
  },
  {
    id: 'suspended',
    entryKey: 'suspended',
    state: 'suspended',
    mayDeal: 'notSet',
    noteKey: 'suspendedNote',
  },
  {
    id: 'correction',
    entryKey: 'correction',
    state: 'recomputed',
    mayDeal: 'notSet',
    noteKey: 'correctionNote',
  },
];

/* ---------------------------------------------------------------------------
   The three decisions the form offers.
   --------------------------------------------------------------------------- */

export interface DecisionOption {
  readonly value: DecisionKind;
  /** Subkey under `adminVetting.decision`. */
  readonly key: string;
  /** The state that would follow from recording this entry. */
  readonly derived: DerivedState;
  /** True where the concept note settles what the decision does. */
  readonly settled: boolean;
}

export const DECISION_OPTIONS: readonly DecisionOption[] = [
  { value: 'approve', key: 'approve', derived: 'approved', settled: true },
  { value: 'decline', key: 'decline', derived: 'declined', settled: true },
  { value: 'suspend', key: 'suspend', derived: 'suspended', settled: false },
];

/**
 * The worked correction example, shown collapsed under the log.
 *
 * It refers to an application decided BEFORE this queue extract, and to entry
 * references that appear nowhere in DEMO_QUEUE. That is deliberate: a worked
 * example pointing at a visible row would have to contradict that row's own log,
 * and a reader comparing the two would learn the wrong thing about corrections.
 */
export const CORRECTION_EXAMPLE = {
  wrongRef: 'SYL-VET-E-0102',
  correctionRef: 'SYL-VET-E-0118',
  application: 'SYL-VET-2026-0019',
} as const;
