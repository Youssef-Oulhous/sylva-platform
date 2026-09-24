-- ============================================================================
-- D2. AN ENTRY IN THE PERMANENT RECORD MAY ONLY BE WRITTEN BY A PARTY TO THE
--     THING IT IS ABOUT
--
-- Closes FINDING-002 (docs/FINDING-002-record-entry-cross-deal-append.md),
-- found by the row-level security matrix on 24 Sep 2026 and deliberately left
-- open there because record.entry belongs to this migration range and a policy
-- fixed from outside its own range is how two migrations end up disagreeing
-- about one table.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG
--
-- record.entry was the one table in the matrix whose INSERT policy checked only
-- that a row was stamped with the WRITER'S OWN organisation:
--
--     CREATE POLICY p_record_insert ON record.entry FOR INSERT
--       TO sylva_buyer, sylva_project_owner
--       WITH CHECK (actor_org_id = sylva.actor_org_id());
--
-- Every other column was free. deal_id, deal_buyer_org_id and deal_owner_org_id
-- are constrained only by the composite foreign key record_deal_fk back to
-- deal.deal, which checks that the three values describe a REAL deal - not that
-- they describe THIS writer's deal. So Buyer B, connected as sylva_buyer with
-- its own valid signed context, could append:
--
--     entry_type         interest_expressed
--     project_id         project 1
--     deal_id            Buyer A's deal
--     deal_buyer_org_id  Buyer A
--     deal_owner_org_id  Owner A
--     actor_org_id       Buyer B        <- its own, so the policy was satisfied
--
-- Confirmed against the live database by tests/rls/matrix.test.ts. Owner B and
-- a registered-but-unvetted organisation could do the same.
--
-- The deal-less shape was as open: a buyer could append a 'listed' or 'offered'
-- entry against a project it has nothing to do with, because project_id was not
-- checked either.
--
-- ---------------------------------------------------------------------------
-- WHY IT MATTERS MORE HERE THAN ON ANY OTHER TABLE
--
-- It is not a read leak. Buyer B still cannot SELECT that deal, its messages,
-- its terms or its documents; every one of those returns zero rows, asserted
-- table by table in the matrix. And the same clause that permitted this refused
-- actor_org_id = <Buyer A>, so a forged row always carried its real author.
--
-- It matters because of R4 and because of where these rows surface:
--
--   * R4. The record is append-only. UPDATE and DELETE are revoked AND blocked
--     by ENABLE ALWAYS triggers. A junk entry cannot be removed - only corrected
--     by a further entry that points at it, with the wrong one staying visible
--     for ever. The cost of a bad row is not "fix it", it is "explain it".
--
--   * record.v_public_entry. An entry carrying another organisation's deal_id
--     is resolved by the public record against coalesce(deal_buyer_org_id,
--     actor_org_id) - that is, against the OTHER organisation. A forged row
--     therefore appears on /record under that organisation's deal label, or
--     under its legal name if it had disclosed that deal. One buyer could put
--     words in another buyer's mouth, publicly and permanently. That is the
--     failure the concept note names as the one to avoid, reached by a write
--     rather than by a read.
--
-- ---------------------------------------------------------------------------
-- THE FIX
--
-- The counterparties are already denormalised onto the row, so the check needs
-- no new column and no join:
--
--   a deal-bearing entry  ->  the writer must be the deal's buyer or its owner
--   a deal-less entry     ->  the writer must own the project
--
-- proj.is_owned_by_actor() is the same SECURITY DEFINER helper record.entry's
-- own SELECT policy already uses, so the read side and the write side now agree
-- about what "this writer's project" means.
--
-- What this does NOT change:
--
--   * The operator. p_record_insert_op is a separate policy WITH CHECK (true),
--     because Sylva records events it witnessed on behalf of both parties. Left
--     exactly as it was.
--   * The one application write path. src/lib/interest/queries.ts writes
--     deal_buyer_org_id = sylva.actor_org_id(), so expressing interest still
--     passes - it was already party-scoped, in code, which is precisely the
--     thing the note says must not be where a rule lives.
--   * Anything a buyer can READ. This is a WITH CHECK; no USING clause moves.
--
-- Consequence in the matrix, as FINDING-002 predicted: three cells change from
-- 'ok' to 'blocked' - Buyer B, Owner B and the unvetted organisation - and the
-- finding comes off docs/SECURITY-MATRIX.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The policy.
--
-- DROP + CREATE rather than ALTER, so the new predicate is readable in one
-- piece here rather than as a diff against a line in migration 0017. A policy
-- carries no privileges, so unlike a view (see 0023, 0024, 0075) dropping one
-- discards nothing.
--
-- The TO list is restated in full. A policy written without one targets PUBLIC,
-- which is the bug migration 0031 was spent on.
-- ---------------------------------------------------------------------------
DROP POLICY p_record_insert ON record.entry;

