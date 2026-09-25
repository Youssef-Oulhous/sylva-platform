import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';

/**
 * The operator's landing page, as a work queue.
 *
 * /admin used not to exist. An operator signing in arrived on the vetting
 * queue, which is one of six duties, and the other five were invisible until
 * somebody remembered to look. So this module answers one question - what does
 * Sylva owe somebody else right now - and answers it in the order the duties
 * appear in the operator's navigation.
 *
 * Three rules hold everywhere below.
 *
 *   1  EVERY READ GOES THROUGH readAs(). One transaction, as sylva_operator,
 *      with a signed actor context. Nothing here filters by organisation in
 *      application code: the policies in db/migrations/0017 do that, and the
 *      operator's policies are USING (true) precisely because operating the
 *      platform means seeing all of it.
 *
 *   2  NOTHING IS A UNIT VOLUME. Every figure counts rows - applications,
 *      projects, questions, entries - so rule 7 has nothing to forbid here.
 *      The page says so rather than leaving a reader to infer it, and no field
 *      below could hold a quantity even if somebody tried.
 *
 *   3  WAITING IS COUNTED IN WHOLE DAYS, BY THE DATABASE. `current_date -
 *      submitted_at::date` is evaluated in the session's transaction, so the
 *      figure cannot drift with the renderer's clock or the reader's timezone.
 */

/* --------------------------------------------------------------- the shapes */

export interface WaitingApplication {
  submissionId: string;
  organisationName: string;
  roleCode: string;
  submittedOn: string;
  waitingDays: number;
}

export interface WaitingProject {
  slug: string;
  title: string;
  status: string;
  /** How many of the ten publication-gate items are still missing. */
  gaps: number;
}

export interface WaitingQuestion {
  questionId: string;
  projectSlug: string;
  projectTitle: string;
  askerName: string;
  askedOn: string;
  waitingDays: number;
  /** The first line of the question, so the row says what it is about. */
  excerpt: string;
}

export interface AppliedWithoutApproval {
  orgId: string;
  legalName: string;
  countryCode: string;
  applications: number;
}

export interface OperatorWorkload {
  /** The date the read was made, for the source stamp. ISO yyyy-mm-dd. */
  asOf: string;

  vettingWaiting: number;
  vettingApplications: WaitingApplication[];

  projectsTotal: number;
  projectsPublished: number;
  projectsWaiting: WaitingProject[];

  questionsTotal: number;
  questionsUnanswered: number;
  questionsWaiting: WaitingQuestion[];

  organisationsTotal: number;
  organisationsApproved: number;
  organisationsApplied: AppliedWithoutApproval[];

  recordEntries: number;
  recordNotPublic: number;
  recordCorrections: number;
  recordLatestOn: string | null;
}

/* ----------------------------------------------------------------- the SQL */

/**
 * Applications with nothing decided.
 *
 * `org.org_role_approval` is the trigger-maintained answer to "what is this
 * organisation for this role", and no row means no decision has been recorded.
 * That - not a status column on the submission - is what "waiting" means, and
 * it is the same predicate R6 reads when it refuses a deal. The head-of-chain
 * test drops applications a re-application has replaced.
 */
const WAITING_APPLICATIONS_SQL = `
  SELECT s.id::text                          AS submission_id,
         o.legal_name::text                   AS organisation_name,
         s.role_code,
         s.submitted_at::date::text           AS submitted_on,
         (current_date - s.submitted_at::date)::int AS waiting_days
    FROM org.vetting_submission s
    JOIN org.organisation o ON o.id = s.org_id
    LEFT JOIN org.org_role_approval a
           ON a.org_id = s.org_id AND a.role_code = s.role_code
   WHERE a.status IS NULL
     AND NOT EXISTS (SELECT 1 FROM org.vetting_submission n
                      WHERE n.supersedes_id = s.id)
   ORDER BY s.submitted_at, s.id`;

