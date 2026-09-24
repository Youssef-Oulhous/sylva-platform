-- ============================================================================
-- A13. THE ONLY WAY A QUANTITY LEAVES THE DATABASE
-- ============================================================================
-- security_invoker = true on every quantity view, so the CALLER's row-level
-- policies decide which rows they see. The column privilege (no role holds
-- SELECT on any *_raw column) decides what shape the number comes back in.
-- There is deliberately no v_total_*, no v_portfolio_* and no endpoint that
-- returns a volume without project_id and unit_type_id beside it.

CREATE VIEW proj.v_period_availability WITH (security_invoker = true, security_barrier = true) AS
SELECT b.project_id,
       b.unit_type_id,
       b.period_id,
       p.label                 AS period_label,
       p.starts_on,
       p.ends_on,
       ut.code                 AS unit_type_code,
       ut.metric_label_en      AS unit_metric_label,
       ut.unit_of_measure,
       ut.vintage_semantics,
       b.expected_issuance_qty,
       b.buffer_qty,
       b.committed_qty,
       b.remaining_qty,
       f.as_of_date            AS forecast_as_of_date,
       f.source_ref_id         AS forecast_source_ref_id,
       b.updated_at
  FROM proj.period_balance b
  JOIN proj.period      p  ON p.id  = b.period_id
  JOIN units.unit_type  ut ON ut.id = b.unit_type_id
  JOIN proj.period_forecast f ON f.id = b.effective_forecast_id;
COMMENT ON VIEW proj.v_period_availability IS
  'Section 6 verbatim: expected issuance, buffer, committed, remaining - per period, per project, never totalled across projects. NOTE FOR THE CLIENT: publishing any three of expected/buffer/committed/remaining discloses the fourth by subtraction, so with one or two buyers per pilot project an observer can attribute an individual deal volume. That is an OPEN DECISION, not something to be silently "solved" by hiding one column.';

CREATE VIEW proj.v_pending_forecast_revision WITH (security_invoker = true, security_barrier = true) AS
SELECT f.id, f.project_id, f.unit_type_id, f.period_id,
       f.expected_issuance_qty, f.buffer_qty, f.sellable_qty,
       f.as_of_date, f.source_ref_id, f.blocked_reason, f.recorded_at
  FROM proj.period_forecast f
 WHERE f.effective = false;
COMMENT ON VIEW proj.v_pending_forecast_revision IS
  'A downward revision that would breach R1 is RECORDED and shown here with its date and reason, rather than refused. The record therefore never stops reflecting reality, and R1 still holds at every instant.';

-- ---------------------------------------------- R5: THE PUBLIC RECORD
-- Owned by sylva_record, a NOLOGIN role that owns THESE VIEWS AND NOTHING ELSE
-- and holds an enumerated grant list. It is the only role besides the operator
-- and the auditor that can resolve a real legal name, and it can only do so
-- through this view, which applies the disclosure test.
-- sylva_record needs CREATE on the schema only long enough to take ownership of
-- this one view; it is revoked immediately afterwards.
GRANT CREATE ON SCHEMA record TO sylva_record;
CREATE VIEW record.v_public_entry WITH (security_barrier = true) AS
SELECT e.public_id,
       e.occurred_at,
       e.entry_type,
       et.label_en                              AS entry_label,
       e.project_id,
       pr.slug                                  AS project_slug,
       -- the counterparty the public sees
       CASE WHEN cp.org_id IS NULL THEN NULL
            WHEN cp.is_named THEN cp.legal_name
            ELSE ps.label END                   AS counterparty_label,
       coalesce(cp.is_named, false)             AS counterparty_is_named,
       cp.sector_code, cp.country_code, cp.size_band_code,
       e.actor_role_snapshot,
       e.actor_person_label,
       corrected.public_id                      AS corrects_entry_public_id,
       e.correction_reason,
       EXISTS (SELECT 1 FROM record.entry c WHERE c.corrects_entry_no = e.entry_no)
                                                AS is_superseded,
       e.source_ref_id
  FROM record.entry e
  JOIN record.entry_type et ON et.code = e.entry_type AND et.is_public
  JOIN proj.project pr      ON pr.id = e.project_id
                           AND pr.status IN ('published','withdrawn','archived')
  LEFT JOIN record.entry corrected ON corrected.entry_no = e.corrects_entry_no
  LEFT JOIN LATERAL (
       -- who the entry is about, and whether that party was named AT THE TIME
       SELECT o.id AS org_id, o.legal_name, o.sector_code, o.country_code, o.size_band_code,
              CASE WHEN e.deal_id IS NOT NULL
                   THEN coalesce((SELECT de.disclosed
                                    FROM deal.deal_disclosure_event de
                                   WHERE de.deal_id = e.deal_id
                                     AND de.decided_at <= e.occurred_at
                                   ORDER BY de.decided_at DESC, de.entry_no DESC
                                   LIMIT 1), false)
                   -- the project owner is named publicly on its own project page
                   ELSE (e.actor_org_id = pr.owner_org_id) END AS is_named
         FROM org.organisation o
        WHERE o.id = coalesce(e.deal_buyer_org_id, e.actor_org_id)) cp ON true
  LEFT JOIN org.organisation_pseudonym ps
         ON ps.project_id = e.project_id AND ps.org_id = cp.org_id;
