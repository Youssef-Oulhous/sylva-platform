-- ============================================================================
-- A11. PUBLICATION GATE  ·  the screen and the database read the same list
-- ============================================================================
CREATE FUNCTION proj.publication_gaps(p_project_id uuid) RETURNS text[]
LANGUAGE sql STABLE AS
$$
  SELECT array_remove(ARRAY[
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM proj.project_text t JOIN proj.text_field f ON f.code = t.field_code
       WHERE t.project_id = p_project_id AND t.locale = 'en'
         AND f.required_for_publication AND t.status = 'published'
       GROUP BY t.field_code
      HAVING count(*) > 0)
      THEN 'english_page_text' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM geo.project_geometry g
      WHERE g.project_id = p_project_id AND g.kind = 'boundary') THEN 'boundary' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM proj.claim_right c
      WHERE c.project_id = p_project_id) THEN 'claim_rights' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM proj.outcome_indicator o
      WHERE o.project_id = p_project_id) THEN 'outcomes' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM proj.indicator_value v
      WHERE v.project_id = p_project_id AND v.value_kind = 'baseline') THEN 'outcome_baseline' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM proj.durability_commitment d
      WHERE d.project_id = p_project_id) THEN 'durability' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM proj.project_party pp
      WHERE pp.project_id = p_project_id AND pp.party_role = 'verifier') THEN 'verifier' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM doc.document d
      WHERE d.project_id = p_project_id AND d.kind = 'project_idea_note') THEN 'project_idea_note' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM doc.document d
      WHERE d.project_id = p_project_id AND d.kind = 'project_design_document') THEN 'project_design_document' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM proj.period_balance b
      WHERE b.project_id = p_project_id) THEN 'availability' END
  ], NULL)
$$;
COMMENT ON FUNCTION proj.publication_gaps(uuid) IS
  'The minimum set is taken from concept note section 6. WHICH items are hard blockers and which are warnings is an OPEN DECISION for the client.';

CREATE FUNCTION proj.enforce_publication_gate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, proj AS
$f$
DECLARE v_gaps text[];
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    v_gaps := proj.publication_gaps(NEW.id);
    IF array_length(v_gaps,1) > 0 THEN
      RAISE EXCEPTION 'project % cannot be published; missing: %',
        NEW.id, array_to_string(v_gaps, ', ') USING ERRCODE = 'SY008';
    END IF;
    NEW.published_at := coalesce(NEW.published_at, now());
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER t_publication_gate BEFORE UPDATE ON proj.project
  FOR EACH ROW EXECUTE FUNCTION proj.enforce_publication_gate();
ALTER TABLE proj.project ENABLE ALWAYS TRIGGER t_publication_gate;
