-- ============================================================================
-- C3. TWO FINDINGS FROM THE ROW-LEVEL SECURITY MATRIX
-- ============================================================================
-- Both belong to the authentication work and both are fixed here.
--
--   docs/FINDING-003-whoami-unreachable.md
--   docs/FINDING-004-password-hash-grant.md
--
-- ---------------------------------------------------------------------------
-- FINDING-004 · the operator and the auditor can read every password hash
-- ---------------------------------------------------------------------------
-- Migration 0016 is written in column-list grants and says why:
--
--   "never as 'grant the table then revoke a column', because a later
--    table-level GRANT would silently restore it"
--
-- Two grants in it are not column lists, and they were correct when written:
-- identity.user_account then held a name, an email, a job title and a locale,
-- and the auditor is meant to see "everything including real names".
--
-- identity.user_account.password_hash has existed since migration 0004, but it
-- was NULL for every row until the authentication work started filling it. A
-- table-level SELECT grant covers whatever the table holds, so the day the
-- column acquired a value the grant silently widened to cover a secret.
--
-- A scrypt record is not a password and both roles are trusted. But the
-- auditor's mandate is the RECORD, not the credentials; an external auditor
-- holding password hashes is a question the grant agreement did not ask; and
-- every extra principal that can read an offline-attackable secret is another
-- place it can leak from. mfa_secret is included for the same reason - it is a
-- shared secret, not a fact about a person.
--
-- ---------------------------------------------------------------------------
-- FINDING-003 · identity.whoami() is granted to roles that cannot call it
-- ---------------------------------------------------------------------------
-- Calling a function requires USAGE on the schema it lives in. Migration 0016
-- granted EXECUTE on identity.whoami() to sylva_buyer, sylva_project_owner,
-- sylva_investor and sylva_operator; only the operator holds that USAGE. So a
-- buyer cannot read its own name, email or locale by ANY route.
--
-- USAGE on a schema grants nothing on the tables in it. After this migration a
-- buyer still cannot SELECT from identity.user_account - no privilege was ever
-- granted and the table's policy names only the operator and the auditor - and
-- tests/rls/matrix.test.ts asserts exactly that, principal by principal.
--
-- This narrows what migration 0040 asserted. 0040's guard said "no privilege
-- role holds USAGE on identity", which was the right shape for the wrong
-- reason: the invariant that matters is that no privilege role can reach a
-- TABLE in identity. That is checked, unchanged, below. The three roles that
-- gain USAGE gain exactly one thing with it: the ability to call the one
-- SECURITY DEFINER function they were already granted.
--
-- Rules touched: none. R5 pseudonymity, R4 append-only and the signed context
-- are all unaffected.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FINDING-004. Table-level SELECT out, column list in.
--    Every column EXCEPT password_hash and mfa_secret.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON identity.user_account FROM sylva_operator, sylva_auditor;

GRANT SELECT (id, person_ref, org_id, email, full_name, job_title, phone,
              locale, status, created_at, last_login_at)
  ON identity.user_account TO sylva_auditor;

GRANT SELECT (id, person_ref, org_id, email, full_name, job_title, phone,
              locale, status, created_at, last_login_at)
  ON identity.user_account TO sylva_operator;

COMMENT ON COLUMN identity.user_account.password_hash IS
  'A scrypt record: scheme$params$salt$derived_key. NO ROLE holds SELECT on '
  'this column - not the operator, not the auditor. It is read only inside '
  'identity.auth_salt() and identity.authenticate(), which are SECURITY '
  'DEFINER and return the parameters and a yes/no respectively, never the '
  'stored value. Guarded by ci.assert_no_credential_grants().';

COMMENT ON COLUMN identity.user_account.mfa_secret IS
  'Reserved; unused. A shared secret, so it is held to the same rule as '
  'password_hash: no role holds SELECT on it.';

-- The same reasoning one level down. identity's only sequence belongs to
-- erasure_event, and nothing but the erasure procedure writes that table, so
-- the three application roles have no use for nextval on it. Left in place it
-- would become live the moment they gained schema USAGE below.
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA identity
  FROM sylva_buyer, sylva_project_owner, sylva_investor;

-- ---------------------------------------------------------------------------
-- 2. FINDING-003. The three roles that were granted whoami() can now reach it.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA identity TO sylva_buyer, sylva_project_owner, sylva_investor;

-- ---------------------------------------------------------------------------
-- 3. The guard FINDING-004 asks for. Effective privilege, never a role name,
--    and it excludes the ownership chain because an owner's privileges are
--    implicit rather than granted (README §11).
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_no_credential_grants() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s can read identity.user_account.%s', r.rolname, c.col), ', ')
    INTO v
    FROM pg_roles r
    CROSS JOIN (VALUES ('password_hash'), ('mfa_secret')) AS c(col)
    JOIN pg_class cl ON cl.oid = 'identity.user_account'::regclass
   WHERE r.rolname LIKE 'sylva\_%'
     AND NOT pg_has_role(r.oid, cl.relowner, 'USAGE')
     AND has_column_privilege(r.oid, cl.oid, c.col, 'SELECT');
  IF v IS NOT NULL THEN PERFORM ci.fail('no_credential_grants', v); END IF;
END $$;

