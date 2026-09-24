-- ============================================================================
-- A14. PRIVILEGES
-- ============================================================================
-- Two rules that are checked by CI and must never be relaxed:
--   (R5) no public-facing role holds SELECT on org.organisation.legal_name
--   (R7) NO role at all - not the operator, not the auditor, not the reporting
--        role - holds SELECT on any *_raw quantity column.
-- Both are expressed as COLUMN-LIST GRANTS, never as "grant the table then
-- revoke a column", because a later table-level GRANT would silently restore it.

REVOKE ALL ON ALL TABLES IN SCHEMA
  sylva, identity, org, units, proj, geo, doc, deal, credit, record, i18n, platform, ci
  FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA
  sylva, identity, org, units, proj, geo, doc, deal, credit, record, i18n, platform, ci
  FROM PUBLIC;
-- SECURITY DEFINER functions must not be executable by everyone by default.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA
  sylva, identity, org, units, proj, geo, doc, deal, credit, record, i18n, platform, ci
  FROM PUBLIC;

-- helper functions every policy calls
GRANT EXECUTE ON FUNCTION
  sylva.actor_org_id(), sylva.actor_person_ref(), sylva.is_operator(),
  sylva.is_auditor(), sylva.is_privileged_reader(), sylva.is_record_publisher(),
  sylva.is_vetted(text, uuid), sylva.is_vetted_investor(), sylva.is_vetted_buyer(),
  sylva.qty(uuid, uuid, numeric), sylva.qty_add(sylva.unit_qty, sylva.unit_qty),
  sylva.qty_amount(sylva.unit_qty)
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

-- the ONE sanctioned aggregate over a quantity. REVOKE ALL ON ALL FUNCTIONS
-- above also covers aggregates, so this grant is not optional.
GRANT EXECUTE ON FUNCTION sylva.sum_same_unit(sylva.unit_qty)
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

GRANT EXECUTE ON FUNCTION geo.site_distance_m(uuid, uuid), geo.project_boundary_geojson(uuid)
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor;
GRANT EXECUTE ON FUNCTION proj.publication_gaps(uuid) TO sylva_operator, sylva_project_owner, sylva_auditor;
GRANT EXECUTE ON FUNCTION deal.counterparty_legal_name(uuid) TO sylva_project_owner, sylva_operator, sylva_auditor;
GRANT EXECUTE ON FUNCTION record.log_access(text, text, text, jsonb)
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor;
GRANT EXECUTE ON FUNCTION identity.whoami()
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator;
-- allocate_pseudonym writes; only the R6 trigger (running as the owner) and the
-- operator may call it.
GRANT EXECUTE ON FUNCTION org.allocate_pseudonym(uuid, uuid) TO sylva_operator;

