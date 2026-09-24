-- ============================================================================
-- A3. ORGANISATIONS, PSEUDONYMS, VETTING, APPROVAL  (R5, R6)
-- ============================================================================
CREATE TABLE org.actor_role (
  code          text PRIMARY KEY,
  label_en      sylva.nonblank NOT NULL,
  is_transacting boolean NOT NULL DEFAULT false
);
INSERT INTO org.actor_role (code,label_en,is_transacting) VALUES
  ('buyer','Buyer',true), ('project_owner','Project owner',true),
  ('investor','Investor',true), ('operator','Operator',false),
  ('auditor','Auditor',false);
-- A transacting role is a strict subset, so 'auditor' can never be approved to
-- transact: it is a foreign-key violation, not a code check.
CREATE UNIQUE INDEX ux_actor_role_transacting
  ON org.actor_role (code, is_transacting);

CREATE TABLE org.organisation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name          sylva.nonblank NOT NULL,
  registration_number text,
  registered_address  text,
  country_code        sylva.country_code NOT NULL,
  sector_code         text NOT NULL,
  size_band_code      text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (sector_code)    REFERENCES platform.sector(code),
  FOREIGN KEY (size_band_code) REFERENCES platform.size_band(code),
  -- composite-FK anchors used downstream so a denormalised copy cannot drift
  UNIQUE (id, country_code)
);

-- Late foreign keys back into identity's org columns (identity references org,
-- never the other way round).
ALTER TABLE identity.user_account
  ADD CONSTRAINT user_account_org_fk FOREIGN KEY (org_id)
  REFERENCES org.organisation(id) ON DELETE RESTRICT;
ALTER TABLE identity.person_label
  ADD CONSTRAINT person_label_org_fk FOREIGN KEY (org_id)
  REFERENCES org.organisation(id) ON DELETE RESTRICT;
ALTER TABLE identity.erasure_event
  ADD CONSTRAINT erasure_org_fk FOREIGN KEY (org_id)
  REFERENCES org.organisation(id) ON DELETE RESTRICT;
ALTER TABLE identity.user_platform_role
  ADD CONSTRAINT user_platform_role_fk FOREIGN KEY (role_code)
  REFERENCES org.actor_role(code);

-- ------------------------------------------------------- R5: THE PSEUDONYM
-- "On the public version of that record the buyer appears as a label such as
-- 'Buyer 014' with its sector, country and size" (section 8).
-- Allocated per (project, organisation): a single platform-wide label combined
-- with per-deal disclosure is not safely combinable, because naming yourself on
-- one deal would retrospectively de-anonymise every other deal under the same
-- label. Allocating the same ordinal on every project converts this to a
-- platform-wide pseudonym with no migration, so the decision stays reversible.
CREATE TABLE org.project_label_counter (
  project_id uuid PRIMARY KEY,                       -- FK added after proj.project
  next_seq   int NOT NULL DEFAULT 1 CHECK (next_seq >= 1)
);

CREATE TABLE org.organisation_pseudonym (
  project_id   uuid NOT NULL,                        -- FK added after proj.project
  org_id       uuid NOT NULL REFERENCES org.organisation(id) ON DELETE RESTRICT,
  seq          int  NOT NULL CHECK (seq > 0),
  label        text NOT NULL GENERATED ALWAYS AS ('Buyer ' || lpad(seq::text, 3, '0')) STORED,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, org_id),
  UNIQUE (project_id, seq),
  UNIQUE (project_id, label)
);

-- ------------------------------------------------------------ R6: VETTING
CREATE TABLE org.questionnaire (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code  text NOT NULL REFERENCES org.actor_role(code),
  version_no int NOT NULL CHECK (version_no >= 1),
  published_at timestamptz,
  UNIQUE (role_code, version_no),
  UNIQUE (id, role_code)
);
COMMENT ON TABLE org.questionnaire IS
  'The vetting questionnaire SHAPE. The questions themselves are not in the concept note and must be supplied by Sylva - in particular, no investor financial-suitability or professional-investor criteria are drafted here, because those terms carry regulatory meaning.';

CREATE TABLE org.question (
  questionnaire_id uuid NOT NULL REFERENCES org.questionnaire(id),
  question_code    text NOT NULL,
  sort_order       int  NOT NULL,
  prompt_en        sylva.nonblank NOT NULL,
  answer_kind      text NOT NULL CHECK (answer_kind IN ('text','longtext','boolean','choice','number','file')),
  is_required      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (questionnaire_id, question_code),
  UNIQUE (questionnaire_id, sort_order)
);

CREATE TABLE org.vetting_submission (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES org.organisation(id),
  role_code               text NOT NULL,
  role_is_transacting     boolean NOT NULL DEFAULT true CHECK (role_is_transacting),
  questionnaire_id        uuid NOT NULL,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  submitted_by_person_ref uuid,                      -- opaque; NO FK. See erasure.
  supersedes_id           uuid UNIQUE REFERENCES org.vetting_submission(id),
  -- only a transacting role can be applied for: an FK violation, not a check
  FOREIGN KEY (role_code, role_is_transacting)
    REFERENCES org.actor_role (code, is_transacting),
  FOREIGN KEY (questionnaire_id, role_code)
    REFERENCES org.questionnaire (id, role_code),
  -- the anchor that lets a decision prove it is deciding THIS org's answers
  UNIQUE (id, org_id, role_code)
);

