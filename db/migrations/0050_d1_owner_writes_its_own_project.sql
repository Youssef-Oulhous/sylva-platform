-- ============================================================================
-- D1. A PROJECT OWNER MAY WRITE ITS OWN PROJECT
-- ============================================================================
-- The concept note (section 2) says project owners "put projects on the
-- platform". Migration 0016 did not let them: every project content table was
-- granted INSERT to sylva_operator only, so the owner-facing pages had nothing
-- to write to and the only way a project could exist was for Sylva staff to
-- type it in.
--
-- This migration closes that gap and nothing else. Three things are true of
-- every grant below and they are what keep it narrow:
--
--   1. INSERT ONLY. Not UPDATE, not DELETE. Every table here is append-only
--      (ci.append_only_table) and an edit is version_no + 1 with the old row
--      still visible. R4 is untouched.
--   2. SCOPED BY ROW POLICY, not by application code. Each new policy tests
--      proj.is_owned_by_actor(project_id), which resolves the organisation
--      through sylva.actor_org_id() - the HMAC-verified context from migration
--      0019. An owner cannot write a row for a project it does not own even if
--      every line of TypeScript above it were wrong. See FINDING-001.
--   3. PUBLICATION IS STILL AN OPERATOR ACT. The owner may move its own
--      project from 'draft' or 'changes_requested' to 'submitted_for_review'
--      and to nothing else. That is enforced twice over - see below.
--
-- ---------------------------------------------------------------------------
-- WHY THE OWNER CANNOT PUBLISH ITS OWN PROJECT, STATED TWICE
-- ---------------------------------------------------------------------------
-- Once by row policy: p_project_owner_submit's WITH CHECK admits exactly one
-- target status.
--
-- And once structurally, which is the half that survives a careless future
-- edit to that policy. proj.project carries
--
--     CHECK ((status = 'published') = (published_at IS NOT NULL))
--
-- and the owner is granted UPDATE on the `status` column ONLY. To publish, a
-- row must also acquire a published_at, and the owner has no privilege that can
-- write that column. proj.enforce_publication_gate() sets it, but it is a
-- BEFORE UPDATE trigger on a statement the owner cannot issue in the first
-- place. So even a policy widened by mistake leaves self-publication
-- impossible: the CHECK constraint refuses the row.
--
-- ci.assert_owner_cannot_self_publish() below asserts the privilege half of
-- that argument, and has self-tests, because a guard that cannot fail is not a
-- guard (README, "If you write a new CI guard").
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT GRANTED
-- ---------------------------------------------------------------------------
--   doc.document, doc.document_version   document upload is not built; when it
--                                        is, the owner's grant belongs with it
--   proj.period_balance                  a cache, written only by triggers
--   org.vetting_decision                 R6 is Sylva's decision, never the
--                                        applicant's
--   proj.text_field, units.*, platform.* reference data stays with the operator
-- ============================================================================

-- ------------------------------------------------------------------ GRANTS
-- Column-list UPDATE, never a table-level one: a table-level UPDATE here would
-- silently cover published_at and dissolve the structural argument above.
GRANT INSERT            ON proj.project TO sylva_project_owner;
GRANT UPDATE (status)   ON proj.project TO sylva_project_owner;

GRANT INSERT ON
  proj.project_text,
  proj.claim_right, proj.claim_right_text,
  proj.outcome_indicator, proj.outcome_indicator_text, proj.indicator_value,
  proj.durability_commitment, proj.durability_commitment_text,
  proj.project_party, proj.project_metric,
  proj.project_unit_type, proj.period,
  geo.project_geometry
  TO sylva_project_owner;

-- --------------------------------------------------------------- POLICIES
-- proj.project itself. A new project is always a draft owned by the actor's
-- own organisation; the slug, the country and the owner are the only things
-- the INSERT can set that matter here.
CREATE POLICY p_project_owner_insert ON proj.project FOR INSERT
  TO sylva_project_owner
  WITH CHECK (owner_org_id = sylva.actor_org_id() AND status = 'draft');

-- USING reads the row as it stands, WITH CHECK reads the row as it would be.
-- Together they are the transition, expressed once: an owner may hand a draft
-- (or a project sent back for changes) to Sylva for review, and may make no
-- other status change at all.
CREATE POLICY p_project_owner_submit ON proj.project FOR UPDATE
  TO sylva_project_owner
  USING      (owner_org_id = sylva.actor_org_id()
              AND status IN ('draft', 'changes_requested'))
  WITH CHECK (owner_org_id = sylva.actor_org_id()
              AND status = 'submitted_for_review');

