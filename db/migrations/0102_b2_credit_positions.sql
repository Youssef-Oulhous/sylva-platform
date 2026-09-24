-- ============================================================================
-- B2. CREDIT POSITIONS  ·  R3 and the lineage scope, both fully declarative
-- ============================================================================
CREATE TABLE credit.position_kind (
  code        text PRIMARY KEY,
  label_en    sylva.nonblank NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  UNIQUE (code, is_terminal)          -- the R3 composite-FK target
);
INSERT INTO credit.position_kind VALUES
  ('issued','Issued',false), ('allocated','Allocated',false),
  ('split','Split',false),   ('transferred','Transferred',false),
  ('retired','Retired',true),('cancelled','Cancelled',true);

-- A unit is a QUANTITY WITHIN A SCOPED POSITION, never a serial number: the
-- platform never mints or numbers units, the scheme does. Every movement -
-- allocation, split, transfer, retirement, cancellation - is a CHILD position
-- that names its parent and restates the parent's kind.
CREATE TABLE credit.credit_position (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq           bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  kind          text NOT NULL REFERENCES credit.position_kind(code),
  project_id    uuid NOT NULL,
  period_id     uuid NOT NULL,
  unit_type_id  uuid NOT NULL,
  holder_org_id uuid NOT NULL REFERENCES org.organisation(id),
  amount_raw    sylva.unit_amount NOT NULL CHECK (amount_raw > 0),
  amount_qty    sylva.unit_qty GENERATED ALWAYS AS
                  (ROW(project_id, unit_type_id, amount_raw)::sylva.unit_qty) STORED,

  parent_id     uuid REFERENCES credit.credit_position(id),
  parent_kind   text,
  -- pinned to false whenever a parent exists, so the composite FK below can only
  -- be satisfied by a NON-TERMINAL parent kind
  parent_kind_is_terminal boolean GENERATED ALWAYS AS
                  (CASE WHEN parent_kind IS NULL THEN NULL ELSE false END) STORED,

  deal_id       uuid,
  registry_record_id uuid NOT NULL,
  -- R2 switches on for EXACTLY the three movements rule 2 names - allocated,
  -- transferred, retired - and is inert for issuance, split and cancellation,
  -- because a MATCH SIMPLE composite FK is skipped when any column is NULL.
  -- Whether cancellation should also require a CONFIRMED reference is an OPEN
  -- DECISION: the note's rule 2 does not name it.
  registry_status_required credit.registry_status GENERATED ALWAYS AS
    (CASE WHEN kind IN ('allocated','transferred','retired')
          THEN 'confirmed'::credit.registry_status END) STORED,

  occurred_on   date NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_org_id  uuid NOT NULL REFERENCES org.organisation(id),
  actor_role_snapshot text NOT NULL REFERENCES org.actor_role(code),
  actor_person_ref uuid,                      -- opaque; NO FK
  actor_person_label sylva.nonblank NOT NULL,
  source_ref_id uuid NOT NULL REFERENCES sylva.source_ref(id),

  -- composite-FK anchors
  UNIQUE (id, kind),
  UNIQUE (id, amount_raw),
  UNIQUE (id, project_id, period_id, unit_type_id),

  -- ===================== R3 LIVES HERE, WITH NO TRIGGER ==================
  -- (a) the stated parent kind must be the parent's REAL kind
  CONSTRAINT r3_parent_kind_is_real
    FOREIGN KEY (parent_id, parent_kind) REFERENCES credit.credit_position (id, kind),
  -- (b) that real kind must be non-terminal, proved against the lookup table
  CONSTRAINT r3_parent_is_not_terminal
    FOREIGN KEY (parent_kind, parent_kind_is_terminal)
    REFERENCES credit.position_kind (code, is_terminal),
  -- (c) belt and braces: a CHECK still fires when foreign keys are skipped,
  --     e.g. under session_replication_role = 'replica'.
  --     ci.assert_r3_literals_match_lookup() keeps this list in step with
  --     credit.position_kind.is_terminal.
  CONSTRAINT r3_terminal_is_final
    CHECK (parent_kind IS NULL OR parent_kind NOT IN ('retired','cancelled')),

  -- a credit can never change project, period or unit type as it moves
  CONSTRAINT r7_lineage_keeps_its_scope
    FOREIGN KEY (parent_id, project_id, period_id, unit_type_id)
    REFERENCES credit.credit_position (id, project_id, period_id, unit_type_id),

  -- ===================== R2 LIVES HERE ==================================
  CONSTRAINT r2_registry_reference_is_confirmed
    FOREIGN KEY (registry_record_id, registry_status_required)
    REFERENCES credit.registry_record (id, confirmation_status)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT r2_registry_record_same_scope
    FOREIGN KEY (registry_record_id, project_id, period_id, unit_type_id)
    REFERENCES credit.registry_record (id, project_id, period_id, unit_type_id),

  CONSTRAINT root_is_an_issuance  CHECK ((parent_id IS NULL) = (kind = 'issued')),
  CONSTRAINT parent_kind_present  CHECK ((parent_id IS NULL) = (parent_kind IS NULL)),
  CONSTRAINT position_period_fk FOREIGN KEY (period_id, project_id)
    REFERENCES proj.period (id, project_id),
  CONSTRAINT position_unit_fk   FOREIGN KEY (project_id, unit_type_id)
    REFERENCES proj.project_unit_type (project_id, unit_type_id),
  CONSTRAINT position_deal_fk   FOREIGN KEY (deal_id, project_id)
    REFERENCES deal.deal (id, project_id)
);
CREATE INDEX ix_position_parent  ON credit.credit_position (parent_id);
CREATE INDEX ix_position_holder  ON credit.credit_position (holder_org_id);   -- RLS predicate
CREATE INDEX ix_position_project ON credit.credit_position (project_id);
CREATE INDEX ix_position_deal    ON credit.credit_position (deal_id);

