-- ============================================================================
-- D1. THE PUBLIC RECORD MUST RESOLVE THE *DEAL* PSEUDONYM, AND THE LABEL
--     TABLE MUST NOT MAP A LABEL BACK TO AN ORGANISATION
--
-- Found while wiring /record to record.v_public_entry, 24 Sep 2026. Two
-- separate defects, both in the one place R5 is actually visible to the
-- public, so both are closed here.
--
-- ---------------------------------------------------------------------------
-- FINDING-005. Migration 0021 moved the pseudonym from the organisation to
-- the deal, and said why:
--
--   "org.organisation_pseudonym is keyed (project_id, org_id), so every
--    pseudonymous entry by one organisation on one project carried the SAME
--    label. Name that organisation on one deal and every other 'Buyer 014'
--    row on that project is attributable to it."
--
-- It created deal.deal_pseudonym, it allocated a label per deal on a trigger,
-- and it guarded the column grant. What it did not do is change the one query
-- that puts a label in front of a reader. record.v_public_entry, written in
-- 0015 and never replaced, still joins org.organisation_pseudonym on
-- (project_id, org_id). So the defect 0021 documents is still exactly what the
-- public record shows: two deals by one buyer on one project carry one label,
-- and naming either one names both.
--
-- Proven on the demo database before this migration: deal
-- ea000000-...-0000a1 has deal.deal_pseudonym.label = 'Buyer 002', and
-- record.v_public_entry reported 'Buyer 001' for its entries - the
-- organisation-level label.
--
-- Fix: for an entry that belongs to a deal, resolve deal.deal_pseudonym by
-- deal_id and NEVER fall back to the organisation-level label. Falling back
-- would reintroduce the linkability the fallback was meant to avoid, so a
-- missing deal label renders as no label at all, and the page says so.
-- An entry with no deal (a project being listed or offered) is still resolved
-- through the organisation-level table: there is no deal to key on, and such
-- an entry is either the project owner, who is named anyway, or an
-- organisation acting on the project rather than on a deal.
--
-- ---------------------------------------------------------------------------
-- FINDING-006. org.organisation_pseudonym is the label -> organisation map,
-- and migration 0016 granted it whole-table SELECT to sylva_web_anon,
-- sylva_buyer, sylva_project_owner and sylva_investor, because it sits in the
-- bulk "reference data" list. Its policy is USING (true). So org_id was
-- readable by an anonymous visitor.
--
-- That is the same hole ci.assert_pseudonym_is_per_deal() was written to
-- prevent on deal.deal_pseudonym - 0021 got the column grant right on the new
-- table and left the old one wide open. What it costs, concretely:
--
--   * A label on project X resolves to an org_id, and the SAME org_id appears
--     against that organisation's labels on every other project. The note's
--     promise that "the same label on two projects is not the same
--     organisation" holds for the LABEL and not for the row behind it: an
--     observer joins on org_id and links a buyer's activity across the whole
--     platform.
--   * org.v_public_party names any organisation that is a declared party to,
--     or the owner of, a public project. An organisation that both buys and
--     appears as a project party is therefore fully unmasked: label ->
--     org_id -> legal name.
--
-- legal_name on org.organisation stays withheld, so this was not a direct
-- route to a name for a pure buyer. It was a direct route to LINKAGE, which is
-- what a pseudonym exists to prevent.
--
-- Fix: the same column-scoped grant deal.deal_pseudonym already has. org_id
-- goes to the operator, the auditor and sylva_record - which is the view owner
-- and therefore how the public record still resolves a label at all.
--
-- ---------------------------------------------------------------------------
-- Not fixed here, and not claimed to be:
--
--   * Every public row still carries sector, country and size band. An
--     organisation named on one deal can still be matched to its pseudonymous
--     rows by those three attributes. That is the k-anonymity decision the
--     client owes us - open decision 2 in the README - and it cannot be closed
--     in a migration.
--   * deal.enforce_r6_and_publication() still calls org.allocate_pseudonym()
--     on every deal, so each deal consumes two numbers from the project's
--     shared label counter and public labels advance in twos. That is
--     cosmetic - a label is opaque and the counter guarantees no collision -
--     and undoing it means replacing a trigger function outside this area's
--     remit. Flagged, not fixed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. The grant 0021 forgot.
--
-- sylva_record owns record.v_public_entry, so the view reads with THAT role's
-- privileges, and 0021 granted deal.deal_pseudonym to the four public roles,
-- to the operator and to the auditor - and not to sylva_record. Replacing the
-- view without this fails with "permission denied for table deal_pseudonym",
-- which is how it was found. It is also the proof that nobody ever pointed the
-- public record at the new table: the attempt could not have succeeded.
--
-- Two columns, not the table. The view joins on deal_id and prints label;
-- org_id is the unmasking column and sylva_record has no need of it. It can
-- already resolve a legal name through org.organisation when disclosure
-- permits, and that is the only naming route it is meant to have.
-- ---------------------------------------------------------------------------
GRANT SELECT (deal_id, label) ON deal.deal_pseudonym TO sylva_record;

