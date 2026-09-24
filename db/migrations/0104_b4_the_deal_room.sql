-- ============================================================================
-- B4. THE DEAL ROOM  ·  the rows the note calls the failure most to be avoided
-- ============================================================================
CREATE TABLE deal.deal_terms_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL,
  project_id      uuid NOT NULL,
  buyer_org_id    uuid NOT NULL,
  owner_org_id    uuid NOT NULL,
  version_no      int  NOT NULL CHECK (version_no >= 1),
  prev_version_no int GENERATED ALWAYS AS
                  (CASE WHEN version_no = 1 THEN NULL ELSE version_no - 1 END) STORED,
  unit_type_id    uuid NOT NULL,
  period_id       uuid NOT NULL,
  deal_shape      text NOT NULL REFERENCES deal.deal_shape(code),
  amount_raw      sylva.unit_amount NOT NULL CHECK (amount_raw > 0),
  amount_qty      sylva.unit_qty GENERATED ALWAYS AS
                    (ROW(project_id, unit_type_id, amount_raw)::sylva.unit_qty) STORED,
  -- price is informational: the platform is not a payment system. It appears on
  -- NO public surface and in NO record entry.
  price_amount    sylva.money_amount,
  price_currency  char(3) NOT NULL DEFAULT 'EUR' CHECK (price_currency ~ '^[A-Z]{3}$'),
  price_basis     text CHECK (price_basis IN ('per_unit','total')),
  claim_rights_note text,
  delivery_note   text,
  document_version_id uuid REFERENCES doc.document_version(id),
  proposed_by_org_id  uuid NOT NULL REFERENCES org.organisation(id),
  proposed_at     timestamptz NOT NULL DEFAULT now(),
  source_ref_id   uuid NOT NULL REFERENCES sylva.source_ref(id),
  UNIQUE (deal_id, version_no),
  CHECK (num_nulls(price_amount, price_basis) IN (0,2)),
  FOREIGN KEY (deal_id, project_id, buyer_org_id, owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id),
  FOREIGN KEY (project_id, unit_type_id)
    REFERENCES proj.project_unit_type (project_id, unit_type_id),
  FOREIGN KEY (period_id, project_id) REFERENCES proj.period (id, project_id),
  FOREIGN KEY (deal_id, prev_version_no)
    REFERENCES deal.deal_terms_version (deal_id, version_no)
);
CREATE INDEX ix_terms_buyer ON deal.deal_terms_version (buyer_org_id);
CREATE INDEX ix_terms_owner ON deal.deal_terms_version (owner_org_id);
CREATE INDEX ix_terms_deal  ON deal.deal_terms_version (deal_id, version_no DESC);

CREATE TABLE deal.deal_message (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id       uuid NOT NULL,
  project_id    uuid NOT NULL,
  buyer_org_id  uuid NOT NULL,
  owner_org_id  uuid NOT NULL,
  sender_org_id uuid NOT NULL REFERENCES org.organisation(id),
  sender_person_ref uuid,                     -- opaque; NO FK
  body          sylva.nonblank NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (deal_id, project_id, buyer_org_id, owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id),
  CONSTRAINT sender_is_a_party CHECK (sender_org_id IN (buyer_org_id, owner_org_id))
);
CREATE INDEX ix_message_deal  ON deal.deal_message (deal_id, sent_at DESC);
CREATE INDEX ix_message_buyer ON deal.deal_message (buyer_org_id);
CREATE INDEX ix_message_owner ON deal.deal_message (owner_org_id);
COMMENT ON TABLE deal.deal_message IS
  'Free-text bodies are the acknowledged second category of personal data. They are part of the record and are NOT deleted on erasure: the account goes and authorship detaches. The privacy notice must say this before a person posts.';