CREATE TABLE org.vetting_answer (
  submission_id    uuid NOT NULL REFERENCES org.vetting_submission(id),
  questionnaire_id uuid NOT NULL,
  question_code    text NOT NULL,
  answer_text      text,
  answer_boolean   boolean,
  answer_numeric   numeric,
  answer_document_id uuid,                            -- FK added after doc.document
  PRIMARY KEY (submission_id, question_code),
  FOREIGN KEY (questionnaire_id, question_code)
    REFERENCES org.question (questionnaire_id, question_code),
  CHECK (num_nonnulls(answer_text, answer_boolean, answer_numeric, answer_document_id) <= 1)
);
COMMENT ON TABLE org.vetting_answer IS
  'Free text here is the acknowledged second category of personal data that the one-table rule cannot literally cover. Handled by a documented redaction procedure, never by deletion, because deleting would break R4.';

CREATE TYPE org.vetting_decision_kind AS ENUM
  ('approved','declined','suspended','reinstated','revoked');

CREATE TABLE org.vetting_decision (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         uuid NOT NULL,
  org_id                uuid NOT NULL REFERENCES org.organisation(id),
  role_code             text NOT NULL REFERENCES org.actor_role(code),
  decision              org.vetting_decision_kind NOT NULL,
  reason                text,
  decided_at            timestamptz NOT NULL DEFAULT now(),
  decided_by_org_id     uuid NOT NULL REFERENCES org.organisation(id),
  decided_by_person_ref uuid,                         -- opaque; NO FK
  review_due_on         date,
  -- an approval cannot exist without the answers it was based on, and cannot
  -- cite another organisation's questionnaire
  FOREIGN KEY (submission_id, org_id, role_code)
    REFERENCES org.vetting_submission (id, org_id, role_code),
  CONSTRAINT decline_needs_reason
    CHECK (decision <> 'declined' OR btrim(coalesce(reason,'')) <> ''),
  CONSTRAINT revoke_needs_reason
    CHECK (decision <> 'revoked'  OR btrim(coalesce(reason,'')) <> '')
);

-- The CURRENT status per (organisation, role). A trigger-maintained cache of the
-- append-only decision chain. This is the single predicate R6 reads, and it is
-- deliberately NOT a foreign-key target: approval is temporal, so citing a
-- historical 'approved' row would let a REVOKED organisation open new deals for
-- ever - the exact hole the append-only chain creates if you point a FK at it.
CREATE TABLE org.org_role_approval (
  org_id           uuid NOT NULL REFERENCES org.organisation(id),
  role_code        text NOT NULL REFERENCES org.actor_role(code),
  status           text NOT NULL CHECK (status IN ('approved','declined','suspended','revoked')),
  last_decision_id uuid NOT NULL REFERENCES org.vetting_decision(id),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, role_code)
);

CREATE FUNCTION org.apply_vetting_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, org AS
$f$
DECLARE new_status text;
BEGIN
  new_status := CASE NEW.decision
                  WHEN 'approved'   THEN 'approved'
                  WHEN 'reinstated' THEN 'approved'
                  WHEN 'declined'   THEN 'declined'
                  WHEN 'suspended'  THEN 'suspended'
                  WHEN 'revoked'    THEN 'revoked' END;
  INSERT INTO org.org_role_approval (org_id, role_code, status, last_decision_id, updated_at)
  VALUES (NEW.org_id, NEW.role_code, new_status, NEW.id, NEW.decided_at)
  ON CONFLICT (org_id, role_code) DO UPDATE
    SET status = EXCLUDED.status,
        last_decision_id = EXCLUDED.last_decision_id,
        updated_at = EXCLUDED.updated_at;
  RETURN NULL;
END $f$;
CREATE TRIGGER t_apply_vetting_decision AFTER INSERT ON org.vetting_decision
  FOR EACH ROW EXECUTE FUNCTION org.apply_vetting_decision();
ALTER TABLE org.vetting_decision ENABLE ALWAYS TRIGGER t_apply_vetting_decision;

-- Used by RLS policies and by the R6 trigger. SECURITY DEFINER so a policy on
-- another table does not have to compose with this table's own policies.
CREATE FUNCTION sylva.is_vetted(p_role text, p_org_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, org, sylva AS
$$ SELECT EXISTS (SELECT 1 FROM org.org_role_approval a
                   WHERE a.org_id = coalesce(p_org_id, sylva.actor_org_id())
                     AND a.role_code = p_role
                     AND a.status = 'approved') $$;

CREATE FUNCTION sylva.is_vetted_investor() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT sylva.is_vetted('investor') $$;
CREATE FUNCTION sylva.is_vetted_buyer() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT sylva.is_vetted('buyer') $$;
