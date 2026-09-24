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
