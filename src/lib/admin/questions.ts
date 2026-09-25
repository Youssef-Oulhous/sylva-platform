import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';

/**
 * The private question box, from Sylva's side.
 *
 * The concept note is explicit: a question asked about a project goes "to the
 * project owner and to us, not to a public comment feed". The owner has had
 * /owner/questions for a while. There was nowhere for "us" to read them at all,
 * which made half of a stated promise undeliverable - a buyer could ask Sylva a
 * question and no operator could ever see it.
 *
 * deal.project_question is append-only and the operator's policy on it is
 * USING (true). So this module reads, and does not write: whether Sylva answers
 * on a project owner's behalf is not settled by the pilot material, and the
 * screen says so rather than inventing the rule. (The database does grant the
 * operator INSERT on deal.project_question_answer, which is worth knowing when
 * that decision is taken.)
 *
 * The asker is NAMED here, AND carries the label it appears under on the
 * record. A question is not part of the public record and this page is not
 * public; the people who can read a question at all are the asker, the project
 * owner, an auditor and a Sylva operator, and rule 5 is about how a buyer
 * appears on the PUBLIC record, which a question never reaches. But the label
 * is what an operator has in front of them when they arrive from the record or
 * from an audit query - "who is Buyer 006 and what did they ask" is one
 * question, not two - so both are printed, with the name second.
 *
 * The label comes from deal.deal_pseudonym for this asker on this project, and
 * from org.organisation_pseudonym where no deal-scoped one has been allocated.
 * An asker with neither - an organisation that has asked a question and never
 * opened a deal - says so rather than showing an empty cell.
 */

export const QUESTION_STATES = ['all', 'open', 'answered'] as const;
export type QuestionState = (typeof QUESTION_STATES)[number];

export function isQuestionState(value: unknown): value is QuestionState {
  return typeof value === 'string' && (QUESTION_STATES as readonly string[]).includes(value);
}

export interface QuestionAnswer {
  answerId: string;
  body: string;
  answeredOn: string;
  answeredByName: string;
  /** True where the answer came from the organisation that owns the project. */
  answeredByOwner: boolean;
}

export interface OperatorQuestion {
  questionId: string;
  projectSlug: string;
  projectTitle: string;
  projectStatus: string;
  ownerName: string;
  askerName: string;
  askerCountry: string;
  askerSector: string;
  /** The label this asker appears under on the record, where one is allocated. */
  askerLabel: string | null;
  body: string;
  askedOn: string;
  waitingDays: number;
  answers: QuestionAnswer[];
}

export interface OperatorQuestions {
  questions: OperatorQuestion[];
  total: number;
  open: number;
  /** The date the read was made, for the source stamp. */
  asOf: string;
}

/**
 * $1 locale · $2 state
 *
 * "Unanswered" is the absence of a row in deal.project_question_answer, never a
 * flag somebody has to remember to set. Ordering puts the longest-waiting
 * question first, because that is the one the promise is being broken on.
 */
const QUESTIONS_SQL = `
  SELECT q.id::text                              AS question_id,
         p.slug                                  AS project_slug,
         p.status::text                          AS project_status,
         COALESCE(t_loc.body, t_en.body, p.slug) AS project_title,
         ow.legal_name::text                     AS owner_name,
         ak.legal_name::text                     AS asker_name,
         COALESCE(ms.name_en, ak.country_code::text) AS asker_country,
         COALESCE(CASE WHEN $1::text = 'de' THEN sec.label_de END,
                  sec.label_en, ak.sector_code)  AS asker_sector,
         COALESCE(dpl.label, opl.label)          AS asker_label,
         q.body::text                            AS body,
         q.asked_at::date::text                  AS asked_on,
         (current_date - q.asked_at::date)::int   AS waiting_days,
         (SELECT count(*) FROM deal.project_question_answer a
           WHERE a.question_id = q.id)::int       AS answer_count
    FROM deal.project_question q
    JOIN proj.project p      ON p.id = q.project_id
    JOIN org.organisation ow ON ow.id = q.owner_org_id
    JOIN org.organisation ak ON ak.id = q.asker_org_id
    LEFT JOIN platform.sector sec         ON sec.code = ak.sector_code
    LEFT JOIN platform.eu_member_state ms ON ms.code  = ak.country_code
    -- The label the asker appears under on the record. Two tables can hold one:
    -- deal.deal_pseudonym (per deal, R5 as it stands since migration 0021) and
    -- org.organisation_pseudonym (the earlier per-project label, still read by
    -- the public record view for entries with no deal). Earliest first, so the
    -- label shown is the one the oldest record row carries.
    LEFT JOIN LATERAL (
      SELECT dp.label FROM deal.deal_pseudonym dp
       WHERE dp.project_id = q.project_id AND dp.org_id = q.asker_org_id
       ORDER BY dp.allocated_at, dp.label LIMIT 1) dpl ON true
    LEFT JOIN LATERAL (
      SELECT op.label FROM org.organisation_pseudonym op
       WHERE op.project_id = q.project_id AND op.org_id = q.asker_org_id
       ORDER BY op.allocated_at, op.label LIMIT 1) opl ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE ($2::text <> 'open'
          OR NOT EXISTS (SELECT 1 FROM deal.project_question_answer a
                          WHERE a.question_id = q.id))
     AND ($2::text <> 'answered'
          OR EXISTS (SELECT 1 FROM deal.project_question_answer a
                      WHERE a.question_id = q.id))
   ORDER BY (SELECT count(*) FROM deal.project_question_answer a
              WHERE a.question_id = q.id) = 0 DESC,
            q.asked_at, q.id`;

