-- ===========================================================================
-- SEED 2 · the vetting questionnaire, and the DEMO approvals
--
-- Concept note section 7: "We collect what the buyer intends to claim, how it
-- operates and its approach to sustainability, and approve or decline. This is
-- a condition of our funding and our main safeguard against greenwashing."
--
-- Every question below traces to that sentence or to a concern a buyer raised
-- in note section 3. Nothing here is invented regulatory screening: the client
-- must review and sign off the final question set before launch.
-- OPEN DECISION - docs/DECISIONS.md.
-- ===========================================================================

INSERT INTO org.questionnaire (id, role_code, version_no, published_at) VALUES
  ('60000000-0000-0000-0000-000000000001','buyer',        1,'2026-09-01'),
  ('60000000-0000-0000-0000-000000000002','investor',     1,'2026-09-01'),
  ('60000000-0000-0000-0000-000000000003','project_owner',1,'2026-09-01')
ON CONFLICT (id) DO NOTHING;

-- --- Buyer -----------------------------------------------------------------
INSERT INTO org.question (questionnaire_id, question_code, sort_order, prompt_en, answer_kind, is_required) VALUES
  ('60000000-0000-0000-0000-000000000001','intended_claim',      10,
   'What environmental benefit does your organisation intend to claim from units it acquires?','text',true),
  ('60000000-0000-0000-0000-000000000001','claim_publication',   20,
   'Where would that claim be published or reported?','text',true),
  ('60000000-0000-0000-0000-000000000001','operations',          30,
   'How does your organisation operate? Describe your main activities and the sites relevant to this interest.','text',true),
  ('60000000-0000-0000-0000-000000000001','water_dependence',    40,
   'Does your organisation depend on water in specific catchments? If so, which.','text',false),
  ('60000000-0000-0000-0000-000000000001','sustainability',      50,
   'Describe your organisation''s approach to sustainability.','text',true),
  -- Both of the following come from note section 3, where buyers raised them
  -- as conditions of taking part at all.
  ('60000000-0000-0000-0000-000000000001','onward_sale_intent',  60,
   'Do you intend to resell or transfer units you acquire, rather than retire them yourself?','boolean',true),
  ('60000000-0000-0000-0000-000000000001','offset_use',          70,
   'Would you present the benefit as an offset against your own impacts?','boolean',true),
  ('60000000-0000-0000-0000-000000000001','exclusivity_needed',  80,
   'Do you require that no other party may claim the same benefit?','boolean',true)
ON CONFLICT DO NOTHING;

-- --- Investor --------------------------------------------------------------
INSERT INTO org.question (questionnaire_id, question_code, sort_order, prompt_en, answer_kind, is_required) VALUES
  ('60000000-0000-0000-0000-000000000002','mandate',      10,
   'Describe the mandate or fund under which you would finance a restoration project.','text',true),
  ('60000000-0000-0000-0000-000000000002','operations',   20,
   'How does your organisation operate, and who is the regulated entity?','text',true),
  ('60000000-0000-0000-0000-000000000002','sustainability',30,
   'Describe your organisation''s approach to sustainability.','text',true),
  ('60000000-0000-0000-0000-000000000002','repayment_expectation',40,
   'From which revenue streams would you expect to be repaid?','text',true)
ON CONFLICT DO NOTHING;

-- --- Project owner ---------------------------------------------------------
INSERT INTO org.question (questionnaire_id, question_code, sort_order, prompt_en, answer_kind, is_required) VALUES
  ('60000000-0000-0000-0000-000000000003','land_control', 10,
   'What is your legal relationship to the land, and for how long does it run?','text',true),
  ('60000000-0000-0000-0000-000000000003','operations',   20,
   'How does your organisation operate, and who delivers the restoration on the ground?','text',true),
  ('60000000-0000-0000-0000-000000000003','scheme',       30,
   'Under which credit scheme, if any, do you expect units to be issued?','text',true),
  ('60000000-0000-0000-0000-000000000003','verifier',     40,
   'Which independent body would verify the ecological result?','text',true)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- DEMO submissions and decisions.