ALTER VIEW record.v_public_entry OWNER TO sylva_record;
REVOKE CREATE ON SCHEMA record FROM sylva_record;
COMMENT ON VIEW record.v_public_entry IS
  'No volume column and no price column, by design. Identity is resolved AS OF each entry''s own timestamp, so withdrawing disclosure applies forward only and nothing already published is rewritten (R4). No WHERE clause removes a corrected entry: the wrong one stays visible, flagged is_superseded and linked to its correction.';

-- The project owner must know who it is negotiating with, but must NOT hold the
-- legal_name column privilege. One narrow, auditable door instead.
-- VOLATILE, not STABLE: it writes an access-log row, and a non-volatile
-- function may not INSERT. Reading a counterparty's real name is exactly the
-- kind of read that must leave a trace.
CREATE FUNCTION deal.counterparty_legal_name(p_deal_id uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, deal, org, record, sylva AS
$f$
DECLARE v_name text; v_buyer uuid;
BEGIN
  SELECT o.legal_name, d.buyer_org_id INTO v_name, v_buyer
    FROM deal.deal d JOIN org.organisation o ON o.id = d.buyer_org_id
   WHERE d.id = p_deal_id
     AND (d.owner_org_id = sylva.actor_org_id() OR sylva.is_privileged_reader());
  IF v_name IS NULL THEN RETURN NULL; END IF;
  INSERT INTO record.access_log (actor_org_id, actor_person_ref, actor_db_role, action, object_kind, object_id)
  VALUES (sylva.actor_org_id(), sylva.actor_person_ref(), current_user,
          'counterparty_name_read', 'deal', p_deal_id::text);
  RETURN v_name;
END $f$;
COMMENT ON FUNCTION deal.counterparty_legal_name(uuid) IS
  'OPEN DECISION: the note confirms Sylva and auditors see real names and is silent on the project owner. Implemented so the owner sees the buyer''s real name from the moment the room opens, because it cannot negotiate otherwise, and the vetting questionnaire must state this to the buyer. Other buyers: never, at any stage.';

-- Writing the access log goes through one definer function; no role holds a
-- direct INSERT on record.access_log.
CREATE FUNCTION record.log_access(p_action text, p_object_kind text, p_object_id text,
                                  p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, record, sylva AS
$$ INSERT INTO record.access_log (actor_org_id, actor_person_ref, actor_db_role, action, object_kind, object_id, detail)
   VALUES (sylva.actor_org_id(), sylva.actor_person_ref(), current_user, p_action, p_object_kind, p_object_id, p_detail) $$;

-- The one self-read path into the personal-data table. No app role holds SELECT
-- on identity.user_account at all.
CREATE FUNCTION identity.whoami()
RETURNS TABLE (user_id uuid, org_id uuid, email text, full_name text, locale text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, identity, sylva AS
$$ SELECT u.id, u.org_id, u.email::text, u.full_name, u.locale
     FROM identity.user_account u
    WHERE u.person_ref = sylva.actor_person_ref() $$;
