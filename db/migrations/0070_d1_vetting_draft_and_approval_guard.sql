-- ============================================================================
-- D1. THE VETTING DRAFT, AND A GUARD THAT APPROVAL IS ALWAYS DERIVED
-- ============================================================================
-- Two things, both belonging to the vetting flow.
--
-- ---------------------------------------------------------------------------
-- 1. org.vetting_draft - working state, deliberately NOT part of the record
-- ---------------------------------------------------------------------------
-- The questionnaire is eight questions long and two of them ask for a
-- paragraph. A buyer will not finish it in one sitting, so "Save draft" has to
-- mean something on the server: a draft kept in the browser is lost the moment
-- the person answers the rest from a different machine, which is exactly how a
-- half-finished application becomes an abandoned one.
--
-- This table is MUTABLE, and that is a deliberate exception to Rule 4, stated
-- here rather than discovered later:
--
--   Rule 4 makes THE RECORD append-only - "the record is append-only; a mistake
--   is corrected by a new entry pointing at the wrong one". A draft is not the
--   record. Nothing has been asserted, nothing has been decided on it, and no
--   other party has seen it. The moment it becomes an assertion it is copied
--   into org.vetting_submission + org.vetting_answer, which ARE append-only,
--   listed in ci.append_only_table, and carry all three R4 triggers. From that
--   instant the draft is worthless and is deleted.
--
--   Making the draft append-only would be worse on the one axis that matters
--   here: it holds free text an organisation typed about itself, which
--   docs/DECISIONS.md D3 already names as the acknowledged second category of
--   personal data. An append-only draft means a sentence typed by mistake can
--   never be taken back, in a table that records nothing anyone relies on.
--
-- It is therefore NOT added to ci.append_only_table. It is org-scoped under
-- row-level security and readable by nobody else - including Sylva. An operator
-- reading an unsubmitted draft would be reading an application that has not
-- been made, and a decision cannot cite it: org.vetting_decision's foreign key
-- is to a SUBMISSION, so a draft can never be the basis of an approval.
--
-- ---------------------------------------------------------------------------
-- 2. ci.assert_approval_is_derived() - R6's other half
-- ---------------------------------------------------------------------------
-- Migration 0005 comments that org.org_role_approval is "written only by the
-- SECURITY DEFINER trigger on org.vetting_decision", and 0017 adds no write
-- policy for it. Neither fact was asserted anywhere. The invariant R6 actually
-- rests on is: approval status is a CONSEQUENCE of a recorded decision and can
-- be reached no other way. A single GRANT in a later migration undoes that
-- silently, and the existing guards would not notice - assert_append_only_
-- complete() only looks at tables in ci.append_only_table, and this one is not
-- in it because the cache is legitimately updated in place by its trigger.
--
-- Written as the README's §11 demands: it asks "can this role actually do
-- this?" via has_table_privilege(), excludes the ownership chain with
-- pg_has_role(), and has a self-test below that grants the forbidden privilege
-- and requires the guard to fire.
--
-- Rules touched: R6 is guarded, not changed. R4 is untouched: no append-only
-- table gains a privilege here, and the new table is not one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. THE DRAFT
-- ---------------------------------------------------------------------------
CREATE TABLE org.vetting_draft (
  org_id           uuid NOT NULL REFERENCES org.organisation(id) ON DELETE RESTRICT,
  questionnaire_id uuid NOT NULL,
  question_code    text NOT NULL,
  -- role_code is carried rather than joined for: the questionnaire a draft
  -- belongs to already fixes it, and the composite FK below makes a draft
  -- claiming the wrong role a foreign-key violation rather than a code check.
  role_code        text NOT NULL,
  answer_text      text,
  answer_boolean   boolean,
  answer_numeric   numeric,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- opaque, NO FK: the same erasure design as every other actor reference.
  -- See docs/DECISIONS.md D3 and ci.assert_no_fk_into_identity().
  updated_by_person_ref uuid,
  PRIMARY KEY (org_id, questionnaire_id, question_code),
  FOREIGN KEY (questionnaire_id, question_code)
    REFERENCES org.question (questionnaire_id, question_code),
  FOREIGN KEY (questionnaire_id, role_code)
    REFERENCES org.questionnaire (id, role_code),
  -- the same shape as org.vetting_answer, so a draft row transfers to a
  -- submitted answer without reinterpretation
  CONSTRAINT vetting_draft_one_answer_kind
    CHECK (num_nonnulls(answer_text, answer_boolean, answer_numeric) <= 1)
);

COMMENT ON TABLE org.vetting_draft IS
  'Unsubmitted vetting answers. Working state, not the record: mutable on purpose, visible only to the organisation that typed it, and deleted when the submission that supersedes it is written. A vetting decision cannot cite it - org.vetting_decision references a submission.';

CREATE INDEX ix_vetting_draft_org ON org.vetting_draft (org_id, role_code);

ALTER TABLE org.vetting_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE org.vetting_draft FORCE  ROW LEVEL SECURITY;

-- One organisation, its own draft, all four verbs. The predicate is the signed
-- context of migration 0019, never a bare session variable - FINDING-001.
CREATE POLICY p_vdraft_own_select ON org.vetting_draft FOR SELECT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (org_id = sylva.actor_org_id());
CREATE POLICY p_vdraft_own_insert ON org.vetting_draft FOR INSERT
  TO sylva_buyer, sylva_project_owner, sylva_investor
  WITH CHECK (org_id = sylva.actor_org_id());
