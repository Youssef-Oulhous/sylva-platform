import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';

/**
 * Every organisation, what it may do, and how that was decided.
 *
 * The vetting queue answers "what is waiting". This answers the other question
 * an operator has to answer several times a week: what is the state of this
 * organisation, and where did that state come from. Those are two columns side
 * by side on purpose.
 *
 * AN APPROVAL IS NEVER SET. `org.org_role_approval` is a cache maintained by
 * the SECURITY DEFINER trigger on `org.vetting_decision`, and
 * `ci.assert_approval_is_derived()` fails the build if any application role
 * gains a privilege on it. So an approval with no decision behind it, or a
 * decision that has not produced the approval it should have, is a fault - and
 * putting the two next to each other is the only way anybody would notice.
 *
 * R6 HANGS OFF THIS TABLE. No deal can be created for an organisation with no
 * approval, and the refusal is a trigger rather than a screen. An organisation
 * with an empty approval cell is one the database will refuse a deal to today.
 *
 * PEOPLE ARE COUNTED, NOT LISTED, and the count does not come from the table
 * that holds personal data. `identity.user_account` is readable by this role,
 * but the count below reads `identity.person_label`, which holds a
 * non-personal label per person and the organisation it belongs to. There is no
 * purpose on this page that needs a name, so no name is fetched.
 */

/* --------------------------------------------------------------- the shapes */

export interface OrgApproval {
  roleCode: string;
  status: string;
  updatedOn: string;
}

export interface OrgDecision {
  decisionId: string;
  roleCode: string;
  decision: string;
  reason: string | null;
  decidedOn: string;
  decidedByName: string;
  /** Whether this decision is the one the current approval was read from. */
  isCurrent: boolean;
}

export interface OperatorOrganisation {
  orgId: string;
  legalName: string;
  registrationNumber: string | null;
  countryCode: string;
  countryName: string;
  sectorLabel: string;
  sizeBandLabel: string;
  approvals: OrgApproval[];
  decisions: OrgDecision[];
  applications: number;
  /** The open application, if any, so the row can link straight to the queue. */
  openSubmissionId: string | null;
  people: number;
}

export interface OperatorOrganisations {
  organisations: OperatorOrganisation[];
  asOf: string;
}

/** One resolved pseudonym. Never a list of every label the platform holds. */
export interface ResolvedPseudonym {
  scope: 'deal' | 'project';
  label: string;
  projectSlug: string;
  projectTitle: string;
  legalName: string;
  countryName: string;
  allocatedOn: string;
  /** Only meaningful for a deal-scoped label: is the deal flagged for disclosure. */
  disclosed: boolean | null;
}

/* ----------------------------------------------------------------- the SQL */

const ORGS_SQL = `
  SELECT o.id::text                            AS org_id,
         o.legal_name::text                    AS legal_name,
         o.registration_number,
         o.country_code::text                  AS country_code,
         COALESCE(ms.name_en, o.country_code::text) AS country_name,
         COALESCE(CASE WHEN $1::text = 'de' THEN sec.label_de END,
                  sec.label_en, o.sector_code) AS sector_label,
         COALESCE(CASE WHEN $1::text = 'de' THEN sz.label_de END,
                  sz.label_en, o.size_band_code) AS size_band_label,
         (SELECT count(*) FROM org.vetting_submission s
           WHERE s.org_id = o.id)::int         AS applications,
         -- The head of a chain with no decision recorded against it: the one
         -- row on this page that is somebody waiting rather than a fact.
         (SELECT s.id::text FROM org.vetting_submission s
           LEFT JOIN org.org_role_approval a
                  ON a.org_id = s.org_id AND a.role_code = s.role_code
          WHERE s.org_id = o.id
            AND a.status IS NULL
            AND NOT EXISTS (SELECT 1 FROM org.vetting_submission n
                             WHERE n.supersedes_id = s.id)
          ORDER BY s.submitted_at LIMIT 1)     AS open_submission_id,
         -- identity.person_label, not identity.user_account: a non-personal
         -- label per person, which is all a count needs.
         (SELECT count(*) FROM identity.person_label pl
           WHERE pl.org_id = o.id)::int        AS people
    FROM org.organisation o
    LEFT JOIN platform.sector sec          ON sec.code = o.sector_code
    LEFT JOIN platform.size_band sz        ON sz.code  = o.size_band_code
    LEFT JOIN platform.eu_member_state ms  ON ms.code  = o.country_code
   ORDER BY o.legal_name`;