-- The grant is half of it. 0031 gave the read policy an explicit TO list -
-- correctly, because a policy without one targets PUBLIC - and sylva_record is
-- not on that list either, so the table stayed invisible to the view owner
-- even after the grant: zero rows, no error, a NULL label. ALTER POLICY rather
-- than DROP + CREATE, so the policy keeps its comment and nothing is lost in
-- the gap.
ALTER POLICY p_deal_pseudonym_readable ON deal.deal_pseudonym
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;

-- ---------------------------------------------------------------------------
-- 1. The view.
--
-- CREATE OR REPLACE, not DROP + CREATE: a DROP discards the view's privileges
-- silently and two migrations have already been spent on exactly that mistake
-- (see 0023 and 0024). Replace keeps them, and the grants are restated below
-- anyway so a future reader can see the read surface in one place.
--
-- The existing seventeen columns keep their names, their order and their
-- types, because CREATE OR REPLACE VIEW permits nothing else. The one new
-- column is appended at the end: superseded_by_public_id, so that a superseded
-- entry can name the entry that superseded it even when the correction is on
-- another page of a paginated extract. Reading back up the list was possible
-- before only if both entries happened to be on screen together.
--
-- Owned by sylva_record, so it runs with that role's privileges and is the
-- only route by which a legal name or a label reaches the public. The
-- ownership is why this has to be done as sylva_record: CREATE OR REPLACE
-- requires it, and sylva_owner is a member of sylva_record (migration 0002).
-- ---------------------------------------------------------------------------
GRANT CREATE ON SCHEMA record TO sylva_record;
SET LOCAL ROLE sylva_record;

CREATE OR REPLACE VIEW record.v_public_entry WITH (security_barrier = true) AS
SELECT e.public_id,
       e.occurred_at,
       e.entry_type,
       et.label_en                              AS entry_label,
       e.project_id,
       pr.slug                                  AS project_slug,
       -- the counterparty the public sees
       CASE WHEN cp.org_id IS NULL THEN NULL::text
            WHEN cp.is_named THEN cp.legal_name::text
            -- FINDING-005: per DEAL, never per organisation. No COALESCE onto
            -- the organisation-level label: that fallback is the linkage.
            WHEN e.deal_id IS NOT NULL THEN dps.label
            ELSE ops.label END                  AS counterparty_label,
       coalesce(cp.is_named, false)             AS counterparty_is_named,
       cp.sector_code, cp.country_code, cp.size_band_code,
       e.actor_role_snapshot,
       e.actor_person_label,
       corrected.public_id                      AS corrects_entry_public_id,
       e.correction_reason,
       EXISTS (SELECT 1 FROM record.entry c WHERE c.corrects_entry_no = e.entry_no)
                                                AS is_superseded,
       e.source_ref_id,
       -- ux_record_corrected_once makes this at most one row.
       (SELECT c.public_id FROM record.entry c
         WHERE c.corrects_entry_no = e.entry_no) AS superseded_by_public_id
  FROM record.entry e
  JOIN record.entry_type et ON et.code = e.entry_type AND et.is_public
  JOIN proj.project pr      ON pr.id = e.project_id
                           AND pr.status IN ('published','withdrawn','archived')
  LEFT JOIN record.entry corrected ON corrected.entry_no = e.corrects_entry_no
  LEFT JOIN LATERAL (
       -- who the entry is about, and whether that party was named AT THE TIME
       SELECT o.id AS org_id, o.legal_name, o.sector_code, o.country_code, o.size_band_code,
              CASE WHEN e.deal_id IS NOT NULL
                   THEN coalesce((SELECT de.disclosed
                                    FROM deal.deal_disclosure_event de
                                   WHERE de.deal_id = e.deal_id
                                     AND de.decided_at <= e.occurred_at
                                   ORDER BY de.decided_at DESC, de.entry_no DESC
                                   LIMIT 1), false)
                   -- the project owner is named publicly on its own project page
                   ELSE (e.actor_org_id = pr.owner_org_id) END AS is_named
         FROM org.organisation o
        WHERE o.id = coalesce(e.deal_buyer_org_id, e.actor_org_id)) cp ON true
  LEFT JOIN deal.deal_pseudonym dps ON dps.deal_id = e.deal_id
  LEFT JOIN org.organisation_pseudonym ops
         ON ops.project_id = e.project_id AND ops.org_id = cp.org_id;

