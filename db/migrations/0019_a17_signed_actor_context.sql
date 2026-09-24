-- ============================================================================
-- A17. SIGNED ACTOR CONTEXT  ·  fix for FINDING-001
--
-- Before this migration the actor's organisation came from a bare GUC:
--
--     SELECT nullif(current_setting('sylva.actor_org_id', true), '')::uuid
--
-- Any principal able to execute SQL in the session could re-SET that GUC and
-- read another organisation's rows. Verified live on PostgreSQL 16.10:
-- sylva_buyer, connected with a valid context for organisation A, re-set the
-- GUC to organisation B and read B's private buyer_site row.
--
-- The role half of the model was never forgeable, because is_operator() and
-- is_auditor() test current_user, which a role cannot change without being
-- granted the target role. Only the organisation half was.
--
-- The fix keeps a GUC - it is the only per-transaction channel a pooled
-- connection has - but makes its contents unforgeable. The application sends
-- ONE value:
--
--     org_id : person_ref : expiry_epoch : hmac_sha256_hex
--
-- and the resolver verifies the MAC inside a SECURITY DEFINER function whose
-- signing key lives in a table that no application role may read. A buyer can
-- still SET the GUC. It cannot produce a valid MAC for an organisation it does
-- not belong to, and cannot read the key in order to make one.
--
-- Rules touched: none directly. This protects the row-level security that
-- carries R5 (pseudonymity), the deal-room isolation the note calls "the
-- failure we most need to avoid", and every org-scoped policy in A15.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The signing key. Owned by sylva_owner, granted to nobody.
-- The deployment generates the key; the placeholder below is refused at runtime.
-- ---------------------------------------------------------------------------
CREATE TABLE sylva.context_key (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  key         bytea NOT NULL CHECK (length(key) >= 32),
  rotated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT context_key_is_singleton CHECK (id = 1)
);

COMMENT ON TABLE sylva.context_key IS
  'HMAC key for the signed actor context. No application role has any privilege '
  'on this table; sylva.actor_ctx() reads it as SECURITY DEFINER. Rotating the '
  'key invalidates every outstanding context immediately, which is the intended '
  'emergency control.';

