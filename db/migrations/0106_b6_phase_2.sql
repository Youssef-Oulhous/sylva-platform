-- ============================================================================
-- B6. PHASE 2 · APPEND-ONLY, PRIVILEGES, ROW-LEVEL SECURITY
-- ============================================================================
INSERT INTO ci.append_only_table (table_name, note) VALUES
  ('credit.registry_confirmation_event','the operator confirming against the scheme by hand'),
  ('credit.credit_position','every credit movement'),
  ('deal.commitment_entry','R1 movements; a release is a new row, never a negative'),
  ('deal.deal_terms_version','versions of the draft terms'),
  ('deal.deal_message','deal-room messages are part of the record'),
  ('proj.project_financials','investor data, versioned'),
  ('proj.evidence_pack_item','what went into a pack'),
  ('proj.evidence_pack_build','a pack downloaded six months ago is reconstructable');
DO $ao2$
DECLARE t regclass;
BEGIN
  FOR t IN SELECT table_name FROM ci.append_only_table
            WHERE table_name IN ('credit.registry_confirmation_event'::regclass,
                                 'credit.credit_position'::regclass,
                                 'deal.commitment_entry'::regclass,
                                 'deal.deal_terms_version'::regclass,
                                 'deal.deal_message'::regclass,
                                 'proj.project_financials'::regclass,
                                 'proj.evidence_pack_item'::regclass,
                                 'proj.evidence_pack_build'::regclass)
  LOOP
    PERFORM sylva.make_append_only(t);
  END LOOP;
END $ao2$;

INSERT INTO ci.no_rls_allowlist VALUES
  ('credit.position_kind','public lookup; the R3 composite-FK target'),
  ('proj.evidence_pack_element','public lookup');
INSERT INTO ci.provenance_allowlist VALUES
  ('credit.position_balance',
   'a cache: its provenance is the credit_position it caches, whose source_ref_id is NOT NULL');

