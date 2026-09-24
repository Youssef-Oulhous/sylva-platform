import { readAs, withActor, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import { qtyFromRow } from '@/lib/units/qty';
import type {
  InterestInput,
  InterestPeriod,
  InterestProject,
  OpenInterest,
  RecordedInterest,
  RequestedVolume,
  SourceRef,
} from './types';

/**
 * Express interest, against the real database.
 *
 * Every function here goes through readAs() or withActor(), so it runs as the
 * caller's PostgreSQL role with the caller's HMAC-signed organisation context.
 * Nothing in this file decides who may do what:
 *
 *   R6   deal.enforce_r6_and_publication() refuses a deal for an organisation
 *        with no 'approved' row, and refuses one against an unpublished
 *        project. We do not pre-check it to be clever; we pre-check it so the
 *        page can SAY so before the click, and we let the trigger be the
 *        authority at the click.
 *   R5   the per-deal pseudonym is allocated by an AFTER INSERT trigger
 *        (migration 0021), so it exists before any entry can reference the
 *        deal. We read it back; we never allocate it.
 *   R4   record.entry is append-only. There is no update path in this file and
 *        there is no privilege behind one.
 *   R7   every volume is selected together with its project_id and
 *        unit_type_id and wrapped in a UnitQty immediately. No function here
 *        returns a bare number.
 */

/* -------------------------------------------------------------- reading */

interface ProjectRow extends Record<string, unknown> {
  id: string; slug: string; country_code: string;
  owner_org_id: string; owner_org_name: string;
  title: string; title_is_fallback: boolean;
  scheme_name: string | null;
}

// org.v_public_party rather than org.organisation: no public-facing role holds
// SELECT on legal_name, and the view names only owners of already-public
// projects. Joining it also means an unpublished project returns no row here,
// which is the behaviour we want and is not our own filter to get wrong.
const PROJECT_SQL = `
  SELECT p.id, p.slug, p.country_code, p.owner_org_id,
         o.legal_name                    AS owner_org_name,
         COALESCE(t_loc.body, t_en.body) AS title,
         (t_loc.body IS NULL)            AS title_is_fallback,
         sc.name                         AS scheme_name
    FROM proj.project p
    JOIN org.v_public_party o ON o.id = p.owner_org_id
    JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = $2 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
    LEFT JOIN LATERAL (
      SELECT s2.name FROM proj.project_unit_type put
       JOIN units.scheme s2 ON s2.id = put.scheme_id
      WHERE put.project_id = p.id LIMIT 1) sc ON true
   WHERE p.slug = $1`;

interface AvailRow extends Record<string, unknown> {
  project_id: string; unit_type_id: string; period_id: string;
  period_label: string; starts_on: string; ends_on: string;
  unit_type_code: string; unit_metric_label: string; unit_of_measure: string;
  vintage_semantics: InterestProject['vintageSemantics'];
  remaining_amount: string;
  src_label: string; src_locator: string | null; src_as_of: string; src_kind: string;
}

// Only `remaining` is selected. The other four figures of the availability pane
// belong on the project page; an enquiry form needs the one number a buyer is
// asking against, and every figure that is not on a screen is a figure that
// cannot be misread off it.
const AVAILABILITY_SQL = `
  SELECT a.project_id, a.unit_type_id, a.period_id, a.period_label,
         a.starts_on::text AS starts_on, a.ends_on::text AS ends_on,
         a.unit_type_code, a.unit_metric_label, a.unit_of_measure,
         a.vintage_semantics,
         (a.remaining_qty).amount AS remaining_amount,
         s.label AS src_label, s.locator AS src_locator,
         s.as_of_date::text AS src_as_of, s.kind::text AS src_kind
    FROM proj.v_period_availability a
    JOIN sylva.source_ref s ON s.id = a.forecast_source_ref_id
   WHERE a.project_id = $1
   ORDER BY a.starts_on`;

function toSource(r: {
  src_label: string; src_locator: string | null; src_as_of: string; src_kind: string;
}): SourceRef {
  return {
    label: r.src_label,
    locator: r.src_locator,
    asOfDate: r.src_as_of,
    kind: r.src_kind,
  };
}

/**
 * The statement-level half of every function in this file is exported beside
 * the transaction-level one.
 *
 * That is not indirection for its own sake: it lets a test run the real
 * statements, as the real role, through the real triggers and policies, inside
 * ONE transaction it then rolls back - so the append-only record does not fill
 * up with test deals that R4 makes it impossible to delete again. The
 * application always uses the wrappers.
 */
export async function loadInterestProjectTx(
  tx: Tx,
  slug: string,
  locale: string,
): Promise<InterestProject | null> {
  const p = await tx.maybe<ProjectRow>(PROJECT_SQL, [slug, locale]);
  if (!p) return null;

  const avail = await tx.query<AvailRow>(AVAILABILITY_SQL, [p.id]);
  if (avail.length === 0) return null;

  const periods: InterestPeriod[] = avail.map((a) => ({
    periodId: a.period_id,
    label: a.period_label,
    startsOn: a.starts_on,
    endsOn: a.ends_on,
    // project_id and unit_type_id travel with the number, always, from the row
    // that produced it.
    remaining: qtyFromRow({
      project_id: a.project_id,
      unit_type_id: a.unit_type_id,
      amount: a.remaining_amount,
    }),
    source: toSource(a),
  }));

  const first = avail[0]!;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    titleIsFallback: p.title_is_fallback,
    countryCode: p.country_code,
    ownerOrgId: p.owner_org_id,
    ownerOrgName: p.owner_org_name,
    schemeName: p.scheme_name ?? '',
    unitTypeId: first.unit_type_id,
    unitTypeCode: first.unit_type_code,
    unitMetricLabel: first.unit_metric_label,
    unitOfMeasure: first.unit_of_measure,
    vintageSemantics: first.vintage_semantics,
    periods,
  };
}

