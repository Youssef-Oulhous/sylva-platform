-- ============================================================================
-- A19. PSEUDONYMS ARE PER DEAL, NOT PER ORGANISATION
--
-- Review finding, 23 Sep 2026. Correct, and it is a certainty rather than a
-- risk, so it is separate from the k-anonymity open item.
--
-- The note (section 3): participation is anonymous by default and "naming is
-- the buyer's choice, deal by deal."
--
-- As built, disclosure was already per deal - record.v_public_entry resolves
-- deal.deal_disclosure_event as at the time of each entry, so a later
-- disclosure correctly does not unmask earlier entries. That part was right.
--
-- The pseudonym was not. org.organisation_pseudonym is keyed (project_id,
-- org_id), so every pseudonymous entry by one organisation on one project
-- carried the SAME label. Name that organisation on one deal and every other
-- "Buyer 014" row on that project is attributable to it. Deal-by-deal choice
-- collapses to project-by-project choice.
--
-- Fix: a deal carries its own label. Two deals by the same buyer on the same
-- project get different labels and cannot be linked to each other.
--
-- WHAT THIS DOES NOT FIX, and must not be claimed to: every public row still
-- carries sector, country and size band. An organisation named on one deal can
-- still be matched to its pseudonymous rows by those three attributes. That is
-- the k-anonymity decision the client owes us - see the view comment - and it
-- cannot be closed in a migration.
-- ============================================================================

CREATE TABLE deal.deal_pseudonym (
  deal_id    uuid PRIMARY KEY REFERENCES deal.deal(id),
  project_id uuid NOT NULL REFERENCES proj.project(id),
  org_id     uuid NOT NULL REFERENCES org.organisation(id) ON DELETE RESTRICT,
  seq        int  NOT NULL CHECK (seq > 0),
  label      text NOT NULL GENERATED ALWAYS AS ('Buyer ' || lpad(seq::text, 3, '0')) STORED,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, seq),
  UNIQUE (project_id, label)
);

COMMENT ON TABLE deal.deal_pseudonym IS
  'R5. One label per DEAL, drawn from the project''s label counter so the '
  'public record reads "Buyer 014" within a project. Two deals by the same '
  'buyer on the same project get different labels: naming one does not name '
  'the other. Never changed, never recycled.';

-- Same counter as the organisation-level allocator, so labels never collide
-- within a project whichever allocator issued them.
CREATE FUNCTION deal.allocate_deal_pseudonym(p_deal_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, deal, org AS
$f$
DECLARE v_seq int; v_label text; v_project uuid; v_org uuid;
BEGIN
  SELECT label INTO v_label FROM deal.deal_pseudonym WHERE deal_id = p_deal_id;
  IF FOUND THEN RETURN v_label; END IF;

  SELECT project_id, buyer_org_id INTO v_project, v_org
    FROM deal.deal WHERE id = p_deal_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'allocate_deal_pseudonym: no such deal %', p_deal_id;
  END IF;

  INSERT INTO org.project_label_counter (project_id) VALUES (v_project)
    ON CONFLICT (project_id) DO NOTHING;
  UPDATE org.project_label_counter SET next_seq = next_seq + 1
   WHERE project_id = v_project RETURNING next_seq - 1 INTO v_seq;   -- row lock

  INSERT INTO deal.deal_pseudonym (deal_id, project_id, org_id, seq)
  VALUES (p_deal_id, v_project, v_org, v_seq) RETURNING label INTO v_label;
  RETURN v_label;
END $f$;

-- Allocate on deal creation so no public entry can ever precede the label.
CREATE FUNCTION deal.assign_pseudonym_on_open() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, deal AS
$f$ BEGIN
  PERFORM deal.allocate_deal_pseudonym(NEW.id);
  RETURN NULL;
END $f$;

CREATE TRIGGER t_deal_pseudonym AFTER INSERT ON deal.deal
  FOR EACH ROW EXECUTE FUNCTION deal.assign_pseudonym_on_open();
ALTER TABLE deal.deal ENABLE ALWAYS TRIGGER t_deal_pseudonym;

-- Append-only, like every other identity-bearing table.
INSERT INTO ci.append_only_table (table_name, note)
VALUES ('deal.deal_pseudonym', 'R5: never changed, never recycled')
ON CONFLICT DO NOTHING;
SELECT sylva.make_append_only('deal.deal_pseudonym');

ALTER TABLE deal.deal_pseudonym ENABLE ROW LEVEL SECURITY;

-- Readable by everyone: a label is the opposite of identifying. The org_id
-- column is NOT readable by the public - see the privilege grant below, which
-- is column-scoped.
CREATE POLICY p_deal_pseudonym_public ON deal.deal_pseudonym FOR SELECT
  USING (true);

REVOKE ALL ON deal.deal_pseudonym FROM PUBLIC;
GRANT SELECT (deal_id, project_id, seq, label, allocated_at)
  ON deal.deal_pseudonym
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor;
-- Only the operator and the auditor may see WHICH organisation a label belongs
-- to. That single grant is what makes the pseudonym a pseudonym.
GRANT SELECT ON deal.deal_pseudonym TO sylva_operator, sylva_auditor;
GRANT INSERT ON deal.deal_pseudonym TO sylva_operator;

CREATE INDEX ix_deal_pseudonym_project ON deal.deal_pseudonym (project_id);

-- ---------------------------------------------------------------------------
-- CI guard.
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_pseudonym_is_per_deal() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  IF to_regclass('deal.deal_pseudonym') IS NULL THEN
    RAISE EXCEPTION 'R5 regression: deal.deal_pseudonym is gone';
  END IF;
  -- No application role that can read the public record may learn which
  -- organisation a label belongs to.
  FOREACH r IN ARRAY ARRAY['sylva_web_anon','sylva_buyer',
                           'sylva_project_owner','sylva_investor'] LOOP
    IF has_column_privilege(r, 'deal.deal_pseudonym', 'org_id', 'SELECT') THEN
      RAISE EXCEPTION
        'R5 regression: % can read deal_pseudonym.org_id and so can unmask every label', r;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION ci.assert_pseudonym_is_per_deal() IS
  'Guards the per-deal pseudonym and, more importantly, the column grant that '
  'keeps org_id out of reach of anyone who can read the public record.';
