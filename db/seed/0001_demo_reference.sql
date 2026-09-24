-- ===========================================================================
-- SEED 1 · platform reference data + DEMO organisations and people
--
--                        *** ALL OF THIS IS DEMO DATA ***
--
-- Every organisation name below begins with "DEMO ". Every project is marked
-- is_demo. No figure here describes a real wetland, a real verification or a
-- real environmental result. The seed exists to exercise the rules - above all
-- Rule 7, which is why the two published projects deliberately use unit types
-- that cannot be added together.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Units of measure. The note's two worked examples, kept deliberately apart.
-- --------------------------------------------------------------------------
INSERT INTO platform.unit_of_measure (code, label_en, definition, decimals, source_label, as_of_date) VALUES
  ('ha_yr', 'hectare-years',
   'One hectare of wetland held under active restoration management for one year.',
   2, 'DEMO scheme rulebook v1.2', '2026-06-30'),
  ('index_point', 'index points',
   'One point on the scheme''s freshwater condition index, as defined by that scheme. Not convertible to area, volume or any other unit.',
   1, 'DEMO scheme rulebook v0.9', '2026-07-15')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Sectors and size bands.
-- --------------------------------------------------------------------------
INSERT INTO platform.sector (code, classification, label_en, label_de) VALUES
  ('food_bev',   'NACE Rev. 2 (DEMO mapping)', 'Food and beverage',        'Lebensmittel und Getränke'),
  ('utilities',  'NACE Rev. 2 (DEMO mapping)', 'Utilities and power',      'Versorgung und Energie'),
  ('finance',    'NACE Rev. 2 (DEMO mapping)', 'Financial services',       'Finanzdienstleistungen'),
  ('chemicals',  'NACE Rev. 2 (DEMO mapping)', 'Chemicals',                'Chemie'),
  ('public',     'NACE Rev. 2 (DEMO mapping)', 'Public and non-profit',    'Öffentlich und gemeinnützig')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.size_band (code, basis, label_en, label_de) VALUES
  ('sme',   'employees', 'Up to 249 employees', 'Bis 249 Beschäftigte'),
  ('large', 'employees', '250 or more employees', '250 oder mehr Beschäftigte')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Provenance. Every figure on a screen points at one of these.
-- --------------------------------------------------------------------------
-- NOTE: source refs of kind 'document' require their document version to
-- exist first (CHECK source_document_present), so they are created in seed 3
-- once the documents are in place. Only non-document provenance lives here.
INSERT INTO sylva.source_ref (id, kind, label, locator, as_of_date) VALUES
  ('50000000-0000-0000-0000-000000000005','operator_statement',
   'DEMO organisation record entered by Sylva during pilot onboarding',NULL,'2026-09-01'),
  ('50000000-0000-0000-0000-000000000006','external_publication',
   'DEMO catchment reference layer, EU-Hydro style dataset (placeholder geometry)',NULL,'2026-05-20'),
  ('50000000-0000-0000-0000-000000000007','calculated_by_sylva',
   'Straight-line geodesic distance between a registered site and the project boundary, computed on request',NULL,'2026-09-23'),
  ('50000000-0000-0000-0000-000000000008','operator_statement',
   'DEMO buyer site registered by the buyer',NULL,'2026-09-15'),
  ('50000000-0000-0000-0000-000000000009','operator_statement',
   'DEMO scheme and unit type recorded by Sylva from the scheme rulebook',NULL,'2026-07-15')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- DEMO organisations.
-- --------------------------------------------------------------------------
INSERT INTO org.organisation (id, legal_name, registration_number, registered_address, country_code, sector_code, size_band_code) VALUES
  ('0a000000-0000-0000-0000-00000000000a','DEMO Moorland Trust gGmbH','HRB 000000 (DEMO)','Musterstraße 1, 14467 Potsdam, DE','DE','public','sme'),
  ('0b000000-0000-0000-0000-00000000000b','DEMO Rivières Vivantes SAS','000 000 000 (DEMO)','1 rue Exemple, 44000 Nantes, FR','FR','public','sme'),
  ('0c000000-0000-0000-0000-00000000000c','DEMO Nordbräu AG','HRB 111111 (DEMO)','Brauereiweg 4, 28195 Bremen, DE','DE','food_bev','large'),
  ('0d000000-0000-0000-0000-00000000000d','DEMO Verdant Foods NV','000000000 (DEMO)','Voorbeeldlaan 12, 3011 Rotterdam, NL','NL','food_bev','large'),
  ('0e000000-0000-0000-0000-00000000000e','DEMO Rheinbank Nachhaltigkeit AG','HRB 222222 (DEMO)','Bankplatz 2, 60311 Frankfurt am Main, DE','DE','finance','large'),
  ('0f000000-0000-0000-0000-00000000000f','DEMO Fonds Bleu SA','000 111 222 (DEMO)','5 avenue Exemple, 75008 Paris, FR','FR','finance','large'),
  ('10000000-0000-0000-0000-000000000010','DEMO Sylva Operations','N/A (DEMO)','Pilot operator, EU','BE','public','sme'),
  ('11000000-0000-0000-0000-000000000011','DEMO Nordic Assurance AB','000000-0000 (DEMO)','Exempelgatan 3, 111 20 Stockholm, SE','SE','finance','sme'),
  ('12000000-0000-0000-0000-000000000012','DEMO Hydro-Verify GmbH','HRB 333333 (DEMO)','Prüfweg 8, 04109 Leipzig, DE','DE','public','sme'),
  ('13000000-0000-0000-0000-000000000013','DEMO BioCert SARL','000 333 444 (DEMO)','3 rue Contrôle, 35000 Rennes, FR','FR','public','sme'),
  -- Never approved. Exists so R6 can be tested against a real row.
  ('14000000-0000-0000-0000-000000000014','DEMO Unvetted Trading Ltd','00000000 (DEMO)','1 Example Road, Dublin 2, IE','IE','chemicals','large')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- DEMO people. The ONLY table in the database holding personal data.
