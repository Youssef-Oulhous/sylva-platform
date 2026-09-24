-- ============================================================================
-- A12. R4 · APPEND-ONLY, APPLIED FROM ONE LIST
-- ============================================================================
-- Privilege + row trigger + statement trigger + TRUNCATE trigger + ENABLE ALWAYS
-- + ENABLE/FORCE RLS, applied in one loop so table N+1 cannot silently miss a
-- layer. ci.assert_append_only_complete() proves the list and the catalogue agree.
CREATE TABLE ci.append_only_table (
  table_name regclass PRIMARY KEY,
  note       text
);
INSERT INTO ci.append_only_table (table_name, note) VALUES
  ('sylva.source_ref','provenance is evidence; it is never edited'),
  ('record.entry','the permanent record'),
  ('record.access_log','who read what'),
  ('deal.deal_stage_event','the stage chain deal.stage is derived from'),
  ('deal.deal_disclosure_event','R5: disclosure applies forward only'),
  ('deal.project_question','the private question box'),
  ('deal.project_question_answer','an answer is a new row, never an edit'),
  ('org.vetting_submission','no approval without the answers it was based on'),
  ('org.vetting_answer','free-text residue; redacted, never deleted'),
  ('org.vetting_decision','R6 source of truth'),
  ('org.organisation_pseudonym','R5: never changed, never recycled'),
  ('proj.period_forecast','R1: revisions are appended, never overwritten'),
  ('proj.project_text','content history stays visible'),
  ('proj.claim_right',''),
  ('proj.claim_right_text',''),
  ('proj.outcome_indicator',''),
  ('proj.outcome_indicator_text',''),
  ('proj.indicator_value',''),
  ('proj.durability_commitment',''),
  ('proj.durability_commitment_text',''),
  ('proj.project_metric',''),
  ('proj.project_party','the partners on the ground'),
  ('geo.project_geometry','boundary and catchment versions'),
  ('doc.document','visibility is fixed at insert'),
  ('doc.document_version','immutable bytes, immutable hash'),
  ('doc.document_withdrawal','stop serving without deleting'),
  ('identity.erasure_event','records THAT an erasure happened, never who'),
  ('platform.site_notice','the approved EU co-funding text');

DO $ao$
DECLARE t regclass;
BEGIN
  FOR t IN SELECT table_name FROM ci.append_only_table ORDER BY table_name::text LOOP
    PERFORM sylva.make_append_only(t);
  END LOOP;
END $ao$;

-- Tables that are deliberately NOT append-only, and why:
--   identity.user_account / user_session / user_platform_role / person_label
--       must be DELETABLE: that is how the right to erasure and an append-only
--       record coexist.
--   proj.project                 publication status moves through its lifecycle
--   proj.period                  operator-maintained project fact
--   proj.period_balance          cache of period_forecast + commitment_entry
--   deal.deal                    stage and disclosure caches of the event chains
--   org.org_role_approval        cache of the vetting_decision chain
--   org.project_label_counter    a counter
--   credit.registry_reference    confirmation status must be able to ADVANCE
--   credit.position_balance      cache of credit.credit_position
--   platform.page_view_daily     aggregate analytics counters
--   every lookup / reference table
-- Each cache is rebuildable from its append-only source and is reconciled by
-- ci.reconcile_period_balance() / ci.reconcile_position_balance().

-- The cache tables still need RLS.
ALTER TABLE proj.period_balance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj.period_balance      FORCE  ROW LEVEL SECURITY;
ALTER TABLE deal.deal                ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal.deal                FORCE  ROW LEVEL SECURITY;
ALTER TABLE org.org_role_approval    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org.org_role_approval    FORCE  ROW LEVEL SECURITY;
ALTER TABLE org.organisation         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org.organisation         FORCE  ROW LEVEL SECURITY;
ALTER TABLE geo.buyer_site           ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo.buyer_site           FORCE  ROW LEVEL SECURITY;
ALTER TABLE proj.project             ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj.project             FORCE  ROW LEVEL SECURITY;
ALTER TABLE identity.user_account    ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.user_account    FORCE  ROW LEVEL SECURITY;
ALTER TABLE proj.period              ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj.period              FORCE  ROW LEVEL SECURITY;
ALTER TABLE proj.project_unit_type   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj.project_unit_type   FORCE  ROW LEVEL SECURITY;
