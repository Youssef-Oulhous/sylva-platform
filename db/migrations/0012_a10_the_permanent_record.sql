-- ============================================================================
-- A10. THE PERMANENT RECORD  ·  R4, and the public face of R5
-- ============================================================================
-- The record carries NO volume column and NO price column, deliberately. Those
-- live in the domain tables under row-level security, which (a) removes a whole
-- class of leak from the public record and (b) removes a summable surface that
-- R7 would otherwise have to defend.

CREATE TABLE record.entry_type (
  code      text PRIMARY KEY,
  label_en  sylva.nonblank NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  -- true where WE are proposing an event the note's vocabulary does not name
  is_proposed_addition boolean NOT NULL DEFAULT false
);
-- Section 8's vocabulary verbatim, plus the additions we are proposing.
INSERT INTO record.entry_type (code,label_en,is_public,is_proposed_addition) VALUES
  ('listed','Listed',true,false),
  ('offered','Offered',true,false),
  ('interest_expressed','Interest expressed',true,false),
  ('terms_proposed','Terms proposed',true,false),
  ('agreed','Agreed',true,false),
  ('credits_issued','Credits issued',true,false),
  ('allocated','Allocated',true,false),
  ('retired','Retired',true,false),
  ('cancelled','Cancelled',true,false),
  -- rule 2 names "transferred" although section 8's list does not: PROPOSED
  ('transferred','Transferred',true,true),
  -- R4 requires a way to point at a wrong entry: PROPOSED as an explicit type
  ('correction','Correction',true,true),
  -- a deal must be able to end without succeeding: PROPOSED
  ('deal_withdrawn','Deal withdrawn',true,true),
  ('deal_declined','Deal declined',true,true),
  ('deal_lapsed','Deal lapsed',true,true);

CREATE TABLE record.entry (
  entry_no      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  entry_type    text NOT NULL REFERENCES record.entry_type(code),
  occurred_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_at   timestamptz NOT NULL DEFAULT clock_timestamp(),

  project_id    uuid NOT NULL REFERENCES proj.project(id),
  deal_id       uuid,
  -- denormalised counterparties: the RLS predicate is zero-hop and indexed, and
  -- the composite FK below makes a mismatch unrepresentable
  deal_buyer_org_id uuid,
  deal_owner_org_id uuid,

  -- what the entry is ABOUT. The figure itself stays in the domain table.
  subject_schema text,
  subject_table  text,
  subject_id     text,

  -- WHO ACTED. An organisation, a frozen role snapshot and a non-personal
  -- label: the record renders correctly for ever with no person named.
  actor_org_id       uuid NOT NULL REFERENCES org.organisation(id),
  actor_role_snapshot text NOT NULL REFERENCES org.actor_role(code),
  actor_person_ref   uuid,                 -- opaque handle; deliberately NO FK
  actor_person_label sylva.nonblank NOT NULL,

  source_ref_id uuid REFERENCES sylva.source_ref(id),
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- R4 correction chain
  corrects_entry_no bigint REFERENCES record.entry(entry_no),
  correction_reason text,
  correction_depth  int NOT NULL DEFAULT 0 CHECK (correction_depth BETWEEN 0 AND 10),

  CONSTRAINT deal_orgs_present CHECK (
    (deal_id IS NULL) = (deal_buyer_org_id IS NULL) AND
    (deal_id IS NULL) = (deal_owner_org_id IS NULL)),
  CONSTRAINT subject_is_whole CHECK (
    num_nulls(subject_schema, subject_table, subject_id) IN (0,3)),
  -- a correction can only point BACKWARDS on a single shared identity sequence,
  -- so self-correction and correction cycles are structurally impossible
  CONSTRAINT correction_points_backwards
    CHECK (corrects_entry_no IS NULL OR corrects_entry_no < entry_no),
  CONSTRAINT correction_is_typed
    CHECK ((entry_type = 'correction') = (corrects_entry_no IS NOT NULL)),
  CONSTRAINT correction_has_reason
    CHECK ((corrects_entry_no IS NULL) = (correction_reason IS NULL)),
  CONSTRAINT correction_reason_nonblank
    CHECK (correction_reason IS NULL OR btrim(correction_reason) <> ''),
  CONSTRAINT record_deal_fk FOREIGN KEY (deal_id, project_id, deal_buyer_org_id, deal_owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id)
);
-- an entry is corrected AT MOST ONCE
CREATE UNIQUE INDEX ux_record_corrected_once
  ON record.entry (corrects_entry_no) WHERE corrects_entry_no IS NOT NULL;
CREATE INDEX ix_record_project    ON record.entry (project_id, occurred_at DESC);
CREATE INDEX ix_record_deal       ON record.entry (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX ix_record_actor_org  ON record.entry (actor_org_id);          -- RLS predicate
CREATE INDEX ix_record_buyer_org  ON record.entry (deal_buyer_org_id);     -- RLS predicate
CREATE INDEX ix_record_owner_org  ON record.entry (deal_owner_org_id);     -- RLS predicate
CREATE INDEX ix_record_type       ON record.entry (entry_type);
-- There is NO is_deleted, is_hidden, is_visible or archived column on this table
-- and ci.assert_no_soft_delete() proves there never will be.

CREATE FUNCTION record.set_correction_depth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, record AS
$f$
DECLARE v_parent_depth int;
BEGIN
  IF NEW.corrects_entry_no IS NULL THEN NEW.correction_depth := 0; RETURN NEW; END IF;
  SELECT e.correction_depth INTO v_parent_depth
    FROM record.entry e WHERE e.entry_no = NEW.corrects_entry_no;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'correction target entry % does not exist', NEW.corrects_entry_no
      USING ERRCODE = 'SY023';
  END IF;
  NEW.correction_depth := v_parent_depth + 1;
  RETURN NEW;
END $f$;
CREATE TRIGGER t_record_correction_depth BEFORE INSERT ON record.entry
  FOR EACH ROW EXECUTE FUNCTION record.set_correction_depth();
ALTER TABLE record.entry ENABLE ALWAYS TRIGGER t_record_correction_depth;

-- ----------------------------------------------- SECURITY / ACCESS LOG
-- Deliberately separate from the business record: it answers "who looked at
-- what", which the transaction record does not and should not.
CREATE TABLE record.access_log (
  entry_no    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_org_id uuid REFERENCES org.organisation(id),
  actor_person_ref uuid,
  -- the DATABASE role the read was made under (sylva_operator, sylva_auditor,
  -- sylva_project_owner, ...). Not a business actor role, so no FK.
  actor_db_role text NOT NULL,
  action      sylva.nonblank NOT NULL,     -- login, doc_download, auditor_read, export
  object_kind text,
  object_id   text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE record.access_log IS
  'No IP address and no free text: those would put personal data outside identity.user_account. Auditor reads of identity or deal content are written here.';