-- Conservation: a position is consumed at most once over, across all children.
CREATE TABLE credit.position_balance (
  position_id  uuid PRIMARY KEY,
  project_id   uuid NOT NULL,
  period_id    uuid NOT NULL,
  unit_type_id uuid NOT NULL,
  amount_raw   sylva.unit_amount NOT NULL CHECK (amount_raw > 0),
  consumed_raw sylva.unit_amount NOT NULL DEFAULT 0,
  amount_qty   sylva.unit_qty GENERATED ALWAYS AS
                 (ROW(project_id, unit_type_id, amount_raw)::sylva.unit_qty) STORED,
  consumed_qty sylva.unit_qty GENERATED ALWAYS AS
                 (ROW(project_id, unit_type_id, consumed_raw)::sylva.unit_qty) STORED,
  remaining_qty sylva.unit_qty GENERATED ALWAYS AS
                 (ROW(project_id, unit_type_id, amount_raw - consumed_raw)::sylva.unit_qty) STORED,
  CONSTRAINT conservation CHECK (consumed_raw <= amount_raw),
  -- the cached amount cannot drift from the position it caches
  FOREIGN KEY (position_id, amount_raw) REFERENCES credit.credit_position (id, amount_raw),
  FOREIGN KEY (position_id, project_id, period_id, unit_type_id)
    REFERENCES credit.credit_position (id, project_id, period_id, unit_type_id)
);
ALTER TABLE credit.position_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit.position_balance FORCE  ROW LEVEL SECURITY;

CREATE FUNCTION credit.apply_position() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, credit AS
$f$
BEGIN
  INSERT INTO credit.position_balance
    (position_id, project_id, period_id, unit_type_id, amount_raw, consumed_raw)
  VALUES (NEW.id, NEW.project_id, NEW.period_id, NEW.unit_type_id, NEW.amount_raw, 0);
  IF NEW.parent_id IS NOT NULL THEN
    -- this UPDATE takes the parent's row lock, so two concurrent children
    -- serialise and the conservation CHECK is evaluated on the summed value
    UPDATE credit.position_balance
       SET consumed_raw = consumed_raw + NEW.amount_raw
     WHERE position_id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent position % has no balance row', NEW.parent_id
        USING ERRCODE = 'SY003';
    END IF;
  END IF;
  RETURN NULL;
END $f$;
CREATE TRIGGER t_apply_position AFTER INSERT ON credit.credit_position
  FOR EACH ROW EXECUTE FUNCTION credit.apply_position();
ALTER TABLE credit.credit_position ENABLE ALWAYS TRIGGER t_apply_position;

-- Readable names for query authors. security_invoker so the caller's policies
-- decide the rows. COLUMNS ARE ENUMERATED, never SELECT *: a view's columns
-- carry their own privileges, so `SELECT *` here would hand amount_raw to every
-- role that can read the view and silently undo the whole R7 column layer.
CREATE VIEW credit.v_position WITH (security_invoker = true, security_barrier = true) AS
SELECT p.id, p.seq, p.kind, p.project_id, p.period_id, p.unit_type_id,
       p.holder_org_id, p.amount_qty, p.parent_id, p.parent_kind, p.deal_id,
       p.registry_record_id, p.occurred_on, p.recorded_at,
       p.actor_org_id, p.actor_role_snapshot, p.actor_person_label, p.source_ref_id,
       b.consumed_qty, b.remaining_qty
  FROM credit.credit_position p
  JOIN credit.position_balance b ON b.position_id = p.id;

CREATE VIEW credit.v_allocation   WITH (security_invoker = true) AS
  SELECT * FROM credit.v_position WHERE kind = 'allocated';
CREATE VIEW credit.v_transfer     WITH (security_invoker = true) AS
  SELECT * FROM credit.v_position WHERE kind = 'transferred';
CREATE VIEW credit.v_retirement   WITH (security_invoker = true) AS
  SELECT * FROM credit.v_position WHERE kind = 'retired';
CREATE VIEW credit.v_cancellation WITH (security_invoker = true) AS
  SELECT * FROM credit.v_position WHERE kind = 'cancelled';
-- There is deliberately no v_total_*, no v_portfolio_* and no view anywhere that
-- returns a quantity without project_id and unit_type_id beside it.
