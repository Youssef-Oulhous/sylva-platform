-- ============================================================================
-- F1. A PROJECT OWNER MAY PUT ITS OWN PROJECT'S DOCUMENTS ON THE PLATFORM
-- ============================================================================
-- Migration 0050 listed this as the one thing it deliberately did not grant:
--
--     doc.document, doc.document_version   document upload is not built; when
--                                          it is, the owner's grant belongs
--                                          with it
--
-- It is built now, so here is the grant. Without it the concept note's
-- section 4 - project owners "put projects on the platform" - stops one item
-- short of being true: an owner can write every content table and then has to
-- email Sylva its project idea note. Two of the ten items the publication gate
-- checks are documents (proj.enforce_publication_gate: project idea note,
-- project design document), so a project that an owner has filled in
-- completely still cannot be published without an operator doing the last
-- step by hand.
--
-- ---------------------------------------------------------------------------
-- WHAT KEEPS THIS NARROW
-- ---------------------------------------------------------------------------
-- 1. INSERT ONLY. Both tables are in ci.append_only_table: UPDATE and DELETE
--    are revoked AND blocked by ENABLE ALWAYS triggers. A new version is
--    version_no + 1 and the old one stays readable, which is R4. In
--    particular an owner cannot widen a document's visibility after the fact -
--    doc.document.visibility is fixed at INSERT, as migration 0010 says, and
--    no UPDATE privilege exists for anyone to relax that with.
--
-- 2. SCOPED BY ROW POLICY, NOT BY APPLICATION CODE. Both policies below test
--    proj.is_owned_by_actor(), which resolves the organisation through
--    sylva.actor_org_id() - the HMAC-verified context from migration 0019.
--    Every line of TypeScript in src/lib/documents could be wrong and an owner
--    still could not attach a document to another organisation's project.
--    See FINDING-001 for why that separation is the design.
--
-- 3. THREE VISIBILITY CLASSES, NOT SIX. An owner may publish a document, or
--    restrict it to vetted buyers, or to vetted investors. It may NOT create
--    an 'admin' or 'auditor' document - those classes mean "Sylva only" and
--    "the auditor only", and a party that can create rows in a class it cannot
--    read is a party that can hide material in it. It may not create a
--    'deal_participants' document either: that class is a deal room's, its
--    counterparties are denormalised onto the row and held honest by a
--    composite foreign key to deal.deal, and the deal room is phase 2.
--
-- 4. UPLOADED BY WHOEVER IS UPLOADING. document_version's policy pins
--    uploaded_by_org_id to sylva.actor_org_id(), so an owner cannot record
--    another organisation as the uploader of its file.
--
-- ---------------------------------------------------------------------------
-- WITHDRAWAL COMES WITH IT, AND HAS TO
-- ---------------------------------------------------------------------------
-- Giving an owner a way to publish a file without giving it a way to unpublish
-- one would be a worse platform than before this migration: the first
-- mis-attached file - a draft with a landowner's name in it, a financial model
-- marked 'public' by mistake - would sit there until a support request reached
-- Sylva. doc.document_withdrawal is the sanctioned correction: the version and
-- its hash survive for the auditor and for any record entry that cited it, and
-- every serving route joins against it and 404s.
--
-- The owner may withdraw a version of a document on ITS OWN project and
-- nothing else, and must say why - `reason` is sylva.nonblank.
-- ============================================================================

-- ------------------------------------------------------------------ GRANTS
GRANT INSERT ON doc.document, doc.document_version, doc.document_withdrawal
  TO sylva_project_owner;

-- ---------------------------------------------------------------- POLICIES
CREATE POLICY p_doc_insert_owner ON doc.document FOR INSERT
  TO sylva_project_owner
  WITH CHECK (scope = 'project'
              AND proj.is_owned_by_actor(project_id)
              AND visibility IN ('public', 'vetted_buyer', 'vetted_investor'));

COMMENT ON POLICY p_doc_insert_owner ON doc.document IS
  'An owner attaches documents to its own project, in the three visibility '
  'classes that are its to choose. admin and auditor are Sylva''s; '
  'deal_participants belongs to a deal room.';

-- The EXISTS re-reads doc.document under THIS role's policies, so a version
-- can only be attached to a document the owner can itself see and own. That
-- also means the class restriction above is inherited: an owner cannot add a
-- version to an 'admin' document, because after migration 0056 it cannot see
-- one.
CREATE POLICY p_docver_insert_owner ON doc.document_version FOR INSERT
  TO sylva_project_owner
  WITH CHECK (uploaded_by_org_id = sylva.actor_org_id()
              AND EXISTS (SELECT 1 FROM doc.document d
                           WHERE d.id = doc.document_version.document_id
                             AND d.scope = 'project'
                             AND proj.is_owned_by_actor(d.project_id)));

CREATE POLICY p_docwd_insert_owner ON doc.document_withdrawal FOR INSERT
  TO sylva_project_owner
  WITH CHECK (withdrawn_by_org_id = sylva.actor_org_id()
              AND EXISTS (SELECT 1
                            FROM doc.document_version v
                            JOIN doc.document d ON d.id = v.document_id
                           WHERE v.id = doc.document_withdrawal.document_version_id
                             AND d.scope = 'project'
                             AND proj.is_owned_by_actor(d.project_id)));

COMMENT ON POLICY p_docwd_insert_owner ON doc.document_withdrawal IS
  'The correction path that has to exist alongside the upload path. The '
  'version row and its hash are never deleted - R4 - only hidden from serving.';