const APPROVALS_SQL = `
  SELECT a.org_id::text          AS org_id,
         a.role_code,
         a.status,
         a.last_decision_id::text AS last_decision_id,
         a.updated_at::date::text AS updated_on
    FROM org.org_role_approval a
   ORDER BY a.role_code`;

const DECISIONS_SQL = `
  SELECT d.id::text                  AS decision_id,
         d.org_id::text              AS org_id,
         d.role_code,
         d.decision::text            AS decision,
         d.reason,
         d.decided_at::date::text    AS decided_on,
         b.legal_name::text          AS decided_by_name
    FROM org.vetting_decision d
    JOIN org.organisation b ON b.id = d.decided_by_org_id
   ORDER BY d.decided_at, d.id`;

/**
 * One pseudonym, by label.
 *
 * Two tables hold one: `deal.deal_pseudonym` (one label per deal, R5 as it
 * stands since migration 0021) and `org.organisation_pseudonym` (the earlier
 * per-project label, still referenced by the public record view for entries
 * that have no deal). Both are asked, because a label an operator is reading off
 * a record could be either, and answering "no such label" for the other one
 * would be wrong.
 *
 * `lower(label)` on both sides: the labels are generated as "Buyer 003", and an
 * operator typing "buyer 003" has asked the same question.
 */
const RESOLVE_SQL = `
  SELECT 'deal'::text          AS scope,
         dp.label              AS label,
         p.slug                AS project_slug,
         COALESCE(
           (SELECT x.body FROM proj.project_text x
             WHERE x.project_id = p.id AND x.field_code = 'title'
               AND x.locale = $1::text
             ORDER BY x.version_no DESC LIMIT 1),
           (SELECT x.body FROM proj.project_text x
             WHERE x.project_id = p.id AND x.field_code = 'title'
               AND x.locale = 'en'
             ORDER BY x.version_no DESC LIMIT 1),
           p.slug)             AS project_title,
         o.legal_name::text    AS legal_name,
         COALESCE(ms.name_en, o.country_code::text) AS country_name,
         dp.allocated_at::date::text AS allocated_on,
         d.disclosed           AS disclosed
    FROM deal.deal_pseudonym dp
    JOIN deal.deal d        ON d.id = dp.deal_id
    JOIN proj.project p     ON p.id = dp.project_id
    JOIN org.organisation o ON o.id = dp.org_id
    LEFT JOIN platform.eu_member_state ms ON ms.code = o.country_code
   WHERE lower(dp.label) = lower($2::text)
  UNION ALL
  SELECT 'project'::text,
         op.label,
         p.slug,
         COALESCE(
           (SELECT x.body FROM proj.project_text x
             WHERE x.project_id = p.id AND x.field_code = 'title'
               AND x.locale = $1::text
             ORDER BY x.version_no DESC LIMIT 1),
           (SELECT x.body FROM proj.project_text x
             WHERE x.project_id = p.id AND x.field_code = 'title'
               AND x.locale = 'en'
             ORDER BY x.version_no DESC LIMIT 1),
           p.slug),
         o.legal_name::text,
         COALESCE(ms.name_en, o.country_code::text),
         op.allocated_at::date::text,
         NULL::boolean
    FROM org.organisation_pseudonym op
    JOIN proj.project p     ON p.id = op.project_id
    JOIN org.organisation o ON o.id = op.org_id
    LEFT JOIN platform.eu_member_state ms ON ms.code = o.country_code
   WHERE lower(op.label) = lower($2::text)
   ORDER BY 1, 3`;

