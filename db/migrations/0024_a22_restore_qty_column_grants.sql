-- ============================================================================
-- A22. RESTORE THE COLUMN GRANTS THAT 0020 DROPPED
--
-- Second instance of the same trap. 0020 dropped and re-added the generated
-- column proj.period_balance.remaining_qty in order to net off reservations.
-- ALTER TABLE ... DROP COLUMN discards that column's privileges, and the newly
-- added reserved_qty never had any. proj.v_period_availability has
-- security_invoker = true, so it reads with the CALLER's privileges and the
-- whole availability pane failed with "permission denied for table
-- period_balance".
--
-- Only the *_qty composites are granted, never the *_raw numerics: the
-- composite carries (project_id, unit_type_id, amount) so a quantity cannot
-- leave the database stripped of the scope that makes it meaningful. That is
-- R7 at the privilege layer, and ci.assert_no_raw_amount_grants() enforces it.
-- ============================================================================

GRANT SELECT (reserved_qty, remaining_qty)
  ON proj.period_balance
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

-- ---------------------------------------------------------------------------
-- Extend the guard: assert the complete read surface of the availability pane,
-- column by column, for every role that is supposed to see it. Two migrations
-- in a row broke this by accident; a guard that names the columns is what stops
-- the third.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ci.assert_public_views_are_granted() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text; r text; c text;
  public_roles text[] := ARRAY['sylva_web_anon','sylva_buyer',
                               'sylva_project_owner','sylva_investor'];
  avail_cols  text[] := ARRAY['project_id','unit_type_id','period_id',
                              'expected_issuance_qty','buffer_qty',
                              'reserved_qty','committed_qty','remaining_qty',
                              'effective_forecast_id','updated_at'];
BEGIN
  FOREACH v IN ARRAY ARRAY['proj.v_period_availability',
                           'record.v_public_entry',
                           'org.v_public_party'] LOOP
    FOREACH r IN ARRAY public_roles LOOP
      IF NOT has_table_privilege(r, v, 'SELECT') THEN
        RAISE EXCEPTION
          'public view % is not readable by % - a DROP VIEW probably discarded its grants', v, r;
      END IF;
    END LOOP;
  END LOOP;

  -- v_period_availability is security_invoker, so the base columns matter too.
  FOREACH r IN ARRAY public_roles LOOP
    FOREACH c IN ARRAY avail_cols LOOP
      IF NOT has_column_privilege(r, 'proj.period_balance', c, 'SELECT') THEN
        RAISE EXCEPTION
          'availability column proj.period_balance.% is not readable by % - '
          'an ALTER TABLE probably dropped and re-added it', c, r;
      END IF;
    END LOOP;
  END LOOP;
END $$;
