-- ============================================================================
-- A29. THE DEAL-PSEUDONYM POLICY MUST NAME ITS ROLES
--
-- Caught by ci.assert_rls_complete() once the other guards stopped drowning it
-- out. My own defect, introduced in 0021.
--
--   CREATE POLICY p_deal_pseudonym_public ON deal.deal_pseudonym
--     FOR SELECT USING (true);
--
-- No TO clause means the policy targets PUBLIC. On this schema the effect was
-- contained - the column grant is what actually withholds org_id, and no role
-- outside the intended set holds SELECT on the table at all - so no identity
-- was reachable. But "contained by a grant elsewhere" is not the standard this
-- schema is held to: every policy states its roles, so that a future GRANT
-- cannot quietly widen an existing policy's reach.
--
-- The label is public information by design; the mapping from label to
-- organisation is not, and stays restricted to the operator and the auditor by
-- the column grants in 0021.
-- ============================================================================

DROP POLICY IF EXISTS p_deal_pseudonym_public ON deal.deal_pseudonym;

CREATE POLICY p_deal_pseudonym_readable ON deal.deal_pseudonym
  FOR SELECT
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report
  USING (true);

COMMENT ON POLICY p_deal_pseudonym_readable ON deal.deal_pseudonym IS
  'R5. The LABEL is public - a pseudonym is meant to be seen. Which '
  'organisation it belongs to is not: org_id is withheld by column-level grant '
  'from every role that can read the public record. See migration 0021 and '
  'ci.assert_pseudonym_is_per_deal().';
