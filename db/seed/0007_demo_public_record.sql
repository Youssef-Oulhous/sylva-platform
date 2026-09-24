-- ===========================================================================
-- SEED 7 · DEMO entries in the public transaction record
--
--                        *** ALL OF THIS IS DEMO DATA ***
--
-- No entry below describes a real transaction, a real buyer or a real
-- environmental result. Every organisation involved is a "DEMO " organisation
-- from seed 1.
--
-- The seeds before this one give organisations, vetting, projects, content,
-- geometry and passwords. They give no deals and no record entries, so /record
-- rendered an empty table on a database built from nothing. This seed makes
-- the page show the four things a reader has to be able to see before the
-- record means anything:
--
--   1. A PSEUDONYMOUS counterparty. A buyer that has not asked to be named
--      appears as its deal's label and nothing else identifies it.
--
--   2. DISCLOSURE THAT APPLIES FORWARD ONLY. DEMO Nordbräu AG chooses on
--      13 September to be named on its Untere Havel deal. The entries it made
--      before that date keep the label they were published with; the entries
--      after it carry the name. Nothing already published is rewritten - that
--      is R4 and it is the whole reason disclosure is resolved as at each
--      entry's own timestamp rather than as at now().
--
--   3. TWO DEALS, TWO LABELS. DEMO Verdant Foods NV has a deal on Brière and
--      a deal on Untere Havel. They carry different labels and there is
--      nothing on the page that connects them. Since migration 0075 the label
--      comes from deal.deal_pseudonym, so this is true per DEAL and not merely
--      per project.
--
--   4. A CORRECTION. Entry .-c4 recorded terms proposed against the wrong
--      period. It is not edited and it is not removed. A correction entry
--      points at it and states why, and a third entry records the event again
--      correctly. All three stay visible, in date order, and the wrong one is
--      marked superseded. That is R4 in the one place a reader can watch it
--      happen.
--
-- Deliberately NOT here: any volume and any price. record.entry has no column
-- for either, so there is nothing on this page a reader could add up - which
-- is Rule 7 satisfied structurally rather than by a linter.
--
-- Idempotent: every statement is a no-op on a second run. It has to be. These
-- tables are append-only, so a duplicate row could never be tidied away.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Provenance. source_ref_id is how a reader knows where a line came from.
-- --------------------------------------------------------------------------
INSERT INTO sylva.source_ref (id, kind, label, locator, as_of_date) VALUES
  ('5f000000-0000-0000-0000-0000000000f7'::uuid, 'operator_statement',
   'DEMO transaction record, recorded by Sylva operations at the time of each event',
   NULL, DATE '2026-09-23')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- A second deal for DEMO Verdant Foods NV, on the Untere Havel project.
--
-- It already has one on Brière from the row-level security fixtures; this one
-- exists so that the record shows one organisation holding two deals under two
-- unrelated labels. The R6 trigger checks that Verdant is an approved buyer
-- and that the project is published, and refuses otherwise - it is not
-- bypassed here and must not be.
-- --------------------------------------------------------------------------
INSERT INTO deal.deal (id, project_id, owner_org_id, buyer_org_id, intended_shape)
SELECT 'ea000000-0000-0000-0000-0000000000c1'::uuid,
       'a1000000-0000-0000-0000-000000000001'::uuid,
       '0a000000-0000-0000-0000-00000000000a'::uuid,
       '0d000000-0000-0000-0000-00000000000d'::uuid,
       'spot'
 WHERE NOT EXISTS (SELECT 1 FROM deal.deal d
                    WHERE d.id = 'ea000000-0000-0000-0000-0000000000c1'::uuid);

-- --------------------------------------------------------------------------
-- The disclosure decision. Made by the buyer, for ONE deal, on a stated date.
--
-- decided_at is what record.v_public_entry compares each entry's occurred_at
-- against, so this date is load-bearing rather than decorative: it is the
-- line between the labelled entries and the named ones below.
-- --------------------------------------------------------------------------
INSERT INTO deal.deal_disclosure_event
  (deal_id, project_id, buyer_org_id, owner_org_id, disclosed,
   decided_by_org_id, decided_by_person_ref, decided_at)
SELECT 'ea000000-0000-0000-0000-0000000000a1'::uuid,
       'a1000000-0000-0000-0000-000000000001'::uuid,
       '0c000000-0000-0000-0000-00000000000c'::uuid,
       '0a000000-0000-0000-0000-00000000000a'::uuid,
       true,
       '0c000000-0000-0000-0000-00000000000c'::uuid,
       'b0000000-0000-0000-0000-0000000000b3'::uuid,
       TIMESTAMPTZ '2026-09-13 09:00:00+02'
 WHERE NOT EXISTS (SELECT 1 FROM deal.deal_disclosure_event e
                    WHERE e.deal_id = 'ea000000-0000-0000-0000-0000000000a1'::uuid);

