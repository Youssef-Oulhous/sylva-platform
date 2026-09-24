-- ===========================================================================
-- SEED 3 · DEMO projects
--
--                        *** ALL OF THIS IS DEMO DATA ***
--
-- Two published projects, deliberately under DIFFERENT schemes with DIFFERENT
-- unit types and DIFFERENT vintage semantics:
--
--   Untere Havel   DEMO Wetland Biodiversity Standard   hectare-years
--                  vintage = period_of_outcome
--   Brière         DEMO Freshwater Index Scheme         index points
--                  vintage = period_of_issuance
--
-- Hectare-years and index points are not interchangeable and the platform must
-- never add them. The seed is built this way so that Rule 7 is exercised by the
-- fixture itself: any screen, export or chart that produces a combined total
-- will fail loudly against this data rather than quietly on real data later.
--
-- A third project stays in draft so the publication gate can be tested.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Schemes and unit types.
-- --------------------------------------------------------------------------
INSERT INTO units.scheme (id, code, name, registry_url, source_label, as_of_date) VALUES
  ('90000000-0000-0000-0000-000000000001','DWBS','DEMO Wetland Biodiversity Standard',
   'https://registry.demo.example/dwbs','DEMO scheme rulebook v1.2','2026-06-30'),
  ('90000000-0000-0000-0000-000000000002','DFIS','DEMO Freshwater Index Scheme',
   'https://registry.demo.example/dfis','DEMO scheme rulebook v0.9','2026-07-15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO units.unit_type (id, scheme_id, code, metric_label_en, unit_of_measure, vintage_semantics, definition_en, source_label, as_of_date) VALUES
  ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','DWBS-HAYR',
   'hectares under restoration for a year','ha_yr','period_of_outcome',
   'One hectare of wetland held under active restoration management for one year, verified against the scheme''s condition criteria. Not convertible to any other scheme''s unit.',
   'DEMO scheme rulebook v1.2, section 5','2026-06-30'),
  ('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','DFIS-PT',
   'points on the freshwater condition index','index_point','period_of_issuance',
   'One point of improvement on the scheme''s freshwater condition index for the assessed reach. An index point has no area or volume meaning and cannot be compared with any area-based unit.',
   'DEMO scheme rulebook v0.9, section 3','2026-07-15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO units.unit_type_translation (unit_type_id, locale, metric_label, definition, status, source_locale) VALUES
  ('91000000-0000-0000-0000-000000000001','de','Hektar unter Renaturierung pro Jahr',
   'Ein Hektar Feuchtgebiet, das ein Jahr lang unter aktiver Renaturierungsbewirtschaftung steht und nach den Zustandskriterien des Standards verifiziert wird. Nicht in Einheiten anderer Standards umrechenbar.',
   'human_draft','en'),
  ('91000000-0000-0000-0000-000000000002','de','Punkte im Süßwasser-Zustandsindex',
   'Ein Punkt Verbesserung im Süßwasser-Zustandsindex des Standards für den bewerteten Abschnitt. Ein Indexpunkt hat keine Flächen- oder Volumenbedeutung und ist nicht mit flächenbasierten Einheiten vergleichbar.',
   'human_draft','en')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Projects. Created as drafts; published at the end, through the gate.
-- --------------------------------------------------------------------------
INSERT INTO proj.project (id, slug, owner_org_id, country_code, status) VALUES
  ('a1000000-0000-0000-0000-000000000001','demo-untere-havel-wetland-restoration','0a000000-0000-0000-0000-00000000000a','DE','draft'),
  ('a1000000-0000-0000-0000-000000000002','demo-marais-de-briere-restoration','0b000000-0000-0000-0000-00000000000b','FR','draft'),
  ('a1000000-0000-0000-0000-000000000003','demo-oder-floodplain-reconnection','0a000000-0000-0000-0000-00000000000a','DE','draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO proj.project_unit_type (project_id, unit_type_id, scheme_id, source_ref_id) VALUES
  ('a1000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000009'),
  ('a1000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000009')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Storage regions. member_state is a foreign key to platform.eu_member_state,
-- so a London or Zurich region cannot be inserted at all - the note's "not a
-- generic Europe region" is a constraint here, not a deployment convention.
-- WHICH provider and region Sylva actually uses is an OPEN DECISION.
-- --------------------------------------------------------------------------
INSERT INTO platform.storage_region (code, provider, city, member_state) VALUES
  ('eu-central-1','DEMO provider','Frankfurt am Main','DE'),
  ('eu-west-3',   'DEMO provider','Paris','FR'),
  ('eu-west-1',   'DEMO provider','Dublin','IE')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Documents, then the document-kind source refs that point at them.
-- --------------------------------------------------------------------------
INSERT INTO doc.document (id, scope, kind, visibility, project_id) VALUES
  ('b1000000-0000-0000-0000-000000000001','project','project_idea_note',        'public',          'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002','project','project_design_document',  'public',          'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000003','project','monitoring_plan',          'public',          'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000004','project','financial_model',          'vetted_investor', 'a1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000005','project','project_idea_note',        'public',          'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000006','project','project_design_document',  'public',          'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000007','project','monitoring_plan',          'public',          'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000008','project','financial_model',          'vetted_investor', 'a1000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO doc.document_version
  (id, document_id, version_no, storage_region, storage_bucket, storage_key,
   content_sha256, byte_size, media_type, locale, uploaded_by_org_id, uploaded_by_person_ref)
SELECT
  ('b2000000-0000-0000-0000-00000000000' || n)::uuid,
  ('b1000000-0000-0000-0000-00000000000' || n)::uuid,
  1, 'eu-central-1', 'sylva-demo-documents',
  'demo/' || n || '.pdf',
  public.digest('DEMO placeholder document ' || n, 'sha256'),
  120000 + n * 1000, 'application/pdf', 'en',
  CASE WHEN n <= 4 THEN '0a000000-0000-0000-0000-00000000000a'::uuid
                   ELSE '0b000000-0000-0000-0000-00000000000b'::uuid END,
  CASE WHEN n <= 4 THEN 'b0000000-0000-0000-0000-0000000000b1'::uuid
                   ELSE 'b0000000-0000-0000-0000-0000000000b2'::uuid END
FROM generate_series(1,8) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO sylva.source_ref (id, kind, label, document_version_id, locator, as_of_date) VALUES
  ('50000000-0000-0000-0000-000000000001','document','DEMO Untere Havel Project Design Document v2.1','b2000000-0000-0000-0000-000000000002','Table 4.2','2026-09-12'),
  ('50000000-0000-0000-0000-000000000002','document','DEMO Untere Havel Project Idea Note v1.0','b2000000-0000-0000-0000-000000000001','Section 3','2026-04-18'),
  ('50000000-0000-0000-0000-000000000003','document','DEMO Brière Project Design Document v1.4','b2000000-0000-0000-0000-000000000006','Tableau 6','2026-08-29'),
  ('50000000-0000-0000-0000-000000000004','document','DEMO Brière Project Idea Note v1.0','b2000000-0000-0000-0000-000000000005','Section 2','2026-03-05'),
  ('50000000-0000-0000-0000-00000000000a','document','DEMO Untere Havel Monitoring Plan v1.1','b2000000-0000-0000-0000-000000000003','Section 2','2026-07-01'),
  ('50000000-0000-0000-0000-00000000000b','document','DEMO Brière Monitoring Plan v1.0','b2000000-0000-0000-0000-000000000007','Section 2','2026-07-20')
ON CONFLICT (id) DO NOTHING;
