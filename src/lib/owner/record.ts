import type { Tx } from '@/lib/db/session';

/**
 * Every write a project owner can make, as small functions over one
 * transaction.
 *
 * THE TWO RULES THAT SHAPE ALL OF THIS
 *
 * Append-only with versions (R4). Not one function here issues an UPDATE
 * against a content table, and none could: UPDATE is revoked from
 * sylva_project_owner and blocked by an ENABLE ALWAYS trigger. Changing a
 * sentence means inserting version_no + 1; the previous version stays in the
 * table and stays visible. `nextVersion` below is the whole of that mechanism,
 * and the self-foreign-key on each table (version N references version N-1)
 * means a gap in the sequence is not representable.
 *
 * Provenance. sylva.source_ref is inserted FIRST and its id is threaded into
 * every row that carries a figure or a statement, because source_ref_id is NOT
 * NULL on all of them. There is no code path here that records a value without
 * recording where it came from - not because these functions check, but because
 * the column would refuse.
 *
 * None of these functions opens a connection or picks a role. They take a Tx
 * from withActor(), so they run as sylva_project_owner with the caller's signed
 * organisation context, and every row policy applies to them exactly as it
 * applies to anything else.
 */

/* ------------------------------------------------------------- PROVENANCE */

export type SourceKind =
  | 'document'
  | 'external_publication'
  | 'operator_statement'
  | 'project_owner_statement'
  | 'calculated_by_sylva';

export interface SourceInput {
  readonly kind: SourceKind;
  readonly label: string;
  readonly locator: string | null;
  readonly sourceUrl: string | null;
  readonly asOfDate: string;
}

/**
 * One provenance row per thing recorded. It is never reused across sections of
 * a save: two figures taken from the same document on the same day are still
 * two statements, and merging them would make a later correction to one of them
 * silently move the other.
 */
export async function insertSource(tx: Tx, src: SourceInput): Promise<string> {
  const row = await tx.one<{ id: string }>(
    `INSERT INTO sylva.source_ref (kind, label, locator, source_url, as_of_date)
     VALUES ($1::sylva.source_kind, $2, $3, $4, $5::date)
     RETURNING id`,
    [src.kind, src.label, src.locator, src.sourceUrl, src.asOfDate],
  );
  return row.id;
}

/* ----------------------------------------------------------- THE PROJECT */

export interface NewProject {
  readonly slug: string;
  readonly countryCode: string;
}

/**
 * A new project, always a draft, always owned by the actor's own organisation.
 *
 * owner_org_id is set from sylva.actor_org_id() inside the statement rather
 * than from anything the form sent. The row policy would refuse any other
 * value, so this is belt and braces - but it also means the form has no field
 * that could be tampered with, which is one fewer thing to validate.
 */
export async function createProject(tx: Tx, p: NewProject): Promise<string> {
  const row = await tx.one<{ id: string }>(
    `INSERT INTO proj.project (slug, owner_org_id, country_code, status)
     VALUES ($1, sylva.actor_org_id(), $2::sylva.country_code, 'draft')
     RETURNING id`,
    [p.slug, p.countryCode],
  );
  return row.id;
}

/**
 * Hand the project to Sylva for review.
 *
 * The transition is enforced by p_project_owner_submit: USING admits a draft or
 * a project sent back for changes, WITH CHECK admits the one target status. So
 * an attempt to publish, withdraw or archive updates zero rows rather than
 * raising - which is why this returns a boolean and the caller turns `false`
 * into a sentence.
 */
export async function submitForReview(tx: Tx, projectId: string): Promise<boolean> {
  const rows = await tx.query<{ id: string }>(
    `UPDATE proj.project SET status = 'submitted_for_review'
      WHERE id = $1
      RETURNING id`,
    [projectId],
  );
  return rows.length === 1;
}

/** The project id for a slug this organisation owns, or null. */
export async function ownProjectIdBySlug(
  tx: Tx,
  slug: string,
): Promise<{ id: string; status: string } | null> {
  return tx.maybe<{ id: string; status: string }>(
    `SELECT id, status::text AS status FROM proj.project
      WHERE slug = $1 AND owner_org_id = sylva.actor_org_id()`,
    [slug],
  );
}

/* --------------------------------------------------------------- VERSIONS */

/**
 * The next version number for one versioned row.
 *
 * Deliberately not `max(version_no) + 1` read into the application and written
 * back: the insert below computes it in the same statement, so two concurrent
 * saves collide on the primary key instead of both reading the same maximum and
 * one of them overwriting the other. Losing a save to a duplicate-key error is
 * a good outcome; losing it silently is not.
 */
function versionExpr(table: string, keys: string): string {
  return `(SELECT coalesce(max(version_no), 0) + 1 FROM ${table} WHERE ${keys})`;
}