/**
 * The project this enquiry is about, or null.
 *
 * null covers three different situations on purpose - no such slug, a project
 * that is not published, and a published project with no effective forecast -
 * because the page's answer to all three is the same 404. Distinguishing them
 * on screen would tell a stranger which slugs exist.
 */
export async function getInterestProject(
  actor: Actor,
  slug: string,
  locale: string,
): Promise<InterestProject | null> {
  return readAs(actor, (tx) => loadInterestProjectTx(tx, slug, locale));
}

interface OpenDealRow extends Record<string, unknown> {
  id: string; stage: string; opened_at: string;
  pseudonym: string | null; record_public_id: string | null;
}

// NOT stage_is_terminal is the same predicate as the partial unique index, so
// what this returns and what the database will refuse are the same question
// asked twice, never two rules that can drift.
const OPEN_DEAL_SQL = `
  SELECT d.id, d.stage, d.opened_at::text AS opened_at,
         ps.label AS pseudonym,
         (SELECT e.public_id::text FROM record.entry e
           WHERE e.deal_id = d.id AND e.entry_type = 'interest_expressed'
           ORDER BY e.entry_no LIMIT 1) AS record_public_id
    FROM deal.deal d
    LEFT JOIN deal.deal_pseudonym ps ON ps.deal_id = d.id
   WHERE d.project_id = $1
     AND d.buyer_org_id = sylva.actor_org_id()
     AND NOT d.stage_is_terminal
   ORDER BY d.opened_at DESC
   LIMIT 1`;

export async function findOpenInterestTx(
  tx: Tx,
  projectId: string,
): Promise<OpenInterest | null> {
  const row = await tx.maybe<OpenDealRow>(OPEN_DEAL_SQL, [projectId]);
  if (!row) return null;
  return {
    dealId: row.id,
    stage: row.stage,
    openedAt: row.opened_at,
    pseudonym: row.pseudonym,
    recordPublicId: row.record_public_id,
  };
}

/** The live deal this buyer already has on this project, if there is one. */
export async function findOpenInterest(
  actor: Actor,
  projectId: string,
): Promise<OpenInterest | null> {
  return readAs(actor, (tx) => findOpenInterestTx(tx, projectId));
}

/* -------------------------------------------------------------- writing */

const INSERT_DEAL_SQL = `
  INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id, intended_shape)
  VALUES ($1::uuid, $2::uuid, sylva.actor_org_id(), $3)
  RETURNING id`;

const INSERT_DISCLOSURE_SQL = `
  INSERT INTO deal.deal_disclosure_event
    (deal_id, project_id, buyer_org_id, owner_org_id, disclosed,
     decided_by_org_id, decided_by_person_ref)
  VALUES ($1::uuid, $2::uuid, sylva.actor_org_id(), $3::uuid, $4,
          sylva.actor_org_id(), sylva.actor_person_ref())`;

const INSERT_VOLUMES_SQL = `
  INSERT INTO deal.interest_volume
    (deal_id, project_id, buyer_org_id, owner_org_id, unit_type_id, period_id,
     requested_raw)
  SELECT $1::uuid, $2::uuid, sylva.actor_org_id(), $3::uuid, $4::uuid,
         v.period_id, v.amount
    FROM unnest($5::uuid[], $6::numeric[]) AS v(period_id, amount)`;

const INSERT_QUESTION_SQL = `
  INSERT INTO deal.project_question
    (project_id, owner_org_id, asker_org_id, asker_person_ref, body)
  VALUES ($1::uuid, $2::uuid, sylva.actor_org_id(), sylva.actor_person_ref(), $3)`;

