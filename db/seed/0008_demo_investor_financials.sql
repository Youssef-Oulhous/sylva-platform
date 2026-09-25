-- ===========================================================================
-- SEED 8 · DEMO investor information
--
--                        *** ALL OF THIS IS DEMO DATA ***
--
-- Concept note section 6: "Investor data. Financing need, revenue streams, the
-- financial model. Visible only to investors we have vetted."
--
-- Without these rows an approved investor signs in, opens a project and finds
-- the financing section empty, which reads as a broken gate rather than a
-- working one. The gate is proj.project_financials' RLS policy
-- p_financials_investor: publicly visible project AND sylva.is_vetted_investor().
--
-- NOTE ON WHAT IS *NOT* HERE. There is no expected return, no yield, no IRR and
-- no repayment projection, because the note does not give us any and the brief
-- forbids "unsupported financial-return calculations". A financing need and the
-- revenue streams a project expects are statements of fact the project owner
-- makes. A return is a claim about the future, and this platform does not make
-- one. If the client wants modelled returns, that is a product decision with
-- its own disclosure obligations - not a column to quietly add.
-- ===========================================================================

INSERT INTO sylva.source_ref (id, kind, label, document_version_id, locator, as_of_date) VALUES
  ('5a000000-0000-0000-0000-0000000000f1','document',
   'DEMO Untere Havel financial model v1.3','b2000000-0000-0000-0000-000000000004','Sheet "Funding"','2026-09-10'),
  ('5a000000-0000-0000-0000-0000000000f2','document',
   'DEMO Brière financial model v1.1','b2000000-0000-0000-0000-000000000008','Feuille "Financement"','2026-08-27')
ON CONFLICT (id) DO NOTHING;

INSERT INTO proj.project_financials
  (project_id, version_no, financing_need, currency,
   revenue_streams_note, financial_model_document_id, source_ref_id, as_of_date)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 1, 1200000, 'EUR',
   'DEMO. Three streams, in the order the project expects them. '
   || 'One: forward sales of hectare-year units for the 2028 and 2029 periods, which is the '
   || 'largest and the least certain, because no unit exists until the verifier has signed off. '
   || 'Two: a regional water-authority contribution for the reconnection works, agreed in '
   || 'principle and not yet contracted. Three: agri-environment payments on the wet meadow '
   || 'from 2029. No return, yield or repayment schedule is stated here: the platform records '
   || 'what the project expects to receive, not what an investor might earn.',
   'b1000000-0000-0000-0000-000000000004',
   '5a000000-0000-0000-0000-0000000000f1', '2026-09-10'),

  ('a1000000-0000-0000-0000-000000000002', 1, 740000, 'EUR',
   'DEMO. Two streams. One: forward sales of index-point units for 2029 and 2030 — index '
   || 'points are this scheme''s unit and are not comparable with any other project''s. '
   || 'Two: a basin-authority maintenance contract covering years three to ten. As above, no '
   || 'return is stated.',
   'b1000000-0000-0000-0000-000000000008',
   '5a000000-0000-0000-0000-0000000000f2', '2026-08-27')
ON CONFLICT (project_id, version_no) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM proj.project_financials;
  RAISE NOTICE 'investor financials seeded for % project(s)', n;
END $$;
