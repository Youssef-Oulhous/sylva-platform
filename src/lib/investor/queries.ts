import { readAs } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type {
  FinancingProject,
  InvestorInterest,
  InvestorOrganisation,
  InvestorStanding,
  InvestorSubmission,
} from './types';

/**
 * Everything the investor workspace reads.
 *
 * readAs() throughout, so every statement runs as sylva_investor under the
 * signed organisation context minted in src/lib/db/session.ts. There is no raw
 * pool here and no service key anywhere in this codebase; a page that wanted
 * one would be telling you it was asking for rows it may not have.
 *
 * THE VETTING GATE IS NOT IMPLEMENTED HERE, and that is the single most
 * important fact about this file. proj.project_financials has no permissive
 * policy for the public or buyer roles at all, and its policy for an investor
 * is `proj.is_publicly_visible(project_id) AND sylva.is_vetted_investor()`
 * (db/migrations/0106). So financingProjects() below carries NO approval test
 * of its own: an unapproved organisation is returned no financing row by the
 * database, and the empty list is the refusal rather than a rendering of it. A
 * second test in TypeScript would be a second thing that can disagree with the
 * policy, and the one that decides is not this one.
 *
 * investorStanding() asks sylva.is_vetted_investor() - the SAME predicate the
 * policy calls - only so the page can say WHY the list is empty. It gates
 * nothing.
 *
 * WHAT NO STATEMENT HERE SELECTS: a return, a yield, an IRR, a multiple, a
 * payback period or a discount rate. None of them is a column in
 * proj.project_financials; the concept note supplies no figure for any of them;
 * and the brief forbids unsupported financial-return calculations. A financing
 * need and a revenue stream are statements the PROJECT makes about itself, each
 * carrying the source it was read from. A return would be a claim about the
 * future, and this platform does not make one.
 *
 * RULE 7: no statement here selects a unit volume, so there is nothing for a
 * screen to add across projects. The financing list carries the scheme and the
 * unit LABEL instead, which is the fact that makes two projects incomparable.
 * A financing need is money rather than a unit volume, but it is still never
 * summed across projects on any screen in this area: two projects seeking
 * finance are two separate conversations and a platform total would be a figure
 * no source stamp could cover.
 */

/* -- Standing -------------------------------------------------------------- */

interface StandingRow extends Record<string, unknown> {
  vetted: boolean;
}

/**
 * The same function the row-level policy on proj.project_financials calls.
 * Asked rather than derived from the decision rows, so the sentence on the
 * overview and the gate on the financing table cannot disagree.
 */
const VETTED_SQL = `SELECT sylva.is_vetted_investor() AS vetted`;

interface SubmissionRow extends Record<string, unknown> {
  role_code: string;
  submitted_on: string;
  decided_on: string | null;
  decision: string | null;
  reason: string | null;
  questionnaire_version: number;
  approved_now: boolean;
}

/**
 * Every questionnaire this organisation has submitted, newest first.
 *
 * ALL roles, not only the investor one. An organisation may have applied as
 * more than one thing and the decisions can differ, so showing the investor row
 * alone would be choosing the one that suits the area the reader is in.
 *
 * org.vetting_decision is append-only (R4), so a superseded decision stays in
 * the list. `approved_now` comes from sylva.is_vetted(), the trigger-maintained
 * approval cache R6 itself reads, with the organisation passed explicitly: the
 * default is the caller's own organisation, which is right here and silently
 * wrong for any row belonging to somebody else.
 */
const SUBMISSIONS_SQL = `
  SELECT s.role_code,
         s.submitted_at::date::text AS submitted_on,
         d.decided_at::date::text   AS decided_on,
         d.decision::text           AS decision,
         d.reason                   AS reason,
         q.version_no               AS questionnaire_version,
         sylva.is_vetted(s.role_code, s.org_id) AS approved_now
    FROM org.vetting_submission s
    JOIN org.questionnaire q ON q.id = s.questionnaire_id
    LEFT JOIN org.vetting_decision d ON d.submission_id = s.id
   -- The policy on org.vetting_submission says the same thing for an investor,
   -- and USING (true) for the operator and the auditor. This page is headed
   -- "your organisation", so the scope is written where the page can be read.
   WHERE s.org_id = sylva.actor_org_id()
   ORDER BY s.submitted_at DESC, s.role_code`;

