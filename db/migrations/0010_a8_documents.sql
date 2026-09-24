-- ============================================================================
-- A8. DOCUMENTS  ·  bytes in EU object storage, authorisation here
-- ============================================================================
CREATE TABLE doc.document_kind (
  code     text PRIMARY KEY,
  label_en sylva.nonblank NOT NULL
);
INSERT INTO doc.document_kind VALUES
  ('project_idea_note','Project idea note'),
  ('project_design_document','Project design document'),
  ('monitoring_plan','Monitoring plan'),
  ('verification_report','Verification report'),
  ('boundary_geojson','Project boundary (GeoJSON)'),
  ('catchment_geojson','Catchment (GeoJSON)'),
  ('signed_agreement','Signed agreement'),
  ('term_sheet','Term sheet'),
  ('letter_of_intent','Letter of intent'),
  ('vetting_evidence','Vetting evidence'),
  ('registry_evidence','Scheme registry evidence'),
  ('financial_model','Financial model'),
  ('reporting_evidence_pack','Reporting evidence pack'),
  ('other','Other');

CREATE TYPE doc.visibility_class AS ENUM
  ('public','vetted_buyer','vetted_investor','deal_participants','admin','auditor');

CREATE TABLE doc.document (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL CHECK (scope IN ('project','deal','organisation')),
  kind         text NOT NULL REFERENCES doc.document_kind(code),
  visibility   doc.visibility_class NOT NULL,
  project_id   uuid REFERENCES proj.project(id),
  deal_id      uuid,                                   -- FK added after deal.deal
  org_id       uuid REFERENCES org.organisation(id),
  -- denormalised counterparties so the RLS policy on a deal document is
  -- zero-hop; kept honest by the composite FK added after deal.deal
  deal_buyer_org_id uuid,
  deal_owner_org_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_anchor CHECK (
    (scope = 'project'      AND project_id IS NOT NULL AND deal_id IS NULL     AND org_id IS NULL) OR
    (scope = 'deal'         AND project_id IS NOT NULL AND deal_id IS NOT NULL AND org_id IS NULL) OR
    (scope = 'organisation' AND project_id IS NULL     AND deal_id IS NULL     AND org_id IS NOT NULL)),
  CONSTRAINT deal_orgs_present CHECK (
    (deal_id IS NULL) = (deal_buyer_org_id IS NULL) AND
    (deal_id IS NULL) = (deal_owner_org_id IS NULL))
);
CREATE INDEX ix_document_project ON doc.document (project_id);
CREATE INDEX ix_document_deal    ON doc.document (deal_id);
CREATE INDEX ix_document_org     ON doc.document (org_id);
CREATE INDEX ix_document_deal_buyer ON doc.document (deal_buyer_org_id);
CREATE INDEX ix_document_deal_owner ON doc.document (deal_owner_org_id);

-- Immutable versions. Visibility is fixed at INSERT: changing what an audience
-- may see is a NEW version or an explicit withdrawal, never an edit.
CREATE TABLE doc.document_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES doc.document(id),
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  storage_region  text NOT NULL REFERENCES platform.storage_region(code),  -- EU only, by FK
  storage_bucket  sylva.nonblank NOT NULL,
  storage_key     sylva.nonblank NOT NULL,
  content_sha256  sylva.sha256 NOT NULL,
  byte_size       bigint NOT NULL CHECK (byte_size > 0),
  media_type      sylva.nonblank NOT NULL,
  locale          text REFERENCES i18n.locale(code),
  uploaded_by_org_id uuid NOT NULL REFERENCES org.organisation(id),
  uploaded_by_person_ref uuid,                         -- opaque; NO FK
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no),
  UNIQUE (storage_bucket, storage_key),                -- a key is never reused
  -- trigger-free contiguity, concurrency-safe: two racing inserts collide on
  -- the unique key rather than both reading the same max()
  FOREIGN KEY (document_id, prev_version_no)
    REFERENCES doc.document_version (document_id, version_no)
);
CREATE INDEX ix_document_version_doc ON doc.document_version (document_id, version_no DESC);

-- A mistakenly published file is WITHDRAWN, never deleted: deleting would break
-- R4. The row and its hash survive for the auditor and for any record entry
-- that cited it; every serving route joins against this table and 404s.
CREATE TABLE doc.document_withdrawal (
  document_version_id uuid PRIMARY KEY REFERENCES doc.document_version(id),
  reason              sylva.nonblank NOT NULL,
  withdrawn_by_org_id uuid NOT NULL REFERENCES org.organisation(id),
  withdrawn_at        timestamptz NOT NULL DEFAULT now()
);

-- late FKs
ALTER TABLE sylva.source_ref
  ADD CONSTRAINT source_document_version_fk FOREIGN KEY (document_version_id)
  REFERENCES doc.document_version(id);
ALTER TABLE geo.project_geometry
  ADD CONSTRAINT geometry_geojson_fk FOREIGN KEY (geojson_document_version_id)
  REFERENCES doc.document_version(id);
ALTER TABLE proj.outcome_indicator
  ADD CONSTRAINT outcome_monitoring_plan_fk FOREIGN KEY (monitoring_plan_document_id)
  REFERENCES doc.document(id);
ALTER TABLE org.vetting_answer
  ADD CONSTRAINT vetting_answer_document_fk FOREIGN KEY (answer_document_id)
  REFERENCES doc.document(id);