-- Passwords are scrypt hashes of 'demo-password-not-for-production'.
-- --------------------------------------------------------------------------
INSERT INTO identity.user_account (id, person_ref, org_id, email, full_name, job_title, locale, status) VALUES
  ('a0000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-0000000000b1','0a000000-0000-0000-0000-00000000000a','owner.a@demo.sylva.example','DEMO Katrin Hofer','Project director','de','active'),
  ('a0000000-0000-0000-0000-0000000000a2','b0000000-0000-0000-0000-0000000000b2','0b000000-0000-0000-0000-00000000000b','owner.b@demo.sylva.example','DEMO Luc Ferrand','Directeur de projet','en','active'),
  ('a0000000-0000-0000-0000-0000000000a3','b0000000-0000-0000-0000-0000000000b3','0c000000-0000-0000-0000-00000000000c','buyer.a@demo.sylva.example','DEMO Sophie Brandt','Head of water stewardship','de','active'),
  ('a0000000-0000-0000-0000-0000000000a4','b0000000-0000-0000-0000-0000000000b4','0d000000-0000-0000-0000-00000000000d','buyer.b@demo.sylva.example','DEMO Joris Velde','Sustainability reporting lead','en','active'),
  ('a0000000-0000-0000-0000-0000000000a5','b0000000-0000-0000-0000-0000000000b5','0e000000-0000-0000-0000-00000000000e','investor.a@demo.sylva.example','DEMO Martin Ebert','Nature finance','de','active'),
  ('a0000000-0000-0000-0000-0000000000a6','b0000000-0000-0000-0000-0000000000b6','0f000000-0000-0000-0000-00000000000f','investor.b@demo.sylva.example','DEMO Claire Nourry','Investment manager','en','active'),
  ('a0000000-0000-0000-0000-0000000000a7','b0000000-0000-0000-0000-0000000000b7','10000000-0000-0000-0000-000000000010','operator@demo.sylva.example','DEMO Ines Kruger','Platform operator','en','active'),
  ('a0000000-0000-0000-0000-0000000000a8','b0000000-0000-0000-0000-0000000000b8','11000000-0000-0000-0000-000000000011','auditor@demo.sylva.example','DEMO Olav Lind','External auditor','en','active'),
  ('a0000000-0000-0000-0000-0000000000a9','b0000000-0000-0000-0000-0000000000b9','14000000-0000-0000-0000-000000000014','unvetted@demo.sylva.example','DEMO Alex Quinn','Commercial','en','active')
ON CONFLICT (id) DO NOTHING;

-- The non-personal label frozen into record rows. Survives erasure of the person.
INSERT INTO identity.person_label (person_ref, org_id, ordinal, label) VALUES
  ('b0000000-0000-0000-0000-0000000000b1','0a000000-0000-0000-0000-00000000000a',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b2','0b000000-0000-0000-0000-00000000000b',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b3','0c000000-0000-0000-0000-00000000000c',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b4','0d000000-0000-0000-0000-00000000000d',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b5','0e000000-0000-0000-0000-00000000000e',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b6','0f000000-0000-0000-0000-00000000000f',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b7','10000000-0000-0000-0000-000000000010',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b8','11000000-0000-0000-0000-000000000011',1,'representative #1'),
  ('b0000000-0000-0000-0000-0000000000b9','14000000-0000-0000-0000-000000000014',1,'representative #1')
ON CONFLICT (person_ref) DO NOTHING;

INSERT INTO identity.user_platform_role (user_id, role_code) VALUES
  ('a0000000-0000-0000-0000-0000000000a1','project_owner'),
  ('a0000000-0000-0000-0000-0000000000a2','project_owner'),
  ('a0000000-0000-0000-0000-0000000000a3','buyer'),
  ('a0000000-0000-0000-0000-0000000000a4','buyer'),
  ('a0000000-0000-0000-0000-0000000000a5','investor'),
  ('a0000000-0000-0000-0000-0000000000a6','investor'),
  ('a0000000-0000-0000-0000-0000000000a7','operator'),
  ('a0000000-0000-0000-0000-0000000000a8','auditor'),
  ('a0000000-0000-0000-0000-0000000000a9','buyer')
ON CONFLICT DO NOTHING;