/* ------------------------------------------------------------- PAGE TEXT */

export interface TextInput {
  readonly fieldCode: string;
  readonly locale: string;
  readonly body: string;
  readonly status: string;
}

/**
 * Record a new version of one text field, but only where it differs from the
 * version already there.
 *
 * The check is not an optimisation. Every version stays visible for ever, so a
 * save that rewrote all five fields on every visit would fill the history with
 * rows that record nothing, and the history is what a reader uses to see what
 * actually changed and when.
 *
 * Returns true where a version was written.
 */
export async function saveText(
  tx: Tx,
  projectId: string,
  t: TextInput,
  sourceRefId: string,
): Promise<boolean> {
  const current = await tx.maybe<{ body: string; status: string }>(
    `SELECT body, status::text AS status FROM proj.project_text
      WHERE project_id = $1 AND field_code = $2 AND locale = $3
      ORDER BY version_no DESC LIMIT 1`,
    [projectId, t.fieldCode, t.locale],
  );
  if (current && current.body === t.body && current.status === t.status) return false;

  await tx.query(
    `INSERT INTO proj.project_text
       (project_id, field_code, locale, version_no, body, status,
        source_locale, source_ref_id)
     VALUES ($1, $2, $3,
             ${versionExpr('proj.project_text',
               'project_id = $1 AND field_code = $2 AND locale = $3')},
             $4, $5::i18n.translation_status, 'en', $6)`,
    [projectId, t.fieldCode, t.locale, t.body, t.status, sourceRefId],
  );
  return true;
}

/* -------------------------------------------------- THE UNIT TYPE SPINE */

/**
 * Declare which scheme and unit type this project issues under.
 *
 * scheme_id is read from units.unit_type rather than taken from the form. The
 * composite foreign key would refuse a mismatched pair anyway, but deriving it
 * means the form cannot even express one, and the error a person sees is never
 * about a constraint they did not know existed.
 */
