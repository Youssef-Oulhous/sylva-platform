-- ============================================================================
-- A5. PROJECTS  ·  the root of every volume figure and the unit of listing
-- ============================================================================
CREATE TYPE proj.publication_status AS ENUM
  ('draft','submitted_for_review','changes_requested','published','withdrawn','archived');

CREATE TABLE proj.project (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  owner_org_id uuid NOT NULL REFERENCES org.organisation(id),
  country_code sylva.country_code NOT NULL,
  status       proj.publication_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'published') = (published_at IS NOT NULL)),
  -- anchors: a deal can never name an owner that is not the project's owner
  UNIQUE (id, owner_org_id)
);
CREATE INDEX ix_project_owner ON proj.project (owner_org_id);
CREATE INDEX ix_project_status ON proj.project (status);

ALTER TABLE org.project_label_counter
  ADD CONSTRAINT label_counter_project_fk FOREIGN KEY (project_id) REFERENCES proj.project(id);
ALTER TABLE org.organisation_pseudonym
  ADD CONSTRAINT pseudonym_project_fk FOREIGN KEY (project_id) REFERENCES proj.project(id);
ALTER TABLE platform.page_view_daily
  ADD CONSTRAINT page_view_project_fk FOREIGN KEY (project_id) REFERENCES proj.project(id);

-- Allocate 'Buyer 014' once, never change it, never recycle it.
CREATE FUNCTION org.allocate_pseudonym(p_project_id uuid, p_org_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, org AS
$f$
DECLARE v_seq int; v_label text;
BEGIN
  SELECT label INTO v_label FROM org.organisation_pseudonym
   WHERE project_id = p_project_id AND org_id = p_org_id;
  IF FOUND THEN RETURN v_label; END IF;
  INSERT INTO org.project_label_counter (project_id) VALUES (p_project_id)
    ON CONFLICT (project_id) DO NOTHING;
  UPDATE org.project_label_counter SET next_seq = next_seq + 1
   WHERE project_id = p_project_id RETURNING next_seq - 1 INTO v_seq;   -- row lock
  INSERT INTO org.organisation_pseudonym (project_id, org_id, seq)
  VALUES (p_project_id, p_org_id, v_seq) RETURNING label INTO v_label;
  RETURN v_label;
END $f$;

-- ------------------------------------------ THE SPINE: declared (project, unit type)
-- Every quantity-bearing row in the database foreign-keys through this table, so
-- a volume in a unit type the project does not sell is UNREPRESENTABLE.
CREATE TABLE proj.project_unit_type (
  project_id    uuid NOT NULL REFERENCES proj.project(id),
  unit_type_id  uuid NOT NULL REFERENCES units.unit_type(id),
  scheme_id     uuid NOT NULL,
  declared_at   timestamptz NOT NULL DEFAULT now(),
  source_ref_id uuid NOT NULL REFERENCES sylva.source_ref(id),
  PRIMARY KEY (project_id, unit_type_id),
  FOREIGN KEY (unit_type_id, scheme_id) REFERENCES units.unit_type (id, scheme_id)
);

-- ------------------------------------------------------------------ PERIODS
CREATE TABLE proj.period (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES proj.project(id),
  label         sylva.nonblank NOT NULL,
  starts_on     date NOT NULL,
  ends_on       date NOT NULL,
  source_ref_id uuid NOT NULL REFERENCES sylva.source_ref(id),
  PRIMARY KEY (id),
  UNIQUE (project_id, id),                 -- composite-FK anchor
  UNIQUE (project_id, label),
  UNIQUE (id, starts_on, ends_on),         -- lets a commitment carry the dates
  CHECK (ends_on > starts_on),
  -- one project's periods can never overlap
  EXCLUDE USING gist (project_id WITH =, daterange(starts_on, ends_on, '[)') WITH &&)
);
CREATE INDEX ix_period_project ON proj.period (project_id);

-- ------------------------------------------------- R1: FORECAST AND BALANCE
-- Expected issuance and buffer are REVISABLE FORECASTS, not inventory figures.
-- Every revision is a new append-only row carrying its own source and as-of date.
CREATE TABLE proj.period_forecast (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL,
  unit_type_id          uuid NOT NULL,
  period_id             uuid NOT NULL,
  expected_issuance_raw sylva.unit_amount NOT NULL,
  buffer_raw            sylva.unit_amount NOT NULL,
  -- readable form: granted; the *_raw columns are granted to NO role (R7)
  expected_issuance_qty sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, expected_issuance_raw)::sylva.unit_qty) STORED,
  buffer_qty            sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, buffer_raw)::sylva.unit_qty) STORED,
  sellable_qty          sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, expected_issuance_raw - buffer_raw)::sylva.unit_qty) STORED,
  source_ref_id         uuid NOT NULL REFERENCES sylva.source_ref(id),
  as_of_date            date NOT NULL,
  recorded_at           timestamptz NOT NULL DEFAULT now(),
  recorded_by_org_id    uuid NOT NULL REFERENCES org.organisation(id),
  -- A revision that would leave existing committed volume above the ceiling is
  -- RECORDED (it is a fact about the project) but NOT APPLIED. R1 therefore
  -- holds at every instant AND the database never refuses to record reality.
  -- Nothing is cancelled or truncated; the shortfall is resolved commercially.
  effective             boolean NOT NULL DEFAULT true,
  blocked_reason        text,
  CONSTRAINT buffer_within_expected CHECK (buffer_raw <= expected_issuance_raw),
  CONSTRAINT blocked_has_reason     CHECK (effective OR btrim(coalesce(blocked_reason,'')) <> ''),
  FOREIGN KEY (project_id, unit_type_id) REFERENCES proj.project_unit_type (project_id, unit_type_id),
  FOREIGN KEY (period_id, project_id)    REFERENCES proj.period (id, project_id)
);
CREATE INDEX ix_forecast_grain ON proj.period_forecast (project_id, unit_type_id, period_id, recorded_at DESC);

