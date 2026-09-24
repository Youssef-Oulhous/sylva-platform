-- ============================================================================
-- A16. CI ASSERTIONS
-- ============================================================================
-- Every guarantee above is a grant, a policy or an absence, and a later
-- migration can silently undo any of them. These functions are the build's
-- forcing function: ci.run_all() is a required CI step and each assertion has
-- a matching deliberately-failing fixture in the test suite, so the assertion
-- itself is tested.

CREATE TABLE ci.no_rls_allowlist (
  table_name regclass PRIMARY KEY,
  reason     sylva.nonblank NOT NULL
);
INSERT INTO ci.no_rls_allowlist VALUES
  ('org.actor_role','public lookup'),
  ('org.questionnaire','public lookup: the questionnaire shape'),
  ('org.question','public lookup: the questionnaire shape'),
  ('org.project_label_counter','a counter; no role holds any privilege on it'),
  ('units.scheme','public reference data'),
  ('units.unit_type','public reference data'),
  ('units.unit_type_translation','public reference data'),
  ('proj.text_field','public lookup'),
  ('proj.party_role','public lookup'),
  ('proj.metric_definition','public lookup; drives the investor gate'),
  ('doc.document_kind','public lookup'),
  ('deal.deal_shape','public lookup'),
  ('deal.deal_stage','public lookup'),
  ('deal.deal_stage_transition','public lookup'),
  ('record.entry_type','public lookup'),
  ('i18n.locale','public lookup'),
  ('platform.eu_member_state','public reference data'),
  ('platform.storage_region','public reference data'),
  ('platform.sector','public reference data'),
  ('platform.size_band','public reference data'),
  ('platform.unit_of_measure','public reference data'),
  ('platform.page_view_daily','aggregate analytics; no per-visit row exists'),
  ('identity.person_label','identity schema: no app role holds USAGE'),
  ('identity.user_platform_role','identity schema: no app role holds USAGE'),
  ('identity.user_session','identity schema: no app role holds USAGE');

CREATE FUNCTION ci.fail(p_assertion text, p_detail text) RETURNS void
LANGUAGE plpgsql AS
$f$ BEGIN
  RAISE EXCEPTION 'CI ASSERTION FAILED [%]: %', p_assertion, p_detail
    USING ERRCODE = 'SY0CI';
END $f$;

-- R7 (1/4): no role anywhere may SELECT a raw quantity column - on a table OR
-- on a view, because a view's columns carry their own privileges.
CREATE FUNCTION ci.assert_no_raw_amount_grants() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s.%s -> %s', table_schema, table_name, column_name, grantee), ', ')
    INTO v
    FROM information_schema.column_privileges
   WHERE column_name LIKE '%\_raw'
     AND privilege_type = 'SELECT'
     AND grantee <> 'sylva_owner';
  IF v IS NOT NULL THEN PERFORM ci.fail('no_raw_amount_grants', v); END IF;
END $f$;

-- R7 (2/4): a raw quantity cannot exist without its project and unit type.
CREATE FUNCTION ci.assert_no_volume_without_scope() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s', c.table_schema, c.table_name), ', ')
    INTO v
    FROM (SELECT DISTINCT c2.table_schema, c2.table_name
            FROM information_schema.columns c2
            JOIN information_schema.tables t2
              ON t2.table_schema = c2.table_schema AND t2.table_name = c2.table_name
           WHERE c2.column_name LIKE '%\_raw' AND t2.table_type = 'BASE TABLE') c
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns x
                      WHERE x.table_schema = c.table_schema AND x.table_name = c.table_name
                        AND x.column_name = 'project_id' AND x.is_nullable = 'NO')
      OR NOT EXISTS (SELECT 1 FROM information_schema.columns x
                      WHERE x.table_schema = c.table_schema AND x.table_name = c.table_name
                        AND x.column_name = 'unit_type_id' AND x.is_nullable = 'NO');
  IF v IS NOT NULL THEN PERFORM ci.fail('no_volume_without_scope', v); END IF;
END $f$;