export async function investorStanding(actor: Actor): Promise<InvestorStanding> {
  return readAs(actor, async (tx) => {
    const vetted = await tx.one<StandingRow>(VETTED_SQL);
    const rows = await tx.query<SubmissionRow>(SUBMISSIONS_SQL);
    const submissions: InvestorSubmission[] = rows.map((r) => ({
      roleCode: r.role_code,
      submittedOn: r.submitted_on,
      decidedOn: r.decided_on,
      decision: r.decision,
      reason: r.reason,
      questionnaireVersion: r.questionnaire_version,
      approvedNow: r.approved_now === true,
    }));
    return { vettedInvestor: vetted.vetted === true, submissions };
  });
}

/* -- Projects seeking finance ---------------------------------------------- */

interface FinancingRow extends Record<string, unknown> {
  project_id: string;
  slug: string;
  title: string | null;
  title_en: string | null;
  country_code: string;
  status: string;
  owner_org_name: string | null;
  scheme_name: string | null;
  unit_label: string | null;
  financing_need: string | null;
  currency: string | null;
  revenue_streams_note: string | null;
  as_of_date: string;
  version_no: number;
  model_document_id: string | null;
  model_readable: boolean;
  src_label: string;
  src_locator: string | null;
  src_as_of: string;
  src_kind: string;
}

/**
 * One row per project that has filed financing information, and nothing else.
 *
 * The join is FROM proj.project_financials outwards rather than from
 * proj.project inwards, because the question this page asks is "which projects
 * are seeking finance", and that is a property of the financing row. A project
 * with no financing row is not a project seeking finance and must not appear as
 * an empty one.
 *
 * WHY THERE IS NO `is_vetted` OR `status = 'published'` CLAUSE HERE. Both are
 * already in the policy this statement runs under, and repeating them would
 * suggest the page decides them. The one scope written into the statement
 * elsewhere in this codebase - sylva.actor_org_id() - is written there because
 * those pages are headed "your organisation" and the policy says USING (true)
 * for a privileged reader. This list is not scoped to the reader's
 * organisation: it is every project seeking finance, which is exactly what the
 * policy admits, so there is nothing for the query to narrow.
 *
 * R4 ON A VERSIONED TABLE: proj.project_financials keeps every version, so the
 * lateral takes the highest version_no per project and the row says which
 * version it is. Nothing is edited and nothing is hidden.
 *
 * THE MODEL, IN THREE STATES. `model_document_id` null means no model has been
 * filed. Not null with `model_readable` false means one is filed and
 * doc.document's own policy did not return the row to this viewer - a different
 * sentence from "no model exists", and the page must not show it as one.
 */