REVOKE ALL ON sylva.context_key FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- The resolver. Parses and verifies once; the two public accessors read it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION sylva.actor_ctx()
RETURNS TABLE (org_id uuid, person_ref uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, sylva
AS $$
DECLARE
  raw   text;
  parts text[];
  k     bytea;
  want  text;
BEGIN
  raw := nullif(current_setting('sylva.actor_ctx', true), '');
  IF raw IS NULL THEN RETURN; END IF;

  parts := string_to_array(raw, ':');
  IF array_length(parts, 1) <> 4 THEN RETURN; END IF;

  -- Expiry first: a captured context stops working on its own.
  IF parts[3] !~ '^[0-9]+$' THEN RETURN; END IF;
  IF to_timestamp(parts[3]::bigint) < now() THEN RETURN; END IF;

  SELECT key INTO k FROM sylva.context_key WHERE id = 1;
  IF k IS NULL THEN RETURN; END IF;

  want := encode(
    public.hmac(convert_to(parts[1] || ':' || parts[2] || ':' || parts[3], 'UTF8'),
                k, 'sha256'::text),
    'hex');

  -- Constant-time-ish: compare full digests, never prefixes.
  IF length(parts[4]) <> length(want) THEN RETURN; END IF;
  IF parts[4] <> want THEN RETURN; END IF;

  BEGIN
    org_id     := parts[1]::uuid;
    person_ref := nullif(parts[2], '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN;
  END;

  RETURN NEXT;
END $$;

COMMENT ON FUNCTION sylva.actor_ctx() IS
  'Verifies the signed actor context. Returns no row for a missing, malformed, '
  'expired or forged context, so every caller degrades to "no organisation" '
  'rather than to someone else''s organisation.';

-- ---------------------------------------------------------------------------
-- Replace the two forgeable accessors. Signatures are unchanged, so every
-- policy written in A15 picks up the fix without being rewritten.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sylva.actor_org_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, sylva AS
$$ SELECT org_id FROM sylva.actor_ctx() $$;

CREATE OR REPLACE FUNCTION sylva.actor_person_ref() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, sylva AS
$$ SELECT person_ref FROM sylva.actor_ctx() $$;

-- ---------------------------------------------------------------------------
-- Minting. Called by the application's login role only, once per request,
-- after the application has itself established who the user is.
-- ---------------------------------------------------------------------------
CREATE FUNCTION sylva.mint_actor_ctx(
  p_org_id      uuid,
  p_person_ref  uuid,
  p_ttl         interval DEFAULT '15 minutes'
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, sylva
AS $$
DECLARE k bytea; exp bigint; body text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'mint_actor_ctx: organisation is required';
  END IF;
  SELECT key INTO k FROM sylva.context_key WHERE id = 1;
  IF k IS NULL THEN
    RAISE EXCEPTION 'mint_actor_ctx: no signing key; run the key bootstrap';
  END IF;
  exp  := extract(epoch FROM (now() + p_ttl))::bigint;
  body := p_org_id::text || ':' || coalesce(p_person_ref::text, '') || ':' || exp;
  RETURN body || ':' ||
         encode(public.hmac(convert_to(body, 'UTF8'), k, 'sha256'::text), 'hex');
END $$;

REVOKE ALL ON FUNCTION sylva.mint_actor_ctx(uuid, uuid, interval) FROM PUBLIC;

-- Only the login roles mint. The privilege roles that actually read data
-- (sylva_buyer, sylva_investor, sylva_project_owner) never can, so a compromised
-- query surface cannot mint itself a context for another organisation.
GRANT EXECUTE ON FUNCTION sylva.mint_actor_ctx(uuid, uuid, interval)
  TO sylva_login_app, sylva_login_operator;

-- ---------------------------------------------------------------------------
-- CI assertions. These are the guarantees, restated as tests.
-- ---------------------------------------------------------------------------
INSERT INTO ci.no_rls_allowlist (table_name, reason) VALUES
  ('sylva.context_key',
   'Protected by privilege, not policy: no application role holds any grant on '
   'it. Only SECURITY DEFINER functions owned by sylva_owner read it.')
ON CONFLICT DO NOTHING;

CREATE FUNCTION ci.assert_signed_context() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  app_roles text[] := ARRAY['sylva_web_anon','sylva_buyer','sylva_investor',
                            'sylva_project_owner','sylva_operator',
                            'sylva_auditor','sylva_report'];
  r   text;
  bad text;
BEGIN
  -- 1. No application role may reach the signing key, by any privilege.
  FOREACH r IN ARRAY app_roles LOOP
    IF has_table_privilege(r, 'sylva.context_key',
                           'SELECT, INSERT, UPDATE, DELETE, REFERENCES') THEN
      RAISE EXCEPTION
        'FINDING-001 regression: % can reach sylva.context_key', r;
    END IF;
  END LOOP;

  -- 2. The accessors must be SECURITY DEFINER, or the fix is undone.
  SELECT string_agg(proname, ', ') INTO bad
  FROM pg_proc
  WHERE pronamespace = 'sylva'::regnamespace
    AND proname IN ('actor_org_id', 'actor_person_ref', 'actor_ctx')
    AND NOT prosecdef;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'FINDING-001 regression: % is not SECURITY DEFINER', bad;
  END IF;

  -- 3. A data-reading role must never be able to mint a context.
  FOREACH r IN ARRAY app_roles LOOP
    IF has_function_privilege(
         r, 'sylva.mint_actor_ctx(uuid,uuid,interval)', 'EXECUTE') THEN
      RAISE EXCEPTION
        'FINDING-001 regression: % can mint an actor context', r;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION ci.assert_signed_context() IS
  'Regression guard for FINDING-001. Run in CI against a freshly migrated '
  'database. Tests effective privilege rather than grant rows, so an implicit '
  'or inherited grant cannot slip past it.';
