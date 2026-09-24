import { readAs, withActor, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import {
  EMPTY_ANSWER,
  isAnswered,
  type AnswerMap,
  type AnswerValue,
  type ApprovalStatus,
  type DecisionKind,
  type DraftState,
  type OwnOrganisation,
  type Questionnaire,
  type SubmissionSummary,
  type VettingDecision,
  type VettingQuestion,
  type VettingState,
  type VettingStatus,
} from './types';

/**
 * Vetting, against the real database.
 *
 * Every function here goes through readAs() or withActor(), so it runs inside
 * one transaction, as the caller's PostgreSQL role, with the caller's signed
 * organisation context. Nothing filters by org_id in application code: the
 * row-level policies in db/migrations/0017 and 0070 do it, and a predicate
 * written twice is a predicate that will one day disagree with itself.
 *
 * Three facts about this schema shape everything below.
 *
 *   1  Approval is DERIVED. org.org_role_approval is a cache maintained by
 *      org.apply_vetting_decision() from the append-only decision chain. No
 *      role can write it - ci.assert_approval_is_derived(), migration 0070 -
 *      so there is no "approve" call here and never will be. Approving is
 *      inserting a decision, which only sylva_operator may do.
 *
 *   2  A submission SUPERSEDES its predecessor. org.vetting_submission is
 *      append-only; re-applying is a new row whose supersedes_id points at the
 *      old one, and the old one stays visible. supersedes_id is UNIQUE, so two
 *      submissions can never claim to replace the same application - the
 *      database refuses the second, which is what makes the chain a chain.
 *
 *   3  A draft is NOT a submission. org.vetting_draft is mutable working state
 *      that only its own organisation can see; see the header of migration
 *      0070 for why that is not a breach of Rule 4.
 *
 * Each operation comes in two forms: one that takes an Actor and opens its own
 * transaction, which is what the application calls, and one that takes a Tx,
 * which the first is a one-line wrapper around. The split exists for exactly
 * one reason: org.vetting_submission, org.vetting_answer and
 * org.vetting_decision are append-only, so a test that writes one can never
 * delete it again. tests/db/vetting.test.ts runs the Tx form inside a
 * transaction it rolls back, which lets it exercise THE SAME SQL without
 * leaving a decision on a real organisation's permanent record. Nothing in
 * src/ may call the Tx form outside a withActor()/readAs() callback.
 */

/* ------------------------------------------------------------------ helpers */

/**
 * The org-scoped reads and writes below are an organisation acting for itself,
 * and only a member actor is that.
 *
 * This is not the security boundary - the row-level policies are - but the
 * policies say something DIFFERENT to an operator and an auditor:
 * p_vsub_privileged, p_vans_privileged and p_vdec_privileged are
 * `USING (true)`, so exactly the same SQL that returns one organisation's
 * application to its own buyer returns some ARBITRARY organisation's to Sylva,
 * chosen by `ORDER BY submitted_at DESC LIMIT 1`. Nothing in the vetting flow
 * asks for that; the operator queue reads by organisation, explicitly.
 *
 * The pages already check the viewer's role before they call. This makes the
 * requirement a property of the function rather than of every caller, so the
 * next caller cannot forget - and it fails closed, with a sentence the error
 * mapping turns into "You don't have access to this information" rather than a
 * page quietly showing a stranger's application.
 */
function requireMember(actor: Actor): void {
  if (actor.kind !== 'member') {
    const err = new Error(
      'vetting: this read is an organisation acting for itself; '
      + `an actor of kind "${actor.kind}" has no application of its own`,
    ) as Error & { code: string };
    // 42501 = insufficient_privilege, so codeForDatabaseError() maps it to
    // "You don't have access to this information" like any refusal from the
    // database itself. The caller cannot tell, and should not need to.
    err.code = '42501';
    throw err;
  }
}

interface QuestionRow extends Record<string, unknown> {
  question_code: string;
  sort_order: number;
  prompt_en: string;
  answer_kind: VettingQuestion['answerKind'];
  is_required: boolean;
}

interface AnswerRow extends Record<string, unknown> {
  question_code: string;
  answer_text: string | null;
  answer_boolean: boolean | null;
  answer_numeric: string | null;
}

function toAnswerMap(rows: readonly AnswerRow[]): AnswerMap {
  const out: Record<string, AnswerValue> = {};
  for (const r of rows) {
    out[r.question_code] = {
      text: r.answer_text,
      boolean: r.answer_boolean,
      numeric: r.answer_numeric,
    };
  }
  return out;
}

const QUESTIONNAIRE_SQL = `
  SELECT q.id, q.role_code, q.version_no, q.published_at::date::text AS published_at
    FROM org.questionnaire q
   WHERE q.role_code = $1
     AND q.published_at IS NOT NULL
     AND q.published_at <= now()
   ORDER BY q.version_no DESC
   LIMIT 1`;

const QUESTIONS_SQL = `
  SELECT question_code, sort_order, prompt_en, answer_kind, is_required
    FROM org.question
   WHERE questionnaire_id = $1
   ORDER BY sort_order`;

export async function questionnaireIn(tx: Tx, roleCode: string): Promise<Questionnaire | null> {
  const head = await tx.maybe<{
    id: string; role_code: string; version_no: number; published_at: string;
  }>(QUESTIONNAIRE_SQL, [roleCode]);
  if (!head) return null;

  const questions = await tx.query<QuestionRow>(QUESTIONS_SQL, [head.id]);
  return {
    id: head.id,
    roleCode: head.role_code,
    versionNo: head.version_no,
    publishedAt: head.published_at,
    questions: questions.map((q) => ({
      questionCode: q.question_code,
      sortOrder: q.sort_order,
      promptEn: q.prompt_en,
      answerKind: q.answer_kind,
      isRequired: q.is_required,
    })),
  };
}

/* -------------------------------------------------------------- the reads */

/**
 * The questionnaire in force for a role: the highest published version.
 *
 * Readable by everyone, including an anonymous visitor - org.questionnaire and
 * org.question are allowlisted as public lookups in ci.no_rls_allowlist,
 * because the SHAPE of the questionnaire is not confidential. The answers are.
 */
export async function loadQuestionnaire(
  actor: Actor,
  roleCode: string,
): Promise<Questionnaire | null> {
  return readAs(actor, (tx) => questionnaireIn(tx, roleCode));
}

export async function draftIn(tx: Tx, questionnaireId: string): Promise<DraftState> {
  const rows = await tx.query<AnswerRow & { updated_at: string }>(
    `SELECT question_code, answer_text, answer_boolean,
            answer_numeric::text AS answer_numeric, updated_at
       FROM org.vetting_draft
      WHERE questionnaire_id = $1
      ORDER BY question_code`,
    [questionnaireId],
  );
  const savedAt = rows.reduce<string | null>(
    (max, r) => (max === null || r.updated_at > max ? r.updated_at : max),
    null,
  );
  return { answers: toAnswerMap(rows), savedAt };
}

/** The caller's own saved draft for a questionnaire. Never anybody else's. */
export async function loadDraft(
  actor: Actor,
  questionnaireId: string,
): Promise<DraftState> {
  requireMember(actor);
  return readAs(actor, (tx) => draftIn(tx, questionnaireId));
}

const HEAD_SUBMISSION_SQL = `
  -- The head of the supersedes chain: the application nothing has replaced.
  -- Ordering by submitted_at alone would pick the newest row even when it has
  -- since been superseded, which is the wrong application to show.
  SELECT s.id, s.role_code, s.questionnaire_id,
         s.submitted_at::text AS submitted_at, s.supersedes_id
    FROM org.vetting_submission s
   WHERE s.role_code = $1
     AND NOT EXISTS (SELECT 1 FROM org.vetting_submission x
                      WHERE x.supersedes_id = s.id)
   ORDER BY s.submitted_at DESC, s.id DESC
   LIMIT 1`;

export async function headSubmissionIn(
  tx: Tx,
  roleCode: string,
): Promise<SubmissionSummary | null> {
  const s = await tx.maybe<{
    id: string; role_code: string; questionnaire_id: string;
    submitted_at: string; supersedes_id: string | null;
  }>(HEAD_SUBMISSION_SQL, [roleCode]);
  if (!s) return null;

  const answers = await tx.query<AnswerRow>(
    `SELECT question_code, answer_text, answer_boolean,
            answer_numeric::text AS answer_numeric
       FROM org.vetting_answer
      WHERE submission_id = $1`,
    [s.id],
  );
  return {
    id: s.id,
    roleCode: s.role_code,
    questionnaireId: s.questionnaire_id,
    submittedAt: s.submitted_at,
    supersedesId: s.supersedes_id,
    answers: toAnswerMap(answers),
  };
}

/** The application that counts today, with the answers as submitted. */
export async function loadHeadSubmission(
  actor: Actor,
  roleCode: string,
): Promise<SubmissionSummary | null> {
  requireMember(actor);
  return readAs(actor, (tx) => headSubmissionIn(tx, roleCode));
}

/**
 * Everything /vetting/status shows, in one transaction so the four rows it
 * reads cannot be from four different moments.
 *
 * The state is derived and never stored:
 *
 *   no submission                 -> not_started
 *   submission, no decision       -> submitted
 *   decision recorded             -> whatever org.org_role_approval says
 *
 * org.org_role_approval is the same row deal.enforce_r6_and_publication()
 * reads, so what this page shows and what R6 enforces cannot drift apart.
 */
export async function loadVettingStatus(
  actor: Actor,
  roleCode: string,
): Promise<VettingStatus> {
  requireMember(actor);
  return readAs(actor, (tx) => vettingStatusIn(tx, roleCode));
}

export async function vettingStatusIn(
  tx: Tx,
  roleCode: string,
): Promise<VettingStatus> {
  {
    const organisation = await tx.maybe<{
      id: string; legal_name: string; country_code: string;
      sector_code: string; size_band_code: string; created_at: string;
    }>(
      `SELECT id, legal_name, country_code, sector_code, size_band_code,
              created_at::text AS created_at
         FROM org.my_organisation()`,
    );

    const submission = await headSubmissionIn(tx, roleCode);

    const count = await tx.one<{ n: string }>(
      'SELECT count(*)::text AS n FROM org.vetting_submission WHERE role_code = $1',
      [roleCode],
    );

    const approval = await tx.maybe<{ status: ApprovalStatus; updated_at: string }>(
      `SELECT status, updated_at::text AS updated_at
         FROM org.org_role_approval
        WHERE role_code = $1`,
      [roleCode],
    );

    const history = await tx.query<{
      id: string; decision: DecisionKind; reason: string | null;
      decided_at: string; review_due_on: string | null; submission_id: string;
    }>(
      `SELECT id, decision::text AS decision, reason,
              decided_at::text AS decided_at,
              review_due_on::text AS review_due_on,
              submission_id
         FROM org.vetting_decision
        WHERE role_code = $1
        ORDER BY decided_at DESC, id DESC`,
      [roleCode],
    );

    const decisions: VettingDecision[] = history.map((d) => ({
      id: d.id,
      decision: d.decision,
      reason: d.reason,
      decidedAt: d.decided_at,
      reviewDueOn: d.review_due_on,
      submissionId: d.submission_id,
    }));

    const state: VettingState = approval
      ? approval.status
      : submission
        ? 'submitted'
        : 'not_started';

    const dates = [
      submission?.submittedAt ?? null,
      approval?.updated_at ?? null,
      decisions[0]?.decidedAt ?? null,
    ].filter((d): d is string => d !== null);

    return {
      roleCode,
      state,
      organisation: organisation
        ? {
            id: organisation.id,
            legalName: organisation.legal_name,
            countryCode: organisation.country_code,
            sectorCode: organisation.sector_code,
            sizeBandCode: organisation.size_band_code,
            createdAt: organisation.created_at,
          } satisfies OwnOrganisation
        : null,
      submission,
      submissionCount: Number(count.n),
      approvalStatus: approval?.status ?? null,
      approvalUpdatedAt: approval?.updated_at ?? null,
      decision: decisions[0] ?? null,
      history: decisions,
      asOfDate: dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    };
  }
}

/** The caller's own organisation. The only route to its own legal name. */
export async function loadOwnOrganisation(
  actor: Actor,
): Promise<OwnOrganisation | null> {
  requireMember(actor);
  return readAs(actor, async (tx) => {
    const row = await tx.maybe<{
      id: string; legal_name: string; country_code: string;
      sector_code: string; size_band_code: string; created_at: string;
    }>(
      `SELECT id, legal_name, country_code, sector_code, size_band_code,
              created_at::text AS created_at
         FROM org.my_organisation()`,
    );
    return row
      ? {
          id: row.id,
          legalName: row.legal_name,
          countryCode: row.country_code,
          sectorCode: row.sector_code,
          sizeBandCode: row.size_band_code,
          createdAt: row.created_at,
        }
      : null;
  });
}

/* ------------------------------------------------------------- the writes */

export interface AnswerInput {
  readonly questionCode: string;
  readonly text?: string | null;
  readonly boolean?: boolean | null;
  readonly numeric?: string | null;
}

function normalise(a: AnswerInput): AnswerValue {
  if (a.boolean !== undefined && a.boolean !== null) {
    return { text: null, boolean: a.boolean, numeric: null };
  }
  if (a.numeric !== undefined && a.numeric !== null && a.numeric.trim() !== '') {
    return { text: null, boolean: null, numeric: a.numeric.trim() };
  }
  const text = (a.text ?? '').trim();
  return { text: text === '' ? null : text, boolean: null, numeric: null };
}

/**
 * Save a draft. Replaces the whole draft for this questionnaire rather than
 * merging, because the form posts the whole questionnaire: a question the
 * person cleared must come back cleared, and a merge would silently restore
 * what they deleted.
 *
 * DELETE-then-INSERT on a table that is explicitly not part of the record. The
 * transaction is the atomicity: a failed save leaves the previous draft intact.
 */
export interface DraftInput {
  questionnaireId: string;
  roleCode: string;
  personRef: string | null;
  answers: readonly AnswerInput[];
}

export async function saveDraft(
  actor: Actor,
  input: DraftInput,
): Promise<{ saved: number }> {
  requireMember(actor);
  return withActor(actor, (tx) => saveDraftIn(tx, input));
}

export async function saveDraftIn(
  tx: Tx,
  input: DraftInput,
): Promise<{ saved: number }> {
  const filled = input.answers
    .map((a) => ({ code: a.questionCode, value: normalise(a) }))
    .filter((a) => isAnswered(a.value));

  {
    await tx.query('DELETE FROM org.vetting_draft WHERE questionnaire_id = $1', [
      input.questionnaireId,
    ]);

    if (filled.length > 0) {
      await tx.query(
        `INSERT INTO org.vetting_draft
           (org_id, questionnaire_id, question_code, role_code,
            answer_text, answer_boolean, answer_numeric, updated_by_person_ref)
         SELECT sylva.actor_org_id(), $1, a.code, $2,
                a.text, a.bool, a.num::numeric, $3
           FROM unnest($4::text[], $5::text[], $6::boolean[], $7::text[])
             AS a(code, text, bool, num)`,
        [
          input.questionnaireId,
          input.roleCode,
          input.personRef,
          filled.map((a) => a.code),
          filled.map((a) => a.value.text),
          filled.map((a) => a.value.boolean),
          filled.map((a) => a.value.numeric),
        ],
      );
    }
    return { saved: filled.length };
  }
}

export class MissingRequiredAnswersError extends Error {
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(`vetting: ${missing.length} required question(s) unanswered`);
    this.name = 'MissingRequiredAnswersError';
    this.missing = missing;
  }
}

