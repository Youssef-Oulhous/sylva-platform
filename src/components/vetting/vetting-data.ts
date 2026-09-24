/**
 * The vetting question set, and the DEMO data the page renders it with.
 *
 * Vetting is the operator's main safeguard against greenwashing and a condition
 * of the funding behind the pilot (concept note section 7). The questions are
 * therefore not a registration form: they ask what the buyer intends to claim,
 * where that claim would appear, how the organisation works, and what it
 * requires of the claim rights. Every question carries its own reason, because
 * a question a reader does not understand gets an answer nobody can use.
 *
 * FRONTEND PASS. Nothing here reads a database. The question definitions are
 * structure, the answers below are fictional, and the file exports no mutable
 * state.
 *
 * Rule 7 (no unit volumes added across projects): this page shows no unit
 * volumes at all. The only figure on it counts questions, which belong to the
 * questionnaire and not to a project, so there is nothing here that two
 * projects' units could be summed into.
 */

export type QuestionKind = 'long' | 'yesno';

/** Two states only. A half-answered question is not answered. */
export type AnswerStatus = 'answered' | 'notAnswered';

/** A source label plus the date the figure was last true. See SourceStamp. */
export interface DemoSource {
  /** i18n key, resolved by the component that renders the stamp. */
  readonly labelKey: string;
  readonly locator: string | null;
  readonly asOfDate: string;
}

export interface VettingQuestion {
  /** Anchor target, and the stem of every control id in the question. */
  readonly id: string;
  /** Position in the whole questionnaire, not within its part. */
  readonly n: number;
  readonly kind: QuestionKind;
  /** Subkey under the `vettingForm.q` namespace. */
  readonly key: string;
  readonly status: AnswerStatus;
  /** Rows on the long-form field, or on a yes/no question's detail field. */
  readonly rows: number;
  /** Subkey under `vettingForm.demoAnswers`. Null where nothing is answered. */
  readonly demoAnswerKey: string | null;
}

export interface VettingPart {
  readonly id: string;
  readonly titleKey: string;
  readonly questions: readonly VettingQuestion[];
}

/**
 * The question set, in the order a buyer reads it: what you would claim, then
 * who you are, then the three questions that decide the shape of a deal. The
 * last three are yes/no because they are conditions rather than descriptions -
 * an open field would collect three paragraphs that still did not say yes.
 */
export const VETTING_PARTS: readonly VettingPart[] = [
  {
    id: 'part-claim',
    titleKey: 'parts.claim',
    questions: [
      {
        id: 'intended-benefit',
        n: 1,
        kind: 'long',
        key: 'benefit',
        status: 'answered',
        rows: 6,
        demoAnswerKey: 'benefit',
      },
      {
        id: 'publication',
        n: 2,
        kind: 'long',
        key: 'publication',
        status: 'answered',
        rows: 5,
        demoAnswerKey: 'publication',
      },
    ],
  },
  {
    id: 'part-operations',
    titleKey: 'parts.operations',
    questions: [
      {
        id: 'operations',
        n: 3,
        kind: 'long',
        key: 'operations',
        status: 'answered',
        rows: 6,
        demoAnswerKey: 'operations',
      },
      {
        id: 'catchments',
        n: 4,
        kind: 'long',
        key: 'catchments',
        status: 'notAnswered',
        rows: 5,
        demoAnswerKey: null,
      },
      {
        id: 'sustainability',
        n: 5,
        kind: 'long',
        key: 'sustainability',
        status: 'notAnswered',
        rows: 7,
        demoAnswerKey: null,
      },
    ],
  },
  {
    id: 'part-intentions',
    titleKey: 'parts.intentions',
    questions: [
      {
        id: 'resale',
        n: 6,
        kind: 'yesno',
        key: 'resale',
        status: 'notAnswered',
        rows: 3,
        demoAnswerKey: null,
      },
      {
        id: 'offset',
        n: 7,
        kind: 'yesno',
        key: 'offset',
        status: 'notAnswered',
        rows: 3,
        demoAnswerKey: null,
      },
      {
        id: 'exclusivity',
        n: 8,
        kind: 'yesno',
        key: 'exclusivity',
        status: 'notAnswered',
        rows: 3,
        demoAnswerKey: null,
      },
    ],
  },
];

/** Flat, in document order. The progress index and the form read the same list. */
export const VETTING_QUESTIONS: readonly VettingQuestion[] = VETTING_PARTS.flatMap(
  (part) => part.questions,
);

export const QUESTION_TOTAL = VETTING_QUESTIONS.length;

/**
 * Derived, never typed in twice: the progress figure and the per-question
 * statuses cannot contradict each other.
 */
export const QUESTIONS_ANSWERED = VETTING_QUESTIONS.filter(
  (question) => question.status === 'answered',
).length;

/* ---------------------------------------------------------------------------
   DEMO DATA. A fictional organisation part-way through the questionnaire.
   Obviously fictional, plausible enough to show what the page does with a real
   entry, and describing no real wetland, verification or environmental result.
   --------------------------------------------------------------------------- */

export interface DemoOrganisation {
  readonly name: string;
  readonly sectorKey: string;
  readonly countryKey: string;
  /** Internal reference. An identifier, so it is set in mono on screen. */
  readonly reference: string;
  readonly source: DemoSource;
}

export const DEMO_ORGANISATION: DemoOrganisation = {
  name: 'DEMO Nordwasser Getränke GmbH',
  sectorKey: 'org.sectorValue',
  countryKey: 'org.countryValue',
  reference: 'ORG-0142',
  source: {
    labelKey: 'org.sourceLabel',
    locator: null,
    asOfDate: '2026-09-18',
  },
};

/** The saved draft the progress figure is taken from. */
export const DEMO_DRAFT_SOURCE: DemoSource = {
  labelKey: 'progress.sourceLabel',
  locator: 'v3',
  asOfDate: '2026-09-22',
};

/** The questionnaire itself is a versioned document, like any other here. */
export const QUESTIONNAIRE_SOURCE: DemoSource = {
  labelKey: 'source.questionnaire',
  locator: 'v1.2',
  asOfDate: '2026-09-10',
};