-- --------------------------------------------------------------------------
-- The entries themselves, oldest first so that the correction can point
-- backwards at a row that already exists.
--
-- occurred_at is set explicitly on every row. The default is clock_timestamp(),
-- which would put the whole demo record inside one second of whenever the seed
-- happened to run, and the disclosure boundary above would then fall on the
-- wrong side of everything.
-- --------------------------------------------------------------------------
INSERT INTO record.entry
  (public_id, entry_type, occurred_at, project_id,
   deal_id, deal_buyer_org_id, deal_owner_org_id,
   actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
   source_ref_id, detail)
SELECT v.public_id::uuid, v.entry_type, v.occurred_at,
       v.project_id::uuid,
       v.deal_id::uuid, v.buyer_org_id::uuid, v.owner_org_id::uuid,
       v.actor_org_id::uuid, v.actor_role, v.person_ref::uuid, v.person_label,
       '5f000000-0000-0000-0000-0000000000f7'::uuid,
       '{"seed":"db/seed/0007","demo":true}'::jsonb
  FROM (VALUES
    -- ---- the two projects are listed and then offered -------------------
    ('ec000000-0000-0000-0000-0000000000c1','listed',
     TIMESTAMPTZ '2026-07-24 10:00:00+02','a1000000-0000-0000-0000-000000000001',
     NULL,NULL,NULL,
     '0a000000-0000-0000-0000-00000000000a','project_owner',
     'b0000000-0000-0000-0000-0000000000b1','representative #1'),

    ('ec000000-0000-0000-0000-0000000000c2','listed',
     TIMESTAMPTZ '2026-07-30 10:00:00+02','a1000000-0000-0000-0000-000000000002',
     NULL,NULL,NULL,
     '0b000000-0000-0000-0000-00000000000b','project_owner',
     'b0000000-0000-0000-0000-0000000000b2','representative #1'),

    ('ec000000-0000-0000-0000-0000000000c3','offered',
     TIMESTAMPTZ '2026-08-14 11:30:00+02','a1000000-0000-0000-0000-000000000001',
     NULL,NULL,NULL,
     '0a000000-0000-0000-0000-00000000000a','project_owner',
     'b0000000-0000-0000-0000-0000000000b1','representative #1'),

    -- ---- Nordbräu, BEFORE it chose to be named --------------------------
    -- Resolved against the disclosure decision as at THIS timestamp, so it
    -- carries the label even though the organisation is named further down.
    ('ec000000-0000-0000-0000-0000000000c4','interest_expressed',
     TIMESTAMPTZ '2026-08-28 09:15:00+02','a1000000-0000-0000-0000-000000000001',
     'ea000000-0000-0000-0000-0000000000a1',
     '0c000000-0000-0000-0000-00000000000c','0a000000-0000-0000-0000-00000000000a',
     '0c000000-0000-0000-0000-00000000000c','buyer',
     'b0000000-0000-0000-0000-0000000000b3','representative #1'),

    -- THE WRONG ENTRY. Corrected on 18 September, below. Left exactly where
    -- it is, for ever.
    ('ec000000-0000-0000-0000-0000000000c5','terms_proposed',
     TIMESTAMPTZ '2026-09-11 16:40:00+02','a1000000-0000-0000-0000-000000000001',
     'ea000000-0000-0000-0000-0000000000a1',
     '0c000000-0000-0000-0000-00000000000c','0a000000-0000-0000-0000-00000000000a',
     '0c000000-0000-0000-0000-00000000000c','buyer',
     'b0000000-0000-0000-0000-0000000000b3','representative #1'),

    -- ---- Brière ---------------------------------------------------------
    ('ec000000-0000-0000-0000-0000000000c6','offered',
     TIMESTAMPTZ '2026-08-21 11:00:00+02','a1000000-0000-0000-0000-000000000002',
     NULL,NULL,NULL,
     '0b000000-0000-0000-0000-00000000000b','project_owner',
     'b0000000-0000-0000-0000-0000000000b2','representative #1'),

    -- Verdant Foods, deal one of two. Never named.
    ('ec000000-0000-0000-0000-0000000000c7','interest_expressed',
     TIMESTAMPTZ '2026-09-08 14:05:00+02','a1000000-0000-0000-0000-000000000002',
     'ea000000-0000-0000-0000-0000000000b1',
     '0d000000-0000-0000-0000-00000000000d','0b000000-0000-0000-0000-00000000000b',
     '0d000000-0000-0000-0000-00000000000d','buyer',
     'b0000000-0000-0000-0000-0000000000b4','representative #1'),

    -- ---- Nordbräu, AFTER it chose to be named (13 September) ------------
    ('ec000000-0000-0000-0000-0000000000c8','terms_proposed',
     TIMESTAMPTZ '2026-09-14 10:20:00+02','a1000000-0000-0000-0000-000000000001',
     'ea000000-0000-0000-0000-0000000000a1',
     '0c000000-0000-0000-0000-00000000000c','0a000000-0000-0000-0000-00000000000a',
     '0c000000-0000-0000-0000-00000000000c','buyer',
     'b0000000-0000-0000-0000-0000000000b3','representative #1'),

    ('ec000000-0000-0000-0000-0000000000c9','agreed',
     TIMESTAMPTZ '2026-09-15 15:00:00+02','a1000000-0000-0000-0000-000000000001',
     'ea000000-0000-0000-0000-0000000000a1',
     '0c000000-0000-0000-0000-00000000000c','0a000000-0000-0000-0000-00000000000a',
     '0c000000-0000-0000-0000-00000000000c','buyer',
     'b0000000-0000-0000-0000-0000000000b3','representative #1'),

    -- ---- Verdant Foods, deal two of two, on the OTHER project -----------
    -- A different label from .-c7 and nothing on the page links them.
    ('ec000000-0000-0000-0000-0000000000cb','interest_expressed',
     TIMESTAMPTZ '2026-09-22 08:45:00+02','a1000000-0000-0000-0000-000000000001',
     'ea000000-0000-0000-0000-0000000000c1',
     '0d000000-0000-0000-0000-00000000000d','0a000000-0000-0000-0000-00000000000a',
     '0d000000-0000-0000-0000-00000000000d','buyer',
     'b0000000-0000-0000-0000-0000000000b4','representative #1')
  ) AS v(public_id, entry_type, occurred_at, project_id,
         deal_id, buyer_org_id, owner_org_id,
         actor_org_id, actor_role, person_ref, person_label)
 WHERE NOT EXISTS (SELECT 1 FROM record.entry e
                    WHERE e.public_id = v.public_id::uuid);

