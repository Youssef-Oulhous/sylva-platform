-- ============================================================================
-- A9. DEALS AND THE PRIVATE ROOM  ·  R6, R5 (disclosure)
-- ============================================================================
-- In release one a deal exists only at stage 'interest_expressed' and carries no
-- volume: Express interest opens a room, it does not reserve anything.

CREATE TABLE deal.deal_shape (
  code     text PRIMARY KEY,
  label_en sylva.nonblank NOT NULL
);
INSERT INTO deal.deal_shape VALUES
  ('spot','Spot volume'), ('forward','Forward contract'), ('co_investment','Co-investment');

CREATE TABLE deal.deal_stage (
  code                   text PRIMARY KEY,
  label_en               sylva.nonblank NOT NULL,
  sort_order             int NOT NULL UNIQUE,
  is_terminal            boolean NOT NULL DEFAULT false,
  -- WHICH STAGE STARTS CONSUMING AVAILABILITY IS NOT STATED IN THE NOTE.
  -- It lives here as DATA so the client's answer is a one-row UPDATE, not an
  -- edit to a trigger body or a migration against an append-only table.
  -- The seeded value below is PROVISIONAL and must be confirmed in writing
  -- before the first real commitment is recorded.
  counts_toward_committed boolean NOT NULL DEFAULT false,
  -- true where WE are proposing a stage the note does not name
  is_proposed_addition   boolean NOT NULL DEFAULT false,
  UNIQUE (code, is_terminal),
  UNIQUE (code, counts_toward_committed)
);
INSERT INTO deal.deal_stage (code,label_en,sort_order,is_terminal,counts_toward_committed,is_proposed_addition) VALUES
  ('interest_expressed','Interest expressed',10,false,false,false),
  ('letter_of_intent','Letter of intent',   20,false,false,false),
  ('term_sheet','Term sheet',               30,false,false,false),
  ('signed','Signed',                       40,true, true, false),
  -- PROPOSED BY US, NOT FOUND IN THE NOTE: without a terminal negative a dead
  -- deal has no honest resting state and would have to be deleted, which R4
  -- forbids. Flagged to the client for confirmation.
  ('withdrawn_by_buyer','Withdrawn by buyer',      50,true,false,true),
  ('declined_by_owner','Declined by project owner',60,true,false,true),
  ('declined_by_operator','Declined by Sylva',     70,true,false,true),
  ('lapsed','Lapsed',                              80,true,false,true);

CREATE TABLE deal.deal_stage_transition (
  from_stage         text NOT NULL REFERENCES deal.deal_stage(code),
  to_stage           text NOT NULL REFERENCES deal.deal_stage(code),
  allowed_actor_role text NOT NULL REFERENCES org.actor_role(code),
  PRIMARY KEY (from_stage, to_stage, allowed_actor_role)
);
-- The note's stage marker: "from first interest, through a letter of intent and
-- a term sheet, to signed." Backward steps are explicit recorded events
-- (renegotiation), never a silent rollback.
INSERT INTO deal.deal_stage_transition VALUES
  ('interest_expressed','letter_of_intent','buyer'),
  ('interest_expressed','letter_of_intent','project_owner'),
  ('letter_of_intent','term_sheet','buyer'),
  ('letter_of_intent','term_sheet','project_owner'),
  ('term_sheet','letter_of_intent','buyer'),
  ('term_sheet','letter_of_intent','project_owner'),
  -- signature happens OUTSIDE the platform; the signed document is uploaded
  ('term_sheet','signed','project_owner'),
  ('term_sheet','signed','operator'),
  ('interest_expressed','withdrawn_by_buyer','buyer'),
  ('letter_of_intent','withdrawn_by_buyer','buyer'),
  ('term_sheet','withdrawn_by_buyer','buyer'),
  ('interest_expressed','declined_by_owner','project_owner'),
  ('letter_of_intent','declined_by_owner','project_owner'),
  ('term_sheet','declined_by_owner','project_owner'),
  ('interest_expressed','declined_by_operator','operator'),
  ('letter_of_intent','declined_by_operator','operator'),
  ('term_sheet','declined_by_operator','operator'),
  ('interest_expressed','lapsed','operator'),
  ('letter_of_intent','lapsed','operator'),
  ('term_sheet','lapsed','operator');

