-- ============================================================================
-- A21. RESTORE THE GRANTS THAT 0020 DROPPED
--
-- Migration 0020 had to DROP and recreate proj.v_period_availability in order
-- to change a generated column it depends on. DROP VIEW discards the view's
-- privileges silently, so every application role lost SELECT on it and the
-- projects index returned "permission denied for view v_period_availability".
--
-- Caught by the first integration test that read the view as an anonymous
-- visitor, which is the argument for those tests existing before the screens
-- that depend on them.
--
-- Restated from A14 rather than inherited, so this file is a complete
-- statement of who may read availability.
-- ============================================================================

GRANT SELECT ON proj.v_period_availability
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report;

-- A regression guard, because a future migration that alters a generated
-- column will hit exactly the same trap.
CREATE FUNCTION ci.assert_public_views_are_granted() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text; r text;
BEGIN
  FOREACH v IN ARRAY ARRAY['proj.v_period_availability',
                           'record.v_public_entry',
                           'org.v_public_party'] LOOP
    FOREACH r IN ARRAY ARRAY['sylva_web_anon','sylva_buyer',
                             'sylva_project_owner','sylva_investor'] LOOP
      IF NOT has_table_privilege(r, v, 'SELECT') THEN
        RAISE EXCEPTION
          'public view % is not readable by % - a DROP VIEW probably discarded its grants', v, r;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON FUNCTION ci.assert_public_views_are_granted() IS
  'DROP VIEW discards privileges without warning. This asserts the public read '
  'surface is still reachable after any migration that rebuilds a view.';