COMMENT ON POLICY p_project_owner_submit ON proj.project IS
  'The owner submits; Sylva publishes. Withdrawal, archiving and publication '
  'stay with sylva_operator, which is where concept note section 4 puts them.';

-- The page content. Same enumerated list as the p_content_* loop in migration
-- 0017, so the read rule and the write rule cover exactly the same tables and
-- cannot drift apart.
DO $content$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'proj.project_text','proj.claim_right','proj.claim_right_text',
    'proj.outcome_indicator','proj.outcome_indicator_text','proj.indicator_value',
    'proj.durability_commitment','proj.durability_commitment_text',
    'proj.project_party','geo.project_geometry'
  ] LOOP
    EXECUTE format($p$CREATE POLICY p_content_insert_owner ON %s FOR INSERT
      TO sylva_project_owner
      WITH CHECK (proj.is_owned_by_actor(project_id))$p$, t);
  END LOOP;
END $content$;

-- The three tables that are not in that loop, each for its own reason.
CREATE POLICY p_metric_insert_owner ON proj.project_metric FOR INSERT
  TO sylva_project_owner
  WITH CHECK (proj.is_owned_by_actor(project_id));

CREATE POLICY p_put_insert_owner ON proj.project_unit_type FOR INSERT
  TO sylva_project_owner
  WITH CHECK (proj.is_owned_by_actor(project_id));

CREATE POLICY p_period_insert_owner ON proj.period FOR INSERT
  TO sylva_project_owner
  WITH CHECK (proj.is_owned_by_actor(project_id));

