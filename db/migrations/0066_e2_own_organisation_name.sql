-- ============================================================================
-- E2. AN ORGANISATION MAY READ ITS OWN NAME
-- ============================================================================
-- Found while wiring the Express interest confirmation, which has to say WHICH
-- organisation the interest was recorded for.
--
-- R5 withholds org.organisation.legal_name from every public-facing role by
-- COLUMN grant (migration 0016), and ci.assert_identity_columns_not_public()
-- keeps it withheld. That is right, and it is not being relaxed here: the rule
-- is that a buyer cannot learn ANOTHER organisation's name.
--
-- It also, as written, stops a buyer reading the name of its own organisation -
-- the one its own representative typed into the registration form. Showing a
-- buyer "Interest recorded for <pseudonym>" when it wants to check it is acting
-- for the right organisation is not privacy, it is a missing sentence.
--
-- So: one more narrow door, in the shape migration 0015 established with
-- deal.counterparty_legal_name(). It takes NO ARGUMENT, which is the whole of
-- its safety - there is nothing to pass, so there is nothing to pass somebody
-- else's id in. It resolves through sylva.actor_org_id(), the HMAC-verified
-- context from migration 0019, so a forged context yields NULL rather than
-- another organisation's name (FINDING-001).
--
-- No access-log row, unlike deal.counterparty_legal_name(): that function
-- discloses the COUNTERPARTY's name, which is exactly the read that must leave
-- a trace. Reading your own letterhead is not that read, and logging it would
-- bury the reads that matter.
-- ============================================================================

CREATE FUNCTION org.actor_organisation_name() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, org, sylva AS
$$ SELECT o.legal_name
     FROM org.organisation o
    WHERE o.id = sylva.actor_org_id() $$;

COMMENT ON FUNCTION org.actor_organisation_name() IS
  'R5-safe: the caller''s OWN organisation name, and nothing else. No argument, '
  'so no id can be substituted; resolves through the signed actor context, so a '
  'forged one returns NULL. Another organisation''s name is still reachable only '
  'through deal.counterparty_legal_name(), which logs the read.';

-- A new function is EXECUTE-able by PUBLIC until it is not. Migration 0016's
-- blanket REVOKE ran long before this function existed.
REVOKE ALL ON FUNCTION org.actor_organisation_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION org.actor_organisation_name()
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor;
-- Deliberately NOT granted to sylva_web_anon: an anonymous visitor has no
-- organisation, so the function would return NULL, and a grant that can only
-- return NULL is decoration - see FINDING-003 on what decoration hides.

-- ---------------------------------------------------------------------------
-- Guard: this door stays a door, not a hole.
-- ---------------------------------------------------------------------------
-- The failure to catch is somebody "simplifying" the function by dropping the
-- WHERE clause, or adding a uuid parameter so a caller can ask about any
-- organisation. Both would turn one sentence on a confirmation screen into a
-- directory of every company on the platform.
CREATE FUNCTION ci.assert_own_name_lookup_is_scoped() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text; n int;
BEGIN
  -- 1. No overload takes an argument.
  SELECT count(*) INTO n
    FROM pg_proc
   WHERE pronamespace = 'org'::regnamespace
     AND proname = 'actor_organisation_name'
     AND pronargs > 0;
  IF n > 0 THEN
    PERFORM ci.fail('own_name_lookup_is_scoped',
      'org.actor_organisation_name() has an overload that takes an argument; '
      'it can then be asked about an organisation other than the caller''s');
  END IF;

  -- 2. The body still restricts to the signed actor context.
  SELECT prosrc INTO v
    FROM pg_proc
   WHERE pronamespace = 'org'::regnamespace
     AND proname = 'actor_organisation_name' AND pronargs = 0;
  IF v IS NULL THEN
    PERFORM ci.fail('own_name_lookup_is_scoped',
                    'org.actor_organisation_name() is gone');
  END IF;
  IF v NOT LIKE '%actor_org_id()%' THEN
    PERFORM ci.fail('own_name_lookup_is_scoped',
      'org.actor_organisation_name() no longer restricts to sylva.actor_org_id(); '
      'it now returns names the caller has no claim to');
  END IF;

  -- 3. The column grant it exists to work around must still be in place, or
  --    the workaround is hiding a real widening of R5.
  SELECT string_agg(r.rolname, ', ') INTO v
    FROM pg_roles r
    JOIN pg_class c ON c.oid = 'org.organisation'::regclass
   WHERE r.rolname IN ('sylva_web_anon','sylva_buyer','sylva_project_owner',
                       'sylva_investor','sylva_report')
     AND NOT pg_has_role(r.oid, c.relowner, 'USAGE')
     AND has_column_privilege(r.oid, c.oid, 'legal_name', 'SELECT');
  IF v IS NOT NULL THEN
    PERFORM ci.fail('own_name_lookup_is_scoped',
      'R5 regression: ' || v || ' can read org.organisation.legal_name directly');
  END IF;
END $$;

COMMENT ON FUNCTION ci.assert_own_name_lookup_is_scoped() IS
  'R5. Keeps org.actor_organisation_name() a one-row self-lookup, and keeps the '
  'column grant it works around closed.';

DO $selftest$
DECLARE fired boolean;
BEGIN
  -- Check 3 fires on the mistake it exists for: a table-level GRANT that sweeps
  -- legal_name up with the columns that are genuinely public.
  fired := false;
  GRANT SELECT ON org.organisation TO sylva_buyer;
  BEGIN PERFORM ci.assert_own_name_lookup_is_scoped();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT ON org.organisation FROM sylva_buyer;
  GRANT SELECT (id, country_code, sector_code, size_band_code, created_at)
    ON org.organisation TO sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION
      'own-name guard is toothless: sylva_buyer reading legal_name directly went unnoticed';
  END IF;

  -- Check 1 fires on an overload that takes an organisation id.
  fired := false;
  CREATE FUNCTION org.actor_organisation_name(p_org_id uuid) RETURNS text
  LANGUAGE sql STABLE AS $decoy$ SELECT 'decoy' $decoy$;
  BEGIN PERFORM ci.assert_own_name_lookup_is_scoped();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  DROP FUNCTION org.actor_organisation_name(uuid);
  IF NOT fired THEN
    RAISE EXCEPTION
      'own-name guard is toothless: an overload taking an org id went unnoticed';
  END IF;

  RAISE NOTICE 'own-name guard verified: it fires on a direct grant and on an argument-taking overload';
END $selftest$;