/**
 * Projects not on the public index, with what the gate still wants.
 *
 * `cardinality(proj.publication_gaps(p.id))` is called per project, per
 * request. It is the same function the trigger on proj.project calls when it
 * refuses a change into `published`, so the number here and the refusal there
 * cannot disagree.
 */
const WAITING_PROJECTS_SQL = `
  SELECT p.slug,
         p.status::text                            AS status,
         COALESCE(t_loc.body, t_en.body, p.slug)   AS title,
         cardinality(proj.publication_gaps(p.id))::int AS gaps
    FROM proj.project p
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE p.status <> 'published'
   ORDER BY cardinality(proj.publication_gaps(p.id)), p.slug`;

/**
 * Questions with no answer recorded.
 *
 * The concept note says a question goes to the project owner AND to us. The
 * owner has had a screen for them since /owner/questions; this is the "and to
 * us" half. An answer is a row in deal.project_question_answer, so "unanswered"
 * is the absence of one - never a flag somebody has to remember to set.
 */
const WAITING_QUESTIONS_SQL = `
  SELECT q.id::text                            AS question_id,
         p.slug                                AS project_slug,
         COALESCE(t_loc.body, t_en.body, p.slug) AS project_title,
         o.legal_name::text                    AS asker_name,
         q.asked_at::date::text                AS asked_on,
         (current_date - q.asked_at::date)::int AS waiting_days,
         left(q.body::text, 160)               AS excerpt
    FROM deal.project_question q
    JOIN proj.project p      ON p.id = q.project_id
    JOIN org.organisation o  ON o.id = q.asker_org_id
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = 'en'
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title' AND x.locale = $1::text
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE NOT EXISTS (SELECT 1 FROM deal.project_question_answer a
                      WHERE a.question_id = q.id)
   ORDER BY q.asked_at, q.id`;

/**
 * Organisations that have applied and hold no approval at all.
 *
 * Deliberately NOT "organisations with no approval": Sylva itself and the
 * auditor are registered organisations that never apply for a transacting role,
 * and listing them as outstanding work would make the card noise. An
 * organisation that has applied and holds nothing is work; one that has never
 * applied is simply registered, and is counted rather than listed.
 */
const APPLIED_WITHOUT_APPROVAL_SQL = `
  SELECT o.id::text                        AS org_id,
         o.legal_name::text                AS legal_name,
         o.country_code::text              AS country_code,
         (SELECT count(*) FROM org.vetting_submission s
           WHERE s.org_id = o.id)::int     AS applications
    FROM org.organisation o
   WHERE NOT EXISTS (SELECT 1 FROM org.org_role_approval a WHERE a.org_id = o.id)
     AND EXISTS (SELECT 1 FROM org.vetting_submission s WHERE s.org_id = o.id)
   ORDER BY o.legal_name`;

/**
 * The counts, in one statement so they are all as at the same instant.
 *
 * `not_public` is the interesting one: it counts entries record.v_public_entry
 * does not reach, which is the difference between what the platform holds and
 * what a visitor can read. It is a count of rows, not a judgement about them.
 */
const COUNTS_SQL = `
  SELECT current_date::text AS as_of,
         (SELECT count(*) FROM proj.project)::int                        AS projects_total,
         (SELECT count(*) FROM proj.project WHERE status = 'published')::int
                                                                        AS projects_published,
         (SELECT count(*) FROM deal.project_question)::int              AS questions_total,
         (SELECT count(*) FROM deal.project_question q
           WHERE NOT EXISTS (SELECT 1 FROM deal.project_question_answer a
                              WHERE a.question_id = q.id))::int         AS questions_unanswered,
         (SELECT count(*) FROM org.organisation)::int                   AS organisations_total,
         (SELECT count(DISTINCT a.org_id) FROM org.org_role_approval a)::int
                                                                        AS organisations_approved,
         (SELECT count(*) FROM record.entry)::int                       AS record_entries,
         (SELECT count(*) FROM record.entry e
           WHERE NOT EXISTS (SELECT 1 FROM record.v_public_entry v
                              WHERE v.public_id = e.public_id))::int    AS record_not_public,
         (SELECT count(*) FROM record.entry
           WHERE entry_type = 'correction')::int                        AS record_corrections,
         (SELECT max(occurred_at)::date::text FROM record.entry)         AS record_latest_on`;

