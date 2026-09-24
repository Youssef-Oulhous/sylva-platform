-- ============================================================================
-- D2. AN ORGANISATION MAY READ ITS OWN NAME
-- ============================================================================
-- Found while wiring the vetting questionnaire: the page has to say WHICH
-- organisation is answering - "a questionnaire with no visible subject is easy
-- to fill in for the wrong entity" - and no application role can read that.
--
--   migration 0016:  GRANT SELECT ON org.organisation TO sylva_operator,
--                    sylva_auditor, sylva_record;                 <- and nobody else
--   migration 0022:  org.v_public_party names declared parties and owners of
--                    already-public projects. A buyer is neither.
--
-- So today a signed-in buyer cannot read its own legal name, sector, country or
-- size band by any route. That is R5 working slightly too hard: R5 says a
-- BUYER'S identity is pseudonymous to OTHER PARTIES and on the public record.
-- It has never said an organisation may not see itself.
--
--   "On the public version of that record the buyer appears as a label such as
--    'Buyer 014' with its sector, country and size"  (concept note, section 8)
--
-- The fix is the pattern this schema already uses twice - org.v_public_party
-- and identity.whoami() - and not a table grant:
--
--   * a table grant would widen R5 permanently and would be caught, correctly,
--     by ci.assert_identity_columns_not_public();
--   * a SECURITY DEFINER function can be narrower than any grant, because its
--     WHERE clause is the boundary.
--
-- The boundary here is sylva.actor_org_id(), the HMAC-verified context from
-- migration 0019. A buyer can set the GUC but cannot forge a valid one and
-- cannot read the signing key to make one - FINDING-001. With no context the
-- function returns NO ROWS, which is why sylva_web_anon is not granted EXECUTE:
-- an anonymous visitor has no organisation and must not be able to probe for
-- one.
--
-- Rules touched: R5 is narrowed to what it actually says, and the narrowing is
-- one row - your own. R4, R6 and R7 are untouched; nothing here writes.
-- ============================================================================

CREATE FUNCTION org.my_organisation()
RETURNS TABLE (
  id             uuid,
  legal_name     text,
  country_code   text,
  sector_code    text,
  size_band_code text,
  created_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, org, sylva AS
$$
  SELECT o.id, o.legal_name::text, o.country_code::text,
         o.sector_code, o.size_band_code, o.created_at
    FROM org.organisation o
   WHERE o.id = sylva.actor_org_id()   -- verified, not asserted. Migration 0019.
$$;

COMMENT ON FUNCTION org.my_organisation() IS
  'The caller''s OWN organisation, and nothing else. The only route by which a buyer, project owner or investor can read its own legal name; R5 keeps every other organisation''s name out of reach. Returns no rows without a valid signed actor context, so it cannot be used to probe.';

-- The operator and the auditor already hold SELECT on the table and need no
-- function. sylva_web_anon, sylva_report and sylva_record are not granted it:
-- none of them acts for an organisation.
REVOKE ALL ON FUNCTION org.my_organisation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION org.my_organisation()
  TO sylva_buyer, sylva_project_owner, sylva_investor;

-- ---------------------------------------------------------------------------
-- Proof, not assertion. Three claims, each checked as the real role.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_a uuid;
  v_org_b uuid;
  v_person uuid;
  v_ctx  text;
  v_seen uuid;
  v_rows int;
BEGIN
  SELECT s.org_id, s.submitted_by_person_ref
    INTO v_org_a, v_person
    FROM org.vetting_submission s
   WHERE s.role_code = 'buyer'
   ORDER BY s.submitted_at
   LIMIT 1;
  SELECT o.id INTO v_org_b FROM org.organisation o
   WHERE o.id <> v_org_a ORDER BY o.created_at LIMIT 1;

  IF v_org_a IS NULL OR v_org_b IS NULL THEN
    RAISE NOTICE 'no organisations loaded yet; org.my_organisation() proof deferred to tests/db/vetting.test.ts';
    RETURN;
  END IF;

  v_ctx := sylva.mint_actor_ctx(v_org_a, v_person, interval '5 minutes');

  -- 1. with no context at all: no rows. This is what keeps it un-probeable.
  PERFORM set_config('sylva.actor_ctx', '', true);
  SET LOCAL ROLE sylva_buyer;
  SELECT count(*) INTO v_rows FROM org.my_organisation();
  RESET ROLE;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'org.my_organisation() returned % row(s) with no actor context', v_rows;
  END IF;

  -- 2. with a valid context: exactly its own organisation, name included.
  PERFORM set_config('sylva.actor_ctx', v_ctx, true);
  SET LOCAL ROLE sylva_buyer;
  SELECT m.id INTO v_seen FROM org.my_organisation() m;
  RESET ROLE;
  IF v_seen IS DISTINCT FROM v_org_a THEN
    RAISE EXCEPTION 'org.my_organisation() returned % for a context minted for %', v_seen, v_org_a;
  END IF;

  -- 3. one row, always. A function that could return two is a join bug waiting
  --    to become a disclosure.
  PERFORM set_config('sylva.actor_ctx', v_ctx, true);
  SET LOCAL ROLE sylva_buyer;
  SELECT count(*) INTO v_rows FROM org.my_organisation();
  RESET ROLE;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'org.my_organisation() returned % rows for one organisation', v_rows;
  END IF;

  PERFORM set_config('sylva.actor_ctx', '', true);
  RAISE NOTICE 'org.my_organisation() verified: no context -> 0 rows, valid context -> exactly its own row';
END $$;