-- --------------------------------------------------- PUBLIC REFERENCE DATA
DO $g$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'platform.eu_member_state','platform.storage_region','platform.sector',
    'platform.size_band','platform.unit_of_measure','platform.site_notice',
    'i18n.locale','org.actor_role','units.scheme','units.unit_type',
    'units.unit_type_translation','proj.text_field','proj.party_role',
    'proj.metric_definition','doc.document_kind','deal.deal_shape',
    'deal.deal_stage','deal.deal_stage_transition','record.entry_type',
    'sylva.source_ref','org.organisation_pseudonym','proj.project',
    'proj.project_unit_type','proj.period','proj.project_text','proj.claim_right',
    'proj.claim_right_text','proj.outcome_indicator','proj.outcome_indicator_text',
    'proj.indicator_value','proj.durability_commitment',
    'proj.durability_commitment_text','proj.project_party','geo.project_geometry',
    'doc.document','doc.document_version','doc.document_withdrawal'
  ] LOOP
    EXECUTE format('GRANT SELECT ON %s TO sylva_web_anon, sylva_buyer,
      sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor,
      sylva_report, sylva_record', t);
  END LOOP;
END $g$;

-- proj.project_metric carries figures but no unit volume; gated by RLS on
-- metric_definition.is_investor_only rather than by column privilege.
GRANT SELECT ON proj.project_metric TO sylva_web_anon, sylva_buyer,
  sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor, sylva_report, sylva_record;

-- ----------------------------------------------- R5: ORGANISATION IDENTITY
-- `SELECT legal_name FROM org.organisation` as any public-facing role fails with
-- 42501, so NO bug in any template can leak a real name.
GRANT SELECT (id, country_code, sector_code, size_band_code, created_at)
  ON org.organisation
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor, sylva_report;
GRANT SELECT ON org.organisation TO sylva_operator, sylva_auditor, sylva_record;

-- ---------------------------------------- R7: QUANTITY-BEARING BASE TABLES
-- Column lists only. The *_raw columns appear in NO grant anywhere.
GRANT SELECT (id, project_id, unit_type_id, period_id,
              expected_issuance_qty, buffer_qty, sellable_qty,
              source_ref_id, as_of_date, recorded_at, recorded_by_org_id,
              effective, blocked_reason)
  ON proj.period_forecast
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;
GRANT INSERT ON proj.period_forecast TO sylva_operator, sylva_project_owner;

GRANT SELECT (project_id, unit_type_id, period_id,
              expected_issuance_qty, buffer_qty, committed_qty, remaining_qty,
              effective_forecast_id, updated_at)
  ON proj.period_balance
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

GRANT SELECT ON proj.v_period_availability, proj.v_pending_forecast_revision
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report;
GRANT SELECT ON record.v_public_entry
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report;

-- ------------------------------------------------------------ WRITE PATHS
GRANT INSERT ON sylva.source_ref TO sylva_operator, sylva_project_owner;
GRANT INSERT ON proj.project_text, proj.claim_right, proj.claim_right_text,
                proj.outcome_indicator, proj.outcome_indicator_text,
                proj.indicator_value, proj.durability_commitment,
                proj.durability_commitment_text, proj.project_party,
                proj.project_metric, proj.project_unit_type, proj.period,
                geo.project_geometry, doc.document, doc.document_version
  TO sylva_operator;
GRANT INSERT ON doc.document_withdrawal TO sylva_operator;
-- the operator administers reference data (schemes, unit types, code lists,
-- questionnaires, storage regions); nobody else may write it
GRANT INSERT, UPDATE ON units.scheme, units.unit_type, units.unit_type_translation,
                        platform.sector, platform.size_band, platform.unit_of_measure,
                        platform.storage_region, org.questionnaire, org.question,
                        proj.metric_definition, proj.text_field
  TO sylva_operator;
GRANT UPDATE (status, published_at) ON proj.project TO sylva_operator;
GRANT INSERT ON proj.project TO sylva_operator;

-- buyer sites are operational data, not the record: a buyer maintains its own
GRANT SELECT, INSERT, UPDATE, DELETE ON geo.buyer_site TO sylva_buyer;
GRANT SELECT ON geo.buyer_site TO sylva_operator, sylva_auditor;

-- vetting
GRANT SELECT ON org.questionnaire, org.question
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor, sylva_web_anon;
GRANT SELECT, INSERT ON org.vetting_submission, org.vetting_answer
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator;
GRANT SELECT ON org.vetting_submission, org.vetting_answer TO sylva_auditor;
GRANT SELECT ON org.vetting_decision, org.org_role_approval
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor;
GRANT INSERT ON org.vetting_decision TO sylva_operator;
GRANT INSERT ON org.organisation TO sylva_operator;
GRANT UPDATE (legal_name, registration_number, registered_address, sector_code, size_band_code)
  ON org.organisation TO sylva_operator;

-- deals
GRANT SELECT ON deal.deal TO sylva_buyer, sylva_project_owner, sylva_operator,
                              sylva_auditor, sylva_record;
GRANT INSERT ON deal.deal TO sylva_buyer, sylva_operator;
GRANT SELECT, INSERT ON deal.deal_stage_event
  TO sylva_buyer, sylva_project_owner, sylva_operator;
GRANT SELECT ON deal.deal_stage_event TO sylva_auditor;
GRANT SELECT, INSERT ON deal.deal_disclosure_event TO sylva_buyer, sylva_operator;
GRANT SELECT ON deal.deal_disclosure_event TO sylva_project_owner, sylva_auditor, sylva_record;
GRANT SELECT, INSERT ON deal.project_question TO sylva_buyer, sylva_investor, sylva_operator;
GRANT SELECT ON deal.project_question TO sylva_project_owner, sylva_auditor;
GRANT SELECT, INSERT ON deal.project_question_answer TO sylva_project_owner, sylva_operator;
GRANT SELECT ON deal.project_question_answer TO sylva_buyer, sylva_investor, sylva_auditor;

-- the record
GRANT SELECT, INSERT ON record.entry
  TO sylva_buyer, sylva_project_owner, sylva_operator;
GRANT SELECT ON record.entry TO sylva_auditor, sylva_record, sylva_investor;
GRANT SELECT ON record.access_log TO sylva_operator, sylva_auditor;

-- analytics
GRANT SELECT, INSERT, UPDATE ON platform.page_view_daily TO sylva_operator;
GRANT SELECT ON platform.page_view_daily TO sylva_auditor, sylva_project_owner;

-- ------------------------------------------------------------ THE AUDITOR
-- Read-only across everything including real names, and NOTHING else, ever.
-- The auditor holds SELECT on identity; no app role does.
GRANT SELECT ON identity.user_account, identity.person_label,
                identity.user_platform_role, identity.user_session,
                identity.erasure_event
  TO sylva_auditor;
GRANT SELECT ON identity.user_account, identity.person_label,
                identity.user_platform_role, identity.erasure_event
  TO sylva_operator;
GRANT SELECT ON ci.append_only_table TO sylva_operator, sylva_auditor;
-- The auditor's privilege set is asserted to be exactly {SELECT} by
-- ci.assert_auditor_is_read_only().

-- ------------------------------------- sylva_record: the public-record owner
-- It can resolve a legal name, and it can do so ONLY through the view it owns.
GRANT SELECT ON record.entry, record.entry_type, proj.project, deal.deal,
                deal.deal_disclosure_event, org.organisation,
                org.organisation_pseudonym
  TO sylva_record;

-- --------------------------------------------------------------- SEQUENCES
GRANT USAGE ON ALL SEQUENCES IN SCHEMA record, deal, identity, org
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator;