// actor_person_label is the NON-PERSONAL label the record is written under, so
// the entry still renders after the person behind it is erased (D3). It comes
// from identity.actor_record_label(), a SECURITY DEFINER function that answers
// about the caller and only the caller - no application role may read the
// identity schema.
const INSERT_ENTRY_SQL = `
  INSERT INTO record.entry
    (entry_type, project_id, deal_id, deal_buyer_org_id, deal_owner_org_id,
     subject_schema, subject_table, subject_id,
     actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label)
  VALUES ('interest_expressed', $1::uuid, $2::uuid, sylva.actor_org_id(), $3::uuid,
          'deal', 'deal', $2::text,
          sylva.actor_org_id(), 'buyer', sylva.actor_person_ref(),
          identity.actor_record_label())
  RETURNING public_id::text AS public_id`;

/**
 * Express interest. ONE transaction, five statements, no compensation logic.
 *
 * withActor() wraps the whole callback in BEGIN/COMMIT, so if the R6 trigger
 * refuses the first statement, or the unique index refuses a second live deal,
 * nothing at all is written: no orphan pseudonym, no record entry about a deal
 * that does not exist, no half-sent enquiry. That is the reason this is a
 * single function and not four server actions.
 *
 * Order is load-bearing in one place. The disclosure event is written BEFORE
 * the record entry, because record.v_public_entry resolves disclosure as at
 * each entry's own timestamp (`decided_at <= occurred_at`). Written the other
 * way round, a buyer that asked to be named would appear pseudonymously on the
 * very entry it asked to be named on.
 *
 * Throws. The caller maps the SQLSTATE to a sentence - see ./errors.ts.
 */
export async function recordInterest(
  actor: Actor,
  input: InterestInput,
): Promise<{ dealId: string; publicId: string }> {
  return withActor(actor, (tx) => recordInterestTx(tx, input));
}

/** The five statements. See recordInterest() above for the reasoning. */
export async function recordInterestTx(
  tx: Tx,
  input: InterestInput,
): Promise<{ dealId: string; publicId: string }> {
  {
    const deal = await tx.one<{ id: string }>(INSERT_DEAL_SQL, [
      input.projectId,
      input.ownerOrgId,
      input.dealShape === 'undecided' ? null : input.dealShape,
    ]);

    // Recorded either way. "Naming is the buyer's choice, deal by deal" - a
    // choice that is only recorded when the answer is yes is not a choice on
    // the record, it is a default with an exception.
    await tx.query(INSERT_DISCLOSURE_SQL, [
      deal.id, input.projectId, input.ownerOrgId, input.disclose,
    ]);

    if (input.volumes.length > 0) {
      await tx.query(INSERT_VOLUMES_SQL, [
        deal.id,
        input.projectId,
        input.ownerOrgId,
        input.unitTypeId,
        input.volumes.map((v) => v.periodId),
        // Each amount goes in beside its own period_id, in one statement, so
        // two lines cannot be transposed by a loop.
        input.volumes.map((v) => String(v.amount)),
      ]);
    }

    if (input.message) {
      await tx.query(INSERT_QUESTION_SQL, [
        input.projectId, input.ownerOrgId, input.message,
      ]);
    }

    const entry = await tx.one<{ public_id: string }>(INSERT_ENTRY_SQL, [
      input.projectId, deal.id, input.ownerOrgId,
    ]);

    return { dealId: deal.id, publicId: entry.public_id };
  }
}

/* --------------------------------------------------------- reading back */

interface RecordedRow extends Record<string, unknown> {
  public_id: string; entry_type: string; occurred_at: string;
  deal_id: string; deal_stage: string; intended_shape: string | null;
  disclosed: boolean; pseudonym: string | null;
  project_id: string; project_slug: string; project_title: string;
  owner_org_name: string; own_org_name: string | null;
  has_message: boolean;
}

const RECORDED_SQL = `
  SELECT e.public_id::text AS public_id,
         e.entry_type,
         e.occurred_at::text AS occurred_at,
         d.id::text          AS deal_id,
         d.stage             AS deal_stage,
         d.intended_shape,
         d.disclosed,
         ps.label            AS pseudonym,
         p.id::text          AS project_id,
         p.slug              AS project_slug,
         COALESCE(t_loc.body, t_en.body) AS project_title,
         o.legal_name        AS owner_org_name,
         -- the caller's OWN organisation; see db/migrations/0066
         org.actor_organisation_name()   AS own_org_name,
         EXISTS (SELECT 1 FROM deal.project_question q
                  WHERE q.project_id = p.id
                    AND q.asker_org_id = d.buyer_org_id
                    AND q.asked_at >= d.opened_at) AS has_message
    FROM record.entry e
    JOIN deal.deal d ON d.id = e.deal_id
    JOIN proj.project p ON p.id = e.project_id
    JOIN org.v_public_party o ON o.id = d.owner_org_id
    LEFT JOIN deal.deal_pseudonym ps ON ps.deal_id = d.id
    JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = 'en' AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_en ON true
    LEFT JOIN LATERAL (
      SELECT body FROM proj.project_text x
       WHERE x.project_id = p.id AND x.field_code = 'title'
         AND x.locale = $2 AND x.status IN ('published','reviewed')
       ORDER BY x.version_no DESC LIMIT 1) t_loc ON true
   WHERE e.public_id = $1::uuid`;

