import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type { BuyerSite } from '@/lib/sites/types';
import type {
  BuyerDashboard,
  DashboardDocument,
  DashboardOrganisation,
  DocumentGroupId,
  ExpressedInterest,
  PublicLabel,
  VettingRecord,
  VettingState,
} from './types';

/**
 * Everything the buyer dashboard shows, read as the viewer's own organisation.
 *
 * One readAs() transaction for the whole page, so every panel on it describes
 * the same instant.
 *
 * EVERY statement here is scoped by sylva.actor_org_id(), and that is not a
 * duplicate of the row-level policy - it is what the page MEANS. The policies
 * on geo.buyer_site, org.vetting_submission and doc.document read
 * `org_id = sylva.actor_org_id()` for a buyer, an owner and an investor, but
 * `USING (true)` for the operator and the auditor, who legitimately hold a
 * read across the platform. This page is headed "your organisation": rendered
 * unscoped it showed an operator every buyer's registered plant coordinates,
 * every organisation's vetting decision and every deal document, under panels
 * saying they were its own. The scope is therefore written here as well, in the
 * same terms the database uses - sylva.actor_org_id() is the signed,
 * unforgeable context from migration 0019 and FINDING-001, not a value this
 * application chooses - so the page cannot answer with somebody else's record
 * whoever opens it.
 *
 * SOME VIEWERS CANNOT READ SOME OF THESE TABLES AT ALL. An investor holds no
 * grant on deal.deal and neither an investor nor a project owner holds one on
 * geo.buyer_site, and sign-in sends an investor here. Those two statements are
 * therefore run inside a SAVEPOINT and a 42501 is taken as "not visible to
 * you": the section renders empty instead of the request ending in a 500. The
 * privilege is still the database's to grant or refuse; this only decides what
 * the page does with the refusal.
 *
 * What this file deliberately does NOT read:
 *
 *   - any person's name, email or job title. Personal data lives in
 *     identity.user_account alone, and the dashboard is about an organisation.
 *   - any unit volume. See the note in ./types.ts.
 *   - any other organisation's legal name. A buyer cannot read one, and the
 *     panels that would have shown one - who decided the vetting, who lodged a
 *     deal document - say "Sylva" or "your organisation" or nothing at all.
 */

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

const ORG_SQL = `
  SELECT org_id, legal_name, registration_number, registered_address,
         country_code, sector_code, sector_label_en, sector_label_de,
         size_band_code, size_band_label_en, size_band_label_de,
         created_at::date::text AS recorded_on
    FROM org.own_organisation()`;

/**
 * R5, restated: the label is allocated PER PROJECT. Two of an organisation's
 * projects cannot be linked to each other through it, so there is no single
 * "your label" to print and this returns a list.
 *
 * Read through org.own_public_labels() rather than from the table. Migration
 * 0075 revoked org.organisation_pseudonym.org_id from every public-facing role
 * because that column IS the label -> organisation map a reader of the public
 * record must not have (FINDING-006). The definer function resolves the
 * caller's own labels and nobody else's; see db/migrations/0082.
 */
const LABELS_SQL = `
  SELECT l.project_id,
         l.label,
         l.allocated_at::date::text AS allocated_on,
         COALESCE(t_loc.body, t_en.body) AS project_title
    FROM org.own_public_labels() l
    JOIN proj.project p ON p.id = l.project_id
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
   ORDER BY l.allocated_at DESC`;

/* -- Vetting --------------------------------------------------------------- */

interface VettingRow extends Record<string, unknown> {
  role_code: string;
  submitted_on: string;
  decided_on: string | null;
  decision: string | null;
  reason: string | null;
  questionnaire_version: number;
  approved_now: boolean;
}

/**
 * The submission chain and the decision recorded against each submission.
 *
 * `approved_now` comes from sylva.is_vetted(), the trigger-maintained approval
 * cache R6 itself reads. The application does not re-derive approval from the
 * decision rows: R6 is enforced in the database and a second implementation in
 * TypeScript is a second thing that can disagree with it.
 */
