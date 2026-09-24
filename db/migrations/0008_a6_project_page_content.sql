-- ============================================================================
-- A6. PROJECT PAGE CONTENT  ·  every figure carries its source and its date
-- ============================================================================
-- Content is append-only-WITH-VERSIONS: a new row supersedes, the old row is
-- retained and stays visible with its own as-of date. Version numbering is
-- contiguous by a GENERATED column plus a self-FK - no trigger, and race-free,
-- because two concurrent inserts collide on the primary key instead of both
-- reading the same max().

CREATE TABLE proj.text_field (
  code                    text PRIMARY KEY,
  label_en                sylva.nonblank NOT NULL,
  required_for_publication boolean NOT NULL DEFAULT false,
  max_chars               int
);
INSERT INTO proj.text_field (code,label_en,required_for_publication,max_chars) VALUES
  ('title','Project title',true,200),
  ('summary','Summary',true,2000),
  ('catchment_context','Catchment context',false,4000),
  ('partners_note','Partners on the ground',false,4000),
  ('durability_note','Durability note',false,4000);

CREATE TABLE proj.project_text (
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  field_code      text NOT NULL REFERENCES proj.text_field(code),
  locale          text NOT NULL REFERENCES i18n.locale(code),
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  body            sylva.nonblank NOT NULL,
  status          i18n.translation_status NOT NULL DEFAULT 'human_draft',
  source_locale   text NOT NULL DEFAULT 'en' REFERENCES i18n.locale(code),
  source_sha256   sylva.sha256,
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, field_code, locale, version_no),
  FOREIGN KEY (project_id, field_code, locale, prev_version_no)
    REFERENCES proj.project_text (project_id, field_code, locale, version_no)
);
CREATE INDEX ix_project_text_fts_en ON proj.project_text
  USING gin (to_tsvector('english', body)) WHERE locale = 'en';
CREATE INDEX ix_project_text_fts_de ON proj.project_text
  USING gin (to_tsvector('german', body))  WHERE locale = 'de';

-- ------------------------------------------------------------ CLAIM RIGHTS
-- "For each benefit the project produces, a plain statement of who may claim it,
-- for what, and what is excluded." Descriptive ONLY. The platform computes
-- nothing, asserts no exclusivity and blocks no deal on claim-rights grounds:
-- that would be a legal determination nothing in the note authorises.
CREATE TABLE proj.claim_right (
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  benefit_key     text NOT NULL,
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  sort_order      int  NOT NULL DEFAULT 0,
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, benefit_key, version_no),
  FOREIGN KEY (project_id, benefit_key, prev_version_no)
    REFERENCES proj.claim_right (project_id, benefit_key, version_no)
);

CREATE TABLE proj.claim_right_text (
  project_id    uuid NOT NULL,
  benefit_key   text NOT NULL,
  version_no    int  NOT NULL,
  locale        text NOT NULL REFERENCES i18n.locale(code),
  benefit_label sylva.nonblank NOT NULL,
  who_may_claim sylva.nonblank NOT NULL,
  for_what      sylva.nonblank NOT NULL,
  -- an exclusions field left blank is the failure mode the interviewed buyers
  -- described, so it is NOT NULL and non-blank
  exclusions    sylva.nonblank NOT NULL,
  status        i18n.translation_status NOT NULL DEFAULT 'human_draft',
  source_sha256 sylva.sha256,
  PRIMARY KEY (project_id, benefit_key, version_no, locale),
  FOREIGN KEY (project_id, benefit_key, version_no)
    REFERENCES proj.claim_right (project_id, benefit_key, version_no)
);

-- --------------------------------------------------------------- OUTCOMES
-- "What is measured, water indicators and the biodiversity metric, with the
-- baseline, the monitoring plan, the verifier and the stated uncertainty."
-- An indicator deliberately carries NO unit_type_id, so a hydrology figure can
-- never enter a unit_qty, a committed volume or an availability panel.
CREATE TABLE proj.outcome_indicator (
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  indicator_code  text NOT NULL,
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  domain          text NOT NULL CHECK (domain IN ('water','biodiversity')),
  measure_unit    sylva.nonblank NOT NULL,
  verifier_org_id uuid REFERENCES org.organisation(id),
  monitoring_plan_document_id uuid,                 -- FK added after doc.document
  uncertainty_note text,        -- reproduced as stated; never computed or narrowed
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, indicator_code, version_no),
  FOREIGN KEY (project_id, indicator_code, prev_version_no)
    REFERENCES proj.outcome_indicator (project_id, indicator_code, version_no)
);

CREATE TABLE proj.outcome_indicator_text (
  project_id       uuid NOT NULL,
  indicator_code   text NOT NULL,
  version_no       int  NOT NULL,
  locale           text NOT NULL REFERENCES i18n.locale(code),
  what_is_measured sylva.nonblank NOT NULL,
  method_note      text,
  status           i18n.translation_status NOT NULL DEFAULT 'human_draft',
  PRIMARY KEY (project_id, indicator_code, version_no, locale),
  FOREIGN KEY (project_id, indicator_code, version_no)
    REFERENCES proj.outcome_indicator (project_id, indicator_code, version_no)
);