interface VolumeRow extends Record<string, unknown> {
  period_id: string; period_label: string;
  project_id: string; unit_type_id: string; amount: string;
  source_label: string; as_of_date: string;
  unit_metric_label: string; unit_of_measure: string;
}

// (requested_qty).amount reaches past the composite, which is the one escape
// hatch R7 cannot close. It is safe HERE and only here: the project_id and
// unit_type_id from the same composite are selected beside it and the row is
// wrapped in a UnitQty on the next line, so the bare number never travels.
const VOLUMES_SQL = `
  SELECT iv.period_id::text  AS period_id,
         pr.label            AS period_label,
         (iv.requested_qty).project_id::text   AS project_id,
         (iv.requested_qty).unit_type_id::text AS unit_type_id,
         (iv.requested_qty).amount             AS amount,
         iv.source_label,
         iv.as_of_date::text AS as_of_date,
         ut.metric_label_en  AS unit_metric_label,
         ut.unit_of_measure
    FROM deal.interest_volume iv
    JOIN proj.period pr ON pr.id = iv.period_id
    JOIN units.unit_type ut ON ut.id = iv.unit_type_id
   WHERE iv.deal_id = $1::uuid
   ORDER BY pr.starts_on`;

/**
 * The confirmation, read back from what was written.
 *
 * Nothing here is carried over from the form. If the buyer asked to be named
 * and the disclosure event did not land, this screen says "pseudonymous",
 * because that is what the record says.
 *
 * Row-level security is what makes the public_id in the URL safe to use as a
 * handle: record.entry's SELECT policy returns the entry only to a party to
 * the deal, to Sylva and to the auditor. Another buyer pasting the same URL
 * gets null, and null is a 404.
 */
export async function getRecordedInterest(
  actor: Actor,
  publicId: string,
  locale: string,
): Promise<RecordedInterest | null> {
  return readAs(actor, (tx) => readRecordedInterestTx(tx, publicId, locale));
}

export async function readRecordedInterestTx(
  tx: Tx,
  publicId: string,
  locale: string,
): Promise<RecordedInterest | null> {
  {
    const r = await tx.maybe<RecordedRow>(RECORDED_SQL, [publicId, locale]);
    if (!r) return null;

    const vs = await tx.query<VolumeRow>(VOLUMES_SQL, [r.deal_id]);
    const volumes: RequestedVolume[] = vs.map((v) => ({
      periodId: v.period_id,
      periodLabel: v.period_label,
      requested: qtyFromRow({
        project_id: v.project_id,
        unit_type_id: v.unit_type_id,
        amount: v.amount,
      }),
      source: {
        label: v.source_label,
        locator: null,
        asOfDate: v.as_of_date,
        kind: 'counterparty_statement',
      },
    }));

    // The unit labels come from the volume rows, so a confirmation with no
    // volumes carries no unit label either rather than an invented one.
    const first = vs[0];
    return {
      publicId: r.public_id,
      reference: referenceFor(r.public_id, r.occurred_at),
      entryType: r.entry_type,
      occurredAt: r.occurred_at,
      dealId: r.deal_id,
      dealStage: r.deal_stage,
      projectId: r.project_id,
      projectSlug: r.project_slug,
      projectTitle: r.project_title,
      ownerOrgName: r.owner_org_name,
      organisationName: r.own_org_name,
      pseudonym: r.pseudonym,
      disclosed: r.disclosed,
      intendedShape: r.intended_shape,
      unitTypeId: first?.unit_type_id ?? '',
      unitMetricLabel: first?.unit_metric_label ?? '',
      unitOfMeasure: first?.unit_of_measure ?? '',
      volumes,
      hasMessage: r.has_message,
    };
  }
}

/**
 * The reference a buyer quotes back to us.
 *
 * Derived from the entry's public_id, which is a random uuid, rather than from
 * record.entry.entry_no. A sequential reference on a confirmation screen tells
 * every buyer how many events the platform has recorded and how far apart two
 * of their own are - a small leak, and a free one to avoid.
 */
export function referenceFor(publicId: string, occurredAt: string): string {
  const year = occurredAt.slice(0, 4);
  const tail = publicId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INT-${year}-${tail}`;
}