/* ------------------------------------------------------------- the reading */

interface OrgRow extends Record<string, unknown> {
  org_id: string;
  legal_name: string;
  registration_number: string | null;
  country_code: string;
  country_name: string;
  sector_label: string;
  size_band_label: string;
  applications: number;
  open_submission_id: string | null;
  people: number;
}

interface ApprovalRow extends Record<string, unknown> {
  org_id: string;
  role_code: string;
  status: string;
  last_decision_id: string;
  updated_on: string;
}

interface DecisionRow extends Record<string, unknown> {
  decision_id: string;
  org_id: string;
  role_code: string;
  decision: string;
  reason: string | null;
  decided_on: string;
  decided_by_name: string;
}

interface ResolveRow extends Record<string, unknown> {
  scope: string;
  label: string;
  project_slug: string;
  project_title: string;
  legal_name: string;
  country_name: string;
  allocated_on: string;
  disclosed: boolean | null;
}

export async function operatorOrganisationsIn(
  tx: Tx,
  locale: string,
): Promise<OperatorOrganisations> {
  const { as_of } = await tx.one<{ as_of: string }>('SELECT current_date::text AS as_of');
  const orgs = await tx.query<OrgRow>(ORGS_SQL, [locale]);
  const approvals = await tx.query<ApprovalRow>(APPROVALS_SQL);
  const decisions = await tx.query<DecisionRow>(DECISIONS_SQL);
  const current = new Set(approvals.map((a) => a.last_decision_id));

  return {
    asOf: as_of,
    organisations: orgs.map((o) => ({
      orgId: o.org_id,
      legalName: o.legal_name,
      registrationNumber: o.registration_number,
      countryCode: o.country_code,
      countryName: o.country_name,
      sectorLabel: o.sector_label,
      sizeBandLabel: o.size_band_label,
      applications: o.applications,
      openSubmissionId: o.open_submission_id,
      people: o.people,
      approvals: approvals
        .filter((a) => a.org_id === o.org_id)
        .map((a) => ({
          roleCode: a.role_code,
          status: a.status,
          updatedOn: a.updated_on,
        })),
      decisions: decisions
        .filter((d) => d.org_id === o.org_id)
        .map((d) => ({
          decisionId: d.decision_id,
          roleCode: d.role_code,
          decision: d.decision,
          reason: d.reason,
          decidedOn: d.decided_on,
          decidedByName: d.decided_by_name,
          isCurrent: current.has(d.decision_id),
        })),
    })),
  };
}

export async function loadOperatorOrganisations(
  actor: Actor,
  locale: string,
): Promise<OperatorOrganisations> {
  return readAs(actor, (tx) => operatorOrganisationsIn(tx, locale));
}

export async function resolvePseudonymIn(
  tx: Tx,
  locale: string,
  label: string,
): Promise<ResolvedPseudonym[]> {
  const rows = await tx.query<ResolveRow>(RESOLVE_SQL, [locale, label]);
  return rows.map((r) => ({
    scope: r.scope === 'deal' ? 'deal' : 'project',
    label: r.label,
    projectSlug: r.project_slug,
    projectTitle: r.project_title,
    legalName: r.legal_name,
    countryName: r.country_name,
    allocatedOn: r.allocated_on,
    disclosed: r.disclosed,
  }));
}

/**
 * Resolve one pseudonym to an organisation.
 *
 * One label at a time, on purpose. Reading the whole allocation table at once
 * would turn a restricted capability into a bulk export of exactly the mapping
 * rule 5 exists to keep out of sight, and the page says so.
 */
export async function resolvePseudonym(
  actor: Actor,
  locale: string,
  label: string,
): Promise<ResolvedPseudonym[]> {
  return readAs(actor, (tx) => resolvePseudonymIn(tx, locale, label));
}
