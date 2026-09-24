-- A0. Extensions, roles, schemas, domains, the unit_qty spine, helpers
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid, digest
CREATE EXTENSION IF NOT EXISTS citext;       -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- uuid = in the period EXCLUDE
CREATE EXTENSION IF NOT EXISTS postgis;      -- geometry(...,4326)

-- ---------------------------------------------------------------- A0.1 ROLES
-- The coarse privilege boundary is the DATABASE ROLE, never a session variable.
-- Persona roles are NOLOGIN. Each connection pool logs in as its own LOGIN role
-- and SET ROLEs to exactly one persona. No login role is a member of a persona
-- it must not reach, so SET ROLE cannot climb a tier.
DO $roles$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'sylva_owner',            -- owns every object; migrations only; NOLOGIN
    'sylva_record',           -- owns the public-record views ONLY; NOLOGIN
    'sylva_web_anon','sylva_buyer','sylva_project_owner','sylva_investor',
    'sylva_operator','sylva_auditor','sylva_report'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY[
    'sylva_login_public','sylva_login_app','sylva_login_operator',
    'sylva_login_auditor','sylva_login_report','sylva_login_migrate'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', r);
    END IF;
  END LOOP;
END $roles$;

-- One pool per tier. The public pool can never become an operator.
GRANT sylva_web_anon                                        TO sylva_login_public;
GRANT sylva_buyer, sylva_project_owner, sylva_investor      TO sylva_login_app;
GRANT sylva_operator                                        TO sylva_login_operator;
GRANT sylva_auditor                                         TO sylva_login_auditor;
GRANT sylva_report                                          TO sylva_login_report;
GRANT sylva_owner                                           TO sylva_login_migrate;
-- the migration role owns the public-record views, so it must be able to hand
-- ownership to sylva_record
GRANT sylva_record                                          TO sylva_owner;

-- ------------------------------------------------------------- A0.2 SCHEMAS
CREATE SCHEMA IF NOT EXISTS sylva    AUTHORIZATION sylva_owner;  -- types, helpers, provenance
CREATE SCHEMA IF NOT EXISTS identity AUTHORIZATION sylva_owner;  -- the ONLY personal data
CREATE SCHEMA IF NOT EXISTS org      AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS units    AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS proj     AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS geo      AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS doc      AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS deal     AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS credit   AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS record   AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS i18n     AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS platform AUTHORIZATION sylva_owner;
CREATE SCHEMA IF NOT EXISTS ci       AUTHORIZATION sylva_owner;

-- Extensions live in public. Nobody may CREATE there; everybody needs USAGE so
-- the citext / geometry types resolve.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT  USAGE  ON SCHEMA public TO PUBLIC;

-- Everything from here on is created BY sylva_owner, so sylva_owner owns every
-- object and FORCE ROW LEVEL SECURITY genuinely binds it. Only the statements
-- above (CREATE EXTENSION, CREATE ROLE) need a superuser.
SET ROLE sylva_owner;

GRANT USAGE ON SCHEMA sylva, org, units, proj, geo, doc, deal, credit, record,
                      i18n, platform
  TO sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
     sylva_operator, sylva_auditor, sylva_report, sylva_record;
-- identity is reachable only by the operator and the auditor. Never by the app
-- roles, never by the public role, never by the record-view owner.
GRANT USAGE ON SCHEMA identity TO sylva_operator, sylva_auditor;
GRANT USAGE ON SCHEMA ci       TO sylva_operator, sylva_auditor;

-- ------------------------------------------------------------- A0.3 DOMAINS
-- Non-blank is a domain, not a habit: every evidential text column uses it, so
-- a NOT NULL cannot be satisfied with '' or '   '.
CREATE DOMAIN sylva.nonblank     AS text    CHECK (btrim(VALUE) <> '');
CREATE DOMAIN sylva.country_code AS char(2) CHECK (VALUE ~ '^[A-Z]{2}$');
CREATE DOMAIN sylva.sha256       AS bytea   CHECK (octet_length(VALUE) = 32);
-- Exact decimal only. A CI assertion fails the build on any float4/float8.
CREATE DOMAIN sylva.unit_amount  AS numeric(20,6) CHECK (VALUE >= 0);
CREATE DOMAIN sylva.money_amount AS numeric(20,2);

-- ---------------------------------------------- A0.4 R7: THE QUANTITY SPINE
-- A volume is never a bare number that leaves the database. Raw amount columns
-- are named *_raw and are granted to NO role; every readable quantity is this
-- composite, for which PostgreSQL defines no sum(), so `SELECT sum(qty) ...`
-- fails at PARSE time (42883) and can never return a plausible wrong number.
CREATE TYPE sylva.unit_qty AS (
  project_id   uuid,
  unit_type_id uuid,
  amount       numeric(20,6)
);

CREATE FUNCTION sylva.qty(p_project_id uuid, p_unit_type_id uuid, p_amount numeric)
RETURNS sylva.unit_qty LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT ROW(p_project_id, p_unit_type_id, p_amount)::sylva.unit_qty $$;

CREATE FUNCTION sylva.qty_add(a sylva.unit_qty, b sylva.unit_qty)
RETURNS sylva.unit_qty LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS
$f$
BEGIN
  IF a IS NULL THEN RETURN b; END IF;
  IF b IS NULL THEN RETURN a; END IF;
  IF a.project_id IS DISTINCT FROM b.project_id THEN
    RAISE EXCEPTION
      'R7: refusing to add unit volumes across projects (% and %)', a.project_id, b.project_id
      USING ERRCODE = 'SY007',
            HINT = 'Units of different projects are not interchangeable. Add project_id to GROUP BY.';
  END IF;
  IF a.unit_type_id IS DISTINCT FROM b.unit_type_id THEN
    RAISE EXCEPTION
      'R7: refusing to add unit volumes across unit types (% and %)', a.unit_type_id, b.unit_type_id
      USING ERRCODE = 'SY007',
            HINT = 'Units of different unit types are not interchangeable. Add unit_type_id to GROUP BY.';
  END IF;
  RETURN ROW(a.project_id, a.unit_type_id, a.amount + b.amount)::sylva.unit_qty;
END $f$;

-- The ONLY aggregate over a quantity anywhere in the database.
CREATE AGGREGATE sylva.sum_same_unit(sylva.unit_qty) (
  SFUNC = sylva.qty_add, STYPE = sylva.unit_qty,
  COMBINEFUNC = sylva.qty_add, PARALLEL = SAFE
);

-- The deliberate, greppable escape hatch. Honest: a determined caller can still
-- write sum((qty).amount). That is caught by CI lint and review, not by Postgres.
CREATE FUNCTION sylva.qty_amount(q sylva.unit_qty) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT q.amount $$;

-- There is deliberately NO conversion function, NO equivalence table, NO co2e
-- column and NO ratio anywhere in this schema. ci.assert_no_conversion() proves it.

-- --------------------------------------------------- A0.5 SESSION HELPERS
-- current_user is the database role. It cannot be forged from inside a session.
-- The org GUC narrows WITHIN a tier and is set with SET LOCAL inside the request
-- transaction. See the open decision on GUC forgeability: REVOKE SET ON PARAMETER
-- is a no-op for custom placeholder parameters in PostgreSQL 16 (verified), so
-- the org GUC is not a boundary against arbitrary SQL execution - the ROLE is.
CREATE FUNCTION sylva.actor_org_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('sylva.actor_org_id', true), '')::uuid $$;