-- owner maintenance policies for the Phase 2 RLS tables (see A15 for why)
DO $own2$
DECLARE t regclass;
BEGIN
  FOR t IN SELECT c.oid::regclass FROM pg_class c
            WHERE c.relrowsecurity
              AND NOT EXISTS (SELECT 1 FROM pg_policy p
                               WHERE p.polrelid = c.oid AND p.polname = 'p_owner_maintenance')
  LOOP
    EXECUTE format('CREATE POLICY p_owner_maintenance ON %s FOR ALL TO sylva_owner
                    USING (true) WITH CHECK (true)', t);
  END LOOP;
END $own2$;

-- ------------------------------------------------------------- PRIVILEGES
GRANT SELECT ON credit.position_kind, proj.evidence_pack_element
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

-- registry records are EVIDENCE and appear on the public record once confirmed
GRANT SELECT (id, scheme_id, project_id, period_id, unit_type_id, record_type,
              external_record_id, record_url, quantity_qty,
              evidence_document_version_id, confirmation_status,
              confirmed_by_org_id, confirmed_at, supersedes_id, source_ref_id,
              as_of_date, recorded_at)
  ON credit.registry_record
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;
GRANT INSERT ON credit.registry_record TO sylva_operator, sylva_project_owner;
GRANT SELECT, INSERT ON credit.registry_confirmation_event TO sylva_operator;
GRANT SELECT ON credit.registry_confirmation_event
  TO sylva_auditor, sylva_project_owner, sylva_buyer, sylva_investor, sylva_web_anon;

GRANT SELECT (id, seq, kind, project_id, period_id, unit_type_id, holder_org_id,
              amount_qty, parent_id, parent_kind, deal_id, registry_record_id,
              occurred_on, recorded_at, actor_org_id, actor_role_snapshot,
              actor_person_label, source_ref_id)
  ON credit.credit_position
  TO sylva_buyer, sylva_project_owner, sylva_operator, sylva_auditor, sylva_report;
GRANT INSERT ON credit.credit_position TO sylva_operator;
GRANT SELECT (position_id, project_id, period_id, unit_type_id,
              amount_qty, consumed_qty, remaining_qty)
  ON credit.position_balance
  TO sylva_buyer, sylva_project_owner, sylva_operator, sylva_auditor, sylva_report;
GRANT SELECT ON credit.v_position, credit.v_allocation, credit.v_transfer,
                credit.v_retirement, credit.v_cancellation
  TO sylva_buyer, sylva_project_owner, sylva_operator, sylva_auditor, sylva_report;

GRANT SELECT (entry_no, deal_id, project_id, buyer_org_id, owner_org_id,
              unit_type_id, period_id, deal_shape, entry_kind, amount_qty,
              counting_stage, committed_on, period_starts_on, period_ends_on,
              source_ref_id, actor_org_id, recorded_at, corrects_entry_no,
              correction_reason)
  ON deal.commitment_entry
  TO sylva_buyer, sylva_project_owner, sylva_operator, sylva_auditor;
GRANT INSERT ON deal.commitment_entry TO sylva_operator;

GRANT SELECT (id, deal_id, project_id, buyer_org_id, owner_org_id, version_no,
              unit_type_id, period_id, deal_shape, amount_qty, price_amount,
              price_currency, price_basis, claim_rights_note, delivery_note,
              document_version_id, proposed_by_org_id, proposed_at, source_ref_id)
  ON deal.deal_terms_version
  TO sylva_buyer, sylva_project_owner, sylva_operator, sylva_auditor;
GRANT INSERT ON deal.deal_terms_version TO sylva_buyer, sylva_project_owner, sylva_operator;

GRANT SELECT, INSERT ON deal.deal_message
  TO sylva_buyer, sylva_project_owner, sylva_operator;
GRANT SELECT ON deal.deal_message TO sylva_auditor;

GRANT SELECT ON proj.project_financials TO sylva_investor, sylva_project_owner,
                                           sylva_operator, sylva_auditor;
GRANT INSERT ON proj.project_financials TO sylva_operator;
GRANT SELECT, INSERT ON proj.evidence_pack_item, proj.evidence_pack_build
  TO sylva_operator;
GRANT SELECT ON proj.evidence_pack_item, proj.evidence_pack_build
  TO sylva_buyer, sylva_auditor, sylva_project_owner;

-- --------------------------------------------------- ROW-LEVEL SECURITY
CREATE POLICY p_registry_public ON credit.registry_record FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
  USING (proj.is_publicly_visible(project_id));
CREATE POLICY p_registry_owner ON credit.registry_record FOR SELECT
  TO sylva_project_owner
  USING (proj.is_publicly_visible(project_id) OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_registry_privileged ON credit.registry_record FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_registry_insert_owner ON credit.registry_record FOR INSERT
  TO sylva_project_owner WITH CHECK (proj.is_owned_by_actor(project_id));
CREATE POLICY p_registry_insert_op ON credit.registry_record FOR INSERT
  TO sylva_operator WITH CHECK (true);
-- no UPDATE policy for any application role: only the SECURITY DEFINER
-- confirmation trigger advances the status.

CREATE POLICY p_regconf_read ON credit.registry_confirmation_event FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_regconf_insert ON credit.registry_confirmation_event FOR INSERT
  TO sylva_operator WITH CHECK (true);   -- only Sylva confirms

CREATE POLICY p_position_holder ON credit.credit_position FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (holder_org_id = sylva.actor_org_id() OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_position_privileged ON credit.credit_position FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_position_insert ON credit.credit_position FOR INSERT
  TO sylva_operator WITH CHECK (true);
-- sylva_web_anon and sylva_investor get NO policy and no privilege.

CREATE POLICY p_posbal_holder ON credit.position_balance FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (EXISTS (SELECT 1 FROM credit.credit_position p
                  WHERE p.id = credit.position_balance.position_id
                    AND (p.holder_org_id = sylva.actor_org_id()
                         OR proj.is_owned_by_actor(p.project_id))));
CREATE POLICY p_posbal_privileged ON credit.position_balance FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);

-- zero-hop, on indexed columns
CREATE POLICY p_commitment_parties ON deal.commitment_entry FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_commitment_privileged ON deal.commitment_entry FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_commitment_insert ON deal.commitment_entry FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_terms_parties ON deal.deal_terms_version FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_terms_privileged ON deal.deal_terms_version FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_terms_insert ON deal.deal_terms_version FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (proposed_by_org_id = sylva.actor_org_id()
              AND (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id()));
CREATE POLICY p_terms_insert_op ON deal.deal_terms_version FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_message_parties ON deal.deal_message FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_message_privileged ON deal.deal_message FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_message_insert ON deal.deal_message FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (sender_org_id = sylva.actor_org_id()
              AND (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id()));
CREATE POLICY p_message_insert_op ON deal.deal_message FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- INVESTOR DATA: deny by default. No permissive policy exists for the public
-- role or the buyer role at all, so these rows are unreachable by every route.
CREATE POLICY p_financials_investor ON proj.project_financials FOR SELECT
  TO sylva_investor
  USING (proj.is_publicly_visible(project_id) AND sylva.is_vetted_investor());
CREATE POLICY p_financials_owner ON proj.project_financials FOR SELECT
  TO sylva_project_owner USING (proj.is_owned_by_actor(project_id));
CREATE POLICY p_financials_privileged ON proj.project_financials FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_financials_insert ON proj.project_financials FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_pack_item_vetted ON proj.evidence_pack_item FOR SELECT
  TO sylva_buyer USING (sylva.is_vetted_buyer() AND proj.is_publicly_visible(project_id));
CREATE POLICY p_pack_item_owner ON proj.evidence_pack_item FOR SELECT
  TO sylva_project_owner USING (proj.is_owned_by_actor(project_id));
CREATE POLICY p_pack_item_privileged ON proj.evidence_pack_item FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_pack_item_insert ON proj.evidence_pack_item FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_pack_build_own ON proj.evidence_pack_build FOR SELECT
  TO sylva_buyer USING (built_for_org_id = sylva.actor_org_id());
CREATE POLICY p_pack_build_owner ON proj.evidence_pack_build FOR SELECT
  TO sylva_project_owner USING (proj.is_owned_by_actor(project_id));
CREATE POLICY p_pack_build_privileged ON proj.evidence_pack_build FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_pack_build_insert ON proj.evidence_pack_build FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- ------------------------------------------------- PHASE 2 CI ASSERTIONS
-- The R3 belt-and-braces CHECK carries a literal list. This keeps it in step
-- with the lookup table it duplicates.
CREATE FUNCTION ci.assert_r3_literals_match_lookup() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, credit AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(code, ', ' ORDER BY code) INTO v
    FROM credit.position_kind WHERE is_terminal;
  IF v IS DISTINCT FROM 'cancelled, retired' THEN
    PERFORM ci.fail('r3_literals_match_lookup',
      'credit.position_kind terminal set is (' || coalesce(v,'') ||
      ') but the r3_terminal_is_final CHECK hard-codes (retired, cancelled)');
  END IF;
END $f$;

CREATE FUNCTION ci.reconcile_position_balance()
RETURNS TABLE (position_id uuid, cached_consumed numeric, actual_consumed numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, credit AS
$$
  SELECT b.position_id, b.consumed_raw,
         coalesce((SELECT sum(c.amount_raw) FROM credit.credit_position c
                    WHERE c.parent_id = b.position_id), 0)
    FROM credit.position_balance b
   WHERE b.consumed_raw IS DISTINCT FROM
         coalesce((SELECT sum(c.amount_raw) FROM credit.credit_position c
                    WHERE c.parent_id = b.position_id), 0)
$$;

CREATE FUNCTION ci.reconcile_committed_volume()
RETURNS TABLE (project_id uuid, unit_type_id uuid, period_id uuid,
               cached numeric, from_entries numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, proj, deal AS
$$
  SELECT b.project_id, b.unit_type_id, b.period_id, b.committed_raw,
         coalesce((SELECT sum(deal.commitment_effect_sign(e.entry_kind) * e.amount_raw)
                     FROM deal.commitment_entry e
                    WHERE e.project_id = b.project_id
                      AND e.unit_type_id = b.unit_type_id
                      AND e.period_id = b.period_id), 0)
    FROM proj.period_balance b
   WHERE b.committed_raw IS DISTINCT FROM
         coalesce((SELECT sum(deal.commitment_effect_sign(e.entry_kind) * e.amount_raw)
                     FROM deal.commitment_entry e
                    WHERE e.project_id = b.project_id
                      AND e.unit_type_id = b.unit_type_id
                      AND e.period_id = b.period_id), 0)
$$;

CREATE OR REPLACE FUNCTION ci.run_all() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci AS
$f$
DECLARE n int;
BEGIN
  PERFORM ci.assert_no_raw_amount_grants();
  PERFORM ci.assert_no_volume_without_scope();
  PERFORM ci.assert_no_conversion();
  PERFORM ci.assert_one_unit_type_per_row();
  PERFORM ci.assert_no_float_columns();
  PERFORM ci.assert_no_fk_into_identity();
  PERFORM ci.assert_no_personal_columns_outside_identity();
  PERFORM ci.assert_no_soft_delete();
  PERFORM ci.assert_append_only_complete();
  PERFORM ci.assert_rls_complete();
  PERFORM ci.assert_identity_columns_not_public();
  PERFORM ci.assert_auditor_is_read_only();
  PERFORM ci.assert_web_anon_is_read_only();
  PERFORM ci.assert_figures_have_provenance();
  PERFORM ci.assert_r3_literals_match_lookup();
  SELECT count(*) INTO n FROM ci.reconcile_period_balance();
  IF n > 0 THEN PERFORM ci.fail('reconcile_period_balance', n || ' rows diverge'); END IF;
  SELECT count(*) INTO n FROM ci.reconcile_position_balance();
  IF n > 0 THEN PERFORM ci.fail('reconcile_position_balance', n || ' rows diverge'); END IF;
  SELECT count(*) INTO n FROM ci.reconcile_committed_volume();
  IF n > 0 THEN PERFORM ci.fail('reconcile_committed_volume', n || ' rows diverge'); END IF;
  RETURN 'all CI assertions passed';
END $f$;


-- the operator and the auditor can run the assertions and the reconciliations
-- without holding any privilege on the raw columns those functions read
GRANT EXECUTE ON FUNCTION ci.run_all(), ci.reconcile_period_balance(),
                          ci.reconcile_position_balance(), ci.reconcile_committed_volume()
  TO sylva_operator, sylva_auditor;