CREATE TABLE deal.deal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL,
  owner_org_id   uuid NOT NULL,
  buyer_org_id   uuid NOT NULL REFERENCES org.organisation(id),
  intended_shape text REFERENCES deal.deal_shape(code),   -- NULL in release one
  -- both caches; written ONLY by SECURITY DEFINER triggers from the append-only
  -- event chains below. No application role holds UPDATE on this table.
  stage             text NOT NULL DEFAULT 'interest_expressed',
  stage_is_terminal boolean NOT NULL DEFAULT false,
  disclosed         boolean NOT NULL DEFAULT false,
  opened_at         timestamptz NOT NULL DEFAULT now(),
  -- anchors used by every child row so RLS is zero-hop and cannot drift
  UNIQUE (id, project_id),
  UNIQUE (id, buyer_org_id),
  UNIQUE (id, project_id, buyer_org_id, owner_org_id),
  CONSTRAINT deal_project_owner_fk FOREIGN KEY (project_id, owner_org_id)
    REFERENCES proj.project (id, owner_org_id),
  CONSTRAINT deal_stage_terminal_fk FOREIGN KEY (stage, stage_is_terminal)
    REFERENCES deal.deal_stage (code, is_terminal),
  CONSTRAINT deal_buyer_is_not_the_owner CHECK (buyer_org_id <> owner_org_id)
);
-- one live room per (project, buyer): "That opens a private room between that
-- buyer and that project." Whether a buyer may run parallel rooms for different
-- deal shapes is an OPEN DECISION.
CREATE UNIQUE INDEX ux_one_live_deal_per_buyer_project
  ON deal.deal (project_id, buyer_org_id) WHERE NOT stage_is_terminal;
CREATE INDEX ix_deal_buyer ON deal.deal (buyer_org_id);   -- RLS predicate column
CREATE INDEX ix_deal_owner ON deal.deal (owner_org_id);   -- RLS predicate column
CREATE INDEX ix_deal_project ON deal.deal (project_id);

ALTER TABLE doc.document
  ADD CONSTRAINT document_deal_fk FOREIGN KEY (deal_id, project_id)
  REFERENCES deal.deal (id, project_id);
ALTER TABLE doc.document
  ADD CONSTRAINT document_deal_orgs_fk
  FOREIGN KEY (deal_id, project_id, deal_buyer_org_id, deal_owner_org_id)
  REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id);

-- ========================== R6 LIVES HERE ==================================
-- Evaluated at INSERT ONLY and never re-evaluated over history, so a later
-- suspension or revocation blocks every NEW deal while leaving existing deals,
-- record entries and holdings intact and readable - nothing is retracted.
-- Deliberately NOT a foreign key to the append-only decision chain: a FK would
-- be satisfied for ever by a historical 'approved' row, so a REVOKED
-- organisation could keep opening deals.
-- FOR SHARE on the approval row is what closes the race: the revocation path
-- UPDATEs that same row, so a revoke and a deal insert cannot interleave.
CREATE FUNCTION deal.enforce_r6_and_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, org, proj, deal AS
$f$
DECLARE v_status text; v_pub proj.publication_status;
BEGIN
  SELECT a.status INTO v_status
    FROM org.org_role_approval a
   WHERE a.org_id = NEW.buyer_org_id AND a.role_code = 'buyer'
   FOR SHARE;
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION
      'R6: organisation % is not an approved buyer (status: %); no deal can be created for it',
      NEW.buyer_org_id, coalesce(v_status, 'no decision on record')
      USING ERRCODE = 'SY006';
  END IF;

  SELECT p.status INTO v_pub FROM proj.project p WHERE p.id = NEW.project_id FOR SHARE;
  IF v_pub IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION
      'A deal can only be opened against a published project (project status: %)', v_pub
      USING ERRCODE = 'SY009';
  END IF;

  PERFORM org.allocate_pseudonym(NEW.project_id, NEW.buyer_org_id);
  RETURN NEW;
END $f$;
CREATE TRIGGER t_deal_r6 BEFORE INSERT ON deal.deal
  FOR EACH ROW EXECUTE FUNCTION deal.enforce_r6_and_publication();
ALTER TABLE deal.deal ENABLE ALWAYS TRIGGER t_deal_r6;

-- --------------------------------------------------- APPEND-ONLY STAGE CHAIN
CREATE TABLE deal.deal_stage_event (
  entry_no      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id       uuid NOT NULL,
  project_id    uuid NOT NULL,
  buyer_org_id  uuid NOT NULL,
  owner_org_id  uuid NOT NULL,
  from_stage    text NOT NULL,
  to_stage      text NOT NULL,
  actor_role    text NOT NULL,
  actor_org_id  uuid NOT NULL REFERENCES org.organisation(id),
  actor_person_ref uuid,                      -- opaque; NO FK
  document_version_id uuid REFERENCES doc.document_version(id),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  -- an illegal transition is a FOREIGN KEY violation against a lookup table, not
  -- trigger logic: changing what is allowed is a data change
  FOREIGN KEY (from_stage, to_stage, actor_role)
    REFERENCES deal.deal_stage_transition (from_stage, to_stage, allowed_actor_role),
  FOREIGN KEY (deal_id, project_id, buyer_org_id, owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id)
);
CREATE INDEX ix_stage_event_deal  ON deal.deal_stage_event (deal_id, entry_no DESC);
CREATE INDEX ix_stage_event_buyer ON deal.deal_stage_event (buyer_org_id);
CREATE INDEX ix_stage_event_owner ON deal.deal_stage_event (owner_org_id);

