import type { BuyerSite } from '@/lib/sites/types';

/**
 * What one organisation has done on this platform.
 *
 * RULE 7. There is no unit volume anywhere in this module and no field one
 * could be put in. The interests list spans several projects, which is exactly
 * the list where a volume column would invite the comparison the rule forbids;
 * it carries the scheme and the unit NAME instead, because the fact that makes
 * two projects incomparable is the fact worth showing.
 *
 * Personal data: none. Not one shape here holds a person's name, email or job
 * title. Personal data lives in identity.user_account alone (concept note §9),
 * and a contact name on this page would make the dashboard a second place it
 * lives and a second place erasure would have to reach.
 */

/* -- Organisation ---------------------------------------------------------- */

export interface DashboardOrganisation {
  orgId: string;
  /** From org.own_organisation(): the caller's OWN name, never another's. */
  legalName: string;
  registrationNumber: string | null;
  registeredAddress: string | null;
  countryCode: string;
  sectorCode: string;
  /** Already resolved for the reader's locale from platform.sector. */
  sectorLabel: string;
  sizeBandCode: string;
  sizeBandLabel: string;
  recordedOn: string;
}

/**
 * How the organisation appears on the public record, per project.
 *
 * R5: the label is allocated per project, so two of an organisation's projects
 * cannot be linked to each other by the label. There is therefore no single
 * "your public label" to print, and this is a list rather than a string.
 */
export interface PublicLabel {
  projectId: string;
  projectTitle: string;
  label: string;
  allocatedOn: string;
}

/* -- Vetting --------------------------------------------------------------- */

export type VettingState = 'approved' | 'submitted' | 'declined' | 'none';

export interface VettingRecord {
  roleCode: string;
  state: VettingState;
  submittedOn: string;
  decidedOn: string | null;
  /** org.vetting_decision.decision, verbatim. null while undecided. */
  decision: string | null;
  /** The operator's recorded reason. Free text, shown as written. */
  reason: string | null;
  questionnaireVersion: number;
  /**
   * From sylva.is_vetted(), which reads the trigger-maintained approval cache.
   * The application never derives this from the decision chain itself.
   */
  approvedNow: boolean;
}

/* -- Expressed interests --------------------------------------------------- */

export interface ExpressedInterest {
  /** record.entry.public_id - the reference the public record shows. */
  publicId: string;
  entryNo: string;
  projectId: string;
  slug: string;
  projectTitle: string;
  /** Stated per row so two rows are not read as the same commodity. */
  schemeName: string | null;
  /** The unit this project issues. A NAME, never a quantity. */
  unitLabel: string | null;
  expressedOn: string;
  /**
   * True once a deal exists for this organisation on that project.
   *
   * Read in a statement of its own, because deal.deal is not granted to the
   * investor role. A viewer that may not see deal state gets false, which the
   * page renders as "with the project owner" - never as "no deal".
   */
  dealOpen: boolean;
}

/* -- Documents ------------------------------------------------------------- */

export type DocumentGroupId = 'organisation' | 'deal' | 'signed';

export interface DashboardDocument {
  id: string;
  /** doc.document_kind.code. The code is what the page translates. */
  kind: string;
  /**
   * doc.document_kind.label_en, in English. That table holds no German label,
   * so this is a FALLBACK: DocumentsSection looks the code up in the message
   * catalogue first and uses this when the key is not there.
   */
  kindLabel: string;
  group: DocumentGroupId;
  /** The project or deal the document belongs to, where it belongs to one. */
  scopeName: string | null;
  versionNo: number | null;
  uploadedOn: string | null;
  /** Documents are attributed to an ORGANISATION, never to a person. */
  lodgedByYou: boolean;
  /** False where the row exists but no version is readable by this viewer. */
  available: boolean;
}

/* -- The page -------------------------------------------------------------- */

export interface BuyerDashboard {
  organisation: DashboardOrganisation | null;
  publicLabels: PublicLabel[];
  vetting: VettingRecord[];
  interests: ExpressedInterest[];
  sites: BuyerSite[];
  documents: DashboardDocument[];
}

/* -- The deal an interest opened ------------------------------------------- */

