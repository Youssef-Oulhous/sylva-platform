-- ============================================================================
-- A20. PROJECT PARTIES MAY BE NAMED PUBLICLY
--
-- Found while wiring the projects index, 23 Sep 2026.
--
-- A14 withholds org.organisation.legal_name from every public-facing role, and
-- that is correct: it is what makes R5 real rather than a convention. But it
-- withholds the name from ALL organisations, and the note requires some of them
-- to be named:
--
--   Section 6: "The partners on the ground. Who develops the project, who owns
--   the land, who verifies. One buyer told us it judges a project by meeting
--   the people behind it."
--
-- So the project owner, the land owner and the verifier must be nameable on a
-- published project page, while buyers must not be nameable anywhere except
-- through a deal they have chosen to disclose.
--
-- The narrow exposure is a view that names an organisation ONLY where it is a
-- declared party to, or the owner of, a project that is already public. The
-- view runs with the privileges of its owner - security_invoker is deliberately
-- NOT set - so it can read legal_name that the caller cannot. The WHERE clause
-- is therefore the whole security boundary and is kept as small as possible.
--
-- A buyer is neither a project party nor a project owner, so no buyer is named
-- by this view. An organisation that is BOTH a buyer and a project owner is
-- named here in its capacity as an owner; that does not link it to its buying,
-- because the public record shows a per-deal label and never the name.
-- ============================================================================

CREATE VIEW org.v_public_party WITH (security_barrier = true) AS
SELECT o.id,
       o.legal_name,
       o.country_code
  FROM org.organisation o
 WHERE EXISTS (
         SELECT 1
           FROM proj.project_party pp
           JOIN proj.project p ON p.id = pp.project_id
          WHERE pp.party_org_id = o.id
            AND p.status IN ('published', 'withdrawn', 'archived'))
    OR EXISTS (
         SELECT 1
           FROM proj.project p
          WHERE p.owner_org_id = o.id
            AND p.status IN ('published', 'withdrawn', 'archived'));

COMMENT ON VIEW org.v_public_party IS
  'The ONLY public route to an organisation''s legal name. Restricted to '
  'declared parties and owners of already-public projects, per concept note '
  'section 6. Runs with the view owner''s privileges by design, so the WHERE '
  'clause is the security boundary - widen it only with review.';

GRANT SELECT ON org.v_public_party
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor;

-- ---------------------------------------------------------------------------
-- The guard. The view is a deliberate hole in R5, so it gets its own test:
-- no organisation may be named through it unless it is a public project party.
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_public_party_view_is_narrow() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE leaked int; r text;
BEGIN
  SELECT count(*) INTO leaked
  FROM org.v_public_party v
  WHERE NOT EXISTS (SELECT 1 FROM proj.project_party pp
                     JOIN proj.project p ON p.id = pp.project_id
                    WHERE pp.party_org_id = v.id
                      AND p.status IN ('published','withdrawn','archived'))
    AND NOT EXISTS (SELECT 1 FROM proj.project p
                    WHERE p.owner_org_id = v.id
                      AND p.status IN ('published','withdrawn','archived'));
  IF leaked > 0 THEN
    RAISE EXCEPTION 'R5 regression: v_public_party names % organisation(s) that are not public parties', leaked;
  END IF;

  -- The base table must still be closed. The view is the only route.
  FOREACH r IN ARRAY ARRAY['sylva_web_anon','sylva_buyer',
                           'sylva_project_owner','sylva_investor'] LOOP
    IF has_column_privilege(r, 'org.organisation', 'legal_name', 'SELECT') THEN
      RAISE EXCEPTION 'R5 regression: % can read org.organisation.legal_name directly', r;
    END IF;
  END LOOP;
END $$;
