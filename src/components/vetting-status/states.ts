import type { BadgeTone } from '@/components/ui/Badge';
import type { VettingState } from '@/lib/vetting/types';

/**
 * The states an application can actually be in, and what each one permits.
 *
 * This file replaces demo-vetting.ts. What it keeps from it is the part that
 * was never demo data - the permission matrix, which is reference material
 * about the platform's own rules - and it corrects the state list, which was
 * wrong in a way that mattered:
 *
 *   before: submitted · under_review · approved · declined
 *   now:    not_started · submitted · approved · declined · suspended · revoked
 *
 * Three changes, each with a reason in the database rather than in taste.
 *
 *   'under_review' is GONE. Nothing in the schema records that a reviewer has
 *   started. There is org.vetting_submission and there is org.vetting_decision
 *   and between them the database knows only "submitted, not yet decided".
 *   Showing "Under review" told an organisation that work had begun when no
 *   row said so.
 *
 *   'not_started' is NEW, and it is the state most organisations are in on the
 *   day they register. identity.register creates no vetting decision, so a new
 *   organisation has no approval row and no submission; the old list had no
 *   way to say that and the page defaulted to showing somebody else's
 *   application.
 *
 *   'suspended' and 'revoked' are NEW. Both are values of
 *   org.org_role_approval.status and both are decisions Sylva can record
 *   (org.vetting_decision_kind), so both are states an organisation can be
 *   sitting in, and neither had a row on this page.
 *
 * Status is never colour alone: every state prints its word as well. The tints
 * are chosen from the existing token set, so no new colour is introduced.
 */

export const VETTING_STATES: readonly VettingState[] = [
  'not_started',
  'submitted',
  'approved',
  'declined',
  'suspended',
  'revoked',
];

export const STATE_TONE: Readonly<Record<VettingState, BadgeTone>> = {
  not_started: 'neutral',
  submitted: 'warning',
  approved: 'bio',
  declined: 'error',
  suspended: 'warning',
  revoked: 'error',
};

/** English sentences used until the catalogue carries these six keys. */
export const STATE_FALLBACK_EN: Readonly<Record<VettingState, string>> = {
  not_started: 'Not started',
  submitted: 'Submitted',
  approved: 'Approved',
  declined: 'Declined',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

export const STATE_MEANING_FALLBACK_EN: Readonly<Record<VettingState, string>> = {
  not_started:
    'This organisation has not yet sent a questionnaire. Until it does, and '
    + 'until Sylva records a decision on it, the organisation cannot express '
    + 'interest in a project.',
  submitted:
    'Sylva has the questionnaire. No decision has been recorded yet, and this '
    + 'page will not guess when one will be - no target time is published.',
  approved:
    'Sylva has recorded an approval for this role. The organisation can express '
    + 'interest in a project and open a private room with it.',
  declined:
    'Sylva has recorded a decision not to approve this organisation for this '
    + 'role, with the reason below. The organisation can still read every '
    + 'published project.',
  suspended:
    'An earlier approval is suspended, with the reason below. No new deal can '
    + 'be created while it is; deals that already exist are untouched.',
  revoked:
    'An earlier approval has been withdrawn, with the reason below. No new deal '
    + 'can be created. Nothing already on the record is retracted.',
};

/**
 * What an organisation can do in each state.
 *
 * 'notSet' is not a hedge, it is the honest answer: the pilot material this
 * page can cite does not settle the point, and guessing it here would invent a
 * rule the client has not written.
 *
 * The 'interest', 'dealRoom', 'financing' and 'record' rows are not opinions.
 * deal.enforce_r6_and_publication() reads org.org_role_approval and refuses
 * anything that is not exactly 'approved', so every one of those rows is 'yes'
 * in the approved column and 'no' everywhere else, by the trigger.
 */
export type CellValue = 'yes' | 'no' | 'notSet';

export interface VettingAction {
  readonly id: string;
  readonly labelKey: string;
  readonly noteKey: string;
  readonly by: Readonly<Record<VettingState, CellValue>>;
}

/** Everything R6 gates: allowed only while the status is exactly 'approved'. */
const R6_GATED: Readonly<Record<VettingState, CellValue>> = {
  not_started: 'no',
  submitted: 'no',
  approved: 'yes',
  declined: 'no',
  suspended: 'no',
  revoked: 'no',
};

/** Reading published material. Never gated: the project pages are public. */
const ALWAYS: Readonly<Record<VettingState, CellValue>> = {
  not_started: 'yes',
  submitted: 'yes',
  approved: 'yes',
  declined: 'yes',
  suspended: 'yes',
  revoked: 'yes',
};

export const VETTING_ACTIONS: readonly VettingAction[] = [
  {
    id: 'browse',
    labelKey: 'vettingStatus.action.browse',
    noteKey: 'vettingStatus.action.browseNote',
    by: ALWAYS,
  },
  {
    id: 'documents',
    labelKey: 'vettingStatus.action.documents',
    noteKey: 'vettingStatus.action.documentsNote',
    by: ALWAYS,
  },
  {
    id: 'sites',
    labelKey: 'vettingStatus.action.sites',
    noteKey: 'vettingStatus.action.sitesNote',
    // OPEN DECISION 5 in the README: may a registered but not-yet-vetted buyer
    // add sites? Recommended yes, not decided. 'notSet' where it is not.
    by: {
      not_started: 'yes',
      submitted: 'yes',
      approved: 'yes',
      declined: 'notSet',
      suspended: 'notSet',
      revoked: 'notSet',
    },
  },
  {
    id: 'interest',
    labelKey: 'vettingStatus.action.interest',
    noteKey: 'vettingStatus.action.interestNote',
    by: R6_GATED,
  },
  {
    id: 'dealRoom',
    labelKey: 'vettingStatus.action.dealRoom',
    noteKey: 'vettingStatus.action.dealRoomNote',
    by: R6_GATED,
  },
  {
    id: 'financing',
    labelKey: 'vettingStatus.action.financing',
    noteKey: 'vettingStatus.action.financingNote',
    by: R6_GATED,
  },
  {
    id: 'record',
    labelKey: 'vettingStatus.action.record',
    noteKey: 'vettingStatus.action.recordNote',
    by: R6_GATED,
  },
];

/** Already in use elsewhere on the platform, so this page adds no new address. */
export const VETTING_CONTACT = 'vetting@sylva-pilot.example';

/* --------------------------------------------------------------- stages */

export type StagePosition = 'done' | 'current' | 'ahead';

/**
 * One step on the track. Two steps exist, not three: "submitted" and
 * "decision". The middle one the first build showed - "under review" - had no
 * row behind it, and a stage nothing can reach is a stage that misleads.
 */
export interface Stage {
  readonly id: string;
  readonly labelKey: string;
  readonly noteKey: string;
  readonly position: StagePosition;
  /** ISO date the stage was reached, or null while it is still ahead. */
  readonly reachedOn: string | null;
}