export async function declareUnitType(
  tx: Tx,
  projectId: string,
  unitTypeId: string,
  sourceRefId: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO proj.project_unit_type (project_id, unit_type_id, scheme_id, source_ref_id)
     SELECT $1, ut.id, ut.scheme_id, $3 FROM units.unit_type ut WHERE ut.id = $2`,
    [projectId, unitTypeId, sourceRefId],
  );
}

/**
 * The translation status a recorded entry's text goes in at.
 *
 * It is a parameter rather than the column default because the column default is
 * 'human_draft' and the PUBLIC project page admits only 'published' and
 * 'reviewed'. Every claim right, outcome detail and durability statement
 * recorded before this existed went in invisible: the owner's form said "Already
 * recorded" and the published page showed the raw benefit key and three dashes.
 * The forms now ask, and this is where the answer lands.
 *
 * These tables are append-only - sylva.deny_mutation() fires BEFORE UPDATE on
 * every one of them - so there is no "mark it ready" that edits a row. Marking a
 * section ready is recording it again at a ready status, which appends
 * version_no + 1 and leaves the draft on the record. That is R4, not a
 * limitation worked around.
 */
export type TextStatus = 'machine_draft' | 'human_draft' | 'reviewed' | 'published';

/* ----------------------------------------------------------- CLAIM RIGHTS */

export interface ClaimRightInput {
  readonly benefitKey: string;
  readonly locale: string;
  readonly benefitLabel: string;
  readonly whoMayClaim: string;
  readonly forWhat: string;
  /** NOT NULL and non-blank in the schema: a blank exclusions field is the
   *  failure the interviewed buyers described, so it cannot be left out. */
  readonly exclusions: string;
  /** Whether a buyer will see it. See TextStatus above. */
  readonly status: TextStatus;
}

export async function addClaimRight(
  tx: Tx,
  projectId: string,
  c: ClaimRightInput,
  sourceRefId: string,
): Promise<number> {
  const row = await tx.one<{ version_no: number }>(
    `INSERT INTO proj.claim_right (project_id, benefit_key, version_no, sort_order, source_ref_id)
     VALUES ($1, $2,
             ${versionExpr('proj.claim_right', 'project_id = $1 AND benefit_key = $2')},
             0, $3)
     RETURNING version_no`,
    [projectId, c.benefitKey, sourceRefId],
  );
  await tx.query(
    `INSERT INTO proj.claim_right_text
       (project_id, benefit_key, version_no, locale,
        benefit_label, who_may_claim, for_what, exclusions, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::i18n.translation_status)`,
    [projectId, c.benefitKey, row.version_no, c.locale,
     c.benefitLabel, c.whoMayClaim, c.forWhat, c.exclusions, c.status],
  );
  return Number(row.version_no);
}

/* --------------------------------------------------------------- OUTCOMES */

export interface OutcomeInput {
  readonly indicatorCode: string;
  readonly domain: 'water' | 'biodiversity';
  readonly measureUnit: string;
  readonly verifierOrgId: string | null;
  readonly uncertaintyNote: string | null;
  readonly locale: string;
  readonly whatIsMeasured: string;
  readonly methodNote: string | null;
  /** The baseline. proj.publication_gaps() will not pass without one. */
  readonly baselineValue: string | null;
  readonly baselineAsOf: string | null;
  /** Whether a buyer will see the detail. See TextStatus above. */
  readonly status: TextStatus;
}

export async function addOutcome(
  tx: Tx,
  projectId: string,
  o: OutcomeInput,
  sourceRefId: string,
): Promise<number> {
  const row = await tx.one<{ version_no: number }>(
    `INSERT INTO proj.outcome_indicator
       (project_id, indicator_code, version_no, domain, measure_unit,
        verifier_org_id, uncertainty_note, source_ref_id)
     VALUES ($1, $2,
             ${versionExpr('proj.outcome_indicator', 'project_id = $1 AND indicator_code = $2')},
             $3, $4, $5::uuid, $6, $7)
     RETURNING version_no`,
    [projectId, o.indicatorCode, o.domain, o.measureUnit,
     o.verifierOrgId, o.uncertaintyNote, sourceRefId],
  );
  await tx.query(
    `INSERT INTO proj.outcome_indicator_text
       (project_id, indicator_code, version_no, locale,
        what_is_measured, method_note, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::i18n.translation_status)`,
    [projectId, o.indicatorCode, row.version_no, o.locale,
     o.whatIsMeasured, o.methodNote, o.status],
  );
  if (o.baselineValue !== null && o.baselineAsOf !== null) {
    // An indicator carries no unit_type_id, so a hydrology figure can never
    // enter a unit_qty, a committed volume or an availability panel. Its unit
    // is free text describing what was measured.
    await tx.query(
      `INSERT INTO proj.indicator_value
         (project_id, indicator_code, version_no, value_kind, value_numeric,
          measure_unit, source_ref_id, as_of_date)
       VALUES ($1, $2, $3, 'baseline', $4::numeric, $5, $6, $7::date)`,
      [projectId, o.indicatorCode, row.version_no, o.baselineValue,
       o.measureUnit, sourceRefId, o.baselineAsOf],
    );
  }
  return Number(row.version_no);
}

/* ------------------------------------------------------------- DURABILITY */

export interface DurabilityInput {
  readonly commitmentKey: string;
  readonly responsibleOrgId: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly horizonYears: number | null;
  readonly locale: string;
  readonly statement: string;
  readonly landControlNote: string;
  /** Whether a buyer will see it. See TextStatus above. */
  readonly status: TextStatus;
}

export async function addDurability(
  tx: Tx,
  projectId: string,
  d: DurabilityInput,
  sourceRefId: string,
): Promise<number> {
  const row = await tx.one<{ version_no: number }>(
    `INSERT INTO proj.durability_commitment
       (project_id, commitment_key, version_no, responsible_org_id,
        starts_on, ends_on, horizon_years, source_ref_id)
     VALUES ($1, $2,
             ${versionExpr('proj.durability_commitment',
               'project_id = $1 AND commitment_key = $2')},
             $3::uuid, $4::date, $5::date, $6::int, $7)
     RETURNING version_no`,
    [projectId, d.commitmentKey, d.responsibleOrgId,
     d.startsOn, d.endsOn, d.horizonYears, sourceRefId],
  );
  await tx.query(
    `INSERT INTO proj.durability_commitment_text
       (project_id, commitment_key, version_no, locale,
        statement, land_control_note, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::i18n.translation_status)`,
    [projectId, d.commitmentKey, row.version_no, d.locale,
     d.statement, d.landControlNote, d.status],
  );
  return Number(row.version_no);
}

/* ------------------------------------------------- PARTNERS ON THE GROUND */

export interface PartyInput {
  readonly partyOrgId: string;
  readonly partyRole: string;
  readonly descriptionEn: string | null;
}

/**
 * Returns false where the party is already on the record. The table is
 * append-only, so ON CONFLICT DO NOTHING is the only safe conflict action here:
 * DO UPDATE would be refused by the trigger, which is correct.
 */
export async function addParty(
  tx: Tx,
  projectId: string,
  p: PartyInput,
  sourceRefId: string,
): Promise<boolean> {
  const rows = await tx.query<{ project_id: string }>(
    `INSERT INTO proj.project_party
       (project_id, party_org_id, party_role, description_en, source_ref_id)
     VALUES ($1, $2::uuid, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING project_id`,
    [projectId, p.partyOrgId, p.partyRole, p.descriptionEn, sourceRefId],
  );
  return rows.length === 1;
}

/* --------------------------------------------------------------- BOUNDARY */

export interface BoundaryInput {
  readonly kind: 'boundary' | 'catchment';
  /** Raw GeoJSON geometry. Parsed by PostGIS, never by this process. */
  readonly geojson: string;
  readonly sourceLicence: string;
  readonly datasetName: string | null;
  readonly asOfDate: string;
}

/**
 * A new version of the project's boundary or catchment.
 *
 * The GeoJSON is handed to PostGIS as a parameter and parsed there. Doing it
 * here would mean this process deciding what counts as a valid polygon, and the
 * CHECK constraints on the table - valid, non-empty, at most 200,000 points -
 * are the definition the database will hold it to anyway.
 *
 * ST_Multi promotes a Polygon to a MultiPolygon; a MultiPolygon passes through
 * unchanged. The column type is MultiPolygon so one project's boundary can be
 * several parcels, which is what a wetland restoration site usually is.
 */
export async function addGeometry(
  tx: Tx,
  projectId: string,
  g: BoundaryInput,
  sourceRefId: string,
): Promise<number> {
  const row = await tx.one<{ version_no: number }>(
    `INSERT INTO geo.project_geometry
       (project_id, kind, version_no, geom, dataset_name,
        source_ref_id, source_licence, as_of_date)
     VALUES ($1, $2::geo.geometry_kind,
             ${versionExpr('geo.project_geometry',
               'project_id = $1 AND kind = $2::geo.geometry_kind')},
             ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
             $4, $5, $6, $7::date)
     RETURNING version_no`,
    [projectId, g.kind, g.geojson, g.datasetName, sourceRefId,
     g.sourceLicence, g.asOfDate],
  );
  return Number(row.version_no);
}

/* ------------------------------------------------- PERIODS AND AVAILABILITY */

export interface PeriodInput {
  readonly label: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly unitTypeId: string;
  /** Decimal strings, never numbers: a float would lose the last digits of a
   *  figure that the database stores as numeric. */
  readonly expectedIssuance: string;
  readonly buffer: string;
  readonly asOfDate: string;
}

/**
 * A period and its first forecast.
 *
 * The forecast is what moves proj.period_balance, and the balance is where R1
 * lives as a CHECK. Nothing here computes availability: expected less buffer
 * less committed is a generated column on that row, so the number on the screen
 * and the number the rule is enforced against are the same number.
 *
 * recorded_by_org_id is set from sylva.actor_org_id() in the statement. The
 * insert policy requires it to equal the actor's organisation, so a forecast
 * cannot be recorded in another organisation's name.
 */
export async function addPeriodWithForecast(
  tx: Tx,
  projectId: string,
  p: PeriodInput,
  sourceRefId: string,
): Promise<string> {
  const period = await tx.one<{ id: string }>(
    `INSERT INTO proj.period (project_id, label, starts_on, ends_on, source_ref_id)
     VALUES ($1, $2, $3::date, $4::date, $5)
     RETURNING id`,
    [projectId, p.label, p.startsOn, p.endsOn, sourceRefId],
  );
  await tx.query(
    `INSERT INTO proj.period_forecast
       (project_id, unit_type_id, period_id, expected_issuance_raw, buffer_raw,
        source_ref_id, as_of_date, recorded_by_org_id)
     VALUES ($1, $2::uuid, $3, $4::numeric, $5::numeric, $6, $7::date,
             sylva.actor_org_id())`,
    [projectId, p.unitTypeId, period.id, p.expectedIssuance, p.buffer,
     sourceRefId, p.asOfDate],
  );
  return period.id;
}

/* ------------------------------------------------- THE PRIVATE QUESTION BOX */

/**
 * Answer a buyer's question.
 *
 * An answer is a new append-only row, never an edit of the question, and never
 * an edit of a previous answer: a correction is a further answer. The row
 * policy requires answered_by_org_id to be the actor's organisation AND the
 * question to belong to a project it owns, so an owner cannot answer a question
 * asked of somebody else.
 *
 * Returns the new answer's id, or null where the policy declined - which is
 * what a question id belonging to another owner produces.
 */
export async function answerQuestion(
  tx: Tx,
  questionId: string,
  body: string,
  personRef: string,
): Promise<string | null> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO deal.project_question_answer
       (question_id, answered_by_org_id, answered_by_person_ref, body)
     SELECT q.id, sylva.actor_org_id(), $2::uuid, $3
       FROM deal.project_question q
      WHERE q.id = $1::bigint
     RETURNING id::text AS id`,
    [questionId, personRef, body],
  );
  return rows[0]?.id ?? null;
}