export interface SubmitResult {
  readonly submissionId: string;
  readonly submittedAt: string;
  readonly supersedesId: string | null;
}

/**
 * Submit the questionnaire.
 *
 * One transaction, five statements, in this order and for these reasons:
 *
 *   1  re-read the questions. Required-ness is the database's answer, not the
 *      form's: a hidden field claiming a question is optional must not be able
 *      to make it so.
 *   2  find the head of the supersedes chain. Two tabs submitting at once both
 *      read the same predecessor, and the SECOND INSERT FAILS: supersedes_id is
 *      UNIQUE, so the chain cannot fork. That is the intended outcome and the
 *      action reports it as "this application has already been replaced".
 *      SELECT ... FOR UPDATE is deliberately NOT used to make it a wait
 *      instead: org.vetting_submission is append-only and no application role
 *      holds UPDATE on it, so a row lock here would be refused outright -
 *      PostgreSQL requires UPDATE, DELETE or SELECT-FOR-UPDATE privilege for
 *      one. The unique index is the serialisation point, and it is a better
 *      one: it is in the database, where the rule survives a rewrite.
 *   3  insert the submission, with org_id taken from the VERIFIED context
 *      rather than from anything the caller sent.
 *   4  insert the answers.
 *   5  delete the draft. It has been superseded by something append-only.
 *
 * What this function does NOT do: touch org.org_role_approval. Submitting is
 * not approval, and the organisation still cannot open a deal - R6 refuses it
 * until sylva_operator records a decision. tests/db/vetting.test.ts proves it.
 */