/* ------------------------------------------------------------- the reading */

interface CountsRow extends Record<string, unknown> {
  as_of: string;
  projects_total: number;
  projects_published: number;
  questions_total: number;
  questions_unanswered: number;
  organisations_total: number;
  organisations_approved: number;
  record_entries: number;
  record_not_public: number;
  record_corrections: number;
  record_latest_on: string | null;
}

interface ApplicationRow extends Record<string, unknown> {
  submission_id: string;
  organisation_name: string;
  role_code: string;
  submitted_on: string;
  waiting_days: number;
}

interface ProjectRow extends Record<string, unknown> {
  slug: string;
  status: string;
  title: string;
  gaps: number;
}

interface QuestionRow extends Record<string, unknown> {
  question_id: string;
  project_slug: string;
  project_title: string;
  asker_name: string;
  asked_on: string;
  waiting_days: number;
  excerpt: string;
}

interface AppliedRow extends Record<string, unknown> {
  org_id: string;
  legal_name: string;
  country_code: string;
  applications: number;
}

/** How many rows of each list a landing page shows before deferring. */
const SHOWN = 6;

export async function operatorWorkloadIn(
  tx: Tx,
  locale: string,
): Promise<OperatorWorkload> {
  const counts = await tx.one<CountsRow>(COUNTS_SQL);
  const applications = await tx.query<ApplicationRow>(WAITING_APPLICATIONS_SQL);
  const projects = await tx.query<ProjectRow>(WAITING_PROJECTS_SQL, [locale]);
  const questions = await tx.query<QuestionRow>(WAITING_QUESTIONS_SQL, [locale]);
  const applied = await tx.query<AppliedRow>(APPLIED_WITHOUT_APPROVAL_SQL);

  return {
    asOf: counts.as_of,

    // The count is the full list's length, not the shown slice's: a card that
    // says "3 waiting" and lists six is lying in the other direction.
    vettingWaiting: applications.length,
    vettingApplications: applications.slice(0, SHOWN).map((r) => ({
      submissionId: r.submission_id,
      organisationName: r.organisation_name,
      roleCode: r.role_code,
      submittedOn: r.submitted_on,
      waitingDays: r.waiting_days,
    })),

    projectsTotal: counts.projects_total,
    projectsPublished: counts.projects_published,
    projectsWaiting: projects.slice(0, SHOWN).map((r) => ({
      slug: r.slug,
      title: r.title,
      status: r.status,
      gaps: r.gaps,
    })),

    questionsTotal: counts.questions_total,
    questionsUnanswered: counts.questions_unanswered,
    questionsWaiting: questions.slice(0, SHOWN).map((r) => ({
      questionId: r.question_id,
      projectSlug: r.project_slug,
      projectTitle: r.project_title,
      askerName: r.asker_name,
      askedOn: r.asked_on,
      waitingDays: r.waiting_days,
      excerpt: r.excerpt,
    })),

    organisationsTotal: counts.organisations_total,
    organisationsApproved: counts.organisations_approved,
    organisationsApplied: applied.slice(0, SHOWN).map((r) => ({
      orgId: r.org_id,
      legalName: r.legal_name,
      countryCode: r.country_code,
      applications: r.applications,
    })),

    recordEntries: counts.record_entries,
    recordNotPublic: counts.record_not_public,
    recordCorrections: counts.record_corrections,
    recordLatestOn: counts.record_latest_on,
  };
}

/** The whole work queue, in one transaction so the figures agree. */
export async function loadOperatorWorkload(
  actor: Actor,
  locale: string,
): Promise<OperatorWorkload> {
  return readAs(actor, (tx) => operatorWorkloadIn(tx, locale));
}