COMMENT ON FUNCTION ci.assert_no_credential_grants() IS
  'FINDING-004 regression guard. A credential is not a fact about a person: no '
  'role reads password_hash or mfa_secret, however trusted it is. Catches the '
  'table-level GRANT that would silently restore it.';

-- ---------------------------------------------------------------------------
-- 4. Replace the 0040 seal guard. Same first and third checks; the second one
--    now states the invariant that is actually true and actually matters.
--    Migrations are immutable, so this is a REPLACE in a new file.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ci.assert_identity_is_sealed() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  -- 1. No TABLE privilege on anything in identity, for any role that is not
  --    (or is not a member of) the owner, the operator or the auditor. This is
  --    the invariant. Schema USAGE without it grants nothing.
  SELECT string_agg(format('%s can %s %s', r.rolname, p.priv, c.oid::regclass), ', ')
    INTO v
    FROM pg_roles r
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES')) AS p(priv)
    JOIN pg_class c ON c.relnamespace = 'identity'::regnamespace AND c.relkind = 'r'
   WHERE r.rolname LIKE 'sylva\_%'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles a
        WHERE a.rolname IN ('sylva_owner','sylva_operator','sylva_auditor')
          AND pg_has_role(r.oid, a.oid, 'USAGE'))
     AND NOT pg_has_role(r.oid, c.relowner, 'USAGE')
     AND has_table_privilege(r.oid, c.oid, p.priv);
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v); END IF;

  -- 2. A role with no reason to be in the schema at all still holds no USAGE.
  --    sylva_buyer, sylva_project_owner and sylva_investor are absent from this
  --    list since FINDING-003: they hold EXECUTE on identity.whoami() and need
  --    USAGE to call it. The roles below hold EXECUTE on nothing in identity.
  SELECT string_agg(format('%s holds USAGE on schema identity', r.rolname), ', ')
    INTO v
    FROM pg_roles r
   WHERE r.rolname IN ('sylva_web_anon','sylva_report','sylva_record')
     AND has_schema_privilege(r.oid, 'identity', 'USAGE');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v); END IF;

  -- 3. The authentication functions must be SECURITY DEFINER, or they cannot
  --    work at all and somebody has "fixed" them by granting table access.
  SELECT string_agg(proname, ', ') INTO v
    FROM pg_proc
   WHERE pronamespace = 'identity'::regnamespace
     AND proname IN ('auth_salt','authenticate','open_session','resolve_session',
                     'close_session','register','whoami')
     AND NOT prosecdef;
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v || ' is not SECURITY DEFINER'); END IF;

  -- 4. FINDING-003, stated as a rule rather than as one fix: a grant that
  --    cannot be exercised is decoration, and decoration hides gaps. Every role
  --    holding EXECUTE on a function in identity must be able to reach the
  --    schema it lives in.
  SELECT string_agg(format('%s has EXECUTE on %s but no USAGE on schema identity',
                           r.rolname, p.oid::regprocedure), ', ')
    INTO v
    FROM pg_roles r
    JOIN pg_proc p ON p.pronamespace = 'identity'::regnamespace
   WHERE r.rolname LIKE 'sylva\_%'
     AND NOT pg_has_role(r.oid, p.proowner, 'USAGE')
     AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
     AND NOT has_schema_privilege(r.oid, 'identity', 'USAGE');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v); END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Self-tests. A guard that cannot fail is not a guard.
-- ---------------------------------------------------------------------------
DO $selftest$
DECLARE fired boolean;
BEGIN
  -- The credential guard fires on the exact mistake that caused FINDING-004:
  -- a table-level grant that sweeps the new column up with the old ones.
  fired := false;
  GRANT SELECT ON identity.user_account TO sylva_operator;
  BEGIN PERFORM ci.assert_no_credential_grants();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT ON identity.user_account FROM sylva_operator;
  GRANT SELECT (id, person_ref, org_id, email, full_name, job_title, phone,
                locale, status, created_at, last_login_at)
    ON identity.user_account TO sylva_operator;
  IF NOT fired THEN
    RAISE EXCEPTION 'credential guard is toothless: a table-level grant went unnoticed';
  END IF;

  -- And on a direct column grant.
  fired := false;
  GRANT SELECT (password_hash) ON identity.user_account TO sylva_buyer;
  BEGIN PERFORM ci.assert_no_credential_grants();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT (password_hash) ON identity.user_account FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION 'credential guard is toothless: a column grant went unnoticed';
  END IF;

  -- The seal guard still fires on a table privilege in identity...
  fired := false;
  GRANT SELECT ON identity.user_session TO sylva_buyer;
  BEGIN PERFORM ci.assert_identity_is_sealed();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT ON identity.user_session FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity seal guard is toothless: a table grant went unnoticed';
  END IF;

  -- ...and on the FINDING-003 shape: EXECUTE without the USAGE to use it.
  fired := false;
  GRANT EXECUTE ON FUNCTION identity.whoami() TO sylva_report;
  BEGIN PERFORM ci.assert_identity_is_sealed();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE EXECUTE ON FUNCTION identity.whoami() FROM sylva_report;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity seal guard is toothless: an unusable EXECUTE grant went unnoticed';
  END IF;

  PERFORM ci.assert_no_credential_grants();
  PERFORM ci.assert_identity_is_sealed();
  PERFORM ci.assert_auditor_is_read_only();
  RAISE NOTICE 'FINDING-003 and FINDING-004 closed; both guards verified';
END $selftest$;
