-- ============================================================================
-- D1c. AN ORGANISATION MAY SEE ITS OWN PUBLIC LABEL
-- ============================================================================
-- Migration range 0080-0084 (buyer-sites-and-dashboard).
--
-- Migration 0075 closed FINDING-006: org.organisation_pseudonym is the
-- label -> organisation map, so a public-facing role holding SELECT on its
-- org_id column could resolve "Buyer 014" on the public record back to a
-- company. The column grant was revoked from every public-facing role, and a
-- guard now keeps it revoked. That is correct and this migration does not
-- touch it.
--
-- But the buyer dashboard has a panel headed "How your organisation appears on
-- the public record", and it is one of the more useful things on the page: a
-- buyer that cannot see its own label cannot check what a reader of the record
-- would see. Reading one's OWN label is not the re-identification FINDING-006
-- is about - you already know who you are.
--
-- So the same shape as org.own_organisation() in migration 0080: a
-- SECURITY DEFINER function with NO ARGUMENT, whose whole body is scoped to
-- sylva.actor_org_id(). There is nothing to point at another organisation, and
-- no column grant is restored, so 0075's guard still passes unchanged.
--
-- R5 note: the label is allocated PER PROJECT, so this returns a LIST. There is
-- no single "your public label", and a screen that printed one would be
-- implying a link between an organisation's projects that the schema is built
-- to prevent.
-- ============================================================================

-- FORCE ROW LEVEL SECURITY binds the table owner, and a SECURITY DEFINER
-- function runs as the owner. Named for whoever actually owns the table rather
-- than for a guessed role, for the reason migrations 0025-0030 exist.
DO $definer$
DECLARE ps_owner text := pg_get_userbyid(
  (SELECT relowner FROM pg_class WHERE oid = 'org.organisation_pseudonym'::regclass));
BEGIN
  EXECUTE format(
    'CREATE POLICY p_pseudonym_definer_read ON org.organisation_pseudonym '
    'FOR SELECT TO %I USING (true)', ps_owner);
END $definer$;

COMMENT ON POLICY p_pseudonym_definer_read ON org.organisation_pseudonym IS
  'Exists only so org.own_public_labels() is not blocked by FORCE ROW LEVEL '
  'SECURITY. It names the table owner, which is not a role any request runs '
  'as, and confers nothing on any application role.';

CREATE FUNCTION org.own_public_labels()
RETURNS TABLE (
  project_id   uuid,
  label        text,
  allocated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, org, sylva
AS $$
  SELECT ps.project_id, ps.label, ps.allocated_at
    FROM org.organisation_pseudonym ps
   -- The whole security boundary. No argument, so it cannot resolve anybody
   -- else's label; NULL context returns nothing.
   WHERE ps.org_id = sylva.actor_org_id()
   ORDER BY ps.allocated_at DESC
$$;

COMMENT ON FUNCTION org.own_public_labels() IS
  'The labels the CALLER''S OWN organisation carries on the public record, one '
  'per project. Does not restore the label -> organisation map FINDING-006 '
  'closed: it resolves only the caller''s own, and takes no argument.';

REVOKE ALL ON FUNCTION org.own_public_labels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION org.own_public_labels()
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor;

-- ---------------------------------------------------------------------------
-- The guard, extended rather than duplicated: the invariant is the same one.
-- Check 6 says both definer functions added by this range are still scoped to
-- the caller's own organisation, and that sylva_web_anon can call neither.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ci.assert_own_org_functions_are_scoped() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text; f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['org.own_organisation()', 'org.own_public_labels()'] LOOP
    SELECT string_agg(p.proname, ', ') INTO v
      FROM pg_proc p
     WHERE p.oid = f::regprocedure
       AND (NOT p.prosecdef
            OR pg_get_functiondef(p.oid) NOT LIKE '%actor_org_id()%');
    IF v IS NOT NULL THEN
      PERFORM ci.fail('own_org_functions_are_scoped',
        f || ' is not a SECURITY DEFINER scoped to sylva.actor_org_id()');
    END IF;

    -- A role with no organisation context would get NULL and therefore no row,
    -- but a function it cannot call is a stronger statement than a function
    -- that happens to answer nothing.
    IF has_function_privilege('sylva_web_anon', f::regprocedure, 'EXECUTE') THEN
      PERFORM ci.fail('own_org_functions_are_scoped',
        'sylva_web_anon can EXECUTE ' || f);
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION ci.assert_own_org_functions_are_scoped() IS
  'The two SECURITY DEFINER functions that read a name or a label the caller '
  'has no column privilege on are scoped to the caller''s own organisation, '
  'and the anonymous role cannot call either.';

DO $selftest$
DECLARE fired boolean := false;
BEGIN
  GRANT EXECUTE ON FUNCTION org.own_public_labels() TO sylva_web_anon;
  BEGIN PERFORM ci.assert_own_org_functions_are_scoped();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE EXECUTE ON FUNCTION org.own_public_labels() FROM sylva_web_anon;
  IF NOT fired THEN
    RAISE EXCEPTION 'own-org guard is toothless: sylva_web_anon holding EXECUTE went unnoticed';
  END IF;

  PERFORM ci.assert_own_org_functions_are_scoped();
  RAISE NOTICE 'own-org function guard verified: fires once, silent otherwise';
END $selftest$;
