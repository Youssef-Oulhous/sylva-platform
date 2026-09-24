-- ============================================================================
-- A18. RESERVED VOLUME COUNTS AGAINST R1
--
-- Review finding, 23 Sep 2026, and it is correct.
--
-- docs/DECISIONS.md D2 decided that capacity is held in two tiers - reserved at
-- term sheet, committed at signed - and that R1 is enforced against
-- reserved + committed. The schema as built enforced R1 against committed_raw
-- alone and had no reserved column at all.
--
-- The consequence: two buyers could each reach a term sheet for the same
-- remaining volume and only discover the clash at signature. That is exactly
-- the failure R1 exists to prevent, moved one stage later.
--
-- Release 1 never writes a reservation - the deal room and term sheets are
-- Phase 2 - so reserved_raw stays 0 until then. The column and the constraint
-- go in now regardless, because period_balance ships in release 1 and the
-- invariant must be right before any data depends on its shape.
-- ============================================================================

-- The view reads remaining_qty, which is regenerated below.
DROP VIEW IF EXISTS proj.v_period_availability;

ALTER TABLE proj.period_balance
  ADD COLUMN reserved_raw sylva.unit_amount NOT NULL DEFAULT 0;

COMMENT ON COLUMN proj.period_balance.reserved_raw IS
  'Volume held by a term sheet that has not been signed. Holds capacity, and '
  'every reservation carries an expiry: without one a stalled negotiation '
  'sterilises the period for ever. Expiry release is an event in the record, '
  'never a deletion.';

ALTER TABLE proj.period_balance
  ADD COLUMN reserved_qty sylva.unit_qty
    GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, reserved_raw)::sylva.unit_qty) STORED;

-- Remaining is what a new buyer can actually still ask for, so it must net off
-- reservations as well as commitments.
ALTER TABLE proj.period_balance DROP COLUMN remaining_qty;
ALTER TABLE proj.period_balance
  ADD COLUMN remaining_qty sylva.unit_qty
    GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id,
           expected_issuance_raw - buffer_raw - reserved_raw - committed_raw
          )::sylva.unit_qty) STORED;

-- R1, restated. The old constraint is replaced rather than supplemented so
-- there is exactly one statement of the rule to read.
ALTER TABLE proj.period_balance
  DROP CONSTRAINT r1_committed_never_exceeds_expected_less_buffer;

ALTER TABLE proj.period_balance
  ADD CONSTRAINT r1_reserved_plus_committed_within_sellable
    CHECK (reserved_raw + committed_raw <= expected_issuance_raw - buffer_raw);

COMMENT ON CONSTRAINT r1_reserved_plus_committed_within_sellable
  ON proj.period_balance IS
  'Rule 1. Committed volume for a project and period never exceeds what the '
  'project expects to issue, less the buffer - counting volume already held by '
  'an unsigned term sheet, so two buyers cannot both reach signature for the '
  'same units.';

-- A forecast revision must not strand reserved volume either, not only
-- committed volume. Same treatment as before: the revision is still recorded,
-- it simply does not take effect, and it says why.
CREATE OR REPLACE FUNCTION proj.evaluate_forecast() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, proj AS
$f$
DECLARE v_committed numeric; v_reserved numeric;
BEGIN
  SELECT committed_raw, reserved_raw INTO v_committed, v_reserved
    FROM proj.period_balance
   WHERE project_id = NEW.project_id AND unit_type_id = NEW.unit_type_id
     AND period_id = NEW.period_id
   FOR UPDATE;
  IF NOT FOUND THEN NEW.effective := true; NEW.blocked_reason := NULL; RETURN NEW; END IF;

  IF NEW.expected_issuance_raw - NEW.buffer_raw < v_committed + v_reserved THEN
    NEW.effective := false;
    NEW.blocked_reason := format(
      'Revision recorded but not applied: sellable volume %s is below committed %s plus reserved %s for this period.',
      (NEW.expected_issuance_raw - NEW.buffer_raw)::text,
      v_committed::text, v_reserved::text);
  ELSE
    NEW.effective := true; NEW.blocked_reason := NULL;
  END IF;
  RETURN NEW;
END $f$;

-- apply_forecast must not clobber reserved_raw on an upsert.
CREATE OR REPLACE FUNCTION proj.apply_forecast() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, proj AS
$f$
BEGIN
  IF NOT NEW.effective THEN RETURN NULL; END IF;
  INSERT INTO proj.period_balance
    (project_id, unit_type_id, period_id, expected_issuance_raw, buffer_raw,
     reserved_raw, committed_raw, effective_forecast_id)
  VALUES (NEW.project_id, NEW.unit_type_id, NEW.period_id,
          NEW.expected_issuance_raw, NEW.buffer_raw, 0, 0, NEW.id)
  ON CONFLICT (project_id, unit_type_id, period_id) DO UPDATE
    SET expected_issuance_raw = EXCLUDED.expected_issuance_raw,
        buffer_raw            = EXCLUDED.buffer_raw,
        effective_forecast_id = EXCLUDED.effective_forecast_id,
        updated_at            = now();   -- reserved_raw / committed_raw untouched
  RETURN NULL;
END $f$;

-- Rebuilt with reserved exposed. The client still has to decide whether
-- committed is published at all - see the comment below.
CREATE VIEW proj.v_period_availability
  WITH (security_invoker = true, security_barrier = true) AS
SELECT b.project_id, b.unit_type_id, b.period_id,
       p.label AS period_label, p.starts_on, p.ends_on,
       ut.code AS unit_type_code,
       ut.metric_label_en AS unit_metric_label,
       ut.unit_of_measure, ut.vintage_semantics,
       b.expected_issuance_qty, b.buffer_qty,
       b.reserved_qty, b.committed_qty, b.remaining_qty,
       f.as_of_date AS forecast_as_of_date,
       f.source_ref_id AS forecast_source_ref_id,
       b.updated_at
  FROM proj.period_balance b
  JOIN proj.period p ON p.id = b.period_id
  JOIN units.unit_type ut ON ut.id = b.unit_type_id
  JOIN proj.period_forecast f ON f.id = b.effective_forecast_id;

COMMENT ON VIEW proj.v_period_availability IS
  'Section 6 verbatim: expected issuance, buffer, reserved, committed, '
  'remaining - per period, per project, never totalled across projects. '
  'OPEN DECISION for the client: these five columns are mutually determining, '
  'so publishing any four discloses the fifth by subtraction. With one buyer in '
  'a period, committed IS that buyer''s deal volume. Options are to publish '
  'committed in bands, to suppress it below a minimum buyer count, or to accept '
  'the disclosure. This is a product decision and must not be resolved by '
  'quietly dropping a column.';

CREATE OR REPLACE FUNCTION ci.assert_r1_counts_reservations() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conrelid = 'proj.period_balance'::regclass
    AND conname  = 'r1_reserved_plus_committed_within_sellable';
  IF def IS NULL THEN
    RAISE EXCEPTION 'R1 regression: the reserved+committed constraint is gone';
  END IF;
  IF def NOT LIKE '%reserved_raw%' OR def NOT LIKE '%committed_raw%' THEN
    RAISE EXCEPTION 'R1 regression: constraint no longer counts both reserved and committed: %', def;
  END IF;
END $$;
