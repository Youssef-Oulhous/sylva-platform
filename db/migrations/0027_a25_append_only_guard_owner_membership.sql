-- ============================================================================
-- A25. THE APPEND-ONLY GUARD MUST FOLLOW OWNER MEMBERSHIP, NOT JUST THE NAME
--
-- A24 excluded the table's own owner. It then correctly started reporting
-- sylva_login_migrate, which holds UPDATE/DELETE/TRUNCATE on every append-only
-- table - because sylva_login_migrate is a MEMBER of sylva_owner, and
-- has_table_privilege() follows role membership.
--
-- That is not a leak. The migration role is the owner, reached through
-- membership; that is how it runs DDL at all. It is not an application role
-- and it is never used to serve a request: db/apply.sh uses it, the pools in
-- src/lib/db/pool.ts never do.
--
-- The rule we actually want is: no role that is NOT the owner, and NOT a
-- member of the owner, may UPDATE, DELETE or TRUNCATE an append-only table.
-- pg_has_role(..., 'USAGE') expresses exactly that and follows the chain.
--
-- Stated plainly so nobody later "simplifies" it back into a leak: the
-- exclusion covers the ownership chain only. Every application role -
-- sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
-- sylva_operator, sylva_auditor, sylva_report - is still checked, and any one
-- of them holding one of these privileges is a genuine R4 failure.
-- ============================================================================

CREATE OR REPLACE FUNCTION ci.assert_append_only_complete() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(msg, '; ') INTO v FROM (
    SELECT format('%s missing guards', t.table_name) AS msg
      FROM ci.append_only_table t
     WHERE (SELECT count(*) FROM pg_trigger g
             WHERE g.tgrelid = t.table_name AND NOT g.tgisinternal
               AND g.tgname IN ('t_append_only_row','t_append_only_stmt','t_append_only_trunc')
               AND g.tgenabled = 'A') <> 3

    UNION ALL
    SELECT format('%s not FORCE RLS', t.table_name)
      FROM ci.append_only_table t JOIN pg_class c ON c.oid = t.table_name
     WHERE NOT (c.relrowsecurity AND c.relforcerowsecurity)

    UNION ALL
    SELECT format('%s grants %s to %s', t.table_name, p.priv, r.rolname)
      FROM ci.append_only_table t
      JOIN pg_class c   ON c.oid = t.table_name
      JOIN pg_roles own ON own.oid = c.relowner
      CROSS JOIN (VALUES ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
      JOIN pg_roles r ON r.rolname LIKE 'sylva\_%'
     WHERE NOT pg_has_role(r.oid, own.oid, 'USAGE')   -- not the owner, not a member of it
       AND has_table_privilege(r.oid, c.oid, p.priv)
  ) s;

  IF v IS NOT NULL THEN PERFORM ci.fail('append_only_complete', v); END IF;
END $$;

-- Prove the guard still has teeth: grant UPDATE to a real application role on a
-- real append-only table, confirm the guard fires, then put it back.
DO $$
DECLARE fired boolean := false;
BEGIN
  GRANT UPDATE ON record.entry TO sylva_buyer;
  BEGIN
    PERFORM ci.assert_append_only_complete();
  EXCEPTION WHEN OTHERS THEN
    fired := true;
  END;
  REVOKE UPDATE ON record.entry FROM sylva_buyer;

  IF NOT fired THEN
    RAISE EXCEPTION
      'append-only guard is toothless: it did not notice sylva_buyer holding UPDATE on record.entry';
  END IF;
  RAISE NOTICE 'append-only guard verified: it fires when an application role gains UPDATE';
END $$;
