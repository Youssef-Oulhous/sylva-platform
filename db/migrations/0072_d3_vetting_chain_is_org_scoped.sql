-- ============================================================================
-- D3. A SUPERSEDES CHAIN MAY NOT CROSS AN ORGANISATION OR A ROLE
-- ============================================================================
-- Found by attacking the vetting flow rather than by reading the DDL, which is
-- the same way FINDING-001 was found.
--
-- Migration 0005 declared the chain like this:
--
--   supersedes_id uuid UNIQUE REFERENCES org.vetting_submission(id)
--
-- `id` alone. So the referenced submission may belong to ANY organisation and
-- to ANY role, and the row-level policy cannot help: p_vsub_insert checks
-- org_id = sylva.actor_org_id() on the row BEING INSERTED, which is honestly
-- the attacker's own, and says nothing about the row it points at.
--
-- Reproduced live, as sylva_buyer, holding a valid signed context for its own
-- organisation:
--
--   INSERT INTO org.vetting_submission (org_id, role_code, questionnaire_id,
--                                       supersedes_id)
--   VALUES (sylva.actor_org_id(), 'buyer', <buyer questionnaire>,
--           '<ANOTHER organisation''s submission id>');    -- INSERT 0 1
--
-- and again pointing at a project_owner submission from a buyer row. Both were
-- accepted.
--
-- Why that matters, in the order the damage lands:
--
--   1  DENIAL OF VETTING, which is denial of every deal. supersedes_id is
--      UNIQUE. Once a stranger's row claims organisation A's head submission as
--      its predecessor, A can never apply again: submitVetting() reads its own
--      head - A still sees it, because A cannot see the attacker's row - and
--      the INSERT hits the unique index. A is told "this application has
--      already been replaced by a newer one, probably from another person in
--      your organisation", which is false, and no action A can take clears it.
--      No new submission means no decision, no decision means no approval, and
--      R6 then refuses A every deal, for ever. This is the most complete
--      lock-out reachable by one INSERT anywhere in the schema.
--
--   2  THE CHAIN AN AUDITOR READS BECOMES UNTRUE. R4 makes the record
--      append-only so that the history is evidence. A chain that forks across
--      organisations is not history of anything.
--
--   3  A ROLE BOUNDARY IS CROSSED. A buyer application superseding a project
--      owner application is not a state the product has.
--
-- What it does NOT reach: org.vetting_decision already carries
-- FOREIGN KEY (submission_id, org_id, role_code), so a decision still cannot
-- cite another organisation's answers. That composite FK is the pattern this
-- migration copies - the anchor UNIQUE (id, org_id, role_code) was already
-- there for exactly this purpose and the chain simply did not use it.
--
-- Exploitability: the attacker needs the victim's submission UUID. That is not
-- public, but it is not a secret either - it is printed to the victim's own
-- staff as "Application reference" on /vetting/status precisely so it can be
-- quoted to Sylva in an email, and every operator and auditor can read every
-- one of them. A former employee is enough.
--
-- Rules touched: R4 and R6 are enforced, not changed. Nothing is granted, no
-- policy is widened, no figure moves. A NULL supersedes_id is still the root of
-- a chain: a multi-column foreign key with MATCH SIMPLE is satisfied whenever
-- any referencing column is NULL, and org_id and role_code are both NOT NULL,
-- so supersedes_id IS NULL is the only way that happens.
-- ============================================================================

ALTER TABLE org.vetting_submission
  ADD CONSTRAINT vetting_submission_supersedes_same_org_role
  FOREIGN KEY (supersedes_id, org_id, role_code)
  REFERENCES org.vetting_submission (id, org_id, role_code);

COMMENT ON CONSTRAINT vetting_submission_supersedes_same_org_role
  ON org.vetting_submission IS
  'R4/R6: a re-application may only supersede an application by the SAME organisation for the SAME role. Without this the chain is forgeable across organisations, and because supersedes_id is UNIQUE a stranger can permanently prevent an organisation from ever applying again.';

-- ---------------------------------------------------------------------------
-- The guard, so a later migration cannot drop the constraint unnoticed
-- ---------------------------------------------------------------------------
-- Structural, like parts (b) and (c) of ci.assert_approval_is_derived(): it
-- asks whether the mechanism is still present, never whether a role is on a
-- list of names. There is no privilege to test here - the hole was reachable by
-- a principal holding exactly the privileges it is supposed to hold.
CREATE FUNCTION ci.assert_vetting_chain_is_org_scoped() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(msg, '; ') INTO v FROM (
    -- (a) the composite foreign key is still there, still over all three
    --     columns, and still pointing at the (id, org_id, role_code) anchor.
    SELECT 'org.vetting_submission.supersedes_id is not scoped to (org_id, role_code)' AS msg
     WHERE NOT EXISTS (
       SELECT 1
         FROM pg_constraint c
        WHERE c.conrelid = 'org.vetting_submission'::regclass
          AND c.confrelid = 'org.vetting_submission'::regclass
          AND c.contype = 'f'
          AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                 FROM unnest(c.conkey) k
                 JOIN pg_attribute a
                   ON a.attrelid = c.conrelid AND a.attnum = k)
              = ARRAY['org_id','role_code','supersedes_id'])

    UNION ALL
    -- (b) UNIQUE (supersedes_id) is what makes the chain a chain rather than a
    --     tree. It is also what turns (a)'s absence into a lock-out, so the two
    --     belong in one guard: whichever of them goes, this fires.
    SELECT 'org.vetting_submission.supersedes_id is no longer UNIQUE'
     WHERE NOT EXISTS (
       SELECT 1
         FROM pg_constraint c
        WHERE c.conrelid = 'org.vetting_submission'::regclass
          AND c.contype = 'u'
          AND (SELECT array_agg(a.attname::text)
                 FROM unnest(c.conkey) k
                 JOIN pg_attribute a
                   ON a.attrelid = c.conrelid AND a.attnum = k)
              = ARRAY['supersedes_id'])
  ) s;

  IF v IS NOT NULL THEN PERFORM ci.fail('vetting_chain_is_org_scoped', v); END IF;