const FINANCING_SQL = `
  SELECT f.project_id,
         p.slug,
         t_loc.body                      AS title,
         t_en.body                       AS title_en,
         p.country_code::text            AS country_code,
         p.status::text                  AS status,
         o.legal_name                    AS owner_org_name,
         u.scheme_name,
         u.unit_label,
         f.financing_need::text          AS financing_need,
         f.currency::text                AS currency,
         f.revenue_streams_note,
         f.as_of_date::text              AS as_of_date,
         f.version_no,
         f.financial_model_document_id::text AS model_document_id,
         (d.id IS NOT NULL)              AS model_readable,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.project p
    JOIN LATERAL (
      SELECT fx.* FROM proj.project_financials fx
       WHERE fx.project_id = p.id
       ORDER BY fx.version_no DESC LIMIT 1) f ON true
    JOIN sylva.source_ref s ON s.id = f.source_ref_id
    -- The project owner is named publicly on this platform; only a buyer is
    -- pseudonymous. org.v_public_party is the view that says so, and no
    -- public-facing role holds a column grant on org.organisation.legal_name.
    LEFT JOIN org.v_public_party o ON o.id = p.owner_org_id
    -- Filed but unreadable arrives as a null id from this join, not as an
    -- absent model. See the note above.
    LEFT JOIN doc.document d ON d.id = f.financial_model_document_id
    JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = $1 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN LATERAL (
      SELECT sc.name AS scheme_name,
             COALESCE(tr.metric_label, ut.metric_label_en) AS unit_label
        FROM proj.project_unit_type put
        JOIN units.unit_type ut ON ut.id = put.unit_type_id
        JOIN units.scheme sc    ON sc.id = put.scheme_id
        LEFT JOIN units.unit_type_translation tr
               ON tr.unit_type_id = ut.id AND tr.locale = $1
              AND tr.status IN ('published','reviewed')
       WHERE put.project_id = p.id
       -- A project sells one unit type in this release. The ORDER BY makes the
       -- row a decided one rather than whichever the planner reached first.
       ORDER BY put.unit_type_id
       LIMIT 1) u ON true
   -- Alphabetical, and said so on the page. Any other order would be a ranking,
   -- and nothing on this platform advises an investor which project to finance.
   ORDER BY COALESCE(t_loc.body, t_en.body)`;

export async function financingProjects(
  actor: Actor,
  locale: string,
): Promise<FinancingProject[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<FinancingRow>(FINANCING_SQL, [locale]);
    return rows.map((r) => ({
      projectId: r.project_id,
      slug: r.slug,
      title: r.title ?? r.title_en ?? r.slug,
      titleIsFallback: r.title === null,
      countryCode: r.country_code,
      status: r.status,
      ownerOrgName: r.owner_org_name ?? '',
      schemeName: r.scheme_name,
      unitLabel: r.unit_label,
      // numeric(20,2) arrives as a string from node-postgres. Number() is the
      // only conversion, and it happens once, here - not in a component.
      financingNeed: r.financing_need === null ? null : Number(r.financing_need),
      currency: r.currency,
      revenueStreamsNote: r.revenue_streams_note,
      asOfDate: r.as_of_date,
      versionNo: r.version_no,
      model:
        r.model_document_id === null
          ? null
          : { documentId: r.model_document_id, readable: r.model_readable === true },
      source: {
        label: r.src_label,
        locator: r.src_locator,
        asOfDate: r.src_as_of,
        kind: r.src_kind,
      },
    }));
  });
}

/* -- Interests ------------------------------------------------------------- */

interface InterestRow extends Record<string, unknown> {
  public_id: string;
  entry_no: string;
  project_id: string;
  slug: string;
  project_title: string;
  scheme_name: string | null;
  unit_label: string | null;
  expressed_on: string;
}

/**
 * The interest entries in the transaction record that name this organisation.
 *
 * record.entry is append-only, so a superseded entry stays in the list: that is
 * R4 on screen rather than in a comment.
 *
 * deal.deal IS NOT JOINED, and not as an oversight. sylva_investor holds no
 * grant on it at all (db/migrations/0016), so the join would abort the whole
 * transaction with a 42501 and take the page down with it. The buyer's own
 * version of this table asks for the deal state in a separate statement inside
 * a savepoint for exactly that reason. Here there is no second statement to
 * make: an investor has no deal state to be shown, and a column that was always
 * empty would read as "no deal" when the truth is "not visible to you".
 *
 * RULE 7: no volume column. This is a list spanning projects, and a column of
 * quantities read one under another is the comparison the rule forbids. The
 * unit each project issues is carried instead.
 */