-- R7 (3/4): absence. No conversion, no equivalence, no CO2e, no ratio, anywhere.
CREATE FUNCTION ci.assert_no_conversion() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(n, ', ') INTO v FROM (
    SELECT format('column %s.%s.%s', table_schema, table_name, column_name) AS n
      FROM information_schema.columns
     WHERE table_schema IN ('sylva','proj','units','deal','credit','record')
       AND column_name ~* '(conversion|equivalen|co2e|ratio_to|exchange_rate)'
    UNION ALL
    SELECT format('routine %s.%s', n.nspname, p.proname)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('sylva','proj','units','deal','credit','record')
       AND p.proname ~* '(conversion|equivalen|co2e|ratio_to|exchange_rate)'
    UNION ALL
    SELECT format('relation %s.%s', n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('sylva','proj','units','deal','credit','record')
       AND c.relname ~* '(conversion|equivalen|co2e|ratio_to|exchange_rate)'
  ) s;
  IF v IS NOT NULL THEN PERFORM ci.fail('no_conversion', v); END IF;
END $f$;

-- R7 (4/4): no table may carry two different unit_type foreign keys in one row.
CREATE FUNCTION ci.assert_one_unit_type_per_row() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s', table_schema, table_name), ', ') INTO v
    FROM (SELECT table_schema, table_name, count(*) AS n
            FROM information_schema.columns
           WHERE column_name LIKE '%unit_type_id'
           GROUP BY 1,2 HAVING count(*) > 1) s;
  IF v IS NOT NULL THEN PERFORM ci.fail('one_unit_type_per_row', v); END IF;
END $f$;

-- Exact decimal only: R1 must not be breakable by binary rounding.
CREATE FUNCTION ci.assert_no_float_columns() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s.%s', table_schema, table_name, column_name), ', ') INTO v
    FROM information_schema.columns
   WHERE table_schema IN ('sylva','identity','org','units','proj','geo','doc',
                          'deal','credit','record','i18n','platform')
     AND udt_name IN ('float4','float8');
  IF v IS NOT NULL THEN PERFORM ci.fail('no_float_columns', v); END IF;
END $f$;

-- Erasure: the single assertion that keeps the design from eroding.
CREATE FUNCTION ci.assert_no_fk_into_identity() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s on %s', c.conname, c.conrelid::regclass), ', ') INTO v
    FROM pg_constraint c
    JOIN pg_class ft ON ft.oid = c.confrelid
    JOIN pg_namespace fn ON fn.oid = ft.relnamespace
    JOIN pg_class rt ON rt.oid = c.conrelid
    JOIN pg_namespace rn ON rn.oid = rt.relnamespace
   WHERE c.contype = 'f' AND fn.nspname = 'identity' AND rn.nspname <> 'identity';
  IF v IS NOT NULL THEN PERFORM ci.fail('no_fk_into_identity', v); END IF;
END $f$;

-- Personal data sits in one table only (structured columns; free text and
-- uploaded binaries are an acknowledged second category).
CREATE FUNCTION ci.assert_no_personal_columns_outside_identity() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s.%s', table_schema, table_name, column_name), ', ') INTO v
    FROM information_schema.columns
   WHERE table_schema IN ('sylva','org','units','proj','geo','doc','deal',
                          'credit','record','i18n','platform')
     AND column_name ~* '(^|_)(email|phone|first_name|last_name|full_name|given_name|surname|ip_addr|ip_address|user_agent|job_title|date_of_birth)($|_)';
  IF v IS NOT NULL THEN PERFORM ci.fail('no_personal_columns_outside_identity', v); END IF;
END $f$;

-- R4: nothing is ever hidden.
CREATE FUNCTION ci.assert_no_soft_delete() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s', t.table_name, c.column_name), ', ') INTO v
    FROM ci.append_only_table t
    JOIN information_schema.columns c
      ON format('%s.%s', c.table_schema, c.table_name)::regclass = t.table_name
   WHERE c.column_name ~* '(is_deleted|deleted_at|is_hidden|hidden|is_visible|archived|soft_delete)';
  IF v IS NOT NULL THEN PERFORM ci.fail('no_soft_delete', v); END IF;
END $f$;

-- R4: the list and the catalogue agree, on every layer.
CREATE FUNCTION ci.assert_append_only_complete() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  -- (a) every listed table carries all three guards, ENABLE ALWAYS, forced RLS
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
    SELECT format('%s grants %s to %s', p.table_schema||'.'||p.table_name, p.privilege_type, p.grantee)
      FROM ci.append_only_table t
      JOIN information_schema.table_privileges p
        ON format('%s.%s', p.table_schema, p.table_name)::regclass = t.table_name
     WHERE p.privilege_type IN ('UPDATE','DELETE','TRUNCATE')
       AND p.grantee <> 'sylva_owner'
  ) s;
  IF v IS NOT NULL THEN PERFORM ci.fail('append_only_complete', v); END IF;