END $$;

COMMENT ON FUNCTION ci.assert_vetting_chain_is_org_scoped() IS
  'R4/R6: the vetting supersedes chain stays inside one organisation and one role, and stays single-successor. Dropping either half lets a stranger lock an organisation out of vetting for ever.';

-- ---------------------------------------------------------------------------
-- Proof the guard has teeth (README §11: a guard that cannot fail is not one)
-- ---------------------------------------------------------------------------
DO $$
DECLARE fired boolean := false;
BEGIN
  ALTER TABLE org.vetting_submission
    DROP CONSTRAINT vetting_submission_supersedes_same_org_role;
  BEGIN
    PERFORM ci.assert_vetting_chain_is_org_scoped();
  EXCEPTION WHEN OTHERS THEN fired := true;
  END;
  ALTER TABLE org.vetting_submission
    ADD CONSTRAINT vetting_submission_supersedes_same_org_role
    FOREIGN KEY (supersedes_id, org_id, role_code)
    REFERENCES org.vetting_submission (id, org_id, role_code);

  IF NOT fired THEN
    RAISE EXCEPTION
      'vetting chain guard is toothless: it did not notice the composite foreign key being dropped';
  END IF;

  PERFORM ci.assert_vetting_chain_is_org_scoped();
  RAISE NOTICE 'vetting chain guard verified: it fires when the composite foreign key is dropped';
END $$;

-- ---------------------------------------------------------------------------
-- Proof the hole is closed, run as the real principal that could exploit it
-- ---------------------------------------------------------------------------
-- Two probes, both as sylva_buyer holding a genuine HMAC-signed context:
--   1  superseding ANOTHER organisation's submission must be refused (23503);
--   2  superseding its OWN, for the same role, must still be accepted - and is
--      rolled back through a distinctive SQLSTATE, because
--      org.vetting_submission is append-only and a migration must not leave a
--      test application on a real organisation's permanent record.
DO $$
DECLARE
  v_mine    uuid; v_mine_org uuid; v_mine_qn uuid;
  v_theirs  uuid;
  v_ctx     text;
  v_state   text;
BEGIN
  SELECT s.id, s.org_id, s.questionnaire_id
    INTO v_mine, v_mine_org, v_mine_qn
    FROM org.vetting_submission s
   WHERE s.role_code = 'buyer'
     AND NOT EXISTS (SELECT 1 FROM org.vetting_submission x
                      WHERE x.supersedes_id = s.id)
   ORDER BY s.submitted_at
   LIMIT 1;

  SELECT s.id INTO v_theirs
    FROM org.vetting_submission s
   WHERE s.org_id <> v_mine_org
   ORDER BY s.submitted_at
   LIMIT 1;

  IF v_mine IS NULL OR v_theirs IS NULL THEN
    RAISE NOTICE 'no vetting fixtures loaded yet; chain proof deferred to tests/db/vetting.test.ts';
    RETURN;
  END IF;

  v_ctx := sylva.mint_actor_ctx(v_mine_org, NULL, interval '5 minutes');

  -- 1. another organisation's application, as a predecessor: refused.
  v_state := NULL;
  PERFORM set_config('sylva.actor_ctx', v_ctx, true);
  SET LOCAL ROLE sylva_buyer;
  BEGIN
    INSERT INTO org.vetting_submission
      (org_id, role_code, questionnaire_id, supersedes_id)
    VALUES (sylva.actor_org_id(), 'buyer', v_mine_qn, v_theirs);
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE;
  END;
  RESET ROLE;
  IF v_state IS DISTINCT FROM '23503' THEN
    RAISE EXCEPTION
      'a buyer could still supersede another organisation''s application (sqlstate %)',
      coalesce(v_state, 'none - it was ACCEPTED');
  END IF;

  -- 2. its own application, same role: still accepted, then rolled back.
  v_state := NULL;
  PERFORM set_config('sylva.actor_ctx', v_ctx, true);
  SET LOCAL ROLE sylva_buyer;
  BEGIN
    INSERT INTO org.vetting_submission
      (org_id, role_code, questionnaire_id, supersedes_id)
    VALUES (sylva.actor_org_id(), 'buyer', v_mine_qn, v_mine);
    RAISE EXCEPTION USING ERRCODE = 'SY0PR', MESSAGE = 'probe accepted; rolling back';
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE;
  END;
  RESET ROLE;
  IF v_state IS DISTINCT FROM 'SY0PR' THEN
    RAISE EXCEPTION
      'the new constraint refuses a LEGITIMATE re-application (sqlstate %)', v_state;
  END IF;

  PERFORM set_config('sylva.actor_ctx', '', true);
  RAISE NOTICE 'vetting chain verified: cross-organisation supersede refused, own-organisation re-application still accepted';
END $$;