--
-- org.apply_vetting_decision() maintains org.org_role_approval from these, so
-- approval state is never written directly - it is always the consequence of a
-- recorded decision. That is what makes R6 auditable rather than merely true.
-- ===========================================================================
INSERT INTO org.vetting_submission (id, org_id, role_code, questionnaire_id, submitted_at, submitted_by_person_ref) VALUES
  ('70000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-00000000000a','project_owner','60000000-0000-0000-0000-000000000003','2026-09-02','b0000000-0000-0000-0000-0000000000b1'),
  ('70000000-0000-0000-0000-000000000002','0b000000-0000-0000-0000-00000000000b','project_owner','60000000-0000-0000-0000-000000000003','2026-09-02','b0000000-0000-0000-0000-0000000000b2'),
  ('70000000-0000-0000-0000-000000000003','0c000000-0000-0000-0000-00000000000c','buyer',        '60000000-0000-0000-0000-000000000001','2026-09-05','b0000000-0000-0000-0000-0000000000b3'),
  ('70000000-0000-0000-0000-000000000004','0d000000-0000-0000-0000-00000000000d','buyer',        '60000000-0000-0000-0000-000000000001','2026-09-06','b0000000-0000-0000-0000-0000000000b4'),
  ('70000000-0000-0000-0000-000000000005','0e000000-0000-0000-0000-00000000000e','investor',     '60000000-0000-0000-0000-000000000002','2026-09-08','b0000000-0000-0000-0000-0000000000b5'),
  ('70000000-0000-0000-0000-000000000006','0f000000-0000-0000-0000-00000000000f','investor',     '60000000-0000-0000-0000-000000000002','2026-09-08','b0000000-0000-0000-0000-0000000000b6'),
  -- Submitted, never decided. The organisation is therefore NOT approved.
  ('70000000-0000-0000-0000-000000000007','14000000-0000-0000-0000-000000000014','buyer',        '60000000-0000-0000-0000-000000000001','2026-09-20','b0000000-0000-0000-0000-0000000000b9')
ON CONFLICT (id) DO NOTHING;

INSERT INTO org.vetting_answer (submission_id, questionnaire_id, question_code, answer_text, answer_boolean) VALUES
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','intended_claim','DEMO: the water-related benefit in catchments where our breweries abstract.',NULL),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','claim_publication','DEMO: our annual sustainability statement.',NULL),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','operations','DEMO: five breweries in northern Germany, all water-dependent.',NULL),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','water_dependence','DEMO: Havel and Weser catchments.',NULL),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','sustainability','DEMO: water stewardship programme running since 2021.',NULL),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','onward_sale_intent',NULL,false),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','offset_use',NULL,false),
  ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','exclusivity_needed',NULL,true),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','intended_claim','DEMO: a documented nature action for sustainability reporting.',NULL),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','claim_publication','DEMO: our CSRD-scope reporting.',NULL),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','operations','DEMO: processing and distribution sites across the Netherlands and Belgium.',NULL),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','sustainability','DEMO: nature strategy published 2025.',NULL),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','onward_sale_intent',NULL,false),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','offset_use',NULL,false),
  ('70000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','exclusivity_needed',NULL,false)
ON CONFLICT DO NOTHING;

INSERT INTO org.vetting_decision (id, submission_id, org_id, role_code, decision, reason, decided_at, decided_by_org_id, decided_by_person_ref) VALUES
  ('80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-00000000000a','project_owner','approved','DEMO: land control and verifier evidence accepted.','2026-09-03','10000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-0000000000b7'),
  ('80000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002','0b000000-0000-0000-0000-00000000000b','project_owner','approved','DEMO: land control and verifier evidence accepted.','2026-09-03','10000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-0000000000b7'),
  ('80000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000003','0c000000-0000-0000-0000-00000000000c','buyer','approved','DEMO: intended claim is specific and consistent with the projects of interest.','2026-09-09','10000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-0000000000b7'),
  ('80000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000004','0d000000-0000-0000-0000-00000000000d','buyer','approved','DEMO: reporting use stated; no offset claim intended.','2026-09-10','10000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-0000000000b7'),
  ('80000000-0000-0000-0000-000000000005','70000000-0000-0000-0000-000000000005','0e000000-0000-0000-0000-00000000000e','investor','approved','DEMO: regulated entity confirmed.','2026-09-11','10000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-0000000000b7'),
  ('80000000-0000-0000-0000-000000000006','70000000-0000-0000-0000-000000000006','0f000000-0000-0000-0000-00000000000f','investor','approved','DEMO: regulated entity confirmed.','2026-09-11','10000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-0000000000b7')
ON CONFLICT (id) DO NOTHING;
