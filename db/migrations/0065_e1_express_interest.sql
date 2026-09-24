-- ============================================================================
-- E1. EXPRESS INTEREST  ·  the platform's main call to action, made real
-- ============================================================================
-- Concept note §7: "A buyer clicks one button, Express interest." §10 puts the
-- Express interest button and the public record of interest events in the first
-- release; the private deal room comes after it.
--
-- Almost everything this needs already exists and is deliberately not rebuilt
-- here:
--
--   deal.deal                    R6 refuses a deal for an unapproved buyer, and
--                                refuses one against an unpublished project
--   deal.deal_pseudonym          allocated by an AFTER INSERT trigger (0021),
--                                so no entry can precede the label
--   deal.deal_disclosure_event   R5, the buyer's naming choice, deal by deal
--   deal.project_question        the private question box the message goes to
--   record.entry                 the append-only record the event is written to
--   ux_one_live_deal_per_buyer_project
--                                one live room per (project, buyer)
--
-- Two things were missing, and only two.
--
-- 1. SOMEWHERE FOR THE VOLUMES TO GO.
--    The enquiry asks which periods a buyer wants and roughly how much. Release
--    one reserves nothing (docs/DECISIONS.md D2: capacity is consumed at term
--    sheet, not at interest), so these figures claim no capacity - but they are
--    figures a project owner reads off a screen, and on this platform a figure
--    lives in a table with its unit scope and its provenance, never in a jsonb
--    blob where sum() can reach it without either.
--
-- 2. A WAY FOR A BUYER TO NAME ITSELF IN THE RECORD WITHOUT READING identity.
--    record.entry.actor_person_label is NOT NULL and non-personal, and the
--    label lives in identity.person_label, which no application role may read.
--    One more SECURITY DEFINER door, in the shape identity.whoami() established.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The volumes in an enquiry.
-- ---------------------------------------------------------------------------
-- R7 is structural here, not a convention:
--   * requested_raw is a *_raw column, so it is granted to NO role and
--     ci.assert_no_raw_amount_grants() keeps it that way;
--   * requested_qty is the composite, which carries (project_id, unit_type_id)
--     with the number, and PostgreSQL defines no sum() over it;
--   * the composite FK to proj.project_unit_type makes a volume in a unit type
--     this project does not sell unrepresentable, and the FK to proj.period
--     makes a period of another project unrepresentable too.
--
-- Provenance: source_label + as_of_date rather than source_ref_id, which is the
-- second shape ci.assert_figures_have_provenance() accepts and the one
-- units.scheme and units.unit_type already use. It is also the honest one: this
-- figure has no external document behind it. The buyer said it, on that date,
-- in this enquiry. Both columns are DEFAULTed so the statement that records an
-- enquiry cannot leave the provenance out, and a buyer needs no INSERT on
-- sylva.source_ref - which it does not have and should not be given.
CREATE TABLE deal.interest_volume (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        uuid NOT NULL,
  -- denormalised, exactly as deal.deal_stage_event does it: the RLS predicate
  -- is zero-hop and indexed, and the composite FK below makes a row that
  -- describes somebody else's deal unrepresentable rather than merely refused.
  project_id     uuid NOT NULL,
  buyer_org_id   uuid NOT NULL,
  owner_org_id   uuid NOT NULL,
  unit_type_id   uuid NOT NULL,
  period_id      uuid NOT NULL,
  requested_raw  sylva.unit_amount NOT NULL CHECK (requested_raw > 0),
  requested_qty  sylva.unit_qty GENERATED ALWAYS AS
      (ROW(project_id, unit_type_id, requested_raw)::sylva.unit_qty) STORED,
  source_label   sylva.nonblank NOT NULL
      DEFAULT 'Volume stated by the buyer in this expression of interest',
  as_of_date     date NOT NULL DEFAULT current_date,
  stated_at      timestamptz NOT NULL DEFAULT now(),
  -- one line per period per enquiry; a second thought is a new enquiry, and a
  -- new enquiry is a new deal
  UNIQUE (deal_id, period_id),
  CONSTRAINT interest_volume_deal_fk
    FOREIGN KEY (deal_id, project_id, buyer_org_id, owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id),
  CONSTRAINT interest_volume_unit_fk
    FOREIGN KEY (project_id, unit_type_id)
    REFERENCES proj.project_unit_type (project_id, unit_type_id),
  CONSTRAINT interest_volume_period_fk
    FOREIGN KEY (period_id, project_id)
    REFERENCES proj.period (id, project_id)
);
CREATE INDEX ix_interest_volume_deal  ON deal.interest_volume (deal_id);
CREATE INDEX ix_interest_volume_buyer ON deal.interest_volume (buyer_org_id);
CREATE INDEX ix_interest_volume_owner ON deal.interest_volume (owner_org_id);