-- ============================================================================
-- THE GUARD
-- ============================================================================
-- Four facts about sylva_project_owner that this migration must leave true.
-- Asked with has_*_privilege(), which follows role membership and answers "can
-- this role actually do this", never by matching a role name against a list -
-- the lesson migrations 0025 to 0030 were spent on.
CREATE FUNCTION ci.assert_owner_cannot_self_publish() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text; own oid;
BEGIN
  SELECT relowner INTO own FROM pg_class WHERE oid = 'proj.project'::regclass;

  -- (1) The owner holds UPDATE on proj.project.status and on no other column.
  --     published_at is the one that matters: without it the CHECK constraint
  --     makes status = 'published' unreachable.
  IF NOT pg_has_role('sylva_project_owner', own, 'USAGE') THEN
    SELECT string_agg(a.attname, ', ') INTO v
      FROM pg_attribute a
     WHERE a.attrelid = 'proj.project'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname <> 'status'
       AND has_column_privilege('sylva_project_owner', a.attrelid, a.attnum, 'UPDATE');
    IF v IS NOT NULL THEN
      PERFORM ci.fail('owner_cannot_self_publish',
        'sylva_project_owner may UPDATE proj.project columns: ' || v);
    END IF;
  END IF;

  -- (2) Nothing in the project schemas is editable in place. The scope is
  --     proj and geo rather than the whole database on purpose: those are the
  --     schemas this migration opens, and a guard that reaches into someone
  --     else's area fails for reasons its own author cannot fix. Other roles'
  --     and other schemas' write surfaces have guards of their own.
  SELECT string_agg(format('%s.%s:%s', n.nspname, c.relname, p.priv), ', ') INTO v
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles o ON o.oid = c.relowner
    CROSS JOIN (VALUES ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
   WHERE c.relkind IN ('r','v','m','p')
     AND n.nspname IN ('proj','geo')
     AND NOT (n.nspname = 'proj' AND c.relname = 'project' AND p.priv = 'UPDATE')
     AND NOT pg_has_role('sylva_project_owner', o.oid, 'USAGE')
     AND has_table_privilege('sylva_project_owner', c.oid, p.priv);
  IF v IS NOT NULL THEN
    PERFORM ci.fail('owner_cannot_self_publish',
      'sylva_project_owner can change rows in place: ' || v);
  END IF;

  -- (3) No INSERT grant on a project table is inert. FINDING-003's general
  --     rule: a grant that cannot be exercised is decoration, and decoration
  --     in a privilege table is read as permission that exists.
  SELECT string_agg(format('%s.%s', n.nspname, c.relname), ', ') INTO v
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles o ON o.oid = c.relowner
   WHERE c.relkind = 'r'
     AND (n.nspname IN ('proj','geo')
          OR c.oid = 'deal.project_question_answer'::regclass)
     AND c.relrowsecurity
     AND NOT pg_has_role('sylva_project_owner', o.oid, 'USAGE')
     AND has_table_privilege('sylva_project_owner', c.oid, 'INSERT')
     AND NOT EXISTS (
           SELECT 1 FROM pg_policy p
            WHERE p.polrelid = c.oid
              AND p.polcmd IN ('a','*')
              AND 'sylva_project_owner'::regrole = ANY (p.polroles));
  IF v IS NOT NULL THEN
    PERFORM ci.fail('owner_cannot_self_publish',
      'sylva_project_owner has an INSERT grant with no INSERT policy: ' || v);
  END IF;

  -- (4) Every content table the owner may write is scoped to its own project.
  --     A WITH CHECK of `true` on one of these would let an owner append a
  --     version to another organisation's project page.
  SELECT string_agg(format('%s on %s', p.polname, p.polrelid::regclass), ', ') INTO v
    FROM pg_policy p
   WHERE p.polcmd IN ('a','*')
     AND 'sylva_project_owner'::regrole = ANY (p.polroles)
     AND p.polrelid IN ('proj.project_text'::regclass, 'proj.claim_right'::regclass,
         'proj.claim_right_text'::regclass, 'proj.outcome_indicator'::regclass,
         'proj.outcome_indicator_text'::regclass, 'proj.indicator_value'::regclass,
         'proj.durability_commitment'::regclass, 'proj.durability_commitment_text'::regclass,
         'proj.project_party'::regclass, 'proj.project_metric'::regclass,
         'proj.project_unit_type'::regclass, 'proj.period'::regclass,
         'proj.period_forecast'::regclass, 'geo.project_geometry'::regclass)
     AND coalesce(pg_get_expr(p.polwithcheck, p.polrelid), 'true') NOT LIKE '%is_owned_by_actor%';
  IF v IS NOT NULL THEN
    PERFORM ci.fail('owner_cannot_self_publish',
      'project content policy is not scoped to the owner''s own project: ' || v);
  END IF;
END $$;

COMMENT ON FUNCTION ci.assert_owner_cannot_self_publish() IS
  'A project owner writes its own project and submits it. It does not publish '
  'it, does not edit a row in place, and cannot reach another organisation''s '
  'project content. Migration 0050.';

-- --------------------------------------------------------------- SELF-TESTS
-- Each grants the forbidden thing, requires the guard to notice, and puts it
-- back. Run inside the migration so a guard that cannot fail never ships.
DO $$
DECLARE fired boolean;
BEGIN
  PERFORM ci.assert_owner_cannot_self_publish();   -- green before we start

  -- (1) the column that would make self-publication possible
  fired := false;
  GRANT UPDATE (published_at) ON proj.project TO sylva_project_owner;
  BEGIN PERFORM ci.assert_owner_cannot_self_publish();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE UPDATE (published_at) ON proj.project FROM sylva_project_owner;
  IF NOT fired THEN
    RAISE EXCEPTION 'owner guard is toothless: UPDATE on published_at went unnoticed';
  END IF;

  -- (2) an in-place edit of content
  fired := false;
  GRANT UPDATE ON proj.project_text TO sylva_project_owner;
  BEGIN PERFORM ci.assert_owner_cannot_self_publish();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE UPDATE ON proj.project_text FROM sylva_project_owner;
  IF NOT fired THEN
    RAISE EXCEPTION 'owner guard is toothless: an UPDATE grant went unnoticed';
  END IF;

  -- (3) an INSERT grant with no policy behind it
  fired := false;
  -- proj.period_balance is a trigger-maintained cache: RLS is on, and no
  -- INSERT policy names any application role. A grant here can never fire.
  GRANT INSERT ON proj.period_balance TO sylva_project_owner;
  BEGIN PERFORM ci.assert_owner_cannot_self_publish();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE INSERT ON proj.period_balance FROM sylva_project_owner;
  IF NOT fired THEN
    RAISE EXCEPTION 'owner guard is toothless: an inert INSERT grant went unnoticed';
  END IF;

  -- (4) a content policy that forgot to scope itself
  fired := false;
  CREATE POLICY p_ci_unscoped_probe ON proj.project_text FOR INSERT
    TO sylva_project_owner WITH CHECK (true);
  BEGIN PERFORM ci.assert_owner_cannot_self_publish();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  DROP POLICY p_ci_unscoped_probe ON proj.project_text;
  IF NOT fired THEN
    RAISE EXCEPTION 'owner guard is toothless: an unscoped content policy went unnoticed';
  END IF;

  PERFORM ci.assert_owner_cannot_self_publish();   -- green again afterwards
  RAISE NOTICE 'owner write guard verified: all four checks fire when broken';
END $$;