END $f$;

-- Row-level security: enabled, forced, non-empty, and never targeted at PUBLIC.
CREATE FUNCTION ci.assert_rls_complete() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(msg, '; ') INTO v FROM (
    SELECT format('%s.%s has no RLS and is not allowlisted', n.nspname, c.relname) AS msg
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r'
       AND n.nspname IN ('sylva','identity','org','units','proj','geo','doc','deal','credit','record','i18n','platform')
       AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
       AND NOT EXISTS (SELECT 1 FROM ci.no_rls_allowlist a WHERE a.table_name = c.oid)
    UNION ALL
    SELECT format('%s.%s has RLS but no policy', n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relrowsecurity
       AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
    UNION ALL
    SELECT format('policy %s on %s targets PUBLIC (no TO clause)', p.polname, p.polrelid::regclass)
      FROM pg_policy p WHERE p.polroles = '{0}'
  ) s;
  IF v IS NOT NULL THEN PERFORM ci.fail('rls_complete', v); END IF;
END $f$;

-- R5: no public-facing role can resolve a real name by any route.
CREATE FUNCTION ci.assert_identity_columns_not_public() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s -> %s', column_name, grantee), ', ') INTO v
    FROM information_schema.column_privileges
   WHERE table_schema = 'org' AND table_name = 'organisation'
     AND column_name IN ('legal_name','registration_number','registered_address')
     AND privilege_type = 'SELECT'
     AND grantee NOT IN ('sylva_owner','sylva_operator','sylva_auditor','sylva_record');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_columns_not_public', v); END IF;
END $f$;

-- The auditor reads everything and writes nothing, for ever.
CREATE FUNCTION ci.assert_auditor_is_read_only() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s:%s', table_schema, table_name, privilege_type), ', ') INTO v
    FROM information_schema.table_privileges
   WHERE grantee = 'sylva_auditor' AND privilege_type <> 'SELECT';
  IF v IS NOT NULL THEN PERFORM ci.fail('auditor_is_read_only', v); END IF;
  SELECT string_agg(format('%s.%s.%s:%s', table_schema, table_name, column_name, privilege_type), ', ') INTO v
    FROM information_schema.column_privileges
   WHERE grantee = 'sylva_auditor' AND privilege_type <> 'SELECT';
  IF v IS NOT NULL THEN PERFORM ci.fail('auditor_is_read_only_columns', v); END IF;
END $f$;

-- The public role can never write anything, anywhere.
CREATE FUNCTION ci.assert_web_anon_is_read_only() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s:%s', table_schema, table_name, privilege_type), ', ') INTO v
    FROM information_schema.table_privileges
   WHERE grantee = 'sylva_web_anon' AND privilege_type <> 'SELECT';
  IF v IS NOT NULL THEN PERFORM ci.fail('web_anon_is_read_only', v); END IF;
END $f$;

-- Section 9: every figure on screen carries its source and its date.
-- Tables whose provenance is carried by a parent row rather than their own
-- source_ref_id, each with a stated reason.
CREATE TABLE ci.provenance_allowlist (
  table_name regclass PRIMARY KEY,
  reason     sylva.nonblank NOT NULL
);
INSERT INTO ci.provenance_allowlist VALUES
  ('proj.period_balance',
   'a cache: its provenance is effective_forecast_id -> proj.period_forecast.source_ref_id, which is NOT NULL');

CREATE FUNCTION ci.assert_figures_have_provenance() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci, sylva, org, proj, deal, credit, doc, record, geo, units, identity, platform, i18n AS
$f$
DECLARE v text;
BEGIN
  SELECT string_agg(format('%s.%s', c.table_schema, c.table_name), ', ') INTO v
    FROM (SELECT DISTINCT table_schema, table_name
            FROM information_schema.columns
           WHERE table_schema IN ('proj','geo','credit','deal')
             AND data_type = 'numeric'
             AND (column_name LIKE '%\_raw'
                  OR column_name IN ('value_numeric','value_low','value_high')
                  OR column_name LIKE 'baseline%'
                  OR column_name LIKE 'quantity%')) c
   WHERE NOT EXISTS (SELECT 1 FROM ci.provenance_allowlist a
                      WHERE a.table_name = format('%s.%s', c.table_schema, c.table_name)::regclass)
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns x
                      WHERE x.table_schema = c.table_schema AND x.table_name = c.table_name
                        AND x.column_name = 'source_ref_id' AND x.is_nullable = 'NO')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns x
                      WHERE x.table_schema = c.table_schema AND x.table_name = c.table_name
                        AND x.column_name = 'source_label' AND x.is_nullable = 'NO');
  IF v IS NOT NULL THEN PERFORM ci.fail('figures_have_provenance', v); END IF;
