-- ============================================================================
-- F2. THE 'admin' AND 'auditor' VISIBILITY CLASSES MEAN WHAT THEY SAY
-- ============================================================================
-- FINDING (documents). doc.visibility_class has six values. Migration 0017
-- implemented five of them precisely and then undid two with one policy:
--
--     CREATE POLICY p_doc_project_owner ON doc.document FOR SELECT
--       TO sylva_project_owner USING (proj.is_owned_by_actor(project_id));
--
-- No visibility test. A project owner therefore read EVERY document attached
-- to its own project, including the ones classed 'admin' and 'auditor'. Those
-- two classes exist for exactly one purpose - material about a project that
-- the project's own organisation is not a party to - and the obvious contents
-- are Sylva's vetting notes on the owner, an assessor's file, a complaint, a
-- funder's audit working paper. The owner reading those is the failure the
-- class was invented to prevent.
--
-- It has never leaked in practice because no document has ever been created in
-- either class: doc.document INSERT was granted only to sylva_operator, and
-- neither the seed data nor the row-level security fixtures create one. So
-- this is a latent hole rather than a live one - and migration 0055, which has
-- just given a second role a way to create documents, is exactly the kind of
-- change that turns the first into the second. Closing it now, in the same
-- pass, rather than after the first admin-class document exists.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES
-- ---------------------------------------------------------------------------
-- The owner's read policy gains a visibility test. Everything else about it is
-- unchanged: an owner still reads its own project's public, vetted-buyer,
-- vetted-investor and deal-participant documents, in draft as well as
-- published, which is what the owner dashboard is built on.
--
-- doc.document_version needs no change. Its policy is
--
--     EXISTS (SELECT 1 FROM doc.document d WHERE d.id = ...document_id)
--
-- and that subquery is evaluated under the caller's own policies, so a version
-- is visible exactly where its document is. Narrowing the document narrows the
-- version with it. That is the property the NOTE in migration 0017 was
-- protecting and it is why this migration is one policy and not three.
--
-- ---------------------------------------------------------------------------
-- WHY THERE IS NO NEW CI GUARD FOR THIS
-- ---------------------------------------------------------------------------
-- A guard must test effective privilege and must be able to fail (README, "If
-- you write a new CI guard"). A ci.assert_* function runs as its caller with
-- no actor context, and with no context proj.is_owned_by_actor() is false for
-- every row - so a guard written here would report "the owner sees no
-- admin-class document" whether or not this migration existed. It could not
-- fail, which makes it decoration.
--
-- The check that CAN fail needs a signed actor context and a real owner, which
-- is what the application test harness already has. It lives in
-- tests/db/documents.test.ts, "an admin-class document is not the project
-- owner's", against a committed fixture on the draft project - and it fails if
-- this policy is reverted.
-- ============================================================================

DROP POLICY p_doc_project_owner ON doc.document;

CREATE POLICY p_doc_project_owner ON doc.document FOR SELECT
  TO sylva_project_owner
  USING (proj.is_owned_by_actor(project_id)
         AND visibility NOT IN ('admin', 'auditor'));

COMMENT ON POLICY p_doc_project_owner ON doc.document IS
  'An owner reads its own project''s documents - but admin and auditor are '
  'classes for material ABOUT the owner, and it is not a party to those. '
  'Migration 0056; the failing-if-reverted test is in tests/db/documents.test.ts.';
