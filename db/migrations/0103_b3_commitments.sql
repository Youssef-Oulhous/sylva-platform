-- ============================================================================
-- B3. COMMITMENTS  ·  where R1 is actually moved
-- ============================================================================
CREATE TYPE deal.commitment_entry_kind AS ENUM
  ('commit','release','correction_commit','correction_release');

-- One shared mapping from entry kind to sign, used by the ONLY writer of the
-- balance, so no caller anywhere can invent a sign. A reduction is never a
-- negative number: it is a new row whose kind carries the direction.
CREATE FUNCTION deal.commitment_effect_sign(k deal.commitment_entry_kind) RETURNS smallint
LANGUAGE sql IMMUTABLE AS
$$ SELECT (CASE k WHEN 'commit' THEN 1 WHEN 'correction_commit' THEN 1
                  ELSE -1 END)::smallint $$;

CREATE TABLE deal.commitment_entry (
  entry_no       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id        uuid NOT NULL,
  project_id     uuid NOT NULL,
  buyer_org_id   uuid NOT NULL,       -- denormalised: zero-hop RLS, FK-anchored
  owner_org_id   uuid NOT NULL,
  unit_type_id   uuid NOT NULL,
  period_id      uuid NOT NULL,
  deal_shape     text NOT NULL REFERENCES deal.deal_shape(code),
  entry_kind     deal.commitment_entry_kind NOT NULL,
  amount_raw     sylva.unit_amount NOT NULL CHECK (amount_raw > 0),
  amount_qty     sylva.unit_qty GENERATED ALWAYS AS
                   (ROW(project_id, unit_type_id, amount_raw)::sylva.unit_qty) STORED,

  -- WHICH STAGE CONSUMES AVAILABILITY IS DATA, NOT CODE. The pinned constant
  -- plus the composite FK mean a commitment can only cite a stage that
  -- deal.deal_stage says counts. Changing the client's answer is a one-row
  -- UPDATE of deal.deal_stage - restricted by this FK once commitments exist,
  -- which is correct: you cannot retroactively change what counted.
  counting_stage        text NOT NULL,
  counting_stage_counts boolean NOT NULL DEFAULT true CHECK (counting_stage_counts),

  committed_on     date NOT NULL,
  period_starts_on date NOT NULL,
  period_ends_on   date NOT NULL,
  source_ref_id    uuid NOT NULL REFERENCES sylva.source_ref(id),
  actor_org_id     uuid NOT NULL REFERENCES org.organisation(id),
  actor_person_ref uuid,
  recorded_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  corrects_entry_no bigint REFERENCES deal.commitment_entry(entry_no),
  correction_reason text,

  FOREIGN KEY (counting_stage, counting_stage_counts)
    REFERENCES deal.deal_stage (code, counts_toward_committed),
  FOREIGN KEY (deal_id, project_id, buyer_org_id, owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id),
  FOREIGN KEY (project_id, unit_type_id)
    REFERENCES proj.project_unit_type (project_id, unit_type_id),
  FOREIGN KEY (period_id, project_id)
    REFERENCES proj.period (id, project_id),
  -- the period's own dates are carried, not retyped
  FOREIGN KEY (period_id, period_starts_on, period_ends_on)
    REFERENCES proj.period (id, starts_on, ends_on),
  -- "a forward contract, where the buyer commits now to take a volume in a
  -- FUTURE year". Applies to the committing entries only; a release can of
  -- course happen after the period has started. WHICH DATE the comparison is
  -- against is an OPEN DECISION - implemented as the date the commitment is
  -- recorded.
  CONSTRAINT forward_is_for_a_future_period CHECK (
    deal_shape <> 'forward'
    OR entry_kind NOT IN ('commit','correction_commit')
    OR period_starts_on > committed_on),
  CONSTRAINT correction_points_backwards
    CHECK (corrects_entry_no IS NULL OR corrects_entry_no < entry_no),
  CONSTRAINT correction_has_reason
    CHECK ((corrects_entry_no IS NULL) = (correction_reason IS NULL)),
  CONSTRAINT correction_reason_nonblank
    CHECK (correction_reason IS NULL OR btrim(correction_reason) <> '')
);
CREATE UNIQUE INDEX ux_commitment_corrected_once
  ON deal.commitment_entry (corrects_entry_no) WHERE corrects_entry_no IS NOT NULL;
CREATE INDEX ix_commitment_deal   ON deal.commitment_entry (deal_id);
CREATE INDEX ix_commitment_buyer  ON deal.commitment_entry (buyer_org_id);  -- RLS predicate
CREATE INDEX ix_commitment_owner  ON deal.commitment_entry (owner_org_id);  -- RLS predicate
CREATE INDEX ix_commitment_grain  ON deal.commitment_entry (project_id, unit_type_id, period_id);

-- ========================== R1 IS MOVED HERE ===============================
-- The rule itself is the CHECK on proj.period_balance. This function contains
-- arithmetic and no rule logic, so a future rewrite of it cannot disable R1:
-- the constraint outlives the function.
CREATE FUNCTION deal.enforce_r1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, deal, proj AS
$f$
DECLARE v_delta numeric;
BEGIN
  -- BEFORE-row triggers run ahead of foreign-key checks, so say plainly what is
  -- wrong rather than letting a raw FK error stand in for "this project does
  -- not sell that unit type".
  IF NOT EXISTS (SELECT 1 FROM proj.project_unit_type put
                  WHERE put.project_id = NEW.project_id
                    AND put.unit_type_id = NEW.unit_type_id) THEN
    RAISE EXCEPTION
      'R7: project % does not sell unit type %; a volume in another project''s unit type is not transferable here',
      NEW.project_id, NEW.unit_type_id USING ERRCODE = 'SY007';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM proj.period pe
                  WHERE pe.id = NEW.period_id AND pe.project_id = NEW.project_id) THEN
    RAISE EXCEPTION
      'R7: period % does not belong to project %; a volume is always scoped to one project',
      NEW.period_id, NEW.project_id USING ERRCODE = 'SY007';
  END IF;

  v_delta := deal.commitment_effect_sign(NEW.entry_kind) * NEW.amount_raw;

  -- This UPDATE takes the balance row lock. Two buyers committing at the same
  -- instant serialise here, and under READ COMMITTED the second re-evaluates
  -- committed_raw + delta against the version the winner committed, then the
  -- CHECK is evaluated on the summed value. No advisory lock, no SERIALIZABLE,
  -- and crucially never `SET committed_raw = (SELECT sum(...) ...)`, which is
  -- the shape that would race.
  UPDATE proj.period_balance
     SET committed_raw = committed_raw + v_delta, updated_at = now()
   WHERE project_id = NEW.project_id AND unit_type_id = NEW.unit_type_id
     AND period_id = NEW.period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'R1: no effective forecast for project % unit type % period %; nothing is sellable',
      NEW.project_id, NEW.unit_type_id, NEW.period_id USING ERRCODE = 'SY001';
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER t_commitment_r1 BEFORE INSERT ON deal.commitment_entry
  FOR EACH ROW EXECUTE FUNCTION deal.enforce_r1();
ALTER TABLE deal.commitment_entry ENABLE ALWAYS TRIGGER t_commitment_r1;