RESET ROLE;
REVOKE CREATE ON SCHEMA record FROM sylva_record;

COMMENT ON VIEW record.v_public_entry IS
  'No volume column and no price column, by design. Identity is resolved AS OF '
  'each entry''s own timestamp, so withdrawing disclosure applies forward only '
  'and nothing already published is rewritten (R4). A pseudonymous counterparty '
  'on a deal is shown its DEAL label (migration 0021, 0075) and never its '
  'organisation-level one, so two deals by one buyer on one project cannot be '
  'linked. No WHERE clause removes a corrected entry: the wrong one stays '
  'visible, flagged is_superseded and linked both ways to its correction. '
  'OPEN DECISION: every row still carries sector, country and size band, which '
  'may be enough to match a named row to a pseudonymous one.';

-- Restated, not assumed. A replace keeps grants; a future DROP would not, and
-- ci.assert_public_views_are_granted() already names this view.
GRANT SELECT ON record.v_public_entry
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report;

-- ---------------------------------------------------------------------------
-- 2. FINDING-006: close the label -> organisation map.
--
-- REVOKE the whole-table grant and put back a column list. Same shape as the
-- grant deal.deal_pseudonym has carried since 0021. sylva_record keeps the
-- whole table: it is the view owner, and resolving the label for a non-deal
-- entry is what it does with it.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON org.organisation_pseudonym
  FROM sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor;

GRANT SELECT (project_id, seq, label, allocated_at)
  ON org.organisation_pseudonym
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor;

-- ---------------------------------------------------------------------------
-- 3. The guards.
--
-- Two, because the two findings fail in different ways: one is a wrong join
-- that a privilege test cannot see, the other is a privilege that a query test
-- cannot see.
-- ---------------------------------------------------------------------------

-- 3a. Privilege. Asks "can this role actually do this?" via
-- has_column_privilege, which follows role membership and sees reality - the
-- lesson of migrations 0025-0030. Self-tested below by granting the forbidden
-- column, asserting the guard fires, and revoking it again.
CREATE FUNCTION ci.assert_pseudonym_map_is_not_public() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r text; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deal.deal_pseudonym','org.organisation_pseudonym'] LOOP
    IF to_regclass(t) IS NULL THEN
      RAISE EXCEPTION 'R5 regression: % is gone', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['sylva_web_anon','sylva_buyer',
                             'sylva_project_owner','sylva_investor'] LOOP
      -- The table owner holds privileges implicitly; that is not a grant.
      IF pg_has_role(r, (SELECT relowner FROM pg_class WHERE oid = to_regclass(t)), 'USAGE') THEN
        CONTINUE;
      END IF;
      IF has_column_privilege(r, t, 'org_id', 'SELECT') THEN
        RAISE EXCEPTION
          'R5 regression: % can read %.org_id and so can map every label back '
          'to an organisation, and link one buyer''s labels across projects', r, t
          USING ERRCODE = 'SY0CI';
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON FUNCTION ci.assert_pseudonym_map_is_not_public() IS
  'Both pseudonym tables, not just the one 0021 added. A label is only a '
  'pseudonym while the row that maps it to an organisation is out of reach.';

