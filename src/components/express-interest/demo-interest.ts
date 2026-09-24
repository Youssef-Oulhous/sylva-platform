/**
 * DEMO DATA for the express-interest page.
 *
 * Nothing here is read from the database, and nothing here describes a real
 * wetland, a real organisation or a real enquiry. Every organisation name begins
 * with "DEMO". The figures exist so that the form, the confirmation screen and
 * the two blocked states can be built, reviewed and translated before any
 * function sits behind them.
 *
 * Prose a reader sees is held as an i18n KEY rather than as an English string,
 * so the German site is never silently served English. Proper nouns
 * (organisation names, scheme name, period labels, references) and figures stay
 * as literals, which is how they will arrive from the database later.
 *
 * Rule 7 (no unit volumes added across projects). Every figure below belongs to
 * ONE project and ONE unit type, and the types have no field that could hold a
 * figure spanning more than one: `remaining` sits inside a period of a single
 * project, and the requested volumes on a recorded enquiry are a LIST of
 * per-period amounts with no total beside them. The unit label travels with the
 * project, and the page prints it next to every number.
 */

export interface DemoSource {
  /** Full i18n key naming the source document. */
  labelKey: string;
  /** Page, section or table reference inside that document. Not translated. */
  locator: string | null;
  /** ISO date the figure was last updated in that document. */
  asOfDate: string;
}

/** One period of one project, with what is left in it. Never a total. */
export interface DemoPeriodRemaining {
  id: string;
  /** The period as the scheme writes it. Not translated. */
  label: string;
  remaining: number;
  source: DemoSource;
}

export interface DemoDealShape {
  id: 'spot' | 'forward' | 'co_investment' | 'undecided';
  labelKey: string;
  noteKey: string;
}

export interface DemoInterestProject {
  slug: string;
  name: string;
  ownerOrgName: string;
  schemeName: string;
  /** Maps to the existing `status.*` namespace. */
  statusKey: string;
  countryKey: string;
  catchmentKey: string;
  /** The unit label that travels with every figure on this page. */
  unitLabelKey: string;
  /** Which of the three existing `project.vintage*` sentences applies here. */
  vintageKey: string;
  periods: DemoPeriodRemaining[];
}

/** One line of an enquiry: a period, and the volume asked about in it. */
export interface DemoRequestedVolume {
  periodLabel: string;
  amount: number;
}

export interface DemoRecordedInterest {
  /** The reference a buyer can quote back to us. Not translated. */
  reference: string;
  recordedOn: string;
  /** Event name from the record vocabulary (concept note §8). */
  eventKey: string;
  buyerOrgName: string;
  /** The label the buyer appears under on the public record. */
  buyerPseudonym: string;
  buyerSectorKey: string;
  buyerCountryKey: string;
  /** False means the public record shows the pseudonym, which is the default. */
  disclosed: boolean;
  dealShapeKey: string;
  /**
   * Per period, never summed. Two of these lines are the same unit type of the
   * same project, so a sum would be arithmetically valid - and it is still not
   * printed, because the periods mean different things and a reader would take
   * the total for a single deliverable quantity.
   */
  requested: DemoRequestedVolume[];
}

export interface DemoPendingOrganisation {
  name: string;
  /** ISO date the vetting questionnaire was submitted. */
  questionnaireSubmittedOn: string;
}

/** The project design document, which is where the remaining figures come from. */
const DESIGN_DOCUMENT: DemoSource = {
  labelKey: 'expressInterest.source.designDocument',
  locator: '§ 7.1',
  asOfDate: '2026-09-12',
};

/**
 * The project this enquiry is about. The same fictional project the project
 * detail page renders, so a reader arriving from that page recognises it.
 */
export const DEMO_INTEREST_PROJECT: DemoInterestProject = {
  slug: 'demo-untere-havel-wetland-restoration',
  name: 'DEMO Untere Havel Wetland Restoration',
  ownerOrgName: 'DEMO Moorland Trust gGmbH',
  schemeName: 'DEMO Wetland Biodiversity Standard',
  statusKey: 'status.published',
  countryKey: 'expressInterest.demo.country',
  catchmentKey: 'expressInterest.demo.catchment',
  unitLabelKey: 'expressInterest.demo.unitLabel',
  vintageKey: 'project.vintageOutcome',
  periods: [
    { id: 'p2028', label: '2028', remaining: 6000, source: DESIGN_DOCUMENT },
    { id: 'p2029', label: '2029', remaining: 7200, source: DESIGN_DOCUMENT },
    { id: 'p2030', label: '2030', remaining: 8340, source: DESIGN_DOCUMENT },
  ],
};

/**
 * The three deal shapes offered side by side on every project (concept note §5),
 * plus the honest fourth answer: the buyer has not decided and wants to talk.
 */
export const DEMO_DEAL_SHAPES: readonly DemoDealShape[] = [
  {
    id: 'spot',
    labelKey: 'expressInterest.form.deal.spot',
    noteKey: 'expressInterest.form.deal.spotNote',
  },
  {
    id: 'forward',
    labelKey: 'expressInterest.form.deal.forward',
    noteKey: 'expressInterest.form.deal.forwardNote',
  },
  {
    id: 'co_investment',
    labelKey: 'expressInterest.form.deal.coInvestment',
    noteKey: 'expressInterest.form.deal.coInvestmentNote',
  },
  {
    id: 'undecided',
    labelKey: 'expressInterest.form.deal.undecided',
    noteKey: 'expressInterest.form.deal.undecidedNote',
  },
];

/**
 * The enquiry shown on the confirmation screen. A specimen: it is what the
 * screen looks like after an enquiry has been sent, not a record of anything.
 */
export const DEMO_RECORDED_INTEREST: DemoRecordedInterest = {
  reference: 'INT-2026-0147',
  recordedOn: '2026-09-24',
  eventKey: 'expressInterest.event.interestExpressed',
  buyerOrgName: 'DEMO Nordwasser Getränke AG',
  buyerPseudonym: 'Buyer 014',
  buyerSectorKey: 'expressInterest.demo.buyerSector',
  buyerCountryKey: 'expressInterest.demo.buyerCountry',
  disclosed: false,
  dealShapeKey: 'expressInterest.form.deal.forward',
  requested: [
    { periodLabel: '2028', amount: 1500 },
    { periodLabel: '2029', amount: 2000 },
  ],
};

/** The organisation in the second blocked state: vetted, not yet decided. */
export const DEMO_PENDING_ORGANISATION: DemoPendingOrganisation = {
  name: 'DEMO Seeufer Papier GmbH',
  questionnaireSubmittedOn: '2026-09-18',
};
