/**
 * Shapes for the buyer dashboard.
 *
 * FRONTEND PASS. Nothing here reads a database. These interfaces exist so the
 * demo data at the top of the page is typed, and so each section component
 * receives rows rather than reaching for data of its own.
 *
 * Prose a reader sees is held as an i18n KEY, never an English string, so the
 * German site is not silently served English. Proper nouns - organisation
 * names, project names, references, catchment names - stay as literals, which
 * is how they will arrive from the database.
 *
 * RULE 7. There is exactly one place in this module where a unit volume can be
 * held: DealVolume, which carries the project's period, its scheme and its unit
 * label alongside the figure. Nothing on the dashboard holds a volume that is
 * detached from the one project it belongs to, and no type here can express a
 * figure spanning two projects: there is no field for one.
 */

/** Every figure on screen carries its source and date (concept note, §9). */
export interface DemoSource {
  labelKey: string;
  locator: string | null;
  asOfDate: string;
}

/* -- Organisation ---------------------------------------------------------- */

export interface BuyerOrganisation {
  legalName: string;
  registrationNumber: string;
  registeredAddress: string;
  countryCode: string;
  sectorKey: string;
  sizeBandKey: string;
  orgRef: string;
  /** How the organisation appears on the public record when not disclosed. */
  publicLabel: string;
  recordedOn: string;
  source: DemoSource;
}

/* -- Vetting --------------------------------------------------------------- */

export type VettingState = 'approved' | 'submitted' | 'declined';

export interface VettingRecord {
  state: VettingState;
  submittedOn: string;
  /** Null while a submission is still with the operator. */
  decidedOn: string | null;
  decidedByOrgName: string;
  questionnaireVersion: string;
  /** The operator's recorded reason, held as a key because it is prose. */
  reasonKey: string | null;
  source: DemoSource;
}

/* -- Expressed interests --------------------------------------------------- */

export type InterestState = 'recorded' | 'dealOpen' | 'closed';

export interface ExpressedInterest {
  id: string;
  projectSlug: string;
  projectName: string;
  /** Stated on every row so two rows cannot be read as the same commodity. */
  schemeName: string;
  unitLabelKey: string;
  expressedOn: string;
  state: InterestState;
  /** Reference of the entry in the public record. */
  recordRef: string;
  /** Set when state is 'dealOpen'. */
  dealRef: string | null;
}

/* -- Registered sites ------------------------------------------------------ */

export interface RegisteredSite {
  id: string;
  name: string;
  locationLabel: string;
  catchmentLabel: string;
  countryCode: string;
  /** WGS 84 decimal degrees, as registered. */
  latitude: number;
  longitude: number;
  registeredOn: string;
}

/* -- Documents ------------------------------------------------------------- */

export interface BuyerDocument {
  id: string;
  nameKey: string;
  /** Key for the scope column: organisation, project or deal. */
  scopeKey: string;
  /** Proper noun the scope points at, e.g. a project name. Null for the org. */
  scopeName: string | null;
  version: string;
  dateIso: string;
  /**
   * Documents are attributed to an ORGANISATION, never to a person: personal
   * data sits in the user accounts table alone (concept note, §9), and a name
   * in a document row would put it here too.
   */
  lodgedByKey: string | null;
  lodgedByOrgName: string | null;
  statusKey: string;
  /** Set on a superseded version: the version that replaced this one. */
  replacedByVersion: string | null;
}

export interface DocumentGroup {
  id: string;
  titleKey: string;
  introKey: string;
  documents: readonly BuyerDocument[];
  /** Shown instead of the table when the group holds nothing yet. */
  emptyTitleKey: string;
  emptyBodyKey: string;
}

/* -- Deals ----------------------------------------------------------------- */

/**
 * "A stage marker running from first interest, through a letter of intent and
 * a term sheet, to signed." (Concept note, §7.) Four stages, in that order,
 * and no stage the note does not name.
 */
export const DEAL_STAGES = ['interest', 'loi', 'termSheet', 'signed'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

/**
 * A volume under discussion, for ONE project, ONE period and ONE unit type.
 *
 * The three fields that frame the figure are not optional, because a volume
 * without its project, period and unit label is the number Rule 7 exists to
 * prevent.
 */
export interface DealVolume {
  periodLabel: string;
  schemeName: string;
  unitLabelKey: string;
  underDiscussion: number;
  /** Remaining in the SAME project and period. Comparable with the above. */
  remainingInPeriod: number;
  source: DemoSource;
}

export type DealDisclosure = 'pseudonymous' | 'named';

export interface BuyerDeal {
  id: string;
  dealRef: string;
  projectSlug: string;
  projectName: string;
  locationLabel: string;
  ownerOrgName: string;
  dealTypeKey: string;
  stage: DealStage;
  openedOn: string;
  lastActivityOn: string;
  lastActivityKey: string;
  disclosure: DealDisclosure;
  /** The label or the legal name, according to `disclosure`. */
  disclosureDisplay: string;
  volume: DealVolume;
  /** A count of documents in the deal room. A count, not a volume. */
  documentCount: number;
}