-- 3b. Resolution. A privilege guard cannot see a wrong join, so this one reads
-- what the view actually returns and compares it with the deal's own label.
-- Data-driven, so it is vacuous on an empty record; the self-test inside it
-- refuses to be vacuous when there is data to test against.
CREATE FUNCTION ci.assert_public_record_uses_the_deal_label() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_testable int; v_wrong int; v_detector int;
BEGIN
  -- Every pseudonymous entry that belongs to a deal must carry that deal's own
  -- label. Not the organisation-level one, and not NULL.
  SELECT count(*) INTO v_testable
    FROM record.v_public_entry v
    JOIN record.entry e   ON e.public_id = v.public_id
    JOIN deal.deal_pseudonym dp ON dp.deal_id = e.deal_id
   WHERE NOT v.counterparty_is_named;

  IF v_testable = 0 THEN
    RAISE NOTICE 'assert_public_record_uses_the_deal_label: no pseudonymous deal entry in the record; nothing to check';
    RETURN;
  END IF;

  SELECT count(*) INTO v_wrong
    FROM record.v_public_entry v
    JOIN record.entry e   ON e.public_id = v.public_id
    JOIN deal.deal_pseudonym dp ON dp.deal_id = e.deal_id
   WHERE NOT v.counterparty_is_named
     AND v.counterparty_label IS DISTINCT FROM dp.label;

  IF v_wrong > 0 THEN
    RAISE EXCEPTION
      'R5 regression: % public entr(ies) show a label that is not their own '
      'deal''s label. See FINDING-005 in migration 0075 - the organisation-level '
      'label links two deals by one buyer on one project.', v_wrong
      USING ERRCODE = 'SY0CI';
  END IF;

  -- Self-test. A guard that cannot fail is not a guard (README section 11).
  -- Feed the same comparison a deliberately wrong expected value: it must
  -- report every row as a mismatch. If it reports none, the comparison is
  -- dead and the check above proved nothing.
  SELECT count(*) INTO v_detector
    FROM record.v_public_entry v
    JOIN record.entry e   ON e.public_id = v.public_id
    JOIN deal.deal_pseudonym dp ON dp.deal_id = e.deal_id
   WHERE NOT v.counterparty_is_named
     AND v.counterparty_label IS DISTINCT FROM ('not-a-label ' || dp.label);

  IF v_detector <> v_testable THEN
    RAISE EXCEPTION
      'assert_public_record_uses_the_deal_label is toothless: its comparison '
      'found % of % rows wrong when every row was made wrong on purpose',
      v_detector, v_testable;
  END IF;
END $$;

COMMENT ON FUNCTION ci.assert_public_record_uses_the_deal_label() IS
  'FINDING-005. 0021 moved the pseudonym to the deal and never changed the '
  'view that displays it, so the public record kept showing the linkable '
  'organisation-level label for four migrations. This reads the view.';

-- ---------------------------------------------------------------------------
-- 4. Self-test for 3a, in the shape migrations 0027-0030 established: grant
--    the forbidden privilege, assert the guard notices, revoke it again.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- it must pass as things now stand
  PERFORM ci.assert_pseudonym_map_is_not_public();

  GRANT SELECT (org_id) ON org.organisation_pseudonym TO sylva_web_anon;
  BEGIN
    PERFORM ci.assert_pseudonym_map_is_not_public();
    REVOKE SELECT (org_id) ON org.organisation_pseudonym FROM sylva_web_anon;
    RAISE EXCEPTION
      'ci.assert_pseudonym_map_is_not_public() is toothless: it did not notice '
      'sylva_web_anon holding SELECT on org.organisation_pseudonym.org_id';
  EXCEPTION WHEN sqlstate 'SY0CI' THEN
    REVOKE SELECT (org_id) ON org.organisation_pseudonym FROM sylva_web_anon;
  END;

  -- and it must pass again afterwards
  PERFORM ci.assert_pseudonym_map_is_not_public();
  PERFORM ci.assert_public_record_uses_the_deal_label();
END $$;