END $f$;

-- The caches are caches. Run nightly; fail loudly.
CREATE FUNCTION ci.reconcile_period_balance()
RETURNS TABLE (project_id uuid, unit_type_id uuid, period_id uuid,
               cached_expected numeric, ledger_expected numeric,
               cached_buffer numeric, ledger_buffer numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, proj AS
$$
  SELECT b.project_id, b.unit_type_id, b.period_id,
         b.expected_issuance_raw, f.expected_issuance_raw,
         b.buffer_raw, f.buffer_raw
    FROM proj.period_balance b
    JOIN LATERAL (SELECT x.expected_issuance_raw, x.buffer_raw
                    FROM proj.period_forecast x
                   WHERE x.project_id = b.project_id AND x.unit_type_id = b.unit_type_id
                     AND x.period_id = b.period_id AND x.effective
                   ORDER BY x.recorded_at DESC, x.id DESC LIMIT 1) f ON true
   WHERE b.expected_issuance_raw IS DISTINCT FROM f.expected_issuance_raw
      OR b.buffer_raw            IS DISTINCT FROM f.buffer_raw
$$;

CREATE FUNCTION ci.run_all() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ci AS
$f$
DECLARE n int;
BEGIN
  PERFORM ci.assert_no_raw_amount_grants();
  PERFORM ci.assert_no_volume_without_scope();
  PERFORM ci.assert_no_conversion();
  PERFORM ci.assert_one_unit_type_per_row();
  PERFORM ci.assert_no_float_columns();
  PERFORM ci.assert_no_fk_into_identity();
  PERFORM ci.assert_no_personal_columns_outside_identity();
  PERFORM ci.assert_no_soft_delete();
  PERFORM ci.assert_append_only_complete();
  PERFORM ci.assert_rls_complete();
  PERFORM ci.assert_identity_columns_not_public();
  PERFORM ci.assert_auditor_is_read_only();
  PERFORM ci.assert_web_anon_is_read_only();
  PERFORM ci.assert_figures_have_provenance();
  SELECT count(*) INTO n FROM ci.reconcile_period_balance();
  IF n > 0 THEN PERFORM ci.fail('reconcile_period_balance', n || ' rows diverge'); END IF;
  RETURN 'all CI assertions passed';
END $f$;
-- ############################################################################
-- SECTION B · PHASE 2
-- Everything below ships in the SAME first migration and is exercised by no
-- release-one screen. It is created now because R1's arithmetic and R4's
-- append-only guarantee make the volume spine prohibitively expensive to
-- retrofit: an empty table costs nothing, changing the shape of an append-only
-- one after go-live costs a great deal.
-- ############################################################################
