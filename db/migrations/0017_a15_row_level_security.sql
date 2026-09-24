-- ============================================================================
-- A15. ROW-LEVEL SECURITY  ·  reviewed table by table
-- ============================================================================
-- Rules followed throughout, because "one buyer seeing another buyer's prices or
-- terms is the failure we most need to avoid":
--   * EVERY policy names its roles with an explicit TO clause. A policy with no
--     TO clause applies to PUBLIC and cannot be reviewed against a role matrix.
--   * Deny by default: a table with RLS enabled and no policy for a role returns
--     zero rows to that role. Absence of a policy is the decision.
--   * The coarse tier is current_user (a database role). sylva.actor_org_id()
--     only narrows WITHIN a tier.
--   * FORCE ROW LEVEL SECURITY everywhere, so the owner is policy-bound too.

-- Predicates used by the project-page policies. SECURITY DEFINER so a policy on
-- one table does not have to compose with proj.project's own policies.
CREATE FUNCTION proj.is_publicly_visible(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, proj AS
$$ SELECT EXISTS (SELECT 1 FROM proj.project x
                   WHERE x.id = p_project_id
                     AND x.status IN ('published','withdrawn','archived')) $$;

CREATE FUNCTION proj.is_owned_by_actor(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, proj, sylva AS
$$ SELECT EXISTS (SELECT 1 FROM proj.project x
                   WHERE x.id = p_project_id
                     AND x.owner_org_id = sylva.actor_org_id()) $$;

GRANT EXECUTE ON FUNCTION proj.is_publicly_visible(uuid), proj.is_owned_by_actor(uuid)
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

-- ------------------------------------------------ OWNER MAINTENANCE POLICY
-- sylva_owner is the migration role and the role every SECURITY DEFINER trigger
-- and helper runs as. It already holds DDL on these tables, so an explicit,
-- named, reviewable policy is better than leaving FORCE off. NOBODY LOGS IN AS
-- sylva_owner (it is NOLOGIN) and no view is owned by it over an RLS table.
DO $own$
DECLARE t regclass;
BEGIN
  FOR t IN SELECT c.oid::regclass FROM pg_class c
            WHERE c.relrowsecurity AND c.relnamespace::regnamespace::text IN
                  ('sylva','identity','org','units','proj','geo','doc','deal','credit','record','i18n','platform')
  LOOP
    EXECUTE format('CREATE POLICY p_owner_maintenance ON %s FOR ALL TO sylva_owner
                    USING (true) WITH CHECK (true)', t);
  END LOOP;
END $own$;

-- ============================ ORGANISATIONS ================================
-- Every role may see THAT an organisation exists and its sector / country /
-- size band, because those are the public record's counterparty attributes.
-- legal_name is withheld by COLUMN privilege, not by row policy.
CREATE POLICY p_org_public  ON org.organisation FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor, sylva_report
  USING (true);
CREATE POLICY p_org_privileged ON org.organisation FOR SELECT
  TO sylva_operator, sylva_auditor, sylva_record USING (true);
CREATE POLICY p_org_operator_write ON org.organisation FOR INSERT
  TO sylva_operator WITH CHECK (true);
CREATE POLICY p_org_operator_update ON org.organisation FOR UPDATE
  TO sylva_operator USING (true) WITH CHECK (true);

-- The pseudonym IS the public identity, so it is world readable. It is
-- append-only, so it is never changed and never recycled.
CREATE POLICY p_pseudonym_public ON org.organisation_pseudonym FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record USING (true);
CREATE POLICY p_pseudonym_operator ON org.organisation_pseudonym FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- ============================ VETTING (R6) =================================
CREATE POLICY p_vsub_own ON org.vetting_submission FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (org_id = sylva.actor_org_id());
CREATE POLICY p_vsub_privileged ON org.vetting_submission FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_vsub_insert ON org.vetting_submission FOR INSERT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  WITH CHECK (org_id = sylva.actor_org_id());
CREATE POLICY p_vsub_insert_op ON org.vetting_submission FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_vans_own ON org.vetting_answer FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (EXISTS (SELECT 1 FROM org.vetting_submission s
                  WHERE s.id = org.vetting_answer.submission_id
                    AND s.org_id = sylva.actor_org_id()));
CREATE POLICY p_vans_privileged ON org.vetting_answer FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_vans_insert ON org.vetting_answer FOR INSERT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  WITH CHECK (EXISTS (SELECT 1 FROM org.vetting_submission s
                       WHERE s.id = org.vetting_answer.submission_id
                         AND s.org_id = sylva.actor_org_id()));
CREATE POLICY p_vans_insert_op ON org.vetting_answer FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- An organisation sees ITS OWN decisions. Whether a declined organisation is
-- told why is an OPEN DECISION; the UI shows status only.
CREATE POLICY p_vdec_own ON org.vetting_decision FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (org_id = sylva.actor_org_id());
CREATE POLICY p_vdec_privileged ON org.vetting_decision FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
-- only Sylva decides
CREATE POLICY p_vdec_insert ON org.vetting_decision FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_approval_own ON org.org_role_approval FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (org_id = sylva.actor_org_id());
CREATE POLICY p_approval_privileged ON org.org_role_approval FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
-- No INSERT/UPDATE/DELETE policy for any application role: this cache is written
-- only by the SECURITY DEFINER trigger on org.vetting_decision.

-- ============================== PROJECTS ===================================
CREATE POLICY p_project_public ON proj.project FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
  USING (status IN ('published','withdrawn','archived'));
CREATE POLICY p_project_owner ON proj.project FOR SELECT
  TO sylva_project_owner
  USING (status IN ('published','withdrawn','archived')
         OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_project_privileged ON proj.project FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_project_operator_write ON proj.project FOR INSERT
  TO sylva_operator WITH CHECK (true);
-- Publication is an operator act (section 4: "we vet everyone, confirm records
-- and publish"). The gate trigger still refuses if the page is incomplete.
CREATE POLICY p_project_operator_update ON proj.project FOR UPDATE
  TO sylva_operator USING (true) WITH CHECK (true);

CREATE POLICY p_put_public ON proj.project_unit_type FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
  USING (proj.is_publicly_visible(project_id));
CREATE POLICY p_put_owner ON proj.project_unit_type FOR SELECT
  TO sylva_project_owner
  USING (proj.is_publicly_visible(project_id) OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_put_privileged ON proj.project_unit_type FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_put_insert ON proj.project_unit_type FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_period_public ON proj.period FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
  USING (proj.is_publicly_visible(project_id));
CREATE POLICY p_period_owner ON proj.period FOR SELECT
  TO sylva_project_owner
  USING (proj.is_publicly_visible(project_id) OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_period_privileged ON proj.period FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_period_insert ON proj.period FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- ------------------------------------------ R1 SURFACES: FORECAST + BALANCE
CREATE POLICY p_forecast_public ON proj.period_forecast FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
  USING (proj.is_publicly_visible(project_id));
CREATE POLICY p_forecast_owner ON proj.period_forecast FOR SELECT
  TO sylva_project_owner
  USING (proj.is_publicly_visible(project_id) OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_forecast_privileged ON proj.period_forecast FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_forecast_insert_owner ON proj.period_forecast FOR INSERT
  TO sylva_project_owner
  WITH CHECK (proj.is_owned_by_actor(project_id)
              AND recorded_by_org_id = sylva.actor_org_id());
CREATE POLICY p_forecast_insert_op ON proj.period_forecast FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_balance_public ON proj.period_balance FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
  USING (proj.is_publicly_visible(project_id));
CREATE POLICY p_balance_owner ON proj.period_balance FOR SELECT
  TO sylva_project_owner
  USING (proj.is_publicly_visible(project_id) OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_balance_privileged ON proj.period_balance FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
-- No write policy for any application role: the balance moves only through the
-- SECURITY DEFINER triggers on period_forecast and commitment_entry.

-- ======================= PROJECT PAGE CONTENT ==============================
-- One reviewed rule - "visible exactly when the project page is visible" -
-- applied to an enumerated list of tables that all carry project_id. The list
-- is explicit so it can be reviewed row by row; ci.assert_rls_complete()
-- fails the build if any table gains RLS without a policy.
DO $content$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'proj.project_text','proj.claim_right','proj.claim_right_text',
    'proj.outcome_indicator','proj.outcome_indicator_text','proj.indicator_value',
    'proj.durability_commitment','proj.durability_commitment_text',
    'proj.project_party','geo.project_geometry'
  ] LOOP
    EXECUTE format($p$CREATE POLICY p_content_public ON %s FOR SELECT
      TO sylva_web_anon, sylva_buyer, sylva_investor, sylva_report, sylva_record
      USING (proj.is_publicly_visible(project_id))$p$, t);
    EXECUTE format($p$CREATE POLICY p_content_owner ON %s FOR SELECT
      TO sylva_project_owner
      USING (proj.is_publicly_visible(project_id) OR proj.is_owned_by_actor(project_id))$p$, t);
    EXECUTE format($p$CREATE POLICY p_content_privileged ON %s FOR SELECT
      TO sylva_operator, sylva_auditor USING (true)$p$, t);
    EXECUTE format($p$CREATE POLICY p_content_insert ON %s FOR INSERT
      TO sylva_operator WITH CHECK (true)$p$, t);
  END LOOP;
END $content$;

-- proj.project_metric is NOT in that list, because investor-only figures are
-- gated here - and the gate is DATA (metric_definition.is_investor_only), so a
-- newly gated figure needs no new policy.
CREATE POLICY p_metric_public ON proj.project_metric FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_report, sylva_record
  USING (proj.is_publicly_visible(project_id)
         AND NOT EXISTS (SELECT 1 FROM proj.metric_definition m
                          WHERE m.code = proj.project_metric.metric_code
                            AND m.is_investor_only));
CREATE POLICY p_metric_investor ON proj.project_metric FOR SELECT
  TO sylva_investor
  USING (proj.is_publicly_visible(project_id)
         AND (NOT EXISTS (SELECT 1 FROM proj.metric_definition m
                           WHERE m.code = proj.project_metric.metric_code
                             AND m.is_investor_only)
              OR sylva.is_vetted_investor()));
CREATE POLICY p_metric_owner ON proj.project_metric FOR SELECT
  TO sylva_project_owner
  USING (proj.is_owned_by_actor(project_id)
         OR (proj.is_publicly_visible(project_id)
             AND NOT EXISTS (SELECT 1 FROM proj.metric_definition m
                              WHERE m.code = proj.project_metric.metric_code
                                AND m.is_investor_only)));
CREATE POLICY p_metric_privileged ON proj.project_metric FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_metric_insert ON proj.project_metric FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- ======================== BUYER SITES (confidential) =======================
-- A corporate's facility and abstraction-point list. PROJECT OWNERS GET NO
-- POLICY AT ALL: they never see a buyer's sites, only the distances the buyer
-- itself is shown. web_anon gets no policy and no privilege either.
CREATE POLICY p_site_own ON geo.buyer_site FOR ALL TO sylva_buyer
  USING (org_id = sylva.actor_org_id())
  WITH CHECK (org_id = sylva.actor_org_id());
CREATE POLICY p_site_privileged ON geo.buyer_site FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);

-- ============================== DOCUMENTS ==================================
CREATE POLICY p_doc_public ON doc.document FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor, sylva_report
  USING (visibility = 'public' AND scope = 'project'
         AND proj.is_publicly_visible(project_id));
CREATE POLICY p_doc_vetted_buyer ON doc.document FOR SELECT
  TO sylva_buyer
  USING (visibility = 'vetted_buyer' AND sylva.is_vetted_buyer()
         AND proj.is_publicly_visible(project_id));
CREATE POLICY p_doc_vetted_investor ON doc.document FOR SELECT
  TO sylva_investor
  USING (visibility = 'vetted_investor' AND sylva.is_vetted_investor()
         AND proj.is_publicly_visible(project_id));
-- zero-hop: the counterparties are denormalised onto the document and kept
-- honest by a composite FK to deal.deal(id, project_id, buyer_org_id, owner_org_id)
CREATE POLICY p_doc_deal_parties ON doc.document FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (visibility = 'deal_participants'
         AND (deal_buyer_org_id = sylva.actor_org_id()
              OR deal_owner_org_id = sylva.actor_org_id()));
CREATE POLICY p_doc_own_org ON doc.document FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (scope = 'organisation' AND org_id = sylva.actor_org_id());
CREATE POLICY p_doc_project_owner ON doc.document FOR SELECT
  TO sylva_project_owner USING (proj.is_owned_by_actor(project_id));
CREATE POLICY p_doc_privileged ON doc.document FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_doc_insert ON doc.document FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- A version is visible exactly where its parent document is, MINUS anything
-- that has been withdrawn (the operator and the auditor still read withdrawn
-- versions, because deleting would break R4).
-- NOTE the fully qualified doc.document_version.id in the NOT EXISTS: a bare
-- `id` would resolve to the withdrawal table the moment that table gained an
-- `id` column, and every withdrawn public document would be served again.
CREATE POLICY p_docver_follows_document ON doc.document_version FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor, sylva_report
  USING (EXISTS (SELECT 1 FROM doc.document d WHERE d.id = doc.document_version.document_id)
         AND NOT EXISTS (SELECT 1 FROM doc.document_withdrawal w
                          WHERE w.document_version_id = doc.document_version.id));
CREATE POLICY p_docver_privileged ON doc.document_version FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_docver_record ON doc.document_version FOR SELECT
  TO sylva_record USING (true);
CREATE POLICY p_docver_insert ON doc.document_version FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_docwd_read ON doc.document_withdrawal FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_report, sylva_operator, sylva_auditor, sylva_record USING (true);
CREATE POLICY p_docwd_insert ON doc.document_withdrawal FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_source_ref_read ON sylva.source_ref FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_report, sylva_operator, sylva_auditor, sylva_record USING (true);
CREATE POLICY p_source_ref_insert ON sylva.source_ref FOR INSERT
  TO sylva_operator, sylva_project_owner WITH CHECK (true);

CREATE POLICY p_site_notice_read ON platform.site_notice FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_report, sylva_operator, sylva_auditor, sylva_record USING (true);
CREATE POLICY p_site_notice_insert ON platform.site_notice FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- ================================ DEALS ====================================
-- This is the policy the note's worst-case failure is about.
CREATE POLICY p_deal_parties ON deal.deal FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_deal_privileged ON deal.deal FOR SELECT
  TO sylva_operator, sylva_auditor, sylva_record USING (true);
CREATE POLICY p_deal_open ON deal.deal FOR INSERT TO sylva_buyer
  WITH CHECK (buyer_org_id = sylva.actor_org_id());
CREATE POLICY p_deal_open_op ON deal.deal FOR INSERT TO sylva_operator
  WITH CHECK (true);
-- sylva_investor gets NO policy: an investor never sees a deal room.
-- NO UPDATE and NO DELETE policy exists for ANY application role, so the stage
-- and disclosure caches cannot be written even if a privilege were granted by
-- mistake later. They move only through the append-only event chains.

CREATE POLICY p_stage_event_parties ON deal.deal_stage_event FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_stage_event_privileged ON deal.deal_stage_event FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_stage_event_insert ON deal.deal_stage_event FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (actor_org_id = sylva.actor_org_id()
              AND (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id()));
CREATE POLICY p_stage_event_insert_op ON deal.deal_stage_event FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_disclosure_parties ON deal.deal_disclosure_event FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_disclosure_privileged ON deal.deal_disclosure_event FOR SELECT
  TO sylva_operator, sylva_auditor, sylva_record USING (true);
-- naming is the BUYER's choice, deal by deal: only the buyer on that deal may
-- write a disclosure event (also enforced by a CHECK on the table)
CREATE POLICY p_disclosure_insert ON deal.deal_disclosure_event FOR INSERT
  TO sylva_buyer
  WITH CHECK (buyer_org_id = sylva.actor_org_id()
              AND decided_by_org_id = sylva.actor_org_id());
CREATE POLICY p_disclosure_insert_op ON deal.deal_disclosure_event FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- The private question box: asker, project owner, Sylva, auditor. Never another
-- buyer, and never public.
CREATE POLICY p_question_asker ON deal.project_question FOR SELECT
  TO sylva_buyer, sylva_investor USING (asker_org_id = sylva.actor_org_id());
CREATE POLICY p_question_owner ON deal.project_question FOR SELECT
  TO sylva_project_owner USING (owner_org_id = sylva.actor_org_id());
CREATE POLICY p_question_privileged ON deal.project_question FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_question_insert ON deal.project_question FOR INSERT
  TO sylva_buyer, sylva_investor WITH CHECK (asker_org_id = sylva.actor_org_id());
CREATE POLICY p_question_insert_op ON deal.project_question FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_answer_read ON deal.project_question_answer FOR SELECT
  TO sylva_buyer, sylva_investor, sylva_project_owner
  USING (EXISTS (SELECT 1 FROM deal.project_question q
                  WHERE q.id = deal.project_question_answer.question_id
                    AND (q.asker_org_id = sylva.actor_org_id()
                         OR q.owner_org_id = sylva.actor_org_id())));
CREATE POLICY p_answer_privileged ON deal.project_question_answer FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_answer_insert ON deal.project_question_answer FOR INSERT
  TO sylva_project_owner
  WITH CHECK (answered_by_org_id = sylva.actor_org_id()
              AND EXISTS (SELECT 1 FROM deal.project_question q
                           WHERE q.id = deal.project_question_answer.question_id
                             AND q.owner_org_id = sylva.actor_org_id()));
CREATE POLICY p_answer_insert_op ON deal.project_question_answer FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- ============================== THE RECORD =================================
-- web_anon has NO policy on record.entry and no row-level route to it. The
-- public reads record.v_public_entry, which is owned by sylva_record.
CREATE POLICY p_record_publisher ON record.entry FOR SELECT
  TO sylva_record USING (true);
CREATE POLICY p_record_privileged ON record.entry FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
CREATE POLICY p_record_party ON record.entry FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (actor_org_id = sylva.actor_org_id()
         OR deal_buyer_org_id = sylva.actor_org_id()
         OR deal_owner_org_id = sylva.actor_org_id()
         OR proj.is_owned_by_actor(project_id));
CREATE POLICY p_record_insert ON record.entry FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (actor_org_id = sylva.actor_org_id());
CREATE POLICY p_record_insert_op ON record.entry FOR INSERT
  TO sylva_operator WITH CHECK (true);

CREATE POLICY p_access_log_privileged ON record.access_log FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
-- writes go through record.log_access() only; no role holds a direct INSERT

-- ============================== IDENTITY ===================================
-- No application role has USAGE on the identity schema, no grant and no policy.
-- A person reads their own row through identity.whoami() (SECURITY DEFINER).
CREATE POLICY p_user_privileged ON identity.user_account FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
