import type { BadgeTone } from '@/components/ui/Badge';
import {
  GATE_ITEM_KEY,
  PUBLICATION_GATE_CODES,
  isGateCode,
  type PublicationGateCode,
  type PublicationStatus,
} from '@/lib/owner/types';
import type { ApprovalStatus, VettingState } from '@/lib/vetting/types';

/**
 * The operator's two screens, in the shapes the pages read.
 *
 * Every type here mirrors a table rather than a screen. Two consequences are
 * worth stating because they are the whole point of this area:
 *
 *   1  THERE IS NO WRITABLE STATE ANYWHERE IN THIS FILE. An organisation's
 *      vetting state is `org.org_role_approval.status`, a cache that only the
 *      SECURITY DEFINER trigger on `org.vetting_decision` writes and that
 *      `ci.assert_approval_is_derived()` proves no application role can reach.
 *      So `AdminVettingRow.state` is a reading, and the only way to change it
 *      is to INSERT a decision. There is no `setState`, no `approved: boolean`
 *      and no place to put one.
 *
 *   2  THE PUBLICATION GATE IS NOT THIS SCREEN'S LIST. `gaps` is whatever
 *      `proj.publication_gaps()` returned a moment ago, filtered only to the
 *      codes this release can name. The trigger `t_publication_gate` applies
 *      the same function to the same project, so a publish that reached the
 *      database another way is refused with SY008 all the same.
 *
 * The gate codes are imported from `@/lib/owner/types` rather than copied. The
 * owner's dashboard and the operator's review screen show the same ten items
 * from the same database function; a second list in this file would be a second
 * thing to forget to update.
 *
 * RULE 7. No type in this file has a field for a unit volume, and neither
 * screen renders one. The operator's project queue is the one table in the
 * platform that puts projects from different schemes side by side, so a shared
 * volume column there would be the clearest possible breach: a hectare-year and
 * an index point measure different things. Every count below counts ROWS -
 * projects, applications, gate items, text fields, periods - and every screen
 * prints the word beside the figure.
 */

export {
  GATE_ITEM_KEY,
  PUBLICATION_GATE_CODES,
  isGateCode,
  type PublicationGateCode,
  type PublicationStatus,
};

/* ========================================================================== */
/*  VETTING                                                                   */
/* ========================================================================== */

/**
 * org.vetting_decision_kind, verbatim, plus the one entry that is not a
 * decision: the submission itself. An application's log is exactly these rows
 * and nothing else - there is no "review opened" event, because nothing in the
 * schema records that a reviewer picked an application up, and printing one
 * would tell an organisation that work had started when no row says so.
 */
export type AdminEntryKind =
  | 'submitted'
  | 'approved'
  | 'declined'
  | 'suspended'
  | 'reinstated'
  | 'revoked';

/** One row of an application's append-only log. Never edited, never removed. */
export interface AdminEntry {
  /** org.vetting_submission.id or org.vetting_decision.id. The real handle. */
  readonly reference: string;
  /** ISO date. */
  readonly on: string;
  readonly kind: AdminEntryKind;
  /** i18n key: the organisation itself, or a Sylva reviewer. */
  readonly byKey: string;
  /** The reason recorded with a decision. Null on the submission row. */
  readonly reason: string | null;
  /** Set on a decision that a later decision has since replaced. */
  readonly superseded: boolean;
}

/** What an operator may record on this screen. Three of the five kinds. */
export type AdminDecisionChoice = 'approve' | 'decline' | 'suspend';

export const ADMIN_DECISION_CHOICES: readonly AdminDecisionChoice[] = [
  'approve',
  'decline',
  'suspend',
];

/** choice -> the `adminVetting.decision.*` key fragment. */
export const DECISION_KEY: Record<AdminDecisionChoice, string> = {
  approve: 'approve',
  decline: 'decline',
  suspend: 'suspend',
};

/** choice -> the state that would then be READ from the decision chain. */
export const DECISION_LEADS_TO: Record<AdminDecisionChoice, VettingState> = {
  approve: 'approved',
  decline: 'declined',
  suspend: 'suspended',
};

/**
 * Whether the concept note settles what the decision does to a deal already
 * agreed. It settles approval and decline; it does not settle suspension, and
 * the screen says so rather than inventing an answer (README rule J).
 */
export const DECISION_IS_SETTLED: Record<AdminDecisionChoice, boolean> = {
  approve: true,
  decline: true,
  suspend: false,
};

/**
 * Tone per state. Never read alone: every badge on these screens contains the
 * state word as well as the tint.
 */
export const STATE_TONE: Readonly<Record<VettingState, BadgeTone>> = {
  not_started: 'neutral',
  submitted: 'neutral',
  approved: 'bio',
  declined: 'error',
  suspended: 'error',
  revoked: 'error',
};

/** org.actor_role.code -> the `adminVetting.role.*` key fragment. */
export const ROLE_KEY: Readonly<Record<string, string>> = {
  buyer: 'buyer',
  investor: 'investor',
  project_owner: 'projectOwner',
  auditor: 'auditor',
};

/** One question with the answer submitted for it, or no answer at all. */
export interface AdminAnswer {
  readonly questionCode: string;
  readonly sortOrder: number;
  /** org.question.prompt_en. The questionnaire is data, never hardcoded here. */
  readonly promptEn: string;
  readonly answerKind: string;
  readonly isRequired: boolean;
  readonly text: string | null;
  readonly boolean: boolean | null;
  /** Kept as a string: a numeric leaves PostgreSQL as text and stays exact. */
  readonly numeric: string | null;
}