CREATE POLICY p_vdraft_own_update ON org.vetting_draft FOR UPDATE
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (org_id = sylva.actor_org_id())
  WITH CHECK (org_id = sylva.actor_org_id());
CREATE POLICY p_vdraft_own_delete ON org.vetting_draft FOR DELETE
  TO sylva_buyer, sylva_project_owner, sylva_investor
  USING (org_id = sylva.actor_org_id());

-- No policy and no grant for sylva_operator or sylva_auditor. Not an oversight:
-- an unsubmitted draft is an application that has not been made. Sylva sees it
-- when it is submitted, which is the event the decision is allowed to cite.
GRANT SELECT, INSERT, UPDATE, DELETE ON org.vetting_draft
  TO sylva_buyer, sylva_project_owner, sylva_investor;

-- ---------------------------------------------------------------------------
-- 2. THE GUARD: approval is derived, never written
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_approval_is_derived() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(msg, '; ') INTO v FROM (
    -- (a) no role outside the ownership chain may write the cache directly.
    --     has_table_privilege() follows role membership, so an INSERT reaching
    --     sylva_buyer through a group is caught; pg_has_role() excludes the
    --     owner and sylva_login_migrate, which IS the owner by membership.
    SELECT format('org.org_role_approval grants %s to %s', p.priv, r.rolname) AS msg
      FROM pg_class c
      JOIN pg_roles own ON own.oid = c.relowner
      CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
      JOIN pg_roles r ON r.rolname LIKE 'sylva\_%'
     WHERE c.oid = 'org.org_role_approval'::regclass
       AND NOT pg_has_role(r.oid, own.oid, 'USAGE')
       AND has_table_privilege(r.oid, c.oid, p.priv)

    UNION ALL
    -- (b) the derivation itself must still be there, and ENABLE ALWAYS, or the
    --     cache quietly stops following the decision chain and every
    --     organisation keeps whatever status it last had - including an
    --     organisation whose approval was revoked.
    SELECT 'org.vetting_decision is missing t_apply_vetting_decision (ENABLE ALWAYS)'
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_trigger g
        WHERE g.tgrelid = 'org.vetting_decision'::regclass
          AND NOT g.tgisinternal
          AND g.tgname = 't_apply_vetting_decision'
          AND g.tgenabled = 'A')

    UNION ALL
    -- (c) a decision must not be editable after the fact. The chain is what an
    --     auditor reads; a rewritable 'declined' reason is not a record.
    SELECT 'org.vetting_decision is not in ci.append_only_table'
     WHERE NOT EXISTS (SELECT 1 FROM ci.append_only_table t
                        WHERE t.table_name = 'org.vetting_decision'::regclass)
  ) s;

  IF v IS NOT NULL THEN PERFORM ci.fail('approval_is_derived', v); END IF;
END $$;

-- NOT checked here, and the omission is deliberate: "no write POLICY on the
-- cache". Migration 0017 puts p_owner_maintenance (FOR ALL TO sylva_owner) on
-- every FORCE-RLS table, precisely so the SECURITY DEFINER trigger can write
-- this one, and on this machine the tables are owned by `postgres` rather than
-- by sylva_owner (README §11: that divergence cost migrations 0025-0030). A
-- policy check would therefore have to decide whether sylva_owner is "the
-- owner" by NAME, which is the one thing a guard here may never do. It would
-- also add nothing: a policy for a role that holds no privilege is decoration
-- - the general rule FINDING-003 states - and the moment such a role is
-- granted one, check (a) fires.

COMMENT ON FUNCTION ci.assert_approval_is_derived() IS
  'R6: org.org_role_approval is a trigger-maintained consequence of org.vetting_decision. No application role may write it, the trigger that derives it must be present and ENABLE ALWAYS, and the decision chain it derives from must be append-only.';

-- Prove it has teeth, once per structural check.
-- A guard that cannot fail is not a guard (README §11).
DO $$
DECLARE fired boolean;
BEGIN
  -- self-test 1: an application role gains INSERT on the cache
  fired := false;
  GRANT INSERT ON org.org_role_approval TO sylva_buyer;
  BEGIN
    PERFORM ci.assert_approval_is_derived();
  EXCEPTION WHEN OTHERS THEN fired := true;
  END;
  REVOKE INSERT ON org.org_role_approval FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION
      'approval guard is toothless: it did not notice sylva_buyer holding INSERT on org.org_role_approval';
  END IF;

  -- self-test 2: the derivation trigger stops firing
  fired := false;
  ALTER TABLE org.vetting_decision DISABLE TRIGGER t_apply_vetting_decision;
  BEGIN
    PERFORM ci.assert_approval_is_derived();
  EXCEPTION WHEN OTHERS THEN fired := true;
  END;
  ALTER TABLE org.vetting_decision ENABLE ALWAYS TRIGGER t_apply_vetting_decision;
  IF NOT fired THEN
    RAISE EXCEPTION
      'approval guard is toothless: it did not notice t_apply_vetting_decision disabled';
  END IF;

  PERFORM ci.assert_approval_is_derived();
  RAISE NOTICE 'approval guard verified: it fires on a direct grant and on a disabled derivation trigger';
END $$;
