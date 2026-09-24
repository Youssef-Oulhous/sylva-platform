-- ============================================================================
-- A23. THE RAW-AMOUNT GUARD MUST EXCLUDE THE ACTUAL TABLE OWNER
--
-- ci.assert_no_raw_amount_grants() excluded the literal role name
-- 'sylva_owner'. A table's owner always holds implicit privileges on its own
-- columns, and the owner is whoever ran the migration - postgres in local
-- development, sylva_owner in a deployed environment. So the guard reported
-- every *_raw column as leaked on a developer machine and would have been
-- switched off or ignored, which is worse than not having it.
--
-- Rewritten to exclude the real owner of each table, whatever it is called, and
-- to check effective privilege rather than grant rows.
-- ============================================================================

CREATE OR REPLACE FUNCTION ci.assert_no_raw_amount_grants() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s.%s -> %s', n.nspname, c.relname, a.attname, g.grantee), ', ')
    INTO v
    FROM pg_attribute a
    JOIN pg_class     c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles     o ON o.oid = c.relowner
    CROSS JOIN LATERAL (
      SELECT r.rolname AS grantee
        FROM pg_roles r
       WHERE r.rolname LIKE 'sylva\_%'
         AND r.rolname <> o.rolname           -- the owner is not a grantee
         AND has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT')
    ) g
   WHERE a.attname LIKE '%\_raw'
     AND a.attnum > 0 AND NOT a.attisdropped
     AND c.relkind = 'r'
     AND n.nspname NOT IN ('pg_catalog', 'information_schema');

  IF v IS NOT NULL THEN PERFORM ci.fail('no_raw_amount_grants', v); END IF;
END $$;

COMMENT ON FUNCTION ci.assert_no_raw_amount_grants() IS
  'R7 at the privilege layer: a bare numeric volume must not leave the '
  'database. Only the *_qty composites are readable, because they carry the '
  'project and unit type that make the number mean something. Excludes each '
  'table''s own owner, whose implicit privileges are not a grant.';
