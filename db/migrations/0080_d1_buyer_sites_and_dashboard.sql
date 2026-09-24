-- ============================================================================
-- D1. THE BUYER'S OWN SITES, AND THE BUYER'S OWN DASHBOARD
-- ============================================================================
-- Migration range 0080-0084 (buyer-sites-and-dashboard).
--
-- Three things, and nothing else:
--
--   1. A buyer may record the provenance of its own site.
--   2. An organisation may read its OWN legal name - and only its own.
--   3. A guard that states, and proves, that a buyer's site locations are
--      private, because that is the claim the /dashboard/sites page makes on
--      screen and a claim on a screen is not enforcement.
--
-- Nothing here widens a read across organisations. Everything added is either
-- scoped by sylva.actor_org_id() or is a privilege the buyer already needed to
-- exercise the write path migration 0016 gave it.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. A buyer may record provenance for its own site.
--
-- geo.buyer_site.source_ref_id is NOT NULL, as it is on every table holding a
-- displayed figure - a coordinate shown on a screen is a figure and carries its
-- source and date like any other. Migration 0016 granted INSERT on
-- sylva.source_ref to the operator and the project owner, and migration 0017
-- gave those two an INSERT policy. It granted the buyer full CRUD on
-- geo.buyer_site in the same file.
--
-- Those two facts do not compose: a buyer cannot insert the row its own site
-- row requires, so the write path it was granted could never be completed.
-- This closes that gap and nothing more. The buyer gains INSERT on one table
-- whose rows are provenance statements; it gains no UPDATE and no DELETE, and
-- sylva.source_ref is append-only under R4 either way.
--
-- IMPORTANT, and stated here because the application has to honour it:
-- sylva.source_ref is world-readable. Migration 0016 grants SELECT on it to
-- sylva_web_anon, and migration 0017's p_source_ref_read is USING (true) for
-- every role there is. So a source_ref label written by a buyer MUST NOT name
-- the site, the place, the coordinates or the organisation. The label says what
-- KIND of statement it is; the private part stays in geo.buyer_site, behind the
-- organisation-scoped policy. src/lib/sites/queries.ts writes one fixed label
-- and a date, and tests/db/sites.test.ts asserts the label carries neither the
-- site name nor the organisation.
-- ---------------------------------------------------------------------------
GRANT INSERT ON sylva.source_ref TO sylva_buyer;

CREATE POLICY p_source_ref_insert_buyer ON sylva.source_ref FOR INSERT
  TO sylva_buyer WITH CHECK (true);

COMMENT ON POLICY p_source_ref_insert_buyer ON sylva.source_ref IS
  'A buyer records the provenance of its own registered site. The row is '
  'world-readable, so its label must never name the site, the place or the '
  'organisation - only what kind of statement it is.';


-- ---------------------------------------------------------------------------
-- 2. An organisation may read its OWN legal name.
--
-- Migration 0016 withholds org.organisation.legal_name, registration_number and
-- registered_address from every public-facing role, and that is R5 working:
-- "One buyer seeing another buyer's prices or terms is the failure we most need
-- to avoid", and a buyer's name on the public record is the first step to that.
-- Migration 0022 opened one narrow view for project parties, and a buyer is
-- deliberately not one.
--
-- But the buyer dashboard shows the organisation ITS OWN record - the same
-- record it typed into the registration form. Refusing an organisation its own
-- name is not privacy, it is a bug; the dashboard would have to print a UUID
-- where the client's design says "Legal name".
--
-- So: a SECURITY DEFINER function, hard-scoped to sylva.actor_org_id(), which
-- is the signed, unforgeable context from migration 0019. It cannot be pointed
-- at another organisation because it takes no argument. No column grant is
-- widened, so ci.assert_public_party_view_is_narrow() - which asks
-- has_column_privilege(role, 'org.organisation', 'legal_name', 'SELECT') - still
-- passes, and a buyer still cannot name another buyer by any route.
--
-- The joins to platform.sector and platform.size_band are here rather than in
-- the application because the caller cannot read legal_name to join against
-- anyway, and one round trip is one round trip.
-- ---------------------------------------------------------------------------

-- FORCE ROW LEVEL SECURITY binds the table OWNER, and a SECURITY DEFINER
-- function runs as the owner. Migration 0040 hit this exactly: without a policy
-- naming whoever actually owns the table, the function returns no rows on a
-- DEPLOYED database while appearing to work locally, where the owner is a
-- superuser and bypasses row security entirely. 0040 added the INSERT half for
-- identity.register; this is the SELECT half, created for the real owner rather
-- than for a role name someone guessed.
DO $definer$
DECLARE og_owner text := pg_get_userbyid(
  (SELECT relowner FROM pg_class WHERE oid = 'org.organisation'::regclass));
