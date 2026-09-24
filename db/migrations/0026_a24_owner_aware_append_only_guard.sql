-- ============================================================================
-- A24. THE APPEND-ONLY GUARD MUST EXCLUDE THE ACTUAL TABLE OWNER
--
-- Same defect as A23, in a second guard, found by running all twenty guards
-- against a database created from scratch rather than one built up in place.
--
-- ci.assert_append_only_complete() excluded the literal role name
-- 'sylva_owner' when looking for UPDATE/DELETE/TRUNCATE grants. A table's
-- owner always holds those privileges implicitly, and the owner is whoever ran
-- the migration: postgres on a developer machine, sylva_owner deployed. So on
-- every fresh developer database the guard reported all ~100 append-only
-- tables as broken.
--
-- That is worse than no guard. A check that cries wolf on a clean checkout is
-- a check that gets commented out, and R4 is the rule that makes the whole
-- record trustworthy.
--
-- Rewritten to exclude each table's real owner and to test effective privilege
-- rather than grant rows, which is also immune to grants arriving by role
-- membership.
-- ============================================================================

CREATE OR REPLACE FUNCTION ci.assert_append_only_complete() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(msg, '; ') INTO v FROM (
    -- (a) all three guards present and ENABLE ALWAYS
    SELECT format('%s missing guards', t.table_name) AS msg
      FROM ci.append_only_table t
     WHERE (SELECT count(*) FROM pg_trigger g
             WHERE g.tgrelid = t.table_name AND NOT g.tgisinternal
               AND g.tgname IN ('t_append_only_row','t_append_only_stmt','t_append_only_trunc')
               AND g.tgenabled = 'A') <> 3

    UNION ALL
    -- (b) row-level security enabled AND forced, so the owner cannot slip past
    SELECT format('%s not FORCE RLS', t.table_name)
      FROM ci.append_only_table t JOIN pg_class c ON c.oid = t.table_name
     WHERE NOT (c.relrowsecurity AND c.relforcerowsecurity)

    UNION ALL
    -- (c) no role other than the table's own owner may UPDATE, DELETE or
    --     TRUNCATE it. has_table_privilege() sees privileges however they
    --     arrive, including through role membership.
    SELECT format('%s grants %s to %s', t.table_name, p.priv, r.rolname)
      FROM ci.append_only_table t
      JOIN pg_class c   ON c.oid = t.table_name
      JOIN pg_roles own ON own.oid = c.relowner
      CROSS JOIN (VALUES ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
      JOIN pg_roles r ON r.rolname LIKE 'sylva\_%'
                     AND r.rolname <> own.rolname
     WHERE has_table_privilege(r.oid, c.oid, p.priv)
  ) s;

  IF v IS NOT NULL THEN PERFORM ci.fail('append_only_complete', v); END IF;
END $$;

COMMENT ON FUNCTION ci.assert_append_only_complete() IS
  'R4. Every append-only table carries the row, statement and TRUNCATE guards '
  'as ENABLE ALWAYS, has RLS enabled and FORCED, and grants UPDATE/DELETE/'
  'TRUNCATE to no role except its own owner. Excludes the owner because its '
  'implicit privileges are not a grant - see migration 0025 for the same fix '
  'applied to the raw-amount guard.';