-- ========================== R1 LIVES HERE ==================================
-- One row per (project, unit type, period). The rule is a CHECK on this row,
-- not an IF inside a trigger body that a future rewrite can delete. Both paths
-- that can break it - a new commitment, and a forecast revision - UPDATE this
-- row, and the UPDATE takes the row lock that serialises concurrent buyers.
CREATE TABLE proj.period_balance (
  project_id            uuid NOT NULL,
  unit_type_id          uuid NOT NULL,
  period_id             uuid NOT NULL,
  expected_issuance_raw sylva.unit_amount NOT NULL,
  buffer_raw            sylva.unit_amount NOT NULL,
  committed_raw         sylva.unit_amount NOT NULL DEFAULT 0,
  expected_issuance_qty sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, expected_issuance_raw)::sylva.unit_qty) STORED,
  buffer_qty            sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, buffer_raw)::sylva.unit_qty) STORED,
  committed_qty         sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, committed_raw)::sylva.unit_qty) STORED,
  remaining_qty         sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id,
           expected_issuance_raw - buffer_raw - committed_raw)::sylva.unit_qty) STORED,
  effective_forecast_id uuid NOT NULL REFERENCES proj.period_forecast(id),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, unit_type_id, period_id),
  CONSTRAINT r1_buffer_within_expected
    CHECK (buffer_raw <= expected_issuance_raw),
  CONSTRAINT r1_committed_never_exceeds_expected_less_buffer
    CHECK (committed_raw <= expected_issuance_raw - buffer_raw),
  FOREIGN KEY (project_id, unit_type_id) REFERENCES proj.project_unit_type (project_id, unit_type_id),
  FOREIGN KEY (period_id, project_id)    REFERENCES proj.period (id, project_id)
);

CREATE FUNCTION proj.evaluate_forecast() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, proj AS
$f$
DECLARE v_committed numeric;
BEGIN
  SELECT committed_raw INTO v_committed FROM proj.period_balance
   WHERE project_id = NEW.project_id AND unit_type_id = NEW.unit_type_id
     AND period_id = NEW.period_id
   FOR UPDATE;
  IF NOT FOUND THEN NEW.effective := true; NEW.blocked_reason := NULL; RETURN NEW; END IF;
  IF NEW.expected_issuance_raw - NEW.buffer_raw < v_committed THEN
    NEW.effective := false;
    NEW.blocked_reason := format(
      'Revision recorded but not applied: sellable volume %s is below committed volume %s for this period.',
      (NEW.expected_issuance_raw - NEW.buffer_raw)::text, v_committed::text);
  ELSE
    NEW.effective := true; NEW.blocked_reason := NULL;
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER t_forecast_evaluate BEFORE INSERT ON proj.period_forecast
  FOR EACH ROW EXECUTE FUNCTION proj.evaluate_forecast();

CREATE FUNCTION proj.apply_forecast() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, proj AS
$f$
BEGIN
  IF NOT NEW.effective THEN RETURN NULL; END IF;
  INSERT INTO proj.period_balance
    (project_id, unit_type_id, period_id, expected_issuance_raw, buffer_raw,
     committed_raw, effective_forecast_id)
  VALUES (NEW.project_id, NEW.unit_type_id, NEW.period_id,
          NEW.expected_issuance_raw, NEW.buffer_raw, 0, NEW.id)
  ON CONFLICT (project_id, unit_type_id, period_id) DO UPDATE
    SET expected_issuance_raw = EXCLUDED.expected_issuance_raw,
        buffer_raw            = EXCLUDED.buffer_raw,
        effective_forecast_id = EXCLUDED.effective_forecast_id,
        updated_at            = now();
  RETURN NULL;
END $f$;
CREATE TRIGGER t_forecast_apply AFTER INSERT ON proj.period_forecast
  FOR EACH ROW EXECUTE FUNCTION proj.apply_forecast();
