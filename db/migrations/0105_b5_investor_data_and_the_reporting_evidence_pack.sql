-- ============================================================================
-- B5. INVESTOR DATA AND THE REPORTING EVIDENCE PACK
-- ============================================================================
-- "Financing need, revenue streams, the financial model. Visible only to
-- investors we have vetted." The platform DISPLAYS the project's own model; it
-- computes no return.
CREATE TABLE proj.project_financials (
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  financing_need  sylva.money_amount,
  currency        char(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  revenue_streams_note text,
  financial_model_document_id uuid REFERENCES doc.document(id),
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  as_of_date      date NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version_no),
  FOREIGN KEY (project_id, prev_version_no)
    REFERENCES proj.project_financials (project_id, version_no)
);
COMMENT ON TABLE proj.project_financials IS
  'Deny by default: there is no permissive policy for the public or buyer roles at all, so these rows are unreachable by every route including a mistaken join. NOTE: no commitment threshold gates this. The brief describes investors as coming in "after buyers commit"; the note states that only as an observation about how the market sequences. A hard gate would be trivial to add and impossible to remove from the record once deals depend on it - OPEN DECISION.';

-- "its assessor asked it to consider projects with a measurable action, a fixed
-- timeframe, expected impact, a budget and a verification standard. We assemble
-- exactly that as a downloadable pack. We state what is in it and make no claim
-- that it satisfies any particular auditor."
-- The words CSRD-compliant, CSRD-ready and CSRD-grade appear nowhere in this
-- schema, in any column, in any seeded value, or in any generated filename.
CREATE TABLE proj.evidence_pack_element (
  code     text PRIMARY KEY,
  label_en sylva.nonblank NOT NULL
);
INSERT INTO proj.evidence_pack_element VALUES
  ('measurable_action','A measurable action'),
  ('fixed_timeframe','A fixed timeframe'),
  ('expected_impact','Expected impact'),
  ('budget','A budget'),
  ('verification_standard','A verification standard');

CREATE TABLE proj.evidence_pack_item (
  project_id   uuid NOT NULL REFERENCES proj.project(id),
  element_code text NOT NULL REFERENCES proj.evidence_pack_element(code),
  item_no      int  NOT NULL CHECK (item_no >= 1),
  source_document_version_id uuid REFERENCES doc.document_version(id),
  source_metric_code text REFERENCES proj.metric_definition(code),
  note         text,
  assembled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, element_code, item_no),
  -- an ASSEMBLY of existing documents and figures, never a generated assertion
  CHECK (num_nonnulls(source_document_version_id, source_metric_code) = 1)
);

CREATE TABLE proj.evidence_pack_build (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES proj.project(id),
  built_for_org_id uuid NOT NULL REFERENCES org.organisation(id),
  built_at      timestamptz NOT NULL DEFAULT now(),
  manifest      jsonb NOT NULL,      -- the exact document_version_ids and metric
  document_version_id uuid REFERENCES doc.document_version(id)  -- codes included
);
CREATE INDEX ix_pack_build_org ON proj.evidence_pack_build (built_for_org_id);
CREATE INDEX ix_pack_build_project ON proj.evidence_pack_build (project_id);
