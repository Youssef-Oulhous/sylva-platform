-- ============================================================================
-- A27. THE IDENTITY GUARD MUST ALLOW THE SCHEMA-OWNING ROLE
--
-- A26 correctly excluded the ownership chain of each table, but on a database
-- where the migration ran as `postgres` the tables are owned by postgres, so
-- sylva_owner is NOT in that chain - it holds ordinary explicit grants and was
-- reported as a leak.
--
-- sylva_owner is the role the application's objects belong to; it reads
-- everything by design and never serves a request. It belongs in the allowed
-- set beside sylva_operator, sylva_auditor and sylva_record.
--
-- The roles this guard actually protects against remain checked:
-- sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor, sylva_report.
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
    JOIN pg_roles own ON own.oid = cl.relowner
   WHERE r.rolname LIKE 'sylva\_%'
     AND r.rolname NOT IN ('sylva_owner', 'sylva_operator', 'sylva_auditor', 'sylva_record')
     AND NOT pg_has_role(r.oid, own.oid, 'USAGE')
     AND has_column_privilege(r.oid, cl.oid, c.col, 'SELECT');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_columns_not_public', v); END IF;
END $$;

DO $$
DECLARE fired boolean := false;
BEGIN
  GRANT SELECT (legal_name) ON org.organisation TO sylva_buyer;
  BEGIN PERFORM ci.assert_identity_columns_not_public();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT (legal_name) ON org.organisation FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity guard is toothless: sylva_buyer reading legal_name went unnoticed';
  END IF;
  RAISE NOTICE 'identity guard verified: still fires for an application role';
END $$;
