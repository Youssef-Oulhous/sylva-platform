import type { BadgeTone } from '@/components/ui/Badge';

/**
 * DEMO DATA for the vetting status page.
 *
 * Nothing here comes from the database. It is the shape a vetting application
 * would have to have for this screen to be built, reviewed and translated
 * before the data layer exists.
 *
 * Every organisation below begins with "DEMO". No application, reference, date
 * or recorded reason describes a real organisation or a real decision.
 *
 * Prose a reader sees is held as an i18n KEY, not an English string, so the
 * German site is not silently served English. Proper nouns - organisation
 * names, application references, the vetting address - stay as literals, which
 * is how they will arrive from the database.
 *
 * RULE 7. There is no volume, quantity or price field anywhere in this module.
 * A vetting decision concerns an organisation, not a project, so there is
 * nothing on this page that could be added to anything else. The dates are the
 * only figures, and they carry a source stamp.
 *
 * RULE J. Two things the concept note does not settle are left unsettled here
 * rather than filled in: `decisionDueOn` is typed `null`, because no target
 * decision time is published and this page must not estimate one; and the
 * permission matrix has a third cell value, 'notSet', for a question the pilot
 * material does not answer.
 */

export type VettingState = 'submitted' | 'under_review' | 'approved' | 'declined';

/** The four states, in the order an application passes through them. */
export const VETTING_STATES: readonly VettingState[] = [
  'submitted',
  'under_review',
  'approved',
  'declined',
];

/**
 * Status is never colour alone: every state prints its word as well. The tint
 * is chosen from the existing token set - `bio` is the green the token file
 * measures at the same value as --success, so no new colour is introduced.
 */
export const STATE_TONE: Readonly<Record<VettingState, BadgeTone>> = {
  submitted: 'neutral',
  under_review: 'warning',
  approved: 'bio',
  declined: 'error',
};

export type StagePosition = 'done' | 'current' | 'ahead';

export interface DemoStage {
  readonly id: string;
  readonly labelKey: string;
  readonly noteKey: string;
  readonly position: StagePosition;
  /** ISO date the stage was reached, or null while it is still ahead. */
  readonly reachedOn: string | null;
}

export interface DemoDecisionReason {
  readonly headlineKey: string;
  readonly detailKey: string;
  /** The part of the questionnaire the decision turns on. */
  readonly partKey: string;
}

export interface NextStep {
  readonly id: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  /** An internal route, where the screen exists today. Null where it does not. */
  readonly href: string | null;
  readonly ctaKey: string | null;
  /** An address to write to, where the step is a question rather than a screen. */
  readonly email: string | null;
}

export interface DemoApplication {
  readonly reference: string;
  readonly organisationName: string;
  readonly roleKey: string;
  readonly sectorKey: string;
  readonly countryKey: string;
  readonly state: VettingState;
  readonly submittedOn: string;
  readonly lastEventOn: string;
  readonly decidedOn: string | null;
  /** Always null. See RULE J above. */
  readonly decisionDueOn: null;
  readonly reason: DemoDecisionReason | null;
  readonly stages: readonly DemoStage[];
  /** One stamp covers the panel: every date in it is read from the same record. */
  readonly source: { readonly labelKey: string; readonly asOfDate: string };
  readonly nextSteps: readonly NextStep[];
}

/** Already in use elsewhere on the platform, so the page adds no new address. */
export const VETTING_CONTACT = 'vetting@sylva-pilot.example';

const STAGE_SUBMITTED = {
  id: 'submitted',
  labelKey: 'vettingStatus.stage.submitted',
  noteKey: 'vettingStatus.stage.submittedNote',
} as const;

const STAGE_REVIEW = {
  id: 'review',
  labelKey: 'vettingStatus.stage.review',
  noteKey: 'vettingStatus.stage.reviewNote',
} as const;

const STAGE_DECISION = {
  id: 'decision',
  labelKey: 'vettingStatus.stage.decision',
  noteKey: 'vettingStatus.stage.decisionNote',
} as const;

/* ---------------------------------------------------------------------------
   The application this page is showing: under review, no decision yet.
   --------------------------------------------------------------------------- */
export const DEMO_PENDING_APPLICATION: DemoApplication = {
  reference: 'SYL-VET-2026-0042',
  organisationName: 'DEMO Nordwasser Getränke GmbH',
  roleKey: 'vettingStatus.role.buyer',
  sectorKey: 'vettingStatus.sector.beverages',
  countryKey: 'vettingStatus.country.de',
  state: 'under_review',
  submittedOn: '2026-09-14',
  lastEventOn: '2026-09-21',
  decidedOn: null,
  decisionDueOn: null,
  reason: null,
  stages: [
    { ...STAGE_SUBMITTED, position: 'done', reachedOn: '2026-09-14' },
    { ...STAGE_REVIEW, position: 'current', reachedOn: '2026-09-21' },
    { ...STAGE_DECISION, position: 'ahead', reachedOn: null },
  ],
  source: { labelKey: 'vettingStatus.sourceLabel', asOfDate: '2026-09-21' },
  nextSteps: [
    {
      id: 'read',
      titleKey: 'vettingStatus.next.pending.read',
      bodyKey: 'vettingStatus.next.pending.readBody',
      href: '/projects',
      ctaKey: 'home.ctaExplore',
      email: null,
    },
    {
      id: 'sites',
      titleKey: 'vettingStatus.next.pending.sites',
      bodyKey: 'vettingStatus.next.pending.sitesBody',
      href: null,
      ctaKey: null,
      email: null,
    },
    {
      id: 'vetting',
      titleKey: 'vettingStatus.next.pending.vetting',
      bodyKey: 'vettingStatus.next.pending.vettingBody',
      href: '/how-it-works#vetting',
      ctaKey: 'vettingStatus.next.howCta',
      email: null,
    },
  ],
};