export function isAnswered(a: AdminAnswer): boolean {
  if (a.boolean !== null) return true;
  if (a.numeric !== null && a.numeric.trim() !== '') return true;
  return a.text !== null && a.text.trim() !== '';
}

/** A row of the vetting queue. */
export interface AdminVettingRow {
  readonly submissionId: string;
  readonly orgId: string;
  /** org.organisation.legal_name. No public-facing role may read this column. */
  readonly organisationName: string;
  readonly roleCode: string;
  /** platform.sector, in the reader's language where the row has one. */
  readonly sectorLabel: string;
  /** platform.eu_member_state.name_en, or the bare code where it is not one. */
  readonly countryName: string;
  readonly submittedOn: string;
  /** The date of the newest entry in the log. Not a decision date. */
  readonly lastEntryOn: string;
  /**
   * Read from org.org_role_approval, which the trigger maintains, or
   * 'submitted' where that table has no row for this organisation and role.
   */
  readonly state: VettingState;
  /** Null until a decision has been recorded. */
  readonly approvalStatus: ApprovalStatus | null;
  /** The submission and every decision, oldest first. */
  readonly entries: readonly AdminEntry[];
  /** How many applications this organisation has made for this role. */
  readonly submissionCount: number;
}

/** One application in full: the queue row, plus its questionnaire. */
export interface AdminVettingApplication extends AdminVettingRow {
  readonly questionnaireId: string;
  readonly answers: readonly AdminAnswer[];
  readonly answeredCount: number;
}

/* ========================================================================== */
/*  PROJECT REVIEW AND PUBLICATION                                            */
/* ========================================================================== */

/** The kinds of thing a gate item counts. Counts of ROWS, never of units. */
export type GateCountKey =
  | 'fields'
  | 'geometries'
  | 'rights'
  | 'indicators'
  | 'baselines'
  | 'commitments'
  | 'periods';

/**
 * What is recorded against a gate item. There is no partial state, because the
 * database has none: `proj.publication_gaps()` either returns the code or it
 * does not.
 */
export type GateDetail =
  | { kind: 'missing' }
  | { kind: 'count'; countKey: GateCountKey; count: number }
  /** An organisation name, printed as a name. */
  | { kind: 'name'; value: string }
  /** A document version, printed as an identifier. */
  | { kind: 'version'; value: string };

export interface GateEntry {
  readonly code: PublicationGateCode;
  /** True when `proj.publication_gaps()` did NOT return this code. */
  readonly recorded: boolean;
  readonly detail: GateDetail;
}

/** A tint per publication status. The status word is always printed with it. */
export const STATUS_TONE: Readonly<Record<PublicationStatus, BadgeTone>> = {
  draft: 'neutral',
  submitted_for_review: 'water',
  changes_requested: 'warning',
  published: 'bio',
  withdrawn: 'neutral',
  archived: 'neutral',
};

/** The order an operator reads them in: what needs attention first. */
export const STATUS_ORDER: readonly PublicationStatus[] = [
  'submitted_for_review',
  'changes_requested',
  'draft',
  'published',
  'withdrawn',
  'archived',
];

export interface AdminProject {
  readonly id: string;
  readonly slug: string;
  /** The project's own title, in the reader's locale where one exists. */
  readonly title: string;
  readonly titleIsFallback: boolean;
  readonly ownerOrgName: string;
  readonly countryCode: string;
  readonly countryName: string;
  /** Scheme name, a proper noun. Null until a unit type is declared. */
  readonly schemeName: string | null;
  /**
   * The unit type every figure on this project is denominated in, localised.
   * Printed on every row precisely so that two rows can never be read as
   * measuring the same thing. Null until the project declares one.
   */
  readonly unitLabel: string | null;
  readonly status: PublicationStatus;
  readonly publishedOn: string | null;
  readonly lastChangeOn: string;
  /** ISO date the gate below was evaluated - which is now. */
  readonly gateCheckedOn: string;
  /** Straight from proj.publication_gaps(). Empty means the gate would pass. */
  readonly gaps: readonly PublicationGateCode[];
  /** Exactly ten entries, one per code, in the order the function builds them. */
  readonly gate: readonly GateEntry[];
}

export function recordedCount(project: AdminProject): number {
  return project.gate.filter((g) => g.recorded).length;
}

export function countByStatus(
  rows: readonly AdminProject[],
): Readonly<Record<PublicationStatus, number>> {
  const counts: Record<PublicationStatus, number> = {
    draft: 0,
    submitted_for_review: 0,
    changes_requested: 0,
    published: 0,
    withdrawn: 0,
    archived: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export function countByState(
  rows: readonly AdminVettingRow[],
): Readonly<Record<VettingState, number>> {
  const counts: Record<VettingState, number> = {
    not_started: 0,
    submitted: 0,
    approved: 0,
    declined: 0,
    suspended: 0,
    revoked: 0,
  };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

/** The states the queue summarises, in the order an operator reads them. */
export const QUEUE_STATES: readonly VettingState[] = [
  'submitted',
  'approved',
  'declined',
  'suspended',
  'revoked',
];

export type { ApprovalStatus, VettingState };