-- --------------------------------------------------------------------------
-- The correction, and the re-recorded event.
--
-- Separate statement because corrects_entry_no is a bigint identity that only
-- exists once the wrong entry has been inserted. The CHECK constraints refuse
-- anything else: a correction must be typed 'correction', must carry a reason,
-- and can only point backwards.
-- --------------------------------------------------------------------------
INSERT INTO record.entry
  (public_id, entry_type, occurred_at, project_id,
   deal_id, deal_buyer_org_id, deal_owner_org_id,
   actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
   source_ref_id, detail, corrects_entry_no, correction_reason)
SELECT 'ec000000-0000-0000-0000-0000000000ca'::uuid, 'correction',
       TIMESTAMPTZ '2026-09-18 09:30:00+02',
       'a1000000-0000-0000-0000-000000000001'::uuid,
       'ea000000-0000-0000-0000-0000000000a1'::uuid,
       '0c000000-0000-0000-0000-00000000000c'::uuid,
       '0a000000-0000-0000-0000-00000000000a'::uuid,
       '10000000-0000-0000-0000-000000000010'::uuid, 'operator',
       'b0000000-0000-0000-0000-0000000000b5'::uuid, 'Sylva operations',
       '5f000000-0000-0000-0000-0000000000f7'::uuid,
       '{"seed":"db/seed/0007","demo":true}'::jsonb,
       w.entry_no,
       'DEMO: the entry recorded the 2028 period. The signed letter of intent states the 2029 period.'
  FROM record.entry w
 WHERE w.public_id = 'ec000000-0000-0000-0000-0000000000c5'::uuid
   AND NOT EXISTS (SELECT 1 FROM record.entry e
                    WHERE e.public_id = 'ec000000-0000-0000-0000-0000000000ca'::uuid);

-- The event, recorded again, correctly. A correction says what was wrong; it
-- does not by itself say what was right.
INSERT INTO record.entry
  (public_id, entry_type, occurred_at, project_id,
   deal_id, deal_buyer_org_id, deal_owner_org_id,
   actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
   source_ref_id, detail)
SELECT 'ec000000-0000-0000-0000-0000000000cc'::uuid, 'terms_proposed',
       TIMESTAMPTZ '2026-09-18 09:35:00+02',
       'a1000000-0000-0000-0000-000000000001'::uuid,
       'ea000000-0000-0000-0000-0000000000a1'::uuid,
       '0c000000-0000-0000-0000-00000000000c'::uuid,
       '0a000000-0000-0000-0000-00000000000a'::uuid,
       '0c000000-0000-0000-0000-00000000000c'::uuid, 'buyer',
       'b0000000-0000-0000-0000-0000000000b3'::uuid, 'representative #1',
       '5f000000-0000-0000-0000-0000000000f7'::uuid,
       '{"seed":"db/seed/0007","demo":true}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM record.entry e
                    WHERE e.public_id = 'ec000000-0000-0000-0000-0000000000cc'::uuid);