/* ---------------------------------------------------------------------------
   The declined worked example. A decision is not a dead end, so this
   application carries the recorded reason and three things still open to it.
   --------------------------------------------------------------------------- */
export const DEMO_DECLINED_APPLICATION: DemoApplication = {
  reference: 'SYL-VET-2026-0031',
  organisationName: 'DEMO Maasdelta Logistiek B.V.',
  roleKey: 'vettingStatus.role.buyer',
  sectorKey: 'vettingStatus.sector.logistics',
  countryKey: 'vettingStatus.country.nl',
  state: 'declined',
  submittedOn: '2026-08-03',
  lastEventOn: '2026-08-27',
  decidedOn: '2026-08-27',
  decisionDueOn: null,
  reason: {
    headlineKey: 'vettingStatus.reason.declinedHeadline',
    detailKey: 'vettingStatus.reason.declinedDetail',
    partKey: 'vettingStatus.reason.declinedPart',
  },
  stages: [
    { ...STAGE_SUBMITTED, position: 'done', reachedOn: '2026-08-03' },
    { ...STAGE_REVIEW, position: 'done', reachedOn: '2026-08-14' },
    { ...STAGE_DECISION, position: 'current', reachedOn: '2026-08-27' },
  ],
  source: { labelKey: 'vettingStatus.sourceLabel', asOfDate: '2026-08-27' },
  nextSteps: [
    {
      id: 'reason',
      titleKey: 'vettingStatus.next.declined.reason',
      bodyKey: 'vettingStatus.next.declined.reasonBody',
      href: null,
      ctaKey: null,
      email: null,
    },
    {
      id: 'projects',
      titleKey: 'vettingStatus.next.declined.projects',
      bodyKey: 'vettingStatus.next.declined.projectsBody',
      href: '/projects',
      ctaKey: 'home.ctaExplore',
      email: null,
    },
    {
      id: 'ask',
      titleKey: 'vettingStatus.next.declined.ask',
      bodyKey: 'vettingStatus.next.declined.askBody',
      href: null,
      ctaKey: 'vettingStatus.next.contactCta',
      email: VETTING_CONTACT,
    },
  ],
};

/* ---------------------------------------------------------------------------
   What an organisation can do in each state.

   'notSet' is not a hedge, it is the honest answer: the pilot material this
   page can cite does not settle the point, and guessing it here would invent a
   rule the client has not written.
   --------------------------------------------------------------------------- */
export type CellValue = 'yes' | 'no' | 'notSet';

export interface DemoAction {
  readonly id: string;
  readonly labelKey: string;
  readonly noteKey: string;
  readonly by: Readonly<Record<VettingState, CellValue>>;
}

export const DEMO_ACTIONS: readonly DemoAction[] = [
  {
    id: 'browse',
    labelKey: 'vettingStatus.action.browse',
    noteKey: 'vettingStatus.action.browseNote',
    by: { submitted: 'yes', under_review: 'yes', approved: 'yes', declined: 'yes' },
  },
  {
    id: 'documents',
    labelKey: 'vettingStatus.action.documents',
    noteKey: 'vettingStatus.action.documentsNote',
    by: { submitted: 'yes', under_review: 'yes', approved: 'yes', declined: 'yes' },
  },
  {
    id: 'sites',
    labelKey: 'vettingStatus.action.sites',
    noteKey: 'vettingStatus.action.sitesNote',
    by: { submitted: 'yes', under_review: 'yes', approved: 'yes', declined: 'notSet' },
  },
  {
    id: 'interest',
    labelKey: 'vettingStatus.action.interest',
    noteKey: 'vettingStatus.action.interestNote',
    by: { submitted: 'no', under_review: 'no', approved: 'yes', declined: 'no' },
  },
  {
    id: 'dealRoom',
    labelKey: 'vettingStatus.action.dealRoom',
    noteKey: 'vettingStatus.action.dealRoomNote',
    by: { submitted: 'no', under_review: 'no', approved: 'yes', declined: 'no' },
  },
  {
    id: 'financing',
    labelKey: 'vettingStatus.action.financing',
    noteKey: 'vettingStatus.action.financingNote',
    by: { submitted: 'no', under_review: 'no', approved: 'yes', declined: 'no' },
  },
  {
    id: 'record',
    labelKey: 'vettingStatus.action.record',
    noteKey: 'vettingStatus.action.recordNote',
    by: { submitted: 'no', under_review: 'no', approved: 'yes', declined: 'no' },
  },
];