const INTERESTS_SQL = `
  SELECT e.public_id,
         e.entry_no::text                AS entry_no,
         e.project_id,
         p.slug,
         COALESCE(t_loc.body, t_en.body) AS project_title,
         u.scheme_name,
         u.unit_label,
         e.occurred_at::date::text       AS expressed_on
    FROM record.entry e
    JOIN proj.project p ON p.id = e.project_id
    JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = $1 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN LATERAL (
      SELECT sc.name AS scheme_name,
             COALESCE(tr.metric_label, ut.metric_label_en) AS unit_label
        FROM proj.project_unit_type put
        JOIN units.unit_type ut ON ut.id = put.unit_type_id
        JOIN units.scheme sc    ON sc.id = put.scheme_id
        LEFT JOIN units.unit_type_translation tr
               ON tr.unit_type_id = ut.id AND tr.locale = $1
              AND tr.status IN ('published','reviewed')
       WHERE put.project_id = p.id
       ORDER BY put.unit_type_id
       LIMIT 1) u ON true
   WHERE e.entry_type = 'interest_expressed'
     -- record.entry's policy admits a party to the entry, and USING (true) for
     -- the operator and the auditor. This page is headed "my interests", so the
     -- actor scope is written here as well as in the policy.
     AND e.actor_org_id = sylva.actor_org_id()
   ORDER BY e.occurred_at DESC, e.entry_no DESC`;

export async function investorInterests(
  actor: Actor,
  locale: string,
): Promise<InvestorInterest[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<InterestRow>(INTERESTS_SQL, [locale]);
    return rows.map((r) => ({
      publicId: r.public_id,
      entryNo: r.entry_no,
      projectId: r.project_id,
      slug: r.slug,
      projectTitle: r.project_title,
      schemeName: r.scheme_name,
      unitLabel: r.unit_label,
      expressedOn: r.expressed_on,
    }));
  });
}

/* -- Organisation ---------------------------------------------------------- */

interface OrgRow extends Record<string, unknown> {
  org_id: string;
  legal_name: string;
  registration_number: string | null;
  registered_address: string | null;
  country_code: string;
  sector_code: string;
  sector_label_en: string | null;
  sector_label_de: string | null;
  size_band_code: string;
  size_band_label_en: string | null;
  size_band_label_de: string | null;
  recorded_on: string;
}

/**
 * The caller's own organisation row, and no other.
 *
 * Through org.own_organisation(), which is the ONLY way an investor may read
 * it: migration 0080 withholds a column grant on org.organisation.legal_name,
 * registration_number and registered_address from every public-facing role, so
 * there is no query this file could have written that would answer with
 * somebody else's name. The function is SECURITY DEFINER, takes no argument and
 * is scoped to sylva.actor_org_id(), so it cannot be aimed at another
 * organisation either.
 */
const ORG_SQL = `
  SELECT org_id, legal_name, registration_number, registered_address,
         country_code, sector_code, sector_label_en, sector_label_de,
         size_band_code, size_band_label_en, size_band_label_de,
         created_at::date::text AS recorded_on
    FROM org.own_organisation()`;

export async function investorOrganisation(
  actor: Actor,
  locale: string,
): Promise<InvestorOrganisation | null> {
  return readAs(actor, async (tx) => {
    const r = await tx.maybe<OrgRow>(ORG_SQL);
    if (r === null) return null;
    const de = locale === 'de';
    return {
      orgId: r.org_id,
      legalName: r.legal_name,
      registrationNumber: r.registration_number,
      registeredAddress: r.registered_address,
      countryCode: r.country_code,
      sectorCode: r.sector_code,
      // Reference data is translated by the authority that owns the codes, in
      // platform.sector and platform.size_band, not by a key per code in the
      // message catalogue.
      sectorLabel: (de ? r.sector_label_de : null) ?? r.sector_label_en ?? r.sector_code,
      sizeBandCode: r.size_band_code,
      sizeBandLabel:
        (de ? r.size_band_label_de : null) ?? r.size_band_label_en ?? r.size_band_code,
      recordedOn: r.recorded_on,
    };
  });
}
