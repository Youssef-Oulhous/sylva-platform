-- ============================================================================
-- A28. THE IDENTITY GUARD MUST FOLLOW MEMBERSHIP OF THE ALLOWED ROLES
--
-- Final correction in this family. A27 allowed four roles by NAME. But the
-- login roles reach their privileges by MEMBERSHIP: sylva_login_operator is a
-- member of sylva_operator, so it can read legal_name, and a name-based
-- allowance did not recognise it.
--
-- The rule stated once, properly:
--
--   An organisation's identifying columns may be read only by a role that is,
--   or is a member of, one of: sylva_owner, sylva_operator, sylva_auditor,
--   sylva_record.
--
-- Everything else - sylva_web_anon, sylva_buyer, sylva_project_owner,
-- sylva_investor, sylva_report, sylva_login_public, sylva_login_app - must not.
-- The public route to a name is org.v_public_party and nothing else.
--
-- Note for whoever reads this later: four migrations (0025, 0026/0027, 0028,
-- this one) were spent on one idea - a privilege guard must ask
-- "can this role actually do this", not "is this role's name on a list".
-- information_schema shows grants; has_*_privilege() and pg_has_role() show
-- reality, including everything inherited. Prefer the latter, always.
-- ============================================================================

CREATE OR REPLACE FUNCTION ci.assert_identity_columns_not_public() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s can read org.organisation.%s', r.rolname, c.col), ', ')
    INTO v
    FROM pg_roles r
    CROSS JOIN (VALUES ('legal_name'), ('registration_number'), ('registered_address')) AS c(col)
    JOIN pg_class cl ON cl.oid = 'org.organisation'::regclass
   WHERE r.rolname LIKE 'sylva\_%'
     -- allowed: the schema owner, the operator, the auditor, the record writer,
     -- and any role that is a member of one of them.
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles a
        WHERE a.rolname IN ('sylva_owner','sylva_operator','sylva_auditor','sylva_record')
          AND pg_has_role(r.oid, a.oid, 'USAGE'))
     AND NOT pg_has_role(r.oid, cl.relowner, 'USAGE')   -- nor the table's own owner
     AND has_column_privilege(r.oid, cl.oid, c.col, 'SELECT');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_columns_not_public', v); END IF;
END $$;

DO $$
DECLARE fired boolean;
BEGIN
  -- must still fire for a role that genuinely should not read a name
  FOREACH fired IN ARRAY ARRAY[false] LOOP END LOOP;
  fired := false;
  GRANT SELECT (legal_name) ON org.organisation TO sylva_buyer;
  BEGIN PERFORM ci.assert_identity_columns_not_public();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT (legal_name) ON org.organisation FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity guard is toothless: sylva_buyer reading legal_name went unnoticed';
  END IF;

  -- and must be quiet when nothing is wrong
  PERFORM ci.assert_identity_columns_not_public();
  RAISE NOTICE 'identity guard verified: fires for sylva_buyer, silent otherwise';
END $$;
