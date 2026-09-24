-- ============================================================================
-- B1. REGISTRY REFERENCES  ·  R2's target
-- ============================================================================
-- "We are not the registry... we store references to their records plus the
-- supporting documents. Our own record is evidence of what was agreed, not the
-- authoritative record of what exists."
CREATE TYPE credit.registry_status AS ENUM
  ('draft','submitted','confirmed','rejected','disputed','superseded');

CREATE TABLE credit.registry_record (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id           uuid NOT NULL REFERENCES units.scheme(id),
  project_id          uuid NOT NULL,
  period_id           uuid NOT NULL,
  unit_type_id        uuid NOT NULL,
  record_type         text NOT NULL CHECK (record_type IN
                        ('issuance','allocation','transfer','retirement','cancellation')),
  -- NOT NULL is not enough: '' and '   ' would satisfy it and R2 would be
  -- met by a blank reference. The nonblank domain closes that.
  external_record_id  sylva.nonblank NOT NULL,
  record_url          text,
  quantity_raw        sylva.unit_amount,
  quantity_qty        sylva.unit_qty GENERATED ALWAYS AS
                        (ROW(project_id, unit_type_id, quantity_raw)::sylva.unit_qty) STORED,
  -- where a scheme publishes only a PDF, the human certificate number goes in
  -- external_record_id and THIS is what makes it checkable
  evidence_document_version_id uuid NOT NULL REFERENCES doc.document_version(id),
  confirmation_status credit.registry_status NOT NULL DEFAULT 'draft',
  confirmed_by_org_id uuid REFERENCES org.organisation(id),
  confirmed_at        timestamptz,
  supersedes_id       uuid UNIQUE REFERENCES credit.registry_record(id),
  source_ref_id       uuid NOT NULL REFERENCES sylva.source_ref(id),
  as_of_date          date NOT NULL,
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  -- one-way implication only: confirmed_at and confirmed_by are HISTORY and
  -- survive a later dispute or supersession, which is what R4 requires.
  CONSTRAINT confirmed_has_confirmer CHECK (
    confirmation_status <> 'confirmed'
    OR (confirmed_at IS NOT NULL AND confirmed_by_org_id IS NOT NULL)),
  -- R2's composite-FK target
  UNIQUE (id, confirmation_status),
  -- the scope FK target: a credit can never cite a record for another project,
  -- period or unit type
  UNIQUE (id, project_id, period_id, unit_type_id),
  FOREIGN KEY (project_id, unit_type_id) REFERENCES proj.project_unit_type (project_id, unit_type_id),
  FOREIGN KEY (period_id, project_id)    REFERENCES proj.period (id, project_id)
);
-- the same scheme record can never be attached to two live things at once
CREATE UNIQUE INDEX ux_registry_record_external
  ON credit.registry_record (scheme_id, record_type, lower(external_record_id))
  WHERE confirmation_status <> 'superseded';
CREATE INDEX ix_registry_record_project ON credit.registry_record (project_id);

-- Confirmation is a HUMAN act by Sylva against the scheme's own database - the
-- platform has no write access to any scheme - and it is recorded as evidence.
CREATE TABLE credit.registry_confirmation_event (
  entry_no          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registry_record_id uuid NOT NULL REFERENCES credit.registry_record(id),
  to_status         credit.registry_status NOT NULL,
  reason            text,
  decided_by_org_id uuid NOT NULL REFERENCES org.organisation(id),
  decided_by_person_ref uuid,
  decided_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT rejection_needs_reason
    CHECK (to_status NOT IN ('rejected','disputed') OR btrim(coalesce(reason,'')) <> '')
);
CREATE INDEX ix_registry_conf_record ON credit.registry_confirmation_event (registry_record_id, entry_no DESC);

CREATE FUNCTION credit.apply_registry_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, credit AS
$f$
BEGIN
  UPDATE credit.registry_record
     SET confirmation_status = NEW.to_status,
         confirmed_by_org_id = CASE WHEN NEW.to_status = 'confirmed'
                                    THEN NEW.decided_by_org_id ELSE confirmed_by_org_id END,
         confirmed_at        = CASE WHEN NEW.to_status = 'confirmed'
                                    THEN NEW.decided_at ELSE confirmed_at END
   WHERE id = NEW.registry_record_id;
  RETURN NULL;
END $f$;
CREATE TRIGGER t_apply_registry_confirmation
  AFTER INSERT ON credit.registry_confirmation_event
  FOR EACH ROW EXECUTE FUNCTION credit.apply_registry_confirmation();
ALTER TABLE credit.registry_confirmation_event
  ENABLE ALWAYS TRIGGER t_apply_registry_confirmation;

-- Everything about a registry record EXCEPT its confirmation cache is immutable.
-- A wrong reference is superseded by a new one plus a correction entry; it is
-- never edited and never deleted.
CREATE FUNCTION credit.guard_registry_record() RETURNS trigger LANGUAGE plpgsql AS
$f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'R4: registry records are never deleted; supersede them'
      USING ERRCODE = 'SY004';
  END IF;
  IF ROW(OLD.id, OLD.scheme_id, OLD.project_id, OLD.period_id, OLD.unit_type_id,
         OLD.record_type, OLD.external_record_id, OLD.record_url, OLD.quantity_raw,
         OLD.evidence_document_version_id, OLD.source_ref_id, OLD.as_of_date)
     IS DISTINCT FROM
     ROW(NEW.id, NEW.scheme_id, NEW.project_id, NEW.period_id, NEW.unit_type_id,
         NEW.record_type, NEW.external_record_id, NEW.record_url, NEW.quantity_raw,
         NEW.evidence_document_version_id, NEW.source_ref_id, NEW.as_of_date)
  THEN
    RAISE EXCEPTION
      'R4: the facts of a registry record are immutable; record a new record and a correction entry'
      USING ERRCODE = 'SY004';
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER t_guard_registry_record BEFORE UPDATE OR DELETE ON credit.registry_record
  FOR EACH ROW EXECUTE FUNCTION credit.guard_registry_record();
ALTER TABLE credit.registry_record ENABLE ALWAYS TRIGGER t_guard_registry_record;
ALTER TABLE credit.registry_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit.registry_record FORCE  ROW LEVEL SECURITY;