CREATE POLICY p_record_insert ON record.entry FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (
    -- an entry always carries its real author
    actor_org_id = sylva.actor_org_id()
    AND CASE
          -- ...and is about a deal this author is a party to
          WHEN deal_id IS NOT NULL
            THEN deal_buyer_org_id = sylva.actor_org_id()
              OR deal_owner_org_id = sylva.actor_org_id()
          -- ...or about a project this author owns. 'listed' and 'offered' are
          -- statements about a project, and only its owner may make one.
          ELSE proj.is_owned_by_actor(project_id)
        END
  );

COMMENT ON POLICY p_record_insert ON record.entry IS
  'FINDING-002, closed in migration 0076. A party to the deal, or the owner of '
  'the project, and nobody else. Checking only actor_org_id let one buyer append '
  'a permanent, public entry carrying another buyer''s deal id, which '
  'record.v_public_entry then resolved and displayed against that other buyer.';

-- ---------------------------------------------------------------------------
-- 2. The guard.
--
-- A privilege guard cannot see this: the privilege - INSERT on record.entry -
-- is unchanged and correct. What changed is a row-level predicate, so the guard
-- reads the predicate itself with pg_get_expr(), which is the effective
-- expression PostgreSQL evaluates and not a name on a list. That is the
-- distinction README section 11 draws: the forbidden thing is matching on a
-- ROLE NAME, because role membership makes a name list lie. A policy's WITH
-- CHECK has no membership to follow - it is either that expression or it is
-- not.
--
-- The behavioural half of this guard lives in tests/rls/matrix.test.ts, which
-- runs the forged INSERT as each of the ten principals against real data, and
-- in tests/db/record.test.ts. A guard that runs inside a migration has no data
-- to test against: migrations apply before the seeds.
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_record_insert_is_party_scoped() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_check text; v_needle text;
BEGIN
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_check
    FROM pg_policy p
   WHERE p.polrelid = 'record.entry'::regclass
     AND p.polname  = 'p_record_insert';

  IF v_check IS NULL THEN
    RAISE EXCEPTION
      'R4 regression: record.entry has no p_record_insert WITH CHECK at all, so '
      'any role holding INSERT may write any entry about anybody'
      USING ERRCODE = 'SY0CI';
  END IF;

  -- Each clause is load-bearing and each one is named, so a guard failure says
  -- which half of the rule was dropped rather than "the policy changed".
  FOREACH v_needle IN ARRAY ARRAY[
      'actor_org_id',          -- the entry carries its real author
      'deal_buyer_org_id',     -- ...who is the deal's buyer
      'deal_owner_org_id',     -- ...or the deal's owner
      'is_owned_by_actor'      -- ...or, with no deal, the project's owner
  ] LOOP
    IF position(v_needle in v_check) = 0 THEN
      RAISE EXCEPTION
        'FINDING-002 regression: record.entry.p_record_insert no longer tests %. '
        'Its WITH CHECK is now: %. An entry may only be written by a party to '
        'the deal it names, or by the owner of the project it names - otherwise '
        'one organisation can append a permanent public entry about another.',
        v_needle, v_check
        USING ERRCODE = 'SY0CI';
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION ci.assert_record_insert_is_party_scoped() IS
  'FINDING-002. record.entry is append-only and its rows are published by '
  'record.v_public_entry, so a weak INSERT check is not "a row to clean up" - '
  'it is a permanent public statement about an organisation that did not make '
  'it. Self-tested in migration 0076.';

-- ---------------------------------------------------------------------------
-- 3. Self-test, in the shape migrations 0027-0030 established: put the
--    forbidden thing back, assert the guard notices, undo it.
--
--    The forbidden thing here is the OLD predicate, which is exactly what a
--    future migration would reintroduce by widening this policy.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- it must pass as things now stand
  PERFORM ci.assert_record_insert_is_party_scoped();

  ALTER POLICY p_record_insert ON record.entry
    WITH CHECK (actor_org_id = sylva.actor_org_id());
  BEGIN
    PERFORM ci.assert_record_insert_is_party_scoped();
    RAISE EXCEPTION
      'ci.assert_record_insert_is_party_scoped() is toothless: it did not notice '
      'the pre-0076 predicate, which is the one it exists to catch';
  EXCEPTION WHEN sqlstate 'SY0CI' THEN
    NULL;  -- what should happen
  END;

  -- put the real one back...
  ALTER POLICY p_record_insert ON record.entry
    WITH CHECK (
      actor_org_id = sylva.actor_org_id()
      AND CASE
            WHEN deal_id IS NOT NULL
              THEN deal_buyer_org_id = sylva.actor_org_id()
                OR deal_owner_org_id = sylva.actor_org_id()
            ELSE proj.is_owned_by_actor(project_id)
          END
    );

  -- ...and it must pass again afterwards
  PERFORM ci.assert_record_insert_is_party_scoped();
END $$;
