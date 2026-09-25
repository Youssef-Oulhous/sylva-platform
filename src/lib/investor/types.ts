import type { SourceRef } from '@/lib/projects/types';

/**
 * What the investor workspace shows.
 *
 * WHAT IS DELIBERATELY ABSENT FROM EVERY TYPE IN THIS FILE: a return, a yield,
 * an IRR, a multiple, a payback period, a discount rate and a projection. Not
 * one of them is a column in proj.project_financials, the concept note gives no
 * figure for any of them, and the brief forbids unsupported financial-return
 * calculations. A financing need and the revenue streams a project expects are
 * statements the PROJECT makes, each carrying the source it was read from. A
 * return would be a claim about the future, and this platform does not make
 * one. There is therefore no field here that a screen could quietly derive one
 * from - not a cost, not a term, not a rate.
 *
 * RULE 7. No type here carries a unit volume, and that is the reason the
 * financing list carries `unitLabel` and `schemeName` instead: the useful fact
 * about two projects side by side is that their units are different things, not
 * how many of each there are. Money is not a unit volume, but a financing need
 * is still never added across projects on any screen - two projects seeking
 * finance are two separate conversations, and a sum of their needs would be a
 * platform figure no source stamp could cover.
 */

/** Whether the vetting gate is open for this organisation, and why. */
export interface InvestorStanding {
  /**
   * sylva.is_vetted_investor() - the SAME predicate the row-level policy on
   * proj.project_financials uses. Asked rather than derived, so the page and
   * the gate cannot disagree.
   */
  vettedInvestor: boolean;
  /** The investor submission chain, newest first. May be empty. */
  submissions: InvestorSubmission[];
}

export interface InvestorSubmission {
  roleCode: string;
  submittedOn: string;
  decidedOn: string | null;
  /** From org.vetting_decision: approved, declined, suspended, revoked… */
  decision: string | null;
  /** The operator's own words. Free text, never a translatable string. */
  reason: string | null;
  questionnaireVersion: number;
  /** From sylva.is_vetted() for THIS submission's role and organisation. */
  approvedNow: boolean;
}

/** One project that has filed financing information. */
export interface FinancingProject {
  projectId: string;
  slug: string;
  title: string;
  /** True when the title fell back to English because no translation exists. */
  titleIsFallback: boolean;
  countryCode: string;
  status: string;
  ownerOrgName: string;
  /** The scheme and unit this project issues under. Never a volume. */
  schemeName: string | null;
  unitLabel: string | null;

  financingNeed: number | null;
  currency: string | null;
  revenueStreamsNote: string | null;
  asOfDate: string;
  /** Which version of proj.project_financials this row is. */
  versionNo: number;

  /**
   * The financial model, in three distinguishable states:
   *   null              no model has been filed for this project
   *   { readable }      filed, and this viewer may download it
   * A model that is filed but not readable by this viewer arrives as
   * `readable: false`, because doc.document's own policy hid the row - which is
   * a different sentence from "no model exists" and must not be shown as one.
   */
  model: FinancingModel | null;

  source: SourceRef;
}

export interface FinancingModel {
  documentId: string;
  readable: boolean;
}

/** An interest entry this organisation is the actor on. */
export interface InvestorInterest {
  publicId: string;
  entryNo: string;
  projectId: string;
  slug: string;
  projectTitle: string;
  schemeName: string | null;
  unitLabel: string | null;
  expressedOn: string;
}

/** The organisation record, as the operator holds it. */
export interface InvestorOrganisation {
  orgId: string;
  legalName: string;
  registrationNumber: string | null;
  registeredAddress: string | null;
  countryCode: string;
  sectorCode: string;
  sectorLabel: string;
  sizeBandCode: string;
  sizeBandLabel: string;
  recordedOn: string;
}
