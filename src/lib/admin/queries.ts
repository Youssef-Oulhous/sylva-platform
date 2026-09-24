import { readAs, withActor, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import {
  PUBLICATION_GATE_CODES,
  isGateCode,
  type AdminAnswer,
  type AdminDecisionChoice,
  type AdminEntry,
  type AdminEntryKind,
  type AdminProject,
  type AdminVettingApplication,
  type AdminVettingRow,
  type ApprovalStatus,
  type GateDetail,
  type GateEntry,
  type PublicationGateCode,
  type PublicationStatus,
  type VettingState,
} from './types';

/**
 * The operator's screens, against the real database.
 *
 * Every function goes through readAs() or withActor(), so it runs inside one
 * transaction, as sylva_operator, with a signed actor context. Nothing here
 * filters by organisation in application code: the row-level policies in
 * db/migrations/0017 do it, and a predicate written twice is a predicate that
 * will one day disagree with itself.
 *
 * Three facts about this schema shape everything below.
 *
 *   1  APPROVAL IS DERIVED. `org.org_role_approval` is a cache maintained by
 *      `org.apply_vetting_decision()` from the append-only decision chain. No
 *      application role can write it - `ci.assert_approval_is_derived()`,
 *      migration 0070 - so there is no `approve()` here and never will be.
 *      Approving is inserting a decision; the trigger does the rest, and the
 *      screen reads the result back.
 *
 *   2  THE DECISION CHAIN BELONGS TO (organisation, role), NOT to a submission.
 *      `org.vetting_decision` cites the submission it was made on, but
 *      `org.org_role_approval`'s key is (org_id, role_code) - which is what R6
 *      reads. So an application's log below is every decision for that
 *      organisation and role, oldest first, and not only the ones citing this
 *      submission. Showing a subset would show a state that did not follow
 *      from the rows on screen.
 *
 *   3  THE PUBLICATION GATE IS A DATABASE FUNCTION. `proj.publication_gaps()`
 *      is called per project, per request. The counts beside each item are
 *      read with the same predicates the function uses, so the detail column
 *      and the pass/fail column cannot disagree.
 *
 * Each write comes in two forms: one that takes an Actor and opens its own
 * transaction, which is what the application calls, and one that takes a Tx,
 * which the first is a one-line wrapper around. The split exists for exactly
 * one reason: `org.vetting_decision` is append-only, so a test that records a
 * decision can never remove it. tests/db/admin.test.ts runs the Tx form inside
 * a transaction it rolls back, which exercises THE SAME SQL through the same
 * triggers without putting an approval on a real organisation's permanent
 * record. Nothing in src/ may call the Tx form outside a withActor() callback.
 */

/* ========================================================================== */
/*  ERRORS THAT ARE NOT DATABASE ERRORS                                       */
/* ========================================================================== */

/** The submission id is not one the queue holds. */
export class UnknownApplicationError extends Error {
  constructor() {
    super('no such vetting submission');
    this.name = 'UnknownApplicationError';
  }
}

/** The project id is not one this operator can see. */
export class UnknownProjectError extends Error {
  constructor() {
    super('no such project');
    this.name = 'UnknownProjectError';
  }
}

/** Publishing something already on the public index changes nothing. */
export class AlreadyPublishedError extends Error {
  constructor() {
    super('project is already published');
    this.name = 'AlreadyPublishedError';
  }
}

/* ========================================================================== */
/*  THE VETTING QUEUE                                                         */
/* ========================================================================== */

const BY_ORG = 'adminVetting.by.organisation';
const BY_REVIEWER = 'adminVetting.by.reviewer';

/**
 * The head of each application chain.
 *
 * `supersedes_id` points at the application a re-application replaced, so the
 * head is the submission nothing points at. The superseded ones stay in the
 * table - they are append-only - and the count of them is carried on the row
 * so the panel can say how many times this organisation has applied.
 */
const queueSql = (where: string) => `
  SELECT s.id                                 AS submission_id,
         s.org_id,
         s.questionnaire_id,
         s.role_code,
         o.legal_name                         AS organisation_name,
         coalesce(CASE WHEN $1 = 'de' THEN sec.label_de END,
                  sec.label_en, o.sector_code) AS sector_label,
         coalesce(ms.name_en, o.country_code) AS country_name,
         s.submitted_at::date::text           AS submitted_on,
         a.status                             AS approval_status,
         (SELECT count(*) FROM org.vetting_submission n
           WHERE n.org_id = s.org_id AND n.role_code = s.role_code)::int
                                              AS submission_count
    FROM org.vetting_submission s
    JOIN org.organisation o ON o.id = s.org_id
    LEFT JOIN platform.sector sec           ON sec.code = o.sector_code
    LEFT JOIN platform.eu_member_state ms   ON ms.code  = o.country_code
    LEFT JOIN org.org_role_approval a
           ON a.org_id = s.org_id AND a.role_code = s.role_code
   WHERE ${where}
   ORDER BY s.submitted_at DESC, s.id`;

/** The queue: one row per application chain, the superseded ones behind it. */
const QUEUE_SQL = queueSql(
  'NOT EXISTS (SELECT 1 FROM org.vetting_submission n WHERE n.supersedes_id = s.id)',
);
/**
 * One application by id, superseded or not. `where` is a literal from this
 * file and never from a request; the id itself is bound as $2.
 */
const ONE_APPLICATION_SQL = queueSql('s.id = $2::uuid');

const DECISIONS_SQL = `
  SELECT d.id, d.org_id, d.role_code, d.decision::text AS decision, d.reason,
         d.decided_at::date::text AS decided_on
    FROM org.vetting_decision d
   WHERE d.org_id = ANY($1::uuid[]) AND d.role_code = ANY($2::text[])
   ORDER BY d.decided_at, d.id`;

const ANSWERS_SQL = `
  SELECT q.question_code, q.sort_order, q.prompt_en, q.answer_kind, q.is_required,
         a.answer_text, a.answer_boolean, a.answer_numeric::text AS answer_numeric
    FROM org.question q
    LEFT JOIN org.vetting_answer a
           ON a.submission_id = $1::uuid AND a.question_code = q.question_code
   WHERE q.questionnaire_id = $2::uuid
   ORDER BY q.sort_order`;

interface QueueRowSql extends Record<string, unknown> {
  submission_id: string; org_id: string; questionnaire_id: string;
  role_code: string; organisation_name: string; sector_label: string;
  country_name: string; submitted_on: string;
  approval_status: ApprovalStatus | null; submission_count: number;
}

interface DecisionRowSql extends Record<string, unknown> {
  id: string; org_id: string; role_code: string; decision: string;
  reason: string | null; decided_on: string;
}

interface AnswerRowSql extends Record<string, unknown> {
  question_code: string; sort_order: number; prompt_en: string;
  answer_kind: string; is_required: boolean;
  answer_text: string | null; answer_boolean: boolean | null;
  answer_numeric: string | null;
}

const DECISION_ENTRY_KIND: Readonly<Record<string, AdminEntryKind>> = {
  approved: 'approved',
  declined: 'declined',
  suspended: 'suspended',
  reinstated: 'reinstated',
  revoked: 'revoked',
};

/**
 * The state of an organisation for one role.
 *
 * It is not computed here. `org.org_role_approval.status` is the trigger's own
 * answer and is the predicate R6 reads; an application that recomputed it from
 * the decision rows would be a second implementation of the rule, free to
 * disagree with the one the database enforces. Where the table has no row, no
 * decision has been recorded and the application is simply submitted.
 */
function stateOf(status: ApprovalStatus | null): VettingState {
  return status ?? 'submitted';
}

function buildEntries(
  row: QueueRowSql,
  decisions: readonly DecisionRowSql[],
): AdminEntry[] {
  const entries: AdminEntry[] = [
    {
      reference: row.submission_id,
      on: row.submitted_on,
      kind: 'submitted',
      byKey: BY_ORG,
      reason: null,
      superseded: false,
    },
  ];
  decisions.forEach((d, i) => {
    const kind = DECISION_ENTRY_KIND[d.decision];
    if (!kind) return;
    entries.push({
      reference: d.id,
      on: d.decided_on,
      kind,
      byKey: BY_REVIEWER,
      reason: d.reason,
      // Every decision but the last has been replaced by a later one. It keeps
      // its row and its reason - R4 - and is marked rather than removed.
      superseded: i < decisions.length - 1,
    });
  });
  return entries;
}

function toQueueRow(
  row: QueueRowSql,
  decisions: readonly DecisionRowSql[],
): AdminVettingRow {
  const entries = buildEntries(row, decisions);
  const last = entries[entries.length - 1]!;
  return {
    submissionId: row.submission_id,
    orgId: row.org_id,
    organisationName: row.organisation_name,
    roleCode: row.role_code,
    sectorLabel: row.sector_label,
    countryName: row.country_name,
    submittedOn: row.submitted_on,
    lastEntryOn: last.on,
    state: stateOf(row.approval_status),
    approvalStatus: row.approval_status,
    entries,
    submissionCount: row.submission_count,
  };
}

function decisionsFor(
  all: readonly DecisionRowSql[],
  orgId: string,
  roleCode: string,
): DecisionRowSql[] {
  return all.filter((d) => d.org_id === orgId && d.role_code === roleCode);
}

export async function vettingQueueIn(
  tx: Tx,
  locale: string,
): Promise<AdminVettingRow[]> {
  const rows = await tx.query<QueueRowSql>(QUEUE_SQL, [locale]);
  if (rows.length === 0) return [];
  const decisions = await tx.query<DecisionRowSql>(DECISIONS_SQL, [
    [...new Set(rows.map((r) => r.org_id))],
    [...new Set(rows.map((r) => r.role_code))],
  ]);
  return rows.map((r) => toQueueRow(r, decisionsFor(decisions, r.org_id, r.role_code)));
}

/** Every application waiting or decided, newest submission first. */
export async function loadVettingQueue(
  actor: Actor,
  locale: string,
): Promise<AdminVettingRow[]> {
  return readAs(actor, (tx) => vettingQueueIn(tx, locale));
}

function toAnswer(r: AnswerRowSql): AdminAnswer {
  return {
    questionCode: r.question_code,
    sortOrder: r.sort_order,
    promptEn: r.prompt_en,
    answerKind: r.answer_kind,
    isRequired: r.is_required,
    text: r.answer_text,
    boolean: r.answer_boolean,
    numeric: r.answer_numeric,
  };
}

export async function vettingApplicationIn(
  tx: Tx,
  submissionId: string,
  locale: string,
): Promise<AdminVettingApplication | null> {
  const rows = await tx.query<QueueRowSql>(ONE_APPLICATION_SQL, [
    locale,
    submissionId,
  ]);
  const row = rows[0];
  if (!row) return null;

  const [decisions, answers] = await Promise.all([
    tx.query<DecisionRowSql>(DECISIONS_SQL, [[row.org_id], [row.role_code]]),
    tx.query<AnswerRowSql>(ANSWERS_SQL, [submissionId, row.questionnaire_id]),
  ]);

  const base = toQueueRow(row, decisions);
  const list = answers.map(toAnswer);
  return {
    ...base,
    questionnaireId: row.questionnaire_id,
    answers: list,
    answeredCount: list.filter(
      (a) =>
        a.boolean !== null
        || (a.numeric !== null && a.numeric.trim() !== '')
        || (a.text !== null && a.text.trim() !== ''),
    ).length,
  };
}

/** One application, with the questionnaire exactly as it was submitted. */
export async function loadVettingApplication(
  actor: Actor,
  submissionId: string,
  locale: string,
): Promise<AdminVettingApplication | null> {
  return readAs(actor, (tx) => vettingApplicationIn(tx, submissionId, locale));
}

/* --------------------------------------------------------- recording one -- */

export interface DecisionInput {
  readonly submissionId: string;
  readonly choice: AdminDecisionChoice;
  /** Required by this application for all three choices. See below. */
  readonly reason: string;
  /** The operator's own organisation and person, from the session. */
  readonly decidedByOrgId: string;
  readonly decidedByPersonRef: string;
}

export interface DecisionResult {
  readonly decisionId: string;
  /** The enum member actually recorded - see the reinstatement note below. */
  readonly recorded: string;
  /** Read back from org.org_role_approval AFTER the trigger ran. */
  readonly state: VettingState;
}

const CURRENT_STATUS_SQL = `
  SELECT a.status
    FROM org.vetting_submission s
    LEFT JOIN org.org_role_approval a
           ON a.org_id = s.org_id AND a.role_code = s.role_code
   WHERE s.id = $1::uuid`;

/**
 * The enum member a choice records.
 *
 * `approve` is two different facts. Approving an organisation that has never
 * been approved is `approved`; approving one that currently stands suspended is
 * `reinstated`. Both resolve to the same status through
 * `org.apply_vetting_decision()`, and the schema carries both members precisely
 * so the record keeps which one happened. Choosing between them from the
 * CURRENT status, read in this same transaction, is the only way to do that
 * without asking the operator a question the record can answer itself.
 */
function enumFor(choice: AdminDecisionChoice, current: ApprovalStatus | null): string {
  if (choice === 'decline') return 'declined';
  if (choice === 'suspend') return 'suspended';
  return current === 'suspended' ? 'reinstated' : 'approved';
}

/**
 * Record one decision.
 *
 * The organisation and the role are taken FROM THE SUBMISSION, not from the
 * form. A request naming another organisation's id changes nothing, because no
 * id from the request reaches those columns: the INSERT reads them back out of
 * `org.vetting_submission` by the submission id, and the composite foreign key
 * `(submission_id, org_id, role_code)` would refuse the row anyway.
 *
 * The reason is mandatory here for all three choices. The database requires one
 * for `declined` and `revoked` only, which is where the concept note names it;
 * this application requires it everywhere because the entry is append-only and
 * can never be edited afterwards to explain itself. That is an application
 * rule, stated rather than hidden, and it makes the form stricter than the
 * schema and never the other way round.
 */
export async function recordDecisionIn(
  tx: Tx,
  input: DecisionInput,
): Promise<DecisionResult> {
  const before = await tx.maybe<{ status: ApprovalStatus | null }>(
    CURRENT_STATUS_SQL,
    [input.submissionId],
  );
  if (!before) throw new UnknownApplicationError();

  const decision = enumFor(input.choice, before.status);

  const written = await tx.maybe<{ id: string }>(
    `INSERT INTO org.vetting_decision
       (submission_id, org_id, role_code, decision, reason,
        decided_by_org_id, decided_by_person_ref)
     SELECT s.id, s.org_id, s.role_code,
            $2::org.vetting_decision_kind, $3::text, $4::uuid, $5::uuid
       FROM org.vetting_submission s
      WHERE s.id = $1::uuid
     RETURNING id`,
    [
      input.submissionId,
      decision,
      input.reason,
      input.decidedByOrgId,
      input.decidedByPersonRef,
    ],
  );
  if (!written) throw new UnknownApplicationError();

  // Read the state back rather than assuming it. The trigger is the authority;
  // if it were ever disabled this read would say so instead of the screen
  // printing a state nothing had written.
  const after = await tx.maybe<{ status: ApprovalStatus | null }>(
    CURRENT_STATUS_SQL,
    [input.submissionId],
  );

  return {
    decisionId: written.id,
    recorded: decision,
    state: stateOf(after?.status ?? null),
  };
}

export async function recordDecision(
  actor: Actor,
  input: DecisionInput,
): Promise<DecisionResult> {
  return withActor(actor, (tx) => recordDecisionIn(tx, input));
}

/* ========================================================================== */
/*  PROJECT REVIEW AND PUBLICATION                                            */
/* ========================================================================== */

/**
 * Every project, with its live publication gate.
 *
 * The counts in the last column use the same predicates
 * `proj.publication_gaps()` uses, so the detail and the pass/fail cannot
 * disagree. There is deliberately no volume in this query: this is the one
 * table that puts projects from different schemes side by side, and a shared
 * volume column would add a hectare-year to an index point (rule 7). The
 * availability item therefore counts PERIODS, which is a count of rows.
 */
const PROJECTS_SQL = `
  SELECT p.id, p.slug, p.country_code, p.status::text AS status,
         o.legal_name                            AS owner_org_name,
         coalesce(ms.name_en, p.country_code)    AS country_name,
         coalesce(t_loc.body, t_en.body, p.slug) AS title,
         (t_loc.body IS NULL)                    AS title_is_fallback,
         proj.publication_gaps(p.id)             AS gaps,
         sc.name                                 AS scheme_name,
         coalesce(utt.metric_label, ut.metric_label_en) AS unit_label,
         p.published_at::date::text              AS published_on,
         greatest(
           p.created_at,
           coalesce((SELECT max(x.recorded_at) FROM proj.project_text x
                      WHERE x.project_id = p.id), p.created_at),
           coalesce((SELECT max(f.recorded_at) FROM proj.period_forecast f
                      WHERE f.project_id = p.id), p.created_at),
           coalesce((SELECT max(g.recorded_at) FROM geo.project_geometry g
                      WHERE g.project_id = p.id), p.created_at)
         )::date::text AS last_change_on,

         -- the ten items, counted with the gate function's own predicates
         (SELECT count(DISTINCT t.field_code)::int
            FROM proj.project_text t
            JOIN proj.text_field f ON f.code = t.field_code
           WHERE t.project_id = p.id AND t.locale = 'en'
             AND f.required_for_publication AND t.status = 'published') AS n_text,
         (SELECT count(*)::int FROM geo.project_geometry g
           WHERE g.project_id = p.id AND g.kind = 'boundary')           AS n_boundary,
         (SELECT count(*)::int FROM proj.claim_right c
           WHERE c.project_id = p.id)                                   AS n_rights,
         (SELECT count(*)::int FROM proj.outcome_indicator oi
           WHERE oi.project_id = p.id)                                  AS n_outcomes,
         (SELECT count(*)::int FROM proj.indicator_value v
           WHERE v.project_id = p.id AND v.value_kind = 'baseline')     AS n_baselines,
         (SELECT count(*)::int FROM proj.durability_commitment d
           WHERE d.project_id = p.id)                                   AS n_durability,
         (SELECT vo.legal_name FROM proj.project_party pp
            JOIN org.organisation vo ON vo.id = pp.party_org_id
           WHERE pp.project_id = p.id AND pp.party_role = 'verifier'
           LIMIT 1)                                                     AS verifier_name,
         (SELECT max(dv.version_no) FROM doc.document dd
            JOIN doc.document_version dv ON dv.document_id = dd.id
           WHERE dd.project_id = p.id AND dd.kind = 'project_idea_note')      AS idea_version,
         (SELECT max(dv.version_no) FROM doc.document dd
            JOIN doc.document_version dv ON dv.document_id = dd.id
           WHERE dd.project_id = p.id AND dd.kind = 'project_design_document') AS design_version,
         (SELECT count(*)::int FROM proj.period_balance b
           WHERE b.project_id = p.id)                                   AS n_periods
    FROM proj.project p
    JOIN org.organisation o ON o.id = p.owner_org_id
    LEFT JOIN platform.eu_member_state ms ON ms.code = p.country_code
    -- The operator's view is the record, not the published page: the newest
    -- version of each field is shown whatever its translation status, because
    -- a project in review is exactly the one whose text is not published yet.
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN LATERAL (
      SELECT put.unit_type_id, put.scheme_id
        FROM proj.project_unit_type put
       WHERE put.project_id = p.id
       ORDER BY put.declared_at LIMIT 1) spine ON true
    LEFT JOIN units.scheme sc    ON sc.id = spine.scheme_id
    LEFT JOIN units.unit_type ut ON ut.id = spine.unit_type_id
    LEFT JOIN units.unit_type_translation utt
           ON utt.unit_type_id = spine.unit_type_id AND utt.locale = $1
   ORDER BY p.status, coalesce(t_loc.body, t_en.body, p.slug)`;

interface ProjectRowSql extends Record<string, unknown> {
  id: string; slug: string; country_code: string; status: PublicationStatus;
  owner_org_name: string; country_name: string; title: string;
  title_is_fallback: boolean; gaps: string[] | null; scheme_name: string | null;
  unit_label: string | null; published_on: string | null; last_change_on: string;
  n_text: number; n_boundary: number; n_rights: number; n_outcomes: number;
  n_baselines: number; n_durability: number; verifier_name: string | null;
  idea_version: number | null; design_version: number | null; n_periods: number;
}

/** What each gate item has recorded against it, when it is not missing. */
function detailFor(code: PublicationGateCode, r: ProjectRowSql): GateDetail {
  switch (code) {
    case 'english_page_text':
      return { kind: 'count', countKey: 'fields', count: r.n_text };
    case 'boundary':
      return { kind: 'count', countKey: 'geometries', count: r.n_boundary };
    case 'claim_rights':
      return { kind: 'count', countKey: 'rights', count: r.n_rights };
    case 'outcomes':
      return { kind: 'count', countKey: 'indicators', count: r.n_outcomes };
    case 'outcome_baseline':
      return { kind: 'count', countKey: 'baselines', count: r.n_baselines };
    case 'durability':
      return { kind: 'count', countKey: 'commitments', count: r.n_durability };
    case 'verifier':
      return r.verifier_name
        ? { kind: 'name', value: r.verifier_name }
        : { kind: 'missing' };
    case 'project_idea_note':
      return r.idea_version !== null
        ? { kind: 'version', value: `v${r.idea_version}` }
        : { kind: 'missing' };
    case 'project_design_document':
      return r.design_version !== null
        ? { kind: 'version', value: `v${r.design_version}` }
        : { kind: 'missing' };
    case 'availability':
      return { kind: 'count', countKey: 'periods', count: r.n_periods };
  }
}

function toProject(r: ProjectRowSql, today: string): AdminProject {
  // Only the codes this release can name. A code from a later migration is
  // dropped here rather than printed raw - see missingFromGateError().
  const gaps = (r.gaps ?? []).filter(isGateCode);
  const gate: GateEntry[] = PUBLICATION_GATE_CODES.map((code) => {
    const recorded = !gaps.includes(code);
    return {
      code,
      recorded,
      detail: recorded ? detailFor(code, r) : { kind: 'missing' },
    };
  });

  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    titleIsFallback: r.title_is_fallback,
    ownerOrgName: r.owner_org_name,
    countryCode: r.country_code,
    countryName: r.country_name,
    schemeName: r.scheme_name,
    unitLabel: r.unit_label,
    status: r.status,
    publishedOn: r.published_on,
    lastChangeOn: r.last_change_on,
    gateCheckedOn: today,
    gaps,
    gate,
  };
}

