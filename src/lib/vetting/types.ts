/**
 * The vetting flow, in the shapes the pages read.
 *
 * Every type here mirrors a table in the `org` schema rather than a screen, so
 * a change to the questionnaire is a data change and not a code change. The
 * question SET, its order, its prompts and which questions are required all
 * come from org.questionnaire + org.question. Nothing in src/ hardcodes them.
 */

/** org.question.answer_kind. The database CHECK holds the authoritative list. */
export type AnswerKind = 'text' | 'longtext' | 'boolean' | 'choice' | 'number' | 'file';

/** The kinds this release can actually render. See QuestionField. */
export const SUPPORTED_ANSWER_KINDS: readonly AnswerKind[] = [
  'text', 'longtext', 'boolean', 'number',
];

export interface VettingQuestion {
  readonly questionCode: string;
  readonly sortOrder: number;
  /** org.question.prompt_en. The catalogue may translate it; see QuestionField. */
  readonly promptEn: string;
  readonly answerKind: AnswerKind;
  readonly isRequired: boolean;
}

export interface Questionnaire {
  readonly id: string;
  readonly roleCode: string;
  readonly versionNo: number;
  /** ISO date. Null is impossible here - only published questionnaires load. */
  readonly publishedAt: string;
  readonly questions: readonly VettingQuestion[];
}

/**
 * One answer, in the three columns org.vetting_answer and org.vetting_draft
 * both use. At most one is non-null - a database CHECK, not a convention.
 */
export interface AnswerValue {
  readonly text: string | null;
  readonly boolean: boolean | null;
  /** Kept as a string: a numeric leaves PostgreSQL as text and stays exact. */
  readonly numeric: string | null;
}

export const EMPTY_ANSWER: AnswerValue = { text: null, boolean: null, numeric: null };

export function isAnswered(a: AnswerValue | undefined): boolean {
  if (!a) return false;
  if (a.boolean !== null) return true;
  if (a.numeric !== null && a.numeric.trim() !== '') return true;
  return a.text !== null && a.text.trim() !== '';
}

/** question_code -> answer. A plain record so it can cross a Server Component. */
export type AnswerMap = Readonly<Record<string, AnswerValue>>;

export interface DraftState {
  readonly answers: AnswerMap;
  /** The most recent updated_at across the draft rows, or null if none. */
  readonly savedAt: string | null;
}

export interface SubmissionSummary {
  readonly id: string;
  readonly roleCode: string;
  readonly questionnaireId: string;
  readonly submittedAt: string;
  /** The submission this one replaced, per org.vetting_submission.supersedes_id. */
  readonly supersedesId: string | null;
  readonly answers: AnswerMap;
}

/**
 * org.vetting_decision.decision. The enum org.vetting_decision_kind, verbatim.
 * 'reinstated' resolves to an approved STATUS but is its own decision, and the
 * page says which one it was - "approved" and "reinstated after suspension"
 * are different facts about an organisation.
 */
export type DecisionKind =
  | 'approved' | 'declined' | 'suspended' | 'reinstated' | 'revoked';

export interface VettingDecision {
  readonly id: string;
  readonly decision: DecisionKind;
  /** NOT NULL for 'declined' and 'revoked' - a database CHECK enforces it. */
  readonly reason: string | null;
  readonly decidedAt: string;
  readonly reviewDueOn: string | null;
  /** The submission this decision was made on. Never a draft. */
  readonly submissionId: string;
}

/** org.org_role_approval.status - the trigger-maintained cache R6 reads. */
export type ApprovalStatus = 'approved' | 'declined' | 'suspended' | 'revoked';

/**
 * The state an organisation is actually in, derived only from rows that exist.
 *
 * There is deliberately no 'under_review' here. Nothing in the schema records
 * that a reviewer has picked an application up - there is a submission and
 * there is a decision, and between them the database knows only "submitted, not
 * yet decided". The first build of this page showed "Under review", which was a
 * state the platform had no way to be in. Showing it would tell an organisation
 * that work had started when nothing on record says so.
 */
export type VettingState =
  | 'not_started'
  | 'submitted'
  | 'approved'
  | 'declined'
  | 'suspended'
  | 'revoked';

export interface OwnOrganisation {
  readonly id: string;
  readonly legalName: string;
  readonly countryCode: string;
  readonly sectorCode: string;
  readonly sizeBandCode: string;
  /**
   * org.organisation.created_at. The only date the table carries - there is no
   * updated_at - so it is what a source stamp on this record can honestly cite.
   */
  readonly createdAt: string;
}

export interface VettingStatus {
  readonly roleCode: string;
  readonly state: VettingState;
  readonly organisation: OwnOrganisation | null;
  /** The head of the supersedes chain: the application that counts today. */
  readonly submission: SubmissionSummary | null;
  /** How many applications this organisation has made for this role. */
  readonly submissionCount: number;
  readonly approvalStatus: ApprovalStatus | null;
  readonly approvalUpdatedAt: string | null;
  /** The decision behind the current status, with its reason. */
  readonly decision: VettingDecision | null;
  /** Every decision for this role, newest first. The chain, not a summary. */
  readonly history: readonly VettingDecision[];
  /**
   * The date this page's figures were last true: the newest of the submission,
   * the approval and the decision. One page, one source stamp.
   */
  readonly asOfDate: string | null;
}

/**
 * The date part of a PostgreSQL timestamptz rendered as text.
 *
 * Postgres gives "2026-09-14 09:31:22+00"; an HTML <time datetime> attribute
 * and next-intl's date formatter both want a date. Slicing rather than parsing
 * keeps the value the database's - a Date built in the server's zone can land
 * on the previous day, and a vetting decision dated one day early is a fact
 * about the record that we would have invented.
 */
export function dateOf(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = ts.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
