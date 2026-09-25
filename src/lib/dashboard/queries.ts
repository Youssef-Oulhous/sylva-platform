import { readAs, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type { BuyerSite } from '@/lib/sites/types';
import type {
  BuyerDashboard,
  BuyerDocuments,
  BuyerInterest,
  BuyerOverview,
  BuyerOrganisationRecord,
  DashboardDocument,
  DashboardOrganisation,
  DocumentGroupId,
  ExpressedInterest,
  InterestDeal,
  ProjectDocument,
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
         -- A withdrawn version is not offered for download, so it must not be
         -- counted as the current one either. The policy on
         -- doc.document_version already hides it from a buyer, an owner and an
         -- investor, but NOT from the operator or the auditor, who must still
         -- see that it existed. Without this the page showed such a row as
         -- "Current" with a download link that the serving route then 404s -
         -- see the same NOT EXISTS in src/lib/documents/queries.ts.
         AND NOT EXISTS (SELECT 1 FROM doc.document_withdrawal w
                          WHERE w.document_version_id = dv.id)
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

/* ========================================================================== *
 *  The buyer workspace, one page at a time
 * ========================================================================== *
 *
 * buyerDashboard() above reads the whole record in one transaction, which is
 * what the overview wants: it prints counts, and counts that disagreed with
 * each other would be worse than slow. The three functions below read one
 * page's worth each, so a deep link to /dashboard/interests does not go and
 * read the site register and the document library to render a table of
 * interests.
 *
 * Every one of them is the same two rules as everything above:
 *
 *   - readAs(), never a raw pool, so the statements run as the viewer's own
 *     PostgreSQL role under the signed organisation context.
 *   - scoped by sylva.actor_org_id() IN THE QUERY as well as in the policy,
 *     because these pages are headed "your organisation" and the policies on
 *     several of these tables say USING (true) for the operator and the
 *     auditor. The scope is what the page MEANS, so it is written where the
 *     page can be read.
 */

/* -- Interests, with the deal each one opened ------------------------------ */

interface DealRow extends Record<string, unknown> {
  project_id: string;
  intended_shape: string | null;
  shape_label_en: string | null;
  stage: string;
  stage_label_en: string | null;
  stage_is_terminal: boolean;
  disclosed: boolean;
  opened_on: string;
  pseudonym: string | null;
}

/**
 * The deals this organisation is the buyer of, with the pseudonym each one
 * carries on the public record.
 *
 * deal.deal_pseudonym.org_id is granted to the operator and the auditor and to
 * nobody else - it is the label -> organisation map a reader of the public
 * record must not hold (the same reasoning as migration 0075 for the
 * per-project label). So the row is NOT reached by org_id; it is reached by
 * joining through deal.deal, whose policy for a buyer reads
 * `buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id()`.
 * The WHERE below narrows that to the buyer side, because this is the buyer's
 * own workspace and an organisation that is both a buyer and a project owner
 * must not find its projects' incoming deals listed under "my interests".
 *
 * One row per deal, and the unique index ux_one_live_deal_per_buyer_project
 * means at most one of them per project is live. A project whose deal has
 * ended and been re-opened would produce two, so the caller takes the newest.
 */
const DEALS_SQL = `
  SELECT d.project_id,
         d.intended_shape,
         sh.label_en            AS shape_label_en,
         d.stage,
         st.label_en            AS stage_label_en,
         d.stage_is_terminal,
         d.disclosed,
         d.opened_at::date::text AS opened_on,
         dp.label               AS pseudonym
    FROM deal.deal d
    LEFT JOIN deal.deal_shape sh ON sh.code = d.intended_shape
    LEFT JOIN deal.deal_stage st ON st.code = d.stage
    LEFT JOIN deal.deal_pseudonym dp ON dp.deal_id = d.id
   WHERE d.buyer_org_id = sylva.actor_org_id()
   ORDER BY d.opened_at DESC`;

/**
 * Every interest this organisation has expressed, with the deal it opened.
 *
 * RULE 7. Still no volume column, and now for a second reason as well as the
 * first. The first is the one in INTERESTS_SQL: this is the one list on the
 * platform spanning several projects, so a column of figures here would be read
 * as a ranking of things that are not comparable. The second is that a deal
 * DOES carry volumes - deal.interest_volume - and it would have been the
 * obvious thing to join in here. It is deliberately not joined: a volume is
 * read one project at a time, on that project's own page, where the unit label
 * can stand beside it.
 */
export async function buyerInterests(
  actor: Actor,
  locale: string,
): Promise<BuyerInterest[]> {
  return readAs(actor, async (tx) => {
    const interestRows = await tx.query<InterestRow>(INTERESTS_SQL, [locale]);
    if (interestRows.length === 0) return [];

    const labelRows = await tx.query<{ project_id: string; label: string }>(
      LABELS_SQL, [locale],
    );
    const labels = new Map(labelRows.map((r) => [r.project_id, r.label]));

    // deal.deal is granted to the buyer, the owner, the operator and the
    // auditor, and NOT to the investor. This page is a buyer page, but a guard
    // is not a security boundary: asked inside a SAVEPOINT, a viewer who holds
    // no grant gets a table of interests with no deal column filled in, rather
    // than a 500.
    const dealRows = await ifPermitted<DealRow>(tx, 'sp_deals', DEALS_SQL);
    const deals = new Map<string, InterestDeal>();
    for (const r of dealRows) {
      // ORDER BY opened_at DESC, so the first one seen for a project is the
      // newest. A second, older deal on the same project is not overwritten in.
      if (deals.has(r.project_id)) continue;
      deals.set(r.project_id, {
        shapeCode: r.intended_shape,
        shapeLabelEn: r.shape_label_en,
        stageCode: r.stage,
        stageLabelEn: r.stage_label_en,
        stageIsTerminal: r.stage_is_terminal === true,
        disclosed: r.disclosed === true,
        openedOn: r.opened_on,
        pseudonym: r.pseudonym,
      });
    }

    return interestRows.map((r) => {
      const deal = deals.get(r.project_id) ?? null;
      return {
        publicId: r.public_id,
        entryNo: r.entry_no,
        projectId: r.project_id,
        slug: r.slug,
        projectTitle: r.project_title,
        schemeName: r.scheme_name,
        unitLabel: r.unit_label,
        expressedOn: r.expressed_on,
        dealOpen: deal !== null && !deal.stageIsTerminal,
        projectLabel: labels.get(r.project_id) ?? null,
        deal,
      };
    });
  });
}

/* -- Documents ------------------------------------------------------------- */

interface ProjectDocumentRow extends Record<string, unknown> {
  id: string;
  project_slug: string;
  project_title: string;
  kind: string;
  kind_label: string;
  visibility: string;
  version_no: number | null;
  uploaded_on: string | null;
  media_type: string | null;
  byte_size: string | null;
}

/**
 * The documents of the projects this organisation has expressed interest in.
 *
 * THERE IS NO VISIBILITY TEST IN THIS QUERY, and there must never be one. The
 * six visibility classes are row-level policies on doc.document and
 * doc.document_version (migrations 0017 and 0056). This statement asks for the
 * documents of a set of projects; the policies decide which of them come back,
 * so an approved buyer is shown the public documents and the vetted-buyer
 * documents, an unapproved one is shown the public documents alone, and neither
 * outcome is a decision this file makes. The class is selected so the page can
 * PRINT the footing each file is offered on - printed, never branched on.
 *
 * The project set is the interests this organisation expressed, scoped by
 * sylva.actor_org_id() for the usual reason: record.entry is world-readable on
 * this platform, so without that line an operator opening this page would be
 * offered the documents of every project anybody has ever been interested in,
 * under a heading saying they were the projects it had expressed interest in.
 */
const PROJECT_DOCUMENTS_SQL = `
  SELECT d.id,
         p.slug                          AS project_slug,
         COALESCE(t_loc.body, t_en.body) AS project_title,
         d.kind,
         dk.label_en                     AS kind_label,
         d.visibility::text              AS visibility,
         v.version_no,
         v.uploaded_at::date::text       AS uploaded_on,
         v.media_type,
         v.byte_size::text               AS byte_size
    FROM doc.document d
    JOIN doc.document_kind dk ON dk.code = d.kind
    JOIN proj.project p ON p.id = d.project_id
    LEFT JOIN LATERAL (
      SELECT dv.version_no, dv.uploaded_at, dv.media_type, dv.byte_size
        FROM doc.document_version dv
       WHERE dv.document_id = d.id
         AND NOT EXISTS (SELECT 1 FROM doc.document_withdrawal w
                          WHERE w.document_version_id = dv.id)
       ORDER BY dv.version_no DESC LIMIT 1) v ON true
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
   WHERE d.scope = 'project'
     AND d.project_id IN (
       SELECT e.project_id
         FROM record.entry e
        WHERE e.entry_type = 'interest_expressed'
          AND e.actor_org_id = sylva.actor_org_id())
   ORDER BY COALESCE(t_loc.body, t_en.body), dk.label_en`;

/** Both halves of the Documents page, in one transaction. */
export async function buyerDocuments(
  actor: Actor,
  locale: string,
): Promise<BuyerDocuments> {
  return readAs(actor, async (tx) => {
    const ownRows = await tx.query<DocumentRow>(DOCUMENTS_SQL, [locale]);
    const own: DashboardDocument[] = ownRows.map((r) => ({
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

    const projectRows = await tx.query<ProjectDocumentRow>(
      PROJECT_DOCUMENTS_SQL, [locale],
    );
    const projects: ProjectDocument[] = projectRows.map((r) => ({
      id: r.id,
      projectSlug: r.project_slug,
      projectTitle: r.project_title,
      kind: r.kind,
      kindLabel: r.kind_label,
      visibility: r.visibility,
      versionNo: r.version_no,
      uploadedOn: r.uploaded_on,
      mediaType: r.media_type,
      // bigint arrives as text; Number is exact to 2^53 and a document is not.
      byteSize: r.byte_size === null ? null : Number(r.byte_size),
      available: r.version_no !== null,
    }));

    return { own, projects };
  });
}

/* -- The organisation record ----------------------------------------------- */

/**
 * The organisation's own row, its vetting chain and its public labels.
 *
 * org.own_organisation() is the only way a buyer may read its own row: no
 * public-facing role holds a column grant on org.organisation.legal_name,
 * registration_number or registered_address, and the SECURITY DEFINER function
 * is scoped to sylva.actor_org_id(), so it can only ever answer for the caller.
 * See db/migrations/0080.
 */
export async function buyerOrganisation(
  actor: Actor,
  locale: string,
): Promise<BuyerOrganisationRecord> {
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

    // An account with no organisation context should not reach this page, but a
    // guard is not a security boundary: it gets the empty record and a sentence
    // rather than three failing statements.
    if (organisation === null) {
      return { organisation: null, vetting: [], publicLabels: [] };
    }

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

    const labelRows = await tx.query<{
      project_id: string; label: string; allocated_on: string; project_title: string;
    }>(LABELS_SQL, [locale]);
    const publicLabels: PublicLabel[] = labelRows.map((r) => ({
      projectId: r.project_id,
      projectTitle: r.project_title,
      label: r.label,
      allocatedOn: r.allocated_on,
    }));

    return { organisation, vetting, publicLabels };
  });
}

/* -- The overview ---------------------------------------------------------- */

/**
 * Four counts, a status, and whether anything is waiting. One transaction.
 *
 * COUNTS RATHER THAN ROWS. The overview used to be the whole buyer area and
 * read the whole record; now it prints four integers, so it asks for four
 * integers. Each one is a count of ROWS on this organisation's own record -
 * Rule 7 is not so much obeyed here as inapplicable, and the page says so
 * under the figures rather than leaving a reader to assume it.
 *
 * DEALS: the count is of deals that have MOVED. A deal row is created when the
 * buyer expresses interest - deal.p_deal_open grants that INSERT to
 * sylva_buyer - so a deal sitting at stage `interest_expressed` is not news and
 * telling a buyer that "a project owner has opened a deal room with you" on the
 * strength of it would be untrue. What is news is a deal that has reached a
 * later stage and not ended, which is what this counts.
 *
 * Two of these statements are asked inside a SAVEPOINT: geo.buyer_site is not
 * granted to an investor or a project owner, and deal.deal is not granted to an
 * investor. A missing grant renders as "not visible to you" - the flags say
 * which - never as a zero.
 */
export async function buyerOverview(
  actor: Actor,
  locale: string,
): Promise<BuyerOverview> {
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

    if (organisation === null) {
      return {
        organisation: null, vetting: null, interests: 0, publicLabels: 0,
        sites: 0, sitesVisible: false, documents: 0,
        dealsAdvanced: 0, dealsVisible: false,
      };
    }

    // The decision governing the BUYER role. An organisation may hold more than
    // one submission - one as a buyer, one as a project owner - and they can
    // differ, so the buyer's is the one this area reports on.
    const vettingRows = await tx.query<VettingRow>(VETTING_SQL);
    const chosen =
      vettingRows.find((r) => r.role_code === 'buyer') ?? vettingRows[0] ?? null;
    const vetting: VettingRecord | null = chosen
      ? {
          roleCode: chosen.role_code,
          state: vettingState(chosen),
          submittedOn: chosen.submitted_on,
          decidedOn: chosen.decided_on,
          decision: chosen.decision,
          reason: chosen.reason,
          questionnaireVersion: chosen.questionnaire_version,
          approvedNow: chosen.approved_now,
        }
      : null;

    const n = (row: { c: string } | null) => (row === null ? 0 : Number(row.c));

    const interests = n(await tx.maybe<{ c: string }>(`
      SELECT count(*)::text AS c
        FROM record.entry e
       WHERE e.entry_type = 'interest_expressed'
         AND e.actor_org_id = sylva.actor_org_id()`));

    const publicLabels = n(await tx.maybe<{ c: string }>(
      'SELECT count(*)::text AS c FROM org.own_public_labels()'));

    // Its own documents plus the documents of the projects it has expressed
    // interest in - the same two sets the Documents page lists, so the figure
    // on the overview and the rows on that page cannot disagree. UNION ALL over
    // the ids rather than two counts added together: a document that is both is
    // impossible (one is scope 'project', the other never is) and a count is
    // cheaper to read than two.
    const documents = n(await tx.maybe<{ c: string }>(`
      SELECT count(*)::text AS c FROM (
        SELECT d.id
          FROM doc.document d
         WHERE d.scope IN ('organisation', 'deal')
           AND (d.org_id = sylva.actor_org_id()
                OR d.deal_buyer_org_id = sylva.actor_org_id()
                OR d.deal_owner_org_id = sylva.actor_org_id())
        UNION ALL
        SELECT d.id
          FROM doc.document d
         WHERE d.scope = 'project'
           AND d.project_id IN (
             SELECT e.project_id
               FROM record.entry e
              WHERE e.entry_type = 'interest_expressed'
                AND e.actor_org_id = sylva.actor_org_id())
      ) reachable`));

    const siteRows = await ifPermitted<{ c: string }>(tx, 'sp_sites', `
      SELECT count(*)::text AS c
        FROM geo.buyer_site s
       WHERE s.org_id = sylva.actor_org_id()`);
    const sitesVisible = siteRows.length > 0;
    const sites = sitesVisible ? Number(siteRows[0]!.c) : 0;

    const dealRows = await ifPermitted<{ c: string }>(tx, 'sp_deals', `
      SELECT count(*)::text AS c
        FROM deal.deal d
       WHERE d.buyer_org_id = sylva.actor_org_id()
         AND d.stage <> 'interest_expressed'
         AND NOT d.stage_is_terminal`);
    const dealsVisible = dealRows.length > 0;
    const dealsAdvanced = dealsVisible ? Number(dealRows[0]!.c) : 0;

    return {
      organisation, vetting, interests, publicLabels,
      sites, sitesVisible, documents, dealsAdvanced, dealsVisible,
    };
  });
}