COMMENT ON TABLE deal.interest_volume IS
  'What a buyer said it was interested in, per period, when it expressed '
  'interest. Claims NO capacity: R1 counts reserved + committed, and interest '
  'is neither (docs/DECISIONS.md D2). Kept because a project owner has to see '
  'the shape of the enquiry, and because a figure on a screen belongs in a '
  'table with its unit scope and its date.';
COMMENT ON COLUMN deal.interest_volume.requested_raw IS
  'R7: granted to no role. Read requested_qty, which carries the project and '
  'unit type that make the number mean something.';

INSERT INTO ci.append_only_table (table_name, note)
VALUES ('deal.interest_volume',
        'what the buyer asked for is evidence of the enquiry; a change is a new enquiry')
ON CONFLICT DO NOTHING;
SELECT sylva.make_append_only('deal.interest_volume');

-- make_append_only enables and FORCEs RLS. The owner-maintenance policy is
-- created here by hand because the loop in migration 0017 has already run and
-- ci.assert_rls_complete() will not accept an RLS table with no policy.
CREATE POLICY p_owner_maintenance ON deal.interest_volume FOR ALL
  TO sylva_owner USING (true) WITH CHECK (true);

-- Same reach as the deal itself: the two parties, Sylva, the auditor. Never
-- another buyer, never the public, never an investor.
CREATE POLICY p_interest_volume_parties ON deal.interest_volume FOR SELECT
  TO sylva_buyer, sylva_project_owner
  USING (buyer_org_id = sylva.actor_org_id() OR owner_org_id = sylva.actor_org_id());
CREATE POLICY p_interest_volume_privileged ON deal.interest_volume FOR SELECT
  TO sylva_operator, sylva_auditor USING (true);
-- A buyer writes only its own lines. FINDING-002 is about exactly the check
-- that is missing on record.entry; this policy does not repeat it.
CREATE POLICY p_interest_volume_insert ON deal.interest_volume FOR INSERT
  TO sylva_buyer
  WITH CHECK (buyer_org_id = sylva.actor_org_id());
CREATE POLICY p_interest_volume_insert_op ON deal.interest_volume FOR INSERT
  TO sylva_operator WITH CHECK (true);

-- Column lists only, and requested_raw appears in none of them.
GRANT SELECT (id, deal_id, project_id, buyer_org_id, owner_org_id, unit_type_id,
              period_id, requested_qty, source_label, as_of_date, stated_at)
  ON deal.interest_volume
  TO sylva_buyer, sylva_project_owner, sylva_operator, sylva_auditor;
GRANT INSERT ON deal.interest_volume TO sylva_buyer, sylva_operator;