CREATE FUNCTION deal.apply_stage_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, deal AS
$f$
DECLARE v_cur text; v_terminal boolean;
BEGIN
  SELECT d.stage INTO v_cur FROM deal.deal d WHERE d.id = NEW.deal_id FOR UPDATE;
  IF v_cur IS DISTINCT FROM NEW.from_stage THEN
    RAISE EXCEPTION 'deal % is at stage %, not %; refusing a stale stage change',
      NEW.deal_id, v_cur, NEW.from_stage USING ERRCODE = 'SY005';
  END IF;
  SELECT s.is_terminal INTO v_terminal FROM deal.deal_stage s WHERE s.code = NEW.to_stage;
  UPDATE deal.deal SET stage = NEW.to_stage, stage_is_terminal = v_terminal
   WHERE id = NEW.deal_id;
  RETURN NULL;
END $f$;
CREATE TRIGGER t_apply_stage_event AFTER INSERT ON deal.deal_stage_event
  FOR EACH ROW EXECUTE FUNCTION deal.apply_stage_event();
ALTER TABLE deal.deal_stage_event ENABLE ALWAYS TRIGGER t_apply_stage_event;

-- ------------------------------------------------- R5: PER-DEAL DISCLOSURE
-- "Participation is anonymous by default, and naming is the buyer's choice,
-- deal by deal." Append-only, so withdrawing disclosure applies FORWARD ONLY and
-- entries already published under the real name are not rewritten (R4).
CREATE TABLE deal.deal_disclosure_event (
  entry_no          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id           uuid NOT NULL,
  project_id        uuid NOT NULL,
  buyer_org_id      uuid NOT NULL,
  owner_org_id      uuid NOT NULL,
  disclosed         boolean NOT NULL,
  decided_by_org_id uuid NOT NULL REFERENCES org.organisation(id),
  decided_by_person_ref uuid,
  decided_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (deal_id, decided_at),
  FOREIGN KEY (deal_id, project_id, buyer_org_id, owner_org_id)
    REFERENCES deal.deal (id, project_id, buyer_org_id, owner_org_id),
  -- only the buyer on the deal may decide its disclosure
  CONSTRAINT disclosure_decided_by_the_buyer CHECK (decided_by_org_id = buyer_org_id)
);
CREATE INDEX ix_disclosure_deal ON deal.deal_disclosure_event (deal_id, decided_at DESC);
CREATE INDEX ix_disclosure_buyer ON deal.deal_disclosure_event (buyer_org_id);
CREATE INDEX ix_disclosure_owner ON deal.deal_disclosure_event (owner_org_id);

CREATE FUNCTION deal.apply_disclosure_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, deal AS
$f$
BEGIN
  UPDATE deal.deal SET disclosed = NEW.disclosed WHERE id = NEW.deal_id;
  RETURN NULL;
END $f$;
CREATE TRIGGER t_apply_disclosure_event AFTER INSERT ON deal.deal_disclosure_event
  FOR EACH ROW EXECUTE FUNCTION deal.apply_disclosure_event();
ALTER TABLE deal.deal_disclosure_event ENABLE ALWAYS TRIGGER t_apply_disclosure_event;

-- --------------------------------------------------- THE PRIVATE QUESTION BOX
-- "Questions go to the project owner and to us, not to a public comment feed."
CREATE TABLE deal.project_question (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id      uuid NOT NULL REFERENCES proj.project(id),
  owner_org_id    uuid NOT NULL,
  asker_org_id    uuid NOT NULL REFERENCES org.organisation(id),
  asker_person_ref uuid,
  body            sylva.nonblank NOT NULL,
  asked_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, owner_org_id) REFERENCES proj.project (id, owner_org_id)
);
CREATE INDEX ix_question_project ON deal.project_question (project_id);
CREATE INDEX ix_question_asker   ON deal.project_question (asker_org_id);
CREATE INDEX ix_question_owner   ON deal.project_question (owner_org_id);

-- an answer is a new append-only row, never an edit of the question
CREATE TABLE deal.project_question_answer (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id      bigint NOT NULL REFERENCES deal.project_question(id),
  answered_by_org_id uuid NOT NULL REFERENCES org.organisation(id),
  answered_by_person_ref uuid,
  body             sylva.nonblank NOT NULL,
  answered_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_question_answer_q ON deal.project_question_answer (question_id);
