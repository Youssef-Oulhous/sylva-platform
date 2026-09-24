-- ============================================================================
-- A26. THE REMAINING PRIVILEGE GUARDS, MADE OWNER-AWARE AND SELF-TESTING
--
-- Third and last instance of the defect fixed in A23 and A25. Found by running
-- all twenty guards against a database built from scratch, which is the only
-- way this class of bug shows up: a database grown in place already has the
-- developer as owner everywhere, so the guards looked green.
--
-- The pattern being removed: comparing `grantee` to a hard-coded list of role
-- names. Two things go wrong with it.
--   1. A table's OWNER always holds privileges implicitly. The owner is
--      whoever ran the migration - postgres locally, sylva_owner deployed - so
--      a name-based exclusion reports the owner as a leak on every developer
--      machine.
--   2. information_schema shows GRANTS. It does not follow role membership, so
--      a privilege reaching a role through a grant to a role it is a member of
--      is invisible. That is a false NEGATIVE, which is the dangerous direction.
--
-- Both are fixed by asking has_*_privilege(), which answers "can this role
-- actually do this", and by excluding the ownership chain with pg_has_role().
--
-- Each guard below ends with a self-test that grants the forbidden privilege,
-- asserts the guard fires, and revokes it again. A guard that cannot fail is
-- not a guard.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- R5: no public-facing role may read an organisation's identifying columns.
-- ---------------------------------------------------------------------------
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
     AND r.rolname NOT IN ('sylva_operator', 'sylva_auditor', 'sylva_record')
     AND NOT pg_has_role(r.oid, own.oid, 'USAGE')       -- not the ownership chain
     AND has_column_privilege(r.oid, cl.oid, c.col, 'SELECT');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_columns_not_public', v); END IF;
END $$;

COMMENT ON FUNCTION ci.assert_identity_columns_not_public() IS
  'R5. An organisation''s legal name is reachable by the public ONLY through '
  'org.v_public_party, which names declared parties of already-public projects '
  'and no one else. This asserts the base columns stay closed.';

-- ---------------------------------------------------------------------------
-- The auditor reads everything and changes nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ci.assert_auditor_is_read_only() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s: %s', n.nspname, c.relname, p.priv), ', ') INTO v
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
   WHERE c.relkind IN ('r', 'v', 'm', 'p')
     AND n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND has_table_privilege('sylva_auditor', c.oid, p.priv);
  IF v IS NOT NULL THEN PERFORM ci.fail('auditor_is_read_only', v); END IF;
END $$;

-- ---------------------------------------------------------------------------
-- The anonymous role reads a little and changes nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ci.assert_web_anon_is_read_only() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s: %s', n.nspname, c.relname, p.priv), ', ') INTO v
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
   WHERE c.relkind IN ('r', 'v', 'm', 'p')
     AND n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND has_table_privilege('sylva_web_anon', c.oid, p.priv);
  IF v IS NOT NULL THEN PERFORM ci.fail('web_anon_is_read_only', v); END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Self-tests. Each grants the forbidden thing, requires the guard to notice,
-- then puts it back.
-- ---------------------------------------------------------------------------
DO $$
DECLARE fired boolean;

BEGIN
  -- identity columns
  fired := false;
  GRANT SELECT (legal_name) ON org.organisation TO sylva_buyer;
  BEGIN PERFORM ci.assert_identity_columns_not_public();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT (legal_name) ON org.organisation FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity guard is toothless: sylva_buyer reading legal_name went unnoticed';
  END IF;

  -- auditor
  fired := false;
  GRANT INSERT ON record.entry TO sylva_auditor;
  BEGIN PERFORM ci.assert_auditor_is_read_only();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE INSERT ON record.entry FROM sylva_auditor;
  IF NOT fired THEN
    RAISE EXCEPTION 'auditor guard is toothless: an INSERT grant went unnoticed';
  END IF;

  -- anonymous
  fired := false;
  GRANT INSERT ON record.entry TO sylva_web_anon;
  BEGIN PERFORM ci.assert_web_anon_is_read_only();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE INSERT ON record.entry FROM sylva_web_anon;
  IF NOT fired THEN
    RAISE EXCEPTION 'web_anon guard is toothless: an INSERT grant went unnoticed';
  END IF;

  RAISE NOTICE 'all three privilege guards verified: each fires when the privilege is granted';
END $$;