-- ---------------------------------------------------------------------------
-- 2. The record label, without opening the identity schema.
-- ---------------------------------------------------------------------------
-- record.entry freezes a non-personal label - 'representative #1' - so the
-- record still renders after the person behind it is erased (D3). The label
-- lives in identity.person_label, and no application role holds USAGE, a grant
-- or a policy on anything in identity. So: one more SECURITY DEFINER function,
-- returning ONE column about the CALLER only, granted narrowly, with no table
-- access anywhere near it.
--
-- It resolves through sylva.actor_person_ref(), which reads the HMAC-signed
-- context (0019, FINDING-001). A buyer that forges a context gets NULL from
-- that function and therefore NULL from this one - it cannot ask for somebody
-- else's label by passing an argument, because there is no argument to pass.
CREATE FUNCTION identity.actor_record_label() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity, sylva AS
$$ SELECT l.label
     FROM identity.person_label l
    WHERE l.person_ref = sylva.actor_person_ref() $$;

COMMENT ON FUNCTION identity.actor_record_label() IS
  'The non-personal label this actor is recorded under (D3). Takes no argument '
  'on purpose: it can only ever answer about the caller. Returns NULL for an '
  'unsigned or forged actor context, and the NOT NULL on '
  'record.entry.actor_person_label then refuses the write.';

-- REVOKE ALL ON ALL FUNCTIONS in migration 0016 does not reach a function that
-- did not exist yet, and a new function is EXECUTE-able by PUBLIC by default.
REVOKE ALL ON FUNCTION identity.actor_record_label() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.actor_record_label()
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator;

-- ---------------------------------------------------------------------------
-- 3. Guard: one live deal per (project, buyer) must stay unrepresentable.
-- ---------------------------------------------------------------------------
-- "That opens a private room between that buyer and that project" - singular.
-- The whole of "you already have an open interest in this project" rests on
-- ux_one_live_deal_per_buyer_project being UNIQUE and PARTIAL: unique so two
-- rooms cannot exist, partial so a withdrawn or declined deal does not block a
-- fresh approach for ever. Drop either property and the application still
-- appears to work, quietly opening duplicate rooms under concurrency.
--
-- The check is factored out so it can be pointed at a table that does NOT have
-- the index, which is how the self-test below proves the guard can fail
-- without touching the real one (README §11).
CREATE FUNCTION ci.has_live_deal_uniqueness(p_table regclass) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE i.indrelid = p_table
       AND i.indisunique
       AND i.indpred IS NOT NULL                       -- partial
       AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
              FROM unnest(i.indkey) AS k(attnum)
              JOIN pg_attribute a
                ON a.attrelid = i.indrelid AND a.attnum = k.attnum)
           = ARRAY['buyer_org_id','project_id']
  )
$$;

CREATE FUNCTION ci.assert_one_live_deal_per_buyer_project() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT ci.has_live_deal_uniqueness('deal.deal'::regclass) THEN
    PERFORM ci.fail('one_live_deal_per_buyer_project',
      'deal.deal has no UNIQUE PARTIAL index over (project_id, buyer_org_id); '
      'two live deal rooms for the same buyer on the same project are now possible');
  END IF;
END $$;

COMMENT ON FUNCTION ci.assert_one_live_deal_per_buyer_project() IS
  'Concept note section 7: Express interest opens A private room between that '
  'buyer and that project. Guards ux_one_live_deal_per_buyer_project, which is '
  'what turns a second click into a refusal the interface can explain rather '
  'than a duplicate room nobody notices.';

DO $selftest$
DECLARE ok_real boolean; ok_decoy boolean;
BEGIN
  CREATE TEMP TABLE ci_decoy_deal (project_id uuid, buyer_org_id uuid);
  ok_real  := ci.has_live_deal_uniqueness('deal.deal'::regclass);
  ok_decoy := ci.has_live_deal_uniqueness('ci_decoy_deal'::regclass);
  DROP TABLE ci_decoy_deal;

  IF NOT ok_real THEN
    RAISE EXCEPTION 'ux_one_live_deal_per_buyer_project is missing or no longer unique+partial';
  END IF;
  IF ok_decoy THEN
    RAISE EXCEPTION
      'one-live-deal guard is toothless: it passed a table that has no such index at all';
  END IF;
  RAISE NOTICE 'one-live-deal guard verified: it passes deal.deal and fails a table without the index';
END $selftest$;