const ANSWERS_SQL = `
  SELECT a.id::text                 AS answer_id,
         a.question_id::text        AS question_id,
         a.body::text               AS body,
         a.answered_at::date::text  AS answered_on,
         o.legal_name::text         AS answered_by_name,
         (o.id = q.owner_org_id)    AS answered_by_owner
    FROM deal.project_question_answer a
    JOIN deal.project_question q ON q.id = a.question_id
    JOIN org.organisation o      ON o.id = a.answered_by_org_id
   WHERE a.question_id = ANY($1::bigint[])
   ORDER BY a.answered_at, a.id`;

const TOTALS_SQL = `
  SELECT current_date::text AS as_of,
         count(*)::int      AS total,
         count(*) FILTER (
           WHERE NOT EXISTS (SELECT 1 FROM deal.project_question_answer a
                              WHERE a.question_id = q.id))::int AS open
    FROM deal.project_question q`;

interface QuestionRow extends Record<string, unknown> {
  question_id: string;
  project_slug: string;
  project_status: string;
  project_title: string;
  owner_name: string;
  asker_name: string;
  asker_country: string;
  asker_sector: string;
  asker_label: string | null;
  body: string;
  asked_on: string;
  waiting_days: number;
  answer_count: number;
}

interface AnswerRow extends Record<string, unknown> {
  answer_id: string;
  question_id: string;
  body: string;
  answered_on: string;
  answered_by_name: string;
  answered_by_owner: boolean;
}

export async function operatorQuestionsIn(
  tx: Tx,
  locale: string,
  state: QuestionState,
): Promise<OperatorQuestions> {
  const totals = await tx.one<{ as_of: string; total: number; open: number }>(TOTALS_SQL);
  const rows = await tx.query<QuestionRow>(QUESTIONS_SQL, [locale, state]);

  const answers = rows.length === 0
    ? []
    : await tx.query<AnswerRow>(ANSWERS_SQL, [rows.map((r) => r.question_id)]);

  return {
    asOf: totals.as_of,
    total: totals.total,
    open: totals.open,
    questions: rows.map((r) => ({
      questionId: r.question_id,
      projectSlug: r.project_slug,
      projectTitle: r.project_title,
      projectStatus: r.project_status,
      ownerName: r.owner_name,
      askerName: r.asker_name,
      askerCountry: r.asker_country,
      askerSector: r.asker_sector,
      askerLabel: r.asker_label,
      body: r.body,
      askedOn: r.asked_on,
      waitingDays: r.waiting_days,
      answers: answers
        .filter((a) => a.question_id === r.question_id)
        .map((a) => ({
          answerId: a.answer_id,
          body: a.body,
          answeredOn: a.answered_on,
          answeredByName: a.answered_by_name,
          answeredByOwner: a.answered_by_owner,
        })),
    })),
  };
}

export async function loadOperatorQuestions(
  actor: Actor,
  locale: string,
  state: QuestionState,
): Promise<OperatorQuestions> {
  return readAs(actor, (tx) => operatorQuestionsIn(tx, locale, state));
}