/**
 * The deal that followed one expressed interest, as the buyer may read it.
 *
 * SEPARATE FROM THE INTEREST, and nullable, because the two are separate facts.
 * An interest is an entry on the append-only record; a deal is a private room
 * Sylva opens between the buyer and the project owner, and most interests do
 * not have one. A shape of `null` is a deal whose shape has not been stated
 * yet, which is not the same thing as a deal that is a spot purchase.
 *
 * RULE 7 AGAIN. There is no volume field here, and there must not be one. This
 * shape is rendered in a list spanning several projects - exactly the list the
 * rule is about. deal.interest_volume exists and is read one project at a time,
 * on the project's own page, never here.
 *
 * `pseudonym` is the label the PUBLIC record carries for this organisation on
 * this deal, from deal.deal_pseudonym. It is allocated per deal, a second time
 * over the per-project label, so that two of an organisation's deals cannot be
 * linked to each other through it either. No public-facing role holds a column
 * grant on deal.deal_pseudonym.org_id, so the row is reached by joining through
 * deal.deal, whose policy admits the two parties and nobody else.
 */
export interface InterestDeal {
  /** deal.deal_shape.code, or null where the shape has not been stated. */
  shapeCode: string | null;
  /** deal.deal_shape.label_en. A FALLBACK: that table has no German label. */
  shapeLabelEn: string | null;
  /** deal.deal_stage.code. */
  stageCode: string;
  /** deal.deal_stage.label_en. A FALLBACK, for the same reason. */
  stageLabelEn: string | null;
  /** True where the stage ends the deal, whichever way it ended. */
  stageIsTerminal: boolean;
  /** True where this organisation chose to be NAMED on this deal. */
  disclosed: boolean;
  openedOn: string;
  /** deal.deal_pseudonym.label, allocated per deal. */
  pseudonym: string | null;
}

/** One expressed interest, with the deal it opened where there is one. */
export interface BuyerInterest extends ExpressedInterest {
  /**
   * The per-PROJECT label from org.own_public_labels(). What the public record
   * carries for the interest entry itself, which is a different allocation from
   * the deal pseudonym above.
   */
  projectLabel: string | null;
  deal: InterestDeal | null;
}

/* -- Project documents a buyer can reach ----------------------------------- */

/**
 * A document of a project this organisation has expressed interest in.
 *
 * WHICH ROWS COME BACK IS THE DATABASE'S ANSWER, not this application's. There
 * is no `visibility = 'public'` filter in the query behind this shape, and
 * there must never be one: the six visibility classes are row-level policies on
 * doc.document (migrations 0017 and 0056), so an approved buyer is shown the
 * public documents and the vetted-buyer documents because the policy says so.
 * The class is carried here and printed, so a reader can see on what footing
 * each file is offered rather than having to assume.
 */
export interface ProjectDocument {
  id: string;
  projectSlug: string;
  projectTitle: string;
  /** doc.document_kind.code. */
  kind: string;
  /** doc.document_kind.label_en. A fallback; that table holds no German. */
  kindLabel: string;
  /** doc.visibility_class, as text. Printed, never used to decide anything. */
  visibility: string;
  versionNo: number | null;
  uploadedOn: string | null;
  mediaType: string | null;
  byteSize: number | null;
  /** False where the row exists but no version is readable and un-withdrawn. */
  available: boolean;
}

/** Everything the Documents page shows, in the two groups it shows it in. */
export interface BuyerDocuments {
  /** Lodged by or with this organisation: vetting, deal rooms, agreements. */
  own: DashboardDocument[];
  /** Belonging to the projects this organisation expressed interest in. */
  projects: ProjectDocument[];
}

/** Everything the Organisation page shows. */
export interface BuyerOrganisationRecord {
  organisation: DashboardOrganisation | null;
  vetting: VettingRecord[];
  publicLabels: PublicLabel[];
}

/* -- The overview ---------------------------------------------------------- */

/**
 * What the overview needs, and nothing else.
 *
 * COUNTS, NOT ROWS. The overview prints four figures and a status; reading the
 * whole record to do it meant six statements and several hundred rows for four
 * integers. Every figure here is a count of ROWS on this organisation's own
 * record - never a unit volume, and never anything added across projects.
 *
 * `sitesVisible` is the honest version of a site count. geo.buyer_site is
 * granted to the buyer, the operator and the auditor and to nobody else, so a
 * viewer who holds no grant gets false rather than a zero that would read as
 * "you have registered no sites".
 */
export interface BuyerOverview {
  organisation: DashboardOrganisation | null;
  /** The decision governing the buyer role, where the organisation has one. */
  vetting: VettingRecord | null;
  interests: number;
  publicLabels: number;
  sites: number;
  sitesVisible: boolean;
  documents: number;
  /**
   * Deals that have moved past the stage an expressed interest opens them at,
   * and have not ended. This is the one that means "somebody is waiting for
   * you": a deal sitting at interest_expressed was created BY the interest and
   * is not news.
   */
  dealsAdvanced: number;
  /** False where the viewer holds no grant on deal.deal - never "no deals". */
  dealsVisible: boolean;
}