const VETTING_SQL = `
  SELECT s.role_code,
         s.submitted_at::date::text   AS submitted_on,
         d.decided_at::date::text     AS decided_on,
         d.decision::text             AS decision,
         d.reason                     AS reason,
         q.version_no                 AS questionnaire_version,
         -- The org is passed explicitly rather than defaulted. The default is
         -- the caller's own organisation, which is right for a buyer reading
         -- its own row and silently wrong for any row belonging to somebody
         -- else - it would stamp the caller's approval onto another
         -- organisation's submission.
         sylva.is_vetted(s.role_code, s.org_id) AS approved_now
    FROM org.vetting_submission s
    JOIN org.questionnaire q ON q.id = s.questionnaire_id
    LEFT JOIN org.vetting_decision d ON d.submission_id = s.id
   WHERE s.org_id = sylva.actor_org_id()
   ORDER BY s.submitted_at DESC`;

function vettingState(row: VettingRow): VettingState {
  if (row.decision === null) return 'submitted';
  if (row.decision === 'approved' || row.decision === 'reinstated') return 'approved';
  return 'declined';
}

/* -- Expressed interests --------------------------------------------------- */

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
 * Every interest this organisation has expressed, newest first.
 *
 * record.entry is append-only, so a closed interest stays in the list - that is
 * R4 on screen rather than in a comment. The scheme and the unit NAME are
 * carried per row, because this is the one list on the page spanning several
 * projects and the fact worth showing about two projects side by side is that
 * their units are not the same thing.
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
       -- A project sells one unit type in this release; the ORDER BY is here
       -- so the row shown is a decided one rather than whichever the planner
       -- happened to reach first if a project ever carries two.
       ORDER BY put.unit_type_id
       LIMIT 1) u ON true
   WHERE e.entry_type = 'interest_expressed'
     AND e.actor_org_id = sylva.actor_org_id()
   ORDER BY e.occurred_at DESC, e.entry_no DESC`;

/**
 * Which of this organisation's projects already have a deal room open.
 *
 * A separate statement rather than an EXISTS inside INTERESTS_SQL, because
 * deal.deal is granted to the buyer, the project owner, the operator and the
 * auditor and NOT to the investor (migration 0016). As a subquery it took the
 * whole interests list down with a 42501 for an investor - who is sent to this
 * page on sign-in. Asked separately, an investor gets its interests and no
 * deal state, which is exactly what it may see.
 */
const DEAL_PROJECTS_SQL = `
  SELECT DISTINCT d.project_id
    FROM deal.deal d
   WHERE d.buyer_org_id = sylva.actor_org_id()`;

/* -- Documents ------------------------------------------------------------- */

interface DocumentRow extends Record<string, unknown> {
  id: string;
  kind: string;
  kind_label: string;
  scope: string;
  scope_name: string | null;
  version_no: number | null;
  uploaded_on: string | null;
  lodged_by_you: boolean;
}

/**
 * The organisation's own documents and its deal-room documents.
 *
 * Scope is limited to 'organisation' and 'deal' on purpose. A published
 * project's public documents are readable by this buyer, but they are the
 * project's documents and they live on the project page; listing them here
 * would turn "my documents" into a copy of the public library and bury the two
 * or three rows that actually belong to this organisation.
 *
 * `available` is derived from whether a version came back. A document whose
 * versions have all been withdrawn is still listed - the row is evidence that
 * it existed - but the page must not offer it for download.
 */
const DOCUMENTS_SQL = `
  SELECT d.id,
         d.kind,
         dk.label_en                     AS kind_label,
         d.scope,
         COALESCE(t_loc.body, t_en.body) AS scope_name,
         v.version_no,
         v.uploaded_at::date::text       AS uploaded_on,
         (v.uploaded_by_org_id = sylva.actor_org_id())
                                         AS lodged_by_you
    FROM doc.document d
    JOIN doc.document_kind dk ON dk.code = d.kind
    LEFT JOIN LATERAL (
      SELECT dv.version_no, dv.uploaded_at, dv.uploaded_by_org_id
        FROM doc.document_version dv
       WHERE dv.document_id = d.id
       ORDER BY dv.version_no DESC LIMIT 1) v ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = d.project_id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = d.project_id AND x.field_code = 'title'
         AND x.locale = $1 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE d.scope IN ('organisation', 'deal')
     -- The caller's OWN documents. doc.document's policy says the same thing
     -- for a buyer, an owner and an investor and says USING (true) for the
     -- operator and the auditor, so without this line a privileged viewer's
     -- "Your documents" section listed every deal document on the platform.
     AND (d.org_id = sylva.actor_org_id()
          OR d.deal_buyer_org_id = sylva.actor_org_id()
          OR d.deal_owner_org_id = sylva.actor_org_id())
   ORDER BY v.uploaded_at DESC NULLS LAST, dk.label_en`;

/**
 * Three groups, in the order the client's design puts them. A signed agreement
 * is its own group because "has anything been signed yet" is the question a
 * buyer opens this section to answer, and the answer is usually no.
 */
function groupFor(row: DocumentRow): DocumentGroupId {
  if (row.kind === 'signed_agreement') return 'signed';
  return row.scope === 'deal' ? 'deal' : 'organisation';
}

/* -- Sites ----------------------------------------------------------------- */

interface SiteRow extends Record<string, unknown> {
  id: string;
  label: string;
  country_code: string;
  latitude: number;
  longitude: number;
  registered_on: string;
  src_label: string;
  src_as_of: string;
}

const SITES_SQL = `
  SELECT s.id,
         s.label::text        AS label,
         s.country_code::text AS country_code,
         ST_Y(s.geom)::float8 AS latitude,
         ST_X(s.geom)::float8 AS longitude,
         s.registered_at::date::text AS registered_on,
         r.label::text        AS src_label,
         r.as_of_date::text   AS src_as_of
    FROM geo.buyer_site s
    JOIN sylva.source_ref r ON r.id = s.source_ref_id
   -- geo.buyer_site's policy reads org_id = sylva.actor_org_id() for a buyer
   -- and USING (true) for the operator and the auditor. This panel is headed
   -- "your sites", so it asks for the caller's own register whoever asks.
   WHERE s.org_id = sylva.actor_org_id()
   ORDER BY s.registered_at DESC, s.label`;

/* -------------------------------------------------------------------------- */

/**
 * One statement that the viewer's role may hold no privilege for.
 *
 * A refused statement aborts the whole transaction, so it is run inside a
 * SAVEPOINT and 42501 - insufficient_privilege, the code PostgreSQL raises for
 * a missing grant or a policy that matched nothing it was allowed to see - is
 * turned into an empty list. Every other error still propagates: a typo in the
 * SQL must not read as "you may not see this".
 *
 * This decides what the PAGE does with a refusal. It does not decide the
 * refusal: the grant is the database's, and no query is retried as anything
 * other than the caller.
 *
 * `name` is a savepoint identifier and cannot be a bound parameter, so it is
 * taken from the two literals below and never from anything a request carries.
 */
async function ifPermitted<R extends Record<string, unknown>>(
  tx: Tx,
  name: 'sp_sites' | 'sp_deals',
  sql: string,
  params: readonly unknown[] = [],
): Promise<R[]> {
  await tx.query(`SAVEPOINT ${name}`);
  try {
    const rows = await tx.query<R>(sql, params);
    await tx.query(`RELEASE SAVEPOINT ${name}`);
    return rows;
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== '42501') throw err;
    await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
    return [];
  }
}

export async function buyerDashboard(
  actor: Actor,
  locale: string,
): Promise<BuyerDashboard> {
  return readAs(actor, async (tx) => {
    const orgRow = await tx.maybe<OrgRow>(ORG_SQL);
    const de = locale === 'de';

    const organisation: DashboardOrganisation | null = orgRow
      ? {
          orgId: orgRow.org_id,
          legalName: orgRow.legal_name,
          registrationNumber: orgRow.registration_number,
          registeredAddress: orgRow.registered_address,
          countryCode: orgRow.country_code,
          sectorCode: orgRow.sector_code,
          sectorLabel:
            (de ? orgRow.sector_label_de : null)
            ?? orgRow.sector_label_en
            ?? orgRow.sector_code,
          sizeBandCode: orgRow.size_band_code,
          sizeBandLabel:
            (de ? orgRow.size_band_label_de : null)
            ?? orgRow.size_band_label_en
            ?? orgRow.size_band_code,
          recordedOn: orgRow.recorded_on,
        }
      : null;

    // An actor with no organisation context - which should not reach this page,
    // but a guard is not a security boundary - gets an empty dashboard rather
    // than five failing queries.
    if (organisation === null) {
      return {
        organisation: null,
        publicLabels: [],
        vetting: [],
        interests: [],
        sites: [],
        documents: [],
      };
    }

    const labelRows = await tx.query<{
      project_id: string; label: string; allocated_on: string; project_title: string;
    }>(LABELS_SQL, [locale]);
    const publicLabels: PublicLabel[] = labelRows.map((r) => ({
      projectId: r.project_id,
      projectTitle: r.project_title,
      label: r.label,
      allocatedOn: r.allocated_on,
    }));

    const vettingRows = await tx.query<VettingRow>(VETTING_SQL);
    const vetting: VettingRecord[] = vettingRows.map((r) => ({
      roleCode: r.role_code,
      state: vettingState(r),
      submittedOn: r.submitted_on,
      decidedOn: r.decided_on,
      decision: r.decision,
      reason: r.reason,
      questionnaireVersion: r.questionnaire_version,
      approvedNow: r.approved_now,
    }));

    const interestRows = await tx.query<InterestRow>(INTERESTS_SQL, [locale]);
    // An investor holds no grant on deal.deal, so this is asked separately and
    // an empty set means "no deal state visible to you" - never "no deal".
    const dealRows = await ifPermitted<{ project_id: string }>(
      tx, 'sp_deals', DEAL_PROJECTS_SQL,
    );
    const withDeal = new Set(dealRows.map((r) => r.project_id));
    const interests: ExpressedInterest[] = interestRows.map((r) => ({
      publicId: r.public_id,
      entryNo: r.entry_no,
      projectId: r.project_id,
      slug: r.slug,
      projectTitle: r.project_title,
      schemeName: r.scheme_name,
      unitLabel: r.unit_label,
      expressedOn: r.expressed_on,
      dealOpen: withDeal.has(r.project_id),
    }));

    // Only the buyer, the operator and the auditor hold SELECT on
    // geo.buyer_site. For an investor or a project owner the section is empty.
    const siteRows = await ifPermitted<SiteRow>(tx, 'sp_sites', SITES_SQL);
    const sites: BuyerSite[] = siteRows.map((r) => ({
      id: r.id,
      label: r.label,
      countryCode: r.country_code,
      latitude: r.latitude,
      longitude: r.longitude,
      registeredOn: r.registered_on,
      source: { label: r.src_label, locator: null, asOfDate: r.src_as_of },
    }));

    const docRows = await tx.query<DocumentRow>(DOCUMENTS_SQL, [locale]);
    const documents: DashboardDocument[] = docRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      kindLabel: r.kind_label,
      group: groupFor(r),
      scopeName: r.scope === 'organisation' ? null : r.scope_name,
      versionNo: r.version_no,
      uploadedOn: r.uploaded_on,
      lodgedByYou: r.lodged_by_you === true,
      available: r.version_no !== null,
    }));

    return { organisation, publicLabels, vetting, interests, sites, documents };
  });
}