CREATE TABLE proj.indicator_value (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL,
  indicator_code text NOT NULL,
  version_no     int  NOT NULL,
  value_kind     text NOT NULL CHECK (value_kind IN ('baseline','target','measured')),
  value_numeric  numeric(24,6) NOT NULL,
  measure_unit   sylva.nonblank NOT NULL,
  uncertainty_low  numeric(24,6),
  uncertainty_high numeric(24,6),
  source_ref_id  uuid NOT NULL REFERENCES sylva.source_ref(id),
  as_of_date     date NOT NULL,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, indicator_code, version_no)
    REFERENCES proj.outcome_indicator (project_id, indicator_code, version_no),
  CONSTRAINT uncertainty_is_a_pair CHECK ((uncertainty_low IS NULL) = (uncertainty_high IS NULL)),
  CONSTRAINT uncertainty_ordered   CHECK (uncertainty_high IS NULL OR uncertainty_high >= uncertainty_low)
);
CREATE INDEX ix_indicator_value_project ON proj.indicator_value (project_id, indicator_code);

-- -------------------------------------------------------------- DURABILITY
-- "What happens to the site after the contract ends: who controls the land, who
-- has committed to maintain it, for how long." One buyer asked about the period
-- after a five-year contract, another about thirty to forty years - so this is a
-- SET of dated commitments with named responsible parties, not one number.
CREATE TABLE proj.durability_commitment (
  project_id       uuid NOT NULL REFERENCES proj.project(id),
  commitment_key   text NOT NULL,
  version_no       int  NOT NULL CHECK (version_no >= 1),
  prev_version_no  int GENERATED ALWAYS AS
                   (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  responsible_org_id uuid REFERENCES org.organisation(id),
  starts_on        date,
  ends_on          date,
  horizon_years    int CHECK (horizon_years > 0),
  source_ref_id    uuid NOT NULL REFERENCES sylva.source_ref(id),
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, commitment_key, version_no),
  CHECK (num_nonnulls(ends_on, horizon_years) >= 1),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on > starts_on),
  FOREIGN KEY (project_id, commitment_key, prev_version_no)
    REFERENCES proj.durability_commitment (project_id, commitment_key, version_no)
);

CREATE TABLE proj.durability_commitment_text (
  project_id     uuid NOT NULL,
  commitment_key text NOT NULL,
  version_no     int  NOT NULL,
  locale         text NOT NULL REFERENCES i18n.locale(code),
  statement      sylva.nonblank NOT NULL,
  land_control_note sylva.nonblank NOT NULL,
  status         i18n.translation_status NOT NULL DEFAULT 'human_draft',
  PRIMARY KEY (project_id, commitment_key, version_no, locale),
  FOREIGN KEY (project_id, commitment_key, version_no)
    REFERENCES proj.durability_commitment (project_id, commitment_key, version_no)
);

-- ------------------------------------------------- PARTNERS ON THE GROUND
CREATE TABLE proj.party_role (
  code     text PRIMARY KEY,
  label_en sylva.nonblank NOT NULL
);
INSERT INTO proj.party_role VALUES
  ('developer','Develops the project'), ('landowner','Owns the land'),
  ('verifier','Verifies the result'),   ('partner','Other partner');

CREATE TABLE proj.project_party (
  project_id    uuid NOT NULL REFERENCES proj.project(id),
  party_org_id  uuid NOT NULL REFERENCES org.organisation(id),
  party_role    text NOT NULL REFERENCES proj.party_role(code),
  description_en text,
  source_ref_id uuid NOT NULL REFERENCES sylva.source_ref(id),
  PRIMARY KEY (project_id, party_org_id, party_role)
);
COMMENT ON COLUMN proj.project_party.description_en IS
  'Where a landowner is a natural person, the page carries a NON-IDENTIFYING description ("private landowner, 40 ha, under a 30-year management agreement") and the name stays out of the database entirely, in Sylva''s own files. This is the most likely place for personal data to leak into the wrong table - confirm the handling with the client.';

-- ---------------------------------------------- GENERIC SOURCED FIGURES
-- Area, budget, expected impact, financing need and anything else the page shows
-- as a number. Investor gating is DATA (is_investor_only), not a new policy per
-- newly gated figure.
CREATE TABLE proj.metric_definition (
  code             text PRIMARY KEY,
  label_en         sylva.nonblank NOT NULL,
  category         sylva.nonblank NOT NULL,
  value_kind       text NOT NULL CHECK (value_kind IN ('numeric','range','text','date')),
  default_uom      text,
  is_investor_only boolean NOT NULL DEFAULT false
);

CREATE TABLE proj.project_metric (
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  metric_code     text NOT NULL REFERENCES proj.metric_definition(code),
  period_id       uuid,
  scope_key       text GENERATED ALWAYS AS (coalesce(period_id::text,'-')) STORED,
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  value_numeric   numeric(24,6),
  value_low       numeric(24,6),
  value_high      numeric(24,6),
  value_text      text,
  value_date      date,
  uom             text,
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  as_of_date      date NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, metric_code, scope_key, version_no),
  CHECK (num_nonnulls(value_numeric, value_low, value_text, value_date) = 1),
  CHECK ((value_low IS NULL) = (value_high IS NULL)),
  CHECK (value_high IS NULL OR value_high >= value_low),
  FOREIGN KEY (period_id, project_id) REFERENCES proj.period (id, project_id),
  FOREIGN KEY (project_id, metric_code, scope_key, prev_version_no)
    REFERENCES proj.project_metric (project_id, metric_code, scope_key, version_no)
);
CREATE INDEX ix_project_metric_project ON proj.project_metric (project_id);