export async function adminProjectsIn(
  tx: Tx,
  locale: string,
): Promise<AdminProject[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await tx.query<ProjectRowSql>(PROJECTS_SQL, [locale]);
  return rows.map((r) => toProject(r, today));
}

/** Every project the operator can see, with its live publication gate. */
export async function loadAdminProjects(
  actor: Actor,
  locale: string,
): Promise<AdminProject[]> {
  return readAs(actor, (tx) => adminProjectsIn(tx, locale));
}

/* ----------------------------------------------------------- publishing -- */

export interface PublishResult {
  readonly projectId: string;
  readonly slug: string;
  /** Filled by proj.enforce_publication_gate(), not by this application. */
  readonly publishedOn: string | null;
}

/**
 * Publish one project.
 *
 * `sylva_operator` holds `UPDATE (status, published_at)` on `proj.project` and
 * nothing else on it, so this is the whole of what an operator may change. The
 * statement sets `status` alone: `proj.enforce_publication_gate()` fills
 * `published_at` itself, and leaving it to the trigger means a database whose
 * trigger had been disabled would fail the `CHECK` that ties the two together
 * rather than quietly publish an incomplete project.
 *
 * The gate is NOT checked here first. The screen shows the operator what is
 * missing and disables the control, but this function deliberately sends the
 * statement and lets the database refuse it with SY008 - which is the only
 * check that is true at the moment of writing. The caller turns that refusal
 * into a sentence; see src/lib/admin/errors.ts.
 */
export async function publishProjectIn(
  tx: Tx,
  projectId: string,
): Promise<PublishResult> {
  const before = await tx.maybe<{ status: PublicationStatus }>(
    'SELECT status::text AS status FROM proj.project WHERE id = $1::uuid',
    [projectId],
  );
  if (!before) throw new UnknownProjectError();
  if (before.status === 'published') throw new AlreadyPublishedError();

  const row = await tx.one<{ id: string; slug: string; published_on: string | null }>(
    `UPDATE proj.project
        SET status = 'published'
      WHERE id = $1::uuid
      RETURNING id, slug, published_at::date::text AS published_on`,
    [projectId],
  );
  return { projectId: row.id, slug: row.slug, publishedOn: row.published_on };
}

export async function publishProject(
  actor: Actor,
  projectId: string,
): Promise<PublishResult> {
  return withActor(actor, (tx) => publishProjectIn(tx, projectId));
}