export async function submitVetting(
  actor: Actor,
  input: DraftInput,
): Promise<SubmitResult> {
  requireMember(actor);
  return withActor(actor, (tx) => submitVettingIn(tx, input));
}

export async function submitVettingIn(
  tx: Tx,
  input: DraftInput,
): Promise<SubmitResult> {
  const given = new Map(
    input.answers.map((a) => [a.questionCode, normalise(a)] as const),
  );

  {
    const questions = await tx.query<QuestionRow>(
      `SELECT question_code, sort_order, prompt_en, answer_kind, is_required
         FROM org.question
        WHERE questionnaire_id = $1
        ORDER BY sort_order`,
      [input.questionnaireId],
    );
    if (questions.length === 0) {
      throw new MissingRequiredAnswersError([]);
    }

    const missing = questions
      .filter((q) => q.is_required && !isAnswered(given.get(q.question_code)))
      .map((q) => q.question_code);
    if (missing.length > 0) throw new MissingRequiredAnswersError(missing);

    // Only answers to questions that actually belong to this questionnaire.
    // The composite foreign key would refuse anything else; dropping it here
    // means a stale tab produces a clean submission rather than an error.
    const rows = questions
      .map((q) => ({ code: q.question_code, value: given.get(q.question_code) ?? EMPTY_ANSWER }))
      .filter((r) => isAnswered(r.value));

    const previous = await tx.maybe<{ id: string }>(
      `SELECT s.id
         FROM org.vetting_submission s
        WHERE s.role_code = $1
          AND NOT EXISTS (SELECT 1 FROM org.vetting_submission x
                           WHERE x.supersedes_id = s.id)
        ORDER BY s.submitted_at DESC, s.id DESC
        LIMIT 1`,
      [input.roleCode],
    );

    const created = await tx.one<{ id: string; submitted_at: string }>(
      `INSERT INTO org.vetting_submission
         (org_id, role_code, questionnaire_id, submitted_by_person_ref, supersedes_id)
       VALUES (sylva.actor_org_id(), $1, $2, $3, $4)
       RETURNING id, submitted_at::text AS submitted_at`,
      [input.roleCode, input.questionnaireId, input.personRef, previous?.id ?? null],
    );

    if (rows.length > 0) {
      await tx.query(
        `INSERT INTO org.vetting_answer
           (submission_id, questionnaire_id, question_code,
            answer_text, answer_boolean, answer_numeric)
         SELECT $1, $2, a.code, a.text, a.bool, a.num::numeric
           FROM unnest($3::text[], $4::text[], $5::boolean[], $6::text[])
             AS a(code, text, bool, num)`,
        [
          created.id,
          input.questionnaireId,
          rows.map((r) => r.code),
          rows.map((r) => r.value.text),
          rows.map((r) => r.value.boolean),
          rows.map((r) => r.value.numeric),
        ],
      );
    }

    await tx.query('DELETE FROM org.vetting_draft WHERE questionnaire_id = $1', [
      input.questionnaireId,
    ]);

    return {
      submissionId: created.id,
      submittedAt: created.submitted_at,
      supersedesId: previous?.id ?? null,
    };
  }
}