BEGIN
  EXECUTE format(
    'CREATE POLICY p_org_definer_read ON org.organisation FOR SELECT TO %I USING (true)',
    og_owner);
END $definer$;

COMMENT ON POLICY p_org_definer_read ON org.organisation IS
  'Exists only so org.own_organisation() is not blocked by FORCE ROW LEVEL '
  'SECURITY, which binds the owner. It names the table owner, which is not a '
  'role any request runs as, and confers nothing on any application role.';

CREATE FUNCTION org.own_organisation()
RETURNS TABLE (
  org_id              uuid,
  legal_name          text,
  registration_number text,
  registered_address  text,
  country_code        text,
  sector_code         text,
  sector_label_en     text,
  sector_label_de     text,
  size_band_code      text,
  size_band_label_en  text,
  size_band_label_de  text,
  created_at          timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, org, platform, sylva
AS $$
  SELECT o.id,
         o.legal_name::text,
         o.registration_number,
         o.registered_address,
         o.country_code::text,
         o.sector_code,
         s.label_en::text,
         s.label_de,
         o.size_band_code,
         b.label_en::text,
         b.label_de,
         o.created_at
    FROM org.organisation o
    LEFT JOIN platform.sector    s ON s.code = o.sector_code
    LEFT JOIN platform.size_band b ON b.code = o.size_band_code
   -- The whole security boundary, in one line. No argument, so there is nothing
   -- to point at another organisation; NULL context returns no row.
   WHERE o.id = sylva.actor_org_id()
$$;

COMMENT ON FUNCTION org.own_organisation() IS
  'The caller''s OWN organisation record, including the legal name that '
  'migration 0016 withholds from every public-facing role. Scoped to '
  'sylva.actor_org_id() and takes no argument, so it cannot be aimed at another '
  'organisation. Guarded by ci.assert_buyer_sites_are_private(), check 5.';

REVOKE ALL ON FUNCTION org.own_organisation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION org.own_organisation()
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator, sylva_auditor;


-- ---------------------------------------------------------------------------
-- 3. The guard.
--
-- "This information must remain private" is written on /dashboard/sites in two
-- languages. This is the sentence underneath it. Five checks:
--
--   1  no role outside the buyer, the operator, the auditor and the ownership
--      chain holds ANY privilege on geo.buyer_site;
--   2  the table has row level security ENABLED and FORCED;
--   3  no policy on it names PUBLIC or a role outside that same set;
--   4  every policy that names sylva_buyer is scoped by sylva.actor_org_id()
--      in BOTH its USING and its WITH CHECK, so one buyer cannot read or write
--      another buyer's row;
--   5  org.own_organisation() is still scoped by sylva.actor_org_id(), because
--      an unscoped version of it would name every organisation on the platform.
--
-- Written against effective privilege - has_table_privilege, pg_has_role - and
-- never against a role name, for the reason migrations 0025-0030 exist: a
-- privilege reaching a role through membership is invisible to
-- information_schema, and that is a false negative in the dangerous direction.
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_buyer_sites_are_private() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v        text;
  st_owner oid := (SELECT relowner FROM pg_class WHERE oid = 'geo.buyer_site'::regclass);
  relrls   boolean;
  relforce boolean;
BEGIN
  -- 1. Privilege. The three roles that may reach the table at all, plus
  --    whoever owns it and anything that is a member of one of them.
  SELECT string_agg(format('%s can %s geo.buyer_site', r.rolname, p.priv), ', ')
    INTO v
    FROM pg_roles r
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES')) AS p(priv)
   WHERE r.rolname LIKE 'sylva\_%'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles a
        WHERE a.rolname IN ('sylva_owner','sylva_buyer','sylva_operator','sylva_auditor')
          AND pg_has_role(r.oid, a.oid, 'USAGE'))
     AND NOT pg_has_role(r.oid, st_owner, 'USAGE')
     AND has_table_privilege(r.oid, 'geo.buyer_site', p.priv);
  IF v IS NOT NULL THEN PERFORM ci.fail('buyer_sites_are_private', v); END IF;

  -- 2. Row level security on, and FORCED. Without FORCE the owner reads every
  --    row, and the owner is what a SECURITY DEFINER function runs as.
  SELECT c.relrowsecurity, c.relforcerowsecurity INTO relrls, relforce
    FROM pg_class c WHERE c.oid = 'geo.buyer_site'::regclass;
  IF NOT relrls OR NOT relforce THEN
    PERFORM ci.fail('buyer_sites_are_private',
      'geo.buyer_site: row level security must be ENABLED and FORCED');
  END IF;

  -- 3. Policies name only those same roles. polroles = {0} means PUBLIC, which
  --    on this table would hand every site to the anonymous visitor.
  SELECT string_agg(format('policy %s names %s', pol.polname,
                           coalesce(pg_get_userbyid(nullif(rid, 0)), 'PUBLIC')), ', ')
    INTO v
    FROM pg_policy pol
    CROSS JOIN LATERAL unnest(pol.polroles) AS u(rid)
   WHERE pol.polrelid = 'geo.buyer_site'::regclass
     AND (rid = 0
          OR (NOT EXISTS (
                SELECT 1 FROM pg_roles a
                 WHERE a.rolname IN ('sylva_owner','sylva_buyer','sylva_operator','sylva_auditor')
                   AND pg_has_role(rid, a.oid, 'USAGE'))
              AND NOT pg_has_role(rid, st_owner, 'USAGE')));
  IF v IS NOT NULL THEN PERFORM ci.fail('buyer_sites_are_private', v); END IF;

  -- 4. The buyer's own policy is organisation-scoped, both ways round. A read
  --    predicate without a write predicate lets a buyer INSERT a row it can
  --    never see, under another organisation's id.
  SELECT string_agg(format('policy %s on geo.buyer_site is not scoped by sylva.actor_org_id()',
                           pol.polname), ', ')
    INTO v
    FROM pg_policy pol
   WHERE pol.polrelid = 'geo.buyer_site'::regclass
     AND EXISTS (SELECT 1 FROM unnest(pol.polroles) AS u(rid)
                  WHERE rid = 'sylva_buyer'::regrole::oid)
     AND (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') NOT LIKE '%actor_org_id%'
          OR coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') NOT LIKE '%actor_org_id%');
  IF v IS NOT NULL THEN PERFORM ci.fail('buyer_sites_are_private', v); END IF;

  -- 5. The one function that reads a legal name the caller has no column
  --    privilege on must still be scoped to the caller's own organisation.
  SELECT string_agg(p.proname, ', ') INTO v
    FROM pg_proc p
   WHERE p.oid = 'org.own_organisation()'::regprocedure
     AND (NOT p.prosecdef OR pg_get_functiondef(p.oid) NOT LIKE '%actor_org_id()%');
  IF v IS NOT NULL THEN
    PERFORM ci.fail('buyer_sites_are_private',
      'org.own_organisation() is no longer a SECURITY DEFINER scoped to sylva.actor_org_id()');
  END IF;
END $$;

COMMENT ON FUNCTION ci.assert_buyer_sites_are_private() IS
  'A buyer''s registered site locations are reachable by that buyer, the '
  'operator and the auditor, and by nobody else. Tests effective privilege and '
  'policy scope, never a role name.';

-- A guard that cannot fail is not a guard. Three ways in, three times it fires.
DO $selftest$
DECLARE fired boolean := false;
BEGIN
  GRANT SELECT ON geo.buyer_site TO sylva_web_anon;
  BEGIN PERFORM ci.assert_buyer_sites_are_private();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT ON geo.buyer_site FROM sylva_web_anon;
  IF NOT fired THEN
    RAISE EXCEPTION 'buyer site guard is toothless: sylva_web_anon reading buyer_site went unnoticed';
  END IF;

  fired := false;
  CREATE POLICY p_ci_selftest_public ON geo.buyer_site FOR SELECT TO PUBLIC USING (true);
  BEGIN PERFORM ci.assert_buyer_sites_are_private();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  DROP POLICY p_ci_selftest_public ON geo.buyer_site;
  IF NOT fired THEN
    RAISE EXCEPTION 'buyer site guard is toothless: a PUBLIC policy went unnoticed';
  END IF;

  fired := false;
  CREATE POLICY p_ci_selftest_wide ON geo.buyer_site FOR SELECT TO sylva_buyer USING (true);
  BEGIN PERFORM ci.assert_buyer_sites_are_private();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  DROP POLICY p_ci_selftest_wide ON geo.buyer_site;
  IF NOT fired THEN
    RAISE EXCEPTION 'buyer site guard is toothless: an unscoped buyer policy went unnoticed';
  END IF;

  PERFORM ci.assert_buyer_sites_are_private();
  RAISE NOTICE 'buyer site privacy guard verified: fires three times, silent otherwise';
END $selftest$;