CREATE FUNCTION sylva.actor_person_ref() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('sylva.actor_person_ref', true), '')::uuid $$;

CREATE FUNCTION sylva.is_operator() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT current_user = 'sylva_operator' $$;

CREATE FUNCTION sylva.is_auditor() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT current_user = 'sylva_auditor' $$;

CREATE FUNCTION sylva.is_privileged_reader() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT current_user IN ('sylva_operator','sylva_auditor') $$;

CREATE FUNCTION sylva.is_record_publisher() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT current_user = 'sylva_record' $$;

-- ------------------------------------------------- A0.6 R4: THE ONE GUARD
CREATE FUNCTION sylva.deny_mutation() RETURNS trigger LANGUAGE plpgsql AS
$f$
BEGIN
  RAISE EXCEPTION
    'R4: %.% is append-only; % is never permitted. Correct a mistake by INSERTing a new entry that points at the wrong one; the wrong one stays visible.',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'SY004';
  RETURN NULL;
END $f$;

-- Applies privilege + row trigger + statement trigger + TRUNCATE trigger +
-- ENABLE ALWAYS + FORCE RLS to one table. Called once per append-only table, so
-- table N+1 cannot silently miss a layer. ENABLE ALWAYS keeps the guard firing
-- under session_replication_role = 'replica' (a bulk-load / logical-replication
-- path); the statement-level trigger catches a zero-row UPDATE ... WHERE false,
-- which a FOR EACH ROW trigger lets through silently.
CREATE FUNCTION sylva.make_append_only(p_table regclass) RETURNS void
LANGUAGE plpgsql AS
$f$
BEGIN
  EXECUTE format('CREATE TRIGGER t_append_only_row BEFORE UPDATE OR DELETE ON %s
                  FOR EACH ROW EXECUTE FUNCTION sylva.deny_mutation()', p_table);
  EXECUTE format('CREATE TRIGGER t_append_only_stmt BEFORE UPDATE OR DELETE ON %s
                  FOR EACH STATEMENT EXECUTE FUNCTION sylva.deny_mutation()', p_table);
  EXECUTE format('CREATE TRIGGER t_append_only_trunc BEFORE TRUNCATE ON %s
                  FOR EACH STATEMENT EXECUTE FUNCTION sylva.deny_mutation()', p_table);
  EXECUTE format('ALTER TABLE %s ENABLE ALWAYS TRIGGER t_append_only_row',   p_table);
  EXECUTE format('ALTER TABLE %s ENABLE ALWAYS TRIGGER t_append_only_stmt',  p_table);
  EXECUTE format('ALTER TABLE %s ENABLE ALWAYS TRIGGER t_append_only_trunc', p_table);
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM PUBLIC', p_table);
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM
                  sylva_web_anon, sylva_buyer, sylva_project_owner, sylva_investor,
                  sylva_operator, sylva_auditor, sylva_report, sylva_record', p_table);
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE  ROW LEVEL SECURITY', p_table);
END $f$;

-- ------------------------------------------- A0.7 PROVENANCE (section 9)
-- Every figure on screen carries its source and its date. That is a schema rule
-- here, not a UI convention: the provenance row is a mandatory FK on every
-- figure-bearing table, and ci.assert_figures_have_provenance() proves it.
CREATE TYPE sylva.source_kind AS ENUM
  ('document','external_publication','operator_statement','calculated_by_sylva');

CREATE TABLE sylva.source_ref (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                sylva.source_kind NOT NULL,
  label               sylva.nonblank NOT NULL,
  document_version_id uuid,                    -- FK added after doc.document_version
  locator             text,                    -- page / section / table number
  source_url          text,
  as_of_date          date NOT NULL,
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_document_present
    CHECK (kind <> 'document' OR document_version_id IS NOT NULL)
);
COMMENT ON TABLE sylva.source_ref IS
  'Provenance for every displayed figure. kind=calculated_by_sylva carries a one-line definition in label plus the computation date, so "computed by us" is itself a stated source.';
