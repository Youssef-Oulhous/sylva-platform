-- ===========================================================================
-- SEED 4 · DEMO project page content, geography, outcomes and availability
--                        *** ALL OF THIS IS DEMO DATA ***
-- No figure here describes a real wetland or a real verification.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Page text. English first, German second (note section 9).
-- --------------------------------------------------------------------------
INSERT INTO proj.project_text (project_id, field_code, locale, version_no, body, status, source_locale, source_ref_id) VALUES
 ('a1000000-0000-0000-0000-000000000001','title','en',1,'DEMO Untere Havel Wetland Restoration','published','en','50000000-0000-0000-0000-000000000002'),
 ('a1000000-0000-0000-0000-000000000001','summary','en',1,
  'A DEMO restoration of drained floodplain wetland on the lower Havel. The project reconnects former polder land to the river, raises the water table over the restored area and re-establishes reed and wet meadow habitat. Units are issued as hectare-years under the DEMO Wetland Biodiversity Standard, and only after an independent body has verified the condition criteria on the ground.',
  'published','en','50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000001','catchment_context','en',1,
  'The site lies within the lower Havel catchment. Buyers with abstraction or discharge points in the same catchment may find the water indicators directly relevant; buyers elsewhere should read them as habitat and biodiversity outcomes only.',
  'published','en','50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000001','title','de',1,'DEMO Renaturierung Untere Havel','published','en','50000000-0000-0000-0000-000000000002'),
 ('a1000000-0000-0000-0000-000000000001','summary','de',1,
  'Eine DEMO-Renaturierung entwässerter Auenfeuchtgebiete an der unteren Havel. Das Projekt schließt ehemaliges Polderland wieder an den Fluss an, hebt den Wasserstand über der renaturierten Fläche an und stellt Schilf- und Feuchtwiesenlebensräume wieder her. Einheiten werden als Hektarjahre nach dem DEMO Wetland Biodiversity Standard ausgegeben, und erst nachdem eine unabhängige Stelle die Zustandskriterien vor Ort verifiziert hat.',
  'published','en','50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','title','en',1,'DEMO Marais de Brière Restoration','published','en','50000000-0000-0000-0000-000000000004'),
 ('a1000000-0000-0000-0000-000000000002','summary','en',1,
  'A DEMO restoration of degraded marshland in the Brière basin. Work focuses on hydrological reconnection of drainage channels and removal of barriers to flow. Units are issued as points on the DEMO Freshwater Index Scheme condition index. Index points measure condition of the assessed reach; they carry no area meaning and cannot be compared with hectare-based units from any other project.',
  'published','en','50000000-0000-0000-0000-000000000003'),
 ('a1000000-0000-0000-0000-000000000002','catchment_context','en',1,
  'The site sits in the Brière basin, draining to the Loire estuary. Water indicators relate to the assessed reach only.',
  'published','en','50000000-0000-0000-0000-000000000003'),
 ('a1000000-0000-0000-0000-000000000002','title','de',1,'DEMO Renaturierung Marais de Brière','published','en','50000000-0000-0000-0000-000000000004'),
 ('a1000000-0000-0000-0000-000000000002','summary','de',1,
  'Eine DEMO-Renaturierung degradierter Sumpfgebiete im Brière-Becken. Die Arbeiten konzentrieren sich auf die hydrologische Wiederanbindung von Entwässerungsgräben und die Beseitigung von Abflusshindernissen. Einheiten werden als Punkte im Zustandsindex des DEMO Freshwater Index Scheme ausgegeben. Indexpunkte messen den Zustand des bewerteten Abschnitts; sie haben keine Flächenbedeutung und sind nicht mit hektarbasierten Einheiten anderer Projekte vergleichbar.',
  'published','en','50000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Geometry. SRID 4326. Boundary supplied by the project; catchment from the
-- reference layer, each carrying its own source and date (docs/DECISIONS.md D4).
-- Placeholder polygons - deliberately simple, clearly not survey data.
-- --------------------------------------------------------------------------
INSERT INTO geo.project_geometry (project_id, kind, version_no, geom, dataset_name, source_ref_id, source_licence, as_of_date) VALUES
 ('a1000000-0000-0000-0000-000000000001','boundary',1,
  ST_Multi(ST_GeomFromText('POLYGON((12.30 52.58, 12.44 52.58, 12.44 52.66, 12.30 52.66, 12.30 52.58))',4326)),
  'DEMO project boundary','50000000-0000-0000-0000-000000000001','DEMO licence - placeholder geometry','2026-09-12'),
 ('a1000000-0000-0000-0000-000000000001','catchment',1,
  ST_Multi(ST_GeomFromText('POLYGON((12.05 52.40, 12.75 52.40, 12.75 52.85, 12.05 52.85, 12.05 52.40))',4326)),
  'DEMO catchment reference layer','50000000-0000-0000-0000-000000000006','DEMO licence - placeholder geometry','2026-05-20'),
 ('a1000000-0000-0000-0000-000000000002','boundary',1,
  ST_Multi(ST_GeomFromText('POLYGON((-2.24 47.33, -2.10 47.33, -2.10 47.41, -2.24 47.41, -2.24 47.33))',4326)),
  'DEMO project boundary','50000000-0000-0000-0000-000000000003','DEMO licence - placeholder geometry','2026-08-29'),
 ('a1000000-0000-0000-0000-000000000002','catchment',1,
  ST_Multi(ST_GeomFromText('POLYGON((-2.45 47.20, -1.90 47.20, -1.90 47.55, -2.45 47.55, -2.45 47.20))',4326)),
  'DEMO catchment reference layer','50000000-0000-0000-0000-000000000006','DEMO licence - placeholder geometry','2026-05-20')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Claim rights. Note section 3: a buyer told us it would not fund a project if
-- onward sale took away its right to claim what it paid for. So "exclusions"
-- is a required column, not a footnote.
-- --------------------------------------------------------------------------
INSERT INTO proj.claim_right (project_id, benefit_key, version_no, sort_order, source_ref_id) VALUES
 ('a1000000-0000-0000-0000-000000000001','water',1,10,'50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000001','biodiversity',1,20,'50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','water',1,10,'50000000-0000-0000-0000-000000000003'),
 ('a1000000-0000-0000-0000-000000000002','biodiversity',1,20,'50000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO proj.claim_right_text (project_id, benefit_key, version_no, locale, benefit_label, who_may_claim, for_what, exclusions, status, source_sha256) VALUES
 ('a1000000-0000-0000-0000-000000000001','water',1,'en','Water-related outcome',
  'The organisation that holds the retired units for the period in question.',
  'Describing its support for a measured improvement in water retention over the restored area, in the period stated on the unit.',
  'Not a claim about drinking-water quality. Not a water abstraction right or permit. Not transferable once retired. Only one organisation may claim a given unit.','published',NULL),
 ('a1000000-0000-0000-0000-000000000001','biodiversity',1,'en','Biodiversity outcome',
  'The organisation that holds the retired units for the period in question.',
  'Describing its support for verified habitat condition on the restored area, in the period stated on the unit.',
  'Not a claim of no net loss or net gain for the organisation as a whole. Not a species-level guarantee. Only one organisation may claim a given unit.','published',NULL),
 ('a1000000-0000-0000-0000-000000000002','water',1,'en','Water-related outcome',
  'The organisation that holds the retired units for the period in question.',
  'Describing its support for a measured improvement in the scheme''s freshwater condition index for the assessed reach.',
  'Not a claim about the wider basin. Not a discharge consent. Index points cannot be restated as volume or area. Only one organisation may claim a given unit.','published',NULL),
 ('a1000000-0000-0000-0000-000000000002','biodiversity',1,'en','Biodiversity outcome',
  'The organisation that holds the retired units for the period in question.',
  'Describing its support for verified marshland condition on the assessed reach.',
  'Not a claim of no net loss or net gain for the organisation as a whole. Only one organisation may claim a given unit.','published',NULL)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Outcomes. Water and biodiversity kept apart, each with its own verifier.
-- Note section 3: water-dependent buyers rank water first, biodiversity second.
-- --------------------------------------------------------------------------
INSERT INTO proj.outcome_indicator (project_id, indicator_code, version_no, domain, measure_unit, verifier_org_id, monitoring_plan_document_id, uncertainty_note, source_ref_id) VALUES
 ('a1000000-0000-0000-0000-000000000001','water_table_depth',1,'water','cm below ground','12000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000003','DEMO: piezometer network, stated as a range because of seasonal variation.','50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000001','reedbed_condition',1,'biodiversity','condition score 0-100','12000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000003','DEMO: plot-based survey, +/- 6 points at 90% confidence.','50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','index_score',1,'water','index points','13000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000007','DEMO: index recomputed annually; uncertainty stated by the scheme.','50000000-0000-0000-0000-000000000003'),
 ('a1000000-0000-0000-0000-000000000002','marsh_condition',1,'biodiversity','condition score 0-100','13000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000007','DEMO: plot-based survey, +/- 8 points at 90% confidence.','50000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO proj.outcome_indicator_text (project_id, indicator_code, version_no, locale, what_is_measured, method_note, status) VALUES
 ('a1000000-0000-0000-0000-000000000001','water_table_depth',1,'en','Mean growing-season depth to the water table across the restored area.','DEMO: monthly piezometer readings at 14 points, April to September.','published'),
 ('a1000000-0000-0000-0000-000000000001','reedbed_condition',1,'en','Condition of re-established reedbed and wet meadow, scored against the scheme''s criteria.','DEMO: annual plot survey on a fixed grid.','published'),
 ('a1000000-0000-0000-0000-000000000002','index_score',1,'en','The scheme''s freshwater condition index for the assessed reach.','DEMO: annual assessment following the scheme rulebook.','published'),
 ('a1000000-0000-0000-0000-000000000002','marsh_condition',1,'en','Condition of restored marshland vegetation, scored against the scheme''s criteria.','DEMO: annual plot survey.','published')
ON CONFLICT DO NOTHING;

INSERT INTO proj.indicator_value (project_id, indicator_code, version_no, value_kind, value_numeric, measure_unit, uncertainty_low, uncertainty_high, source_ref_id, as_of_date) VALUES
 ('a1000000-0000-0000-0000-000000000001','water_table_depth',1,'baseline',82,'cm below ground',76,88,'50000000-0000-0000-0000-000000000001','2026-03-31'),
 ('a1000000-0000-0000-0000-000000000001','water_table_depth',1,'target',  35,'cm below ground',28,44,'50000000-0000-0000-0000-000000000001','2026-09-12'),
 ('a1000000-0000-0000-0000-000000000001','reedbed_condition',1,'baseline',21,'condition score 0-100',15,27,'50000000-0000-0000-0000-000000000001','2026-03-31'),
 ('a1000000-0000-0000-0000-000000000001','reedbed_condition',1,'target',  64,'condition score 0-100',58,70,'50000000-0000-0000-0000-000000000001','2026-09-12'),
 ('a1000000-0000-0000-0000-000000000002','index_score',1,'baseline',31,'index points',28,34,'50000000-0000-0000-0000-000000000003','2026-02-28'),
 ('a1000000-0000-0000-0000-000000000002','index_score',1,'target',  58,'index points',52,64,'50000000-0000-0000-0000-000000000003','2026-08-29'),
 ('a1000000-0000-0000-0000-000000000002','marsh_condition',1,'baseline',26,'condition score 0-100',18,34,'50000000-0000-0000-0000-000000000003','2026-02-28'),
 ('a1000000-0000-0000-0000-000000000002','marsh_condition',1,'target',  61,'condition score 0-100',53,69,'50000000-0000-0000-0000-000000000003','2026-08-29')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Durability. Note section 6: one buyer asked about the period after a
-- five-year contract, another about thirty to forty years.
-- --------------------------------------------------------------------------
INSERT INTO proj.durability_commitment (project_id, commitment_key, version_no, responsible_org_id, starts_on, ends_on, horizon_years, source_ref_id) VALUES
 ('a1000000-0000-0000-0000-000000000001','management',1,'0a000000-0000-0000-0000-00000000000a','2026-10-01','2056-09-30',30,'50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','management',1,'0b000000-0000-0000-0000-00000000000b','2026-11-01','2056-10-31',30,'50000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO proj.durability_commitment_text (project_id, commitment_key, version_no, locale, statement, land_control_note, status) VALUES
 ('a1000000-0000-0000-0000-000000000001','management',1,'en',
  'DEMO: the project owner commits to maintain the restored hydrology and habitat management for thirty years from the start of works. After the last unit period, management continues under the same commitment.',
  'DEMO: the land is held under a long lease from the regional authority running to 2056. The project owner is responsible for maintenance throughout. What happens after 2056 is not yet agreed and is not represented here.','published'),
 ('a1000000-0000-0000-0000-000000000002','management',1,'en',
  'DEMO: the project owner commits to maintain hydrological reconnection works and vegetation management for thirty years from the start of works.',
  'DEMO: the land is communally owned; the project owner holds a management agreement running to 2056. What happens after 2056 is not yet agreed and is not represented here.','published')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Partners. Note section 6: "one buyer told us it judges a project by meeting
-- the people behind it."
-- --------------------------------------------------------------------------
INSERT INTO proj.project_party (project_id, party_org_id, party_role, description_en, source_ref_id) VALUES
 ('a1000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-00000000000a','developer','DEMO: designs and delivers the restoration works.','50000000-0000-0000-0000-000000000002'),
 ('a1000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-00000000000a','landowner','DEMO: holds the long lease over the restored area.','50000000-0000-0000-0000-000000000002'),
 ('a1000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000012','verifier','DEMO: independent verification of the condition criteria.','50000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','0b000000-0000-0000-0000-00000000000b','developer','DEMO: designs and delivers the reconnection works.','50000000-0000-0000-0000-000000000004'),
 ('a1000000-0000-0000-0000-000000000002','0b000000-0000-0000-0000-00000000000b','landowner','DEMO: holds the management agreement over the assessed reach.','50000000-0000-0000-0000-000000000004'),
 ('a1000000-0000-0000-0000-000000000002','13000000-0000-0000-0000-000000000013','verifier','DEMO: independent verification of the index assessment.','50000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Periods and forecasts. period_balance is maintained by t_forecast_apply,
-- never written directly. Note the two projects' periods mean different things:
-- Havel vintages are periods of OUTCOME, Brière vintages are periods of
-- ISSUANCE. The unit type records which, so a forward contract is not misdated.
-- --------------------------------------------------------------------------
INSERT INTO proj.period (id, project_id, label, starts_on, ends_on, source_ref_id) VALUES
 ('c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','2028','2028-01-01','2028-12-31','50000000-0000-0000-0000-000000000001'),
 ('c1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001','2029','2029-01-01','2029-12-31','50000000-0000-0000-0000-000000000001'),
 ('c1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001','2030','2030-01-01','2030-12-31','50000000-0000-0000-0000-000000000001'),
 ('c1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000002','2029','2029-01-01','2029-12-31','50000000-0000-0000-0000-000000000003'),
 ('c1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002','2030','2030-01-01','2030-12-31','50000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO proj.period_forecast (project_id, unit_type_id, period_id, expected_issuance_raw, buffer_raw, source_ref_id, as_of_date, recorded_by_org_id) VALUES
 ('a1000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',12400,1000,'50000000-0000-0000-0000-000000000001','2026-09-12','0a000000-0000-0000-0000-00000000000a'),
 ('a1000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002',10000, 800,'50000000-0000-0000-0000-000000000001','2026-09-12','0a000000-0000-0000-0000-00000000000a'),
 ('a1000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000003', 9500, 760,'50000000-0000-0000-0000-000000000001','2026-09-12','0a000000-0000-0000-0000-00000000000a'),
 ('a1000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000004',  540,  54,'50000000-0000-0000-0000-000000000003','2026-08-29','0b000000-0000-0000-0000-00000000000b'),
 ('a1000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000005',  610,  61,'50000000-0000-0000-0000-000000000003','2026-08-29','0b000000-0000-0000-0000-00000000000b')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Buyer sites. Private to the owning organisation - never public.
-- --------------------------------------------------------------------------
INSERT INTO geo.buyer_site (id, org_id, label, country_code, geom, source_ref_id) VALUES
 ('d1000000-0000-0000-0000-000000000001','0c000000-0000-0000-0000-00000000000c','DEMO Bremen brewery','DE',ST_SetSRID(ST_MakePoint(8.8017,53.0793),4326),'50000000-0000-0000-0000-000000000008'),
 ('d1000000-0000-0000-0000-000000000002','0c000000-0000-0000-0000-00000000000c','DEMO Brandenburg brewery','DE',ST_SetSRID(ST_MakePoint(12.5551,52.4125),4326),'50000000-0000-0000-0000-000000000008'),
 ('d1000000-0000-0000-0000-000000000003','0d000000-0000-0000-0000-00000000000d','DEMO Rotterdam plant','NL',ST_SetSRID(ST_MakePoint(4.4777,51.9244),4326),'50000000-0000-0000-0000-000000000008')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Publish. Goes through proj.enforce_publication_gate(): if anything above is
-- missing, this UPDATE fails and says which item. The third project is left in
-- draft precisely so that failure path stays testable.
-- --------------------------------------------------------------------------
UPDATE proj.project SET status='published'
 WHERE id IN ('a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002');
