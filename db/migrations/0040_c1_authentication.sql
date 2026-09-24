-- ============================================================================
-- C1. AUTHENTICATION  ·  the only way in, and the only way into identity
-- ============================================================================
-- The constraint this migration exists to satisfy:
--
--   No application role holds USAGE on schema identity, and none ever will.
--   So authentication CANNOT be "SELECT ... FROM identity.user_account".
--
-- Everything below is therefore a SECURITY DEFINER function owned by the
-- schema owner, granted EXECUTE to ONE login role and to nothing else. The
-- pattern is sylva.mint_actor_ctx (migration 0019): the LOGIN role may call it,
-- the privilege roles it can SET ROLE to may not.
--
-- Which login role? sylva_login_public - the least privileged one there is. It
-- is a member of sylva_web_anon and of nothing else, so the code path that
-- handles an unauthenticated stranger's password holds read-only access to
-- published pages and six function calls. Sign-in must not run on a pool that
-- could become a buyer.
--
-- ---------------------------------------------------------------------------
-- PASSWORD VERIFICATION, AND WHY IT IS TWO CALLS
-- ---------------------------------------------------------------------------
-- The hash is scrypt. PostgreSQL cannot compute scrypt: pgcrypto offers
-- bf/md5/des only, and the machine this is built on has no compiler, so a
-- pgcrypto replacement or an argon2 extension is not available. The derivation
-- therefore happens in Node (src/lib/auth/password.ts).
--
-- Handing the stored hash to the application to compare would undo the seal on
-- identity: the application would hold the verifier for every account it looks
-- up, whether or not the password was right. So the split is:
--
--   1  identity.auth_salt(email)   -> the PARAMETERS and SALT only, never the
--                                     derived key. For an unknown email it
--                                     returns a DECOY salt, derived
--                                     deterministically from the email and the
--                                     context key, so the caller does exactly
--                                     the same scrypt work either way and a
--                                     wrong-email attempt costs the same as a
--                                     wrong-password attempt.
--   2  identity.authenticate(email, derived_key)
--                                  -> compares INSIDE the function, in the
--                                     database, and returns the account row on
--                                     success and NO ROW on failure. The stored
--                                     verifier never leaves the function.
--
-- The comparison is over sha256 digests of equal length, so it does not short-
-- circuit on the first differing byte of the secret. The application also
-- compares with crypto.timingSafeEqual on its side; neither layer is load-
-- bearing alone.
--
-- ---------------------------------------------------------------------------
-- SESSIONS
-- ---------------------------------------------------------------------------
-- identity.user_session.token_sha256 is a sylva.sha256 domain and already
-- existed. The RAW token is generated in Node (32 bytes from node:crypto) and
-- is never sent to the database at all - open_session takes the digest. That is
-- a deliberate deviation from "open_session returns the token": a token the
-- database never saw cannot appear in a statement log, a parameter trace or a
-- crash dump. The database stores the digest, which is what it must store.
--
-- ---------------------------------------------------------------------------
-- RULES TOUCHED
-- ---------------------------------------------------------------------------
-- R4  nothing here is append-only. identity.* is deliberately DELETABLE - that
--     is the erasure design (migration 0014, D3). close_session DELETEs a row
--     and must.
-- R6  registration does NOT approve anybody. identity.register creates an
--     organisation with no org.vetting_decision, so org.org_role_approval has
--     no row for it and the R6 trigger refuses any deal. Registering and being
--     approved are different things and this migration keeps them different.
-- R7  no quantity is read or written here.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. The definer's own way past FORCE ROW LEVEL SECURITY.
--
-- identity.user_account and org.organisation are both ENABLE + FORCE ROW LEVEL
-- SECURITY, and FORCE binds the table OWNER. A SECURITY DEFINER function runs
-- as the owner, so without a policy naming the owner these functions return no
-- rows and insert nothing - on a DEPLOYED database, where the owner is
-- sylva_owner. They appear to work locally only because the local owner is a
-- superuser, which is exactly the divergence migrations 0025-0030 were spent
-- on. So the policies are created for whoever actually owns the table.
--
-- These are narrow on purpose: SELECT/INSERT/UPDATE on the account table,
-- INSERT on the organisation table, and nothing else. No FOR ALL, no DELETE.
-- ---------------------------------------------------------------------------
DO $definer$
DECLARE
  ua_owner text := pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'identity.user_account'::regclass));
  og_owner text := pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'org.organisation'::regclass));
BEGIN
  EXECUTE format(
    'CREATE POLICY p_user_definer_read ON identity.user_account FOR SELECT TO %I USING (true)', ua_owner);
  EXECUTE format(
    'CREATE POLICY p_user_definer_insert ON identity.user_account FOR INSERT TO %I WITH CHECK (true)', ua_owner);
  EXECUTE format(
    'CREATE POLICY p_user_definer_update ON identity.user_account FOR UPDATE TO %I USING (true) WITH CHECK (true)', ua_owner);
  EXECUTE format(
    'CREATE POLICY p_org_definer_insert ON org.organisation FOR INSERT TO %I WITH CHECK (true)', og_owner);
END $definer$;

COMMENT ON POLICY p_user_definer_read ON identity.user_account IS
  'The identity schema is sealed by PRIVILEGE - no application role holds USAGE '
  'on it. This policy exists only so the SECURITY DEFINER functions in migration '
  '0040 are not blocked by FORCE ROW LEVEL SECURITY, which binds the owner. It '
  'grants nothing to any role that can log in as itself.';

-- ---------------------------------------------------------------------------
-- 1. The salt handout.
--
-- Returns "scrypt$N=...,r=...,p=...,len=...$<salt-base64>" and NOTHING else.
-- For an email with no active account, or an account with no password set, it
-- returns a decoy of the same shape, stable for that email, derived under the
-- context key so it cannot be recognised as a decoy without that key.
-- ---------------------------------------------------------------------------
CREATE FUNCTION identity.auth_salt(p_email citext)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity, sylva, public
AS $f$
DECLARE
  v_hash text;
  v_key  bytea;
BEGIN
  IF p_email IS NULL OR btrim(p_email::text) = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.password_hash INTO v_hash
    FROM identity.user_account u
   WHERE u.email = p_email;

  -- A real record is "scheme$params$salt$derived_key". Hand back the first
  -- three fields; the fourth is the verifier and must never leave.
  IF v_hash IS NOT NULL AND v_hash ~ '^scrypt\$[^$]+\$[^$]+\$[^$]+$' THEN
    RETURN split_part(v_hash, '$', 1) || '$' ||
           split_part(v_hash, '$', 2) || '$' ||
           split_part(v_hash, '$', 3);
  END IF;

  -- Decoy. Same default parameters the application writes, so the caller's
  -- scrypt costs the same, and a salt that is deterministic for this email so
  -- repeated probing looks like a real account rather than like a decoy.
  SELECT key INTO v_key FROM sylva.context_key WHERE id = 1;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'auth_salt: no signing key; run the key bootstrap';
  END IF;

  RETURN 'scrypt$N=16384,r=8,p=1,len=64$' ||
         encode(substring(public.hmac(convert_to('pwsalt:' || lower(p_email::text), 'UTF8'),
                                      v_key, 'sha256'::text)
                          FROM 1 FOR 16), 'base64');
END $f$;

COMMENT ON FUNCTION identity.auth_salt(citext) IS
  'Returns the scrypt parameters and salt for an email address, or an '
  'indistinguishable decoy for an address with no account. Never returns the '
  'derived key. Step 1 of 2; identity.authenticate does the comparison.';

-- ---------------------------------------------------------------------------
-- 2. The verifier.
--
-- Takes the full candidate record the application derived from the salt above
-- and returns the account on a match, nothing otherwise. status is returned
-- rather than filtered on, so the application can say "this account is
-- suspended" instead of "wrong password", which is both true and kinder.
-- ---------------------------------------------------------------------------
CREATE FUNCTION identity.authenticate(p_email citext, p_derived_key text)
RETURNS TABLE (user_id uuid, person_ref uuid, org_id uuid, locale text, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity, sylva, public
AS $f$
DECLARE
  r      record;
  stored text;
  v_key  bytea;
BEGIN
  IF p_email IS NULL OR p_derived_key IS NULL THEN RETURN; END IF;

  SELECT u.id, u.person_ref, u.org_id, u.locale, u.status, u.password_hash
    INTO r
    FROM identity.user_account u
   WHERE u.email = p_email;

  -- Unknown email, or a known account with no password: compare against an
  -- unmatchable value of the same shape rather than returning early, so the
  -- cost of the two failure modes is the same.
  stored := r.password_hash;
  IF stored IS NULL THEN
    SELECT key INTO v_key FROM sylva.context_key WHERE id = 1;
    stored := 'scrypt$absent$' ||
              encode(public.hmac(convert_to(coalesce(p_email::text, ''), 'UTF8'),
                                 coalesce(v_key, '\x00'::bytea), 'sha256'::text), 'base64');
  END IF;

  -- Digest comparison: both sides are 32 bytes whatever the inputs were, so the
  -- comparison does not leak how far it got through the secret.
  IF public.digest(convert_to(stored, 'UTF8'), 'sha256'::text)
     <> public.digest(convert_to(p_derived_key, 'UTF8'), 'sha256'::text) THEN
    RETURN;
  END IF;

  IF r.id IS NULL THEN RETURN; END IF;

  user_id    := r.id;
  person_ref := r.person_ref;
  org_id     := r.org_id;
  locale     := r.locale;
  status     := r.status::text;
  RETURN NEXT;
END $f$;

COMMENT ON FUNCTION identity.authenticate(citext, text) IS
  'Verifies a candidate scrypt record against the stored one INSIDE the '
  'database and returns the account row, or no row. The stored verifier is '
  'never returned. A wrong password and an unknown email cost the same.';

-- ---------------------------------------------------------------------------
-- 3. Sessions.
--
-- open_session takes the DIGEST of a token generated by the application. The
-- raw token is never sent to the database, so it cannot end up in a log.
-- ---------------------------------------------------------------------------
CREATE FUNCTION identity.open_session(
  p_user_id      uuid,
  p_token_sha256 sylva.sha256,
  p_ttl          interval DEFAULT '12 hours'
) RETURNS TABLE (session_id uuid, expires_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, identity, sylva
AS $f$
DECLARE r record;
BEGIN
  IF p_user_id IS NULL OR p_token_sha256 IS NULL THEN
    RAISE EXCEPTION 'open_session: user and token digest are required';
  END IF;
  IF p_ttl <= interval '0' THEN
    RAISE EXCEPTION 'open_session: ttl must be positive';
  END IF;

  -- Only an active account gets a session. Checked here as well as in the
  -- application, because this is the function that actually issues one.
  PERFORM 1 FROM identity.user_account u
    WHERE u.id = p_user_id AND u.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'open_session: account is not active'
      USING ERRCODE = 'SY023';
  END IF;

  -- Expired rows are rubbish, not history: identity.* is the one part of this
  -- database that is deliberately not append-only.
  DELETE FROM identity.user_session s WHERE s.expires_at < now();

  INSERT INTO identity.user_session (user_id, token_sha256, expires_at)
  VALUES (p_user_id, p_token_sha256, now() + p_ttl)
  RETURNING id, identity.user_session.expires_at INTO r;

  UPDATE identity.user_account u SET last_login_at = now() WHERE u.id = p_user_id;

  session_id := r.id;
  expires_at := r.expires_at;
  RETURN NEXT;
END $f$;

COMMENT ON FUNCTION identity.open_session(uuid, sylva.sha256, interval) IS
  'Opens a session for an ACTIVE account. Takes sha256(token); the raw token is '
  'generated by the application and never reaches the database.';

CREATE FUNCTION identity.resolve_session(p_token_sha256 sylva.sha256)
RETURNS TABLE (user_id uuid, person_ref uuid, org_id uuid, locale text,
               status text, roles text[], expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity, org, sylva
AS $f$
  SELECT u.id, u.person_ref, u.org_id, u.locale, u.status::text,
         coalesce(
           (SELECT array_agg(r.role_code ORDER BY r.role_code)
              FROM identity.user_platform_role r
             WHERE r.user_id = u.id),
           ARRAY[]::text[]),
         s.expires_at
    FROM identity.user_session s
    JOIN identity.user_account u ON u.id = s.user_id
   WHERE s.token_sha256 = p_token_sha256
     AND s.expires_at > now()
     AND u.status = 'active'
$f$;

COMMENT ON FUNCTION identity.resolve_session(sylva.sha256) IS
  'Resolves a session digest to the person, their organisation and their '
  'platform roles. Returns no row for an unknown, expired or suspended '
  'session, so the caller degrades to anonymous rather than to someone else.';

CREATE FUNCTION identity.close_session(p_token_sha256 sylva.sha256)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, identity, sylva
AS $f$
  DELETE FROM identity.user_session s WHERE s.token_sha256 = p_token_sha256;
$f$;

COMMENT ON FUNCTION identity.close_session(sylva.sha256) IS
  'Signing out destroys the session row. identity.* is not append-only: that is '
  'the erasure design, and a session record is personal data.';

-- ---------------------------------------------------------------------------
-- 4. Registration.
--
-- One transaction: the organisation that will transact, the person who signs in
-- on its behalf, that person's non-personal record label, and the role applied
-- for. No vetting decision and therefore NO APPROVAL - see R6 above.
-- ---------------------------------------------------------------------------
CREATE FUNCTION identity.register(
  p_role_code           text,
  p_legal_name          text,
  p_registration_number text,
  p_registered_address  text,
  p_country_code        text,
  p_sector_code         text,
  p_size_band_code      text,
  p_full_name           text,
  p_job_title           text,
  p_email               citext,
  p_password_hash       text,
  p_locale              text DEFAULT 'en'
) RETURNS TABLE (user_id uuid, person_ref uuid, org_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, identity, org, sylva
AS $f$
DECLARE
  v_org     uuid;
  v_user    uuid;
  v_person  uuid;
  v_ordinal int;
BEGIN
  -- Only a TRANSACTING role can be registered for. Operator and auditor
  -- accounts are created by Sylva, never through a public form.
  PERFORM 1 FROM org.actor_role a
    WHERE a.code = p_role_code AND a.is_transacting;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'register: % is not a role that can be registered for', p_role_code
      USING ERRCODE = 'SY021';
  END IF;

  IF p_password_hash IS NULL OR btrim(p_password_hash) = '' THEN
    RAISE EXCEPTION 'register: a password hash is required';
  END IF;

  PERFORM 1 FROM identity.user_account u WHERE u.email = p_email;
  IF FOUND THEN
    RAISE EXCEPTION 'register: an account already exists for this address'
      USING ERRCODE = 'SY020';
  END IF;

  BEGIN
    INSERT INTO org.organisation
      (legal_name, registration_number, registered_address,
       country_code, sector_code, size_band_code)
    VALUES (p_legal_name, nullif(btrim(coalesce(p_registration_number, '')), ''),
            nullif(btrim(coalesce(p_registered_address, '')), ''),
            upper(p_country_code)::sylva.country_code, p_sector_code, p_size_band_code)
    RETURNING id INTO v_org;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'register: unknown sector, size band or country code'
      USING ERRCODE = 'SY022';
  END;

  INSERT INTO identity.user_account
    (org_id, email, full_name, job_title, locale, password_hash, status)
  VALUES (v_org, p_email, p_full_name,
          nullif(btrim(coalesce(p_job_title, '')), ''),
          coalesce(p_locale, 'en'), p_password_hash, 'active')
  RETURNING id, identity.user_account.person_ref INTO v_user, v_person;

  SELECT coalesce(max(l.ordinal), 0) + 1 INTO v_ordinal
    FROM identity.person_label l WHERE l.org_id = v_org;

  INSERT INTO identity.person_label (person_ref, org_id, ordinal, label)
  VALUES (v_person, v_org, v_ordinal, 'representative #' || v_ordinal);

  INSERT INTO identity.user_platform_role (user_id, role_code)
  VALUES (v_user, p_role_code);

  user_id    := v_user;
  person_ref := v_person;
  org_id     := v_org;
  RETURN NEXT;
END $f$;

COMMENT ON FUNCTION identity.register(text,text,text,text,text,text,text,text,text,citext,text,text) IS
  'Creates org.organisation + identity.user_account + identity.person_label + '
  'identity.user_platform_role in one transaction. Creates NO vetting decision, '
  'so the organisation is not approved and R6 still refuses it a deal.';

-- ---------------------------------------------------------------------------
-- 5. Grants. Narrow, and to a LOGIN role only.
--
-- REVOKE ALL ON ALL FUNCTIONS IN SCHEMA identity ran in migration 0016, but
-- these functions are newer than that statement, so the PUBLIC default applies
-- to them and revoking is not optional.
--
-- USAGE on schema identity goes to sylva_login_public and to nothing else. It
-- is a LOGIN role, not an application role: sylva_web_anon, sylva_buyer,
-- sylva_project_owner, sylva_investor, sylva_report and sylva_record still hold
-- no USAGE, so SET LOCAL ROLE still seals the schema for every query the
-- application actually runs. ci.assert_identity_is_sealed() below proves it.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION identity.auth_salt(citext) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.authenticate(citext, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.open_session(uuid, sylva.sha256, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.resolve_session(sylva.sha256) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.close_session(sylva.sha256) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.register(text,text,text,text,text,text,text,text,text,citext,text,text) FROM PUBLIC;

GRANT USAGE ON SCHEMA identity TO sylva_login_public;

GRANT EXECUTE ON FUNCTION identity.auth_salt(citext)                             TO sylva_login_public;
GRANT EXECUTE ON FUNCTION identity.authenticate(citext, text)                    TO sylva_login_public;
GRANT EXECUTE ON FUNCTION identity.open_session(uuid, sylva.sha256, interval)    TO sylva_login_public;
GRANT EXECUTE ON FUNCTION identity.resolve_session(sylva.sha256)                 TO sylva_login_public;
GRANT EXECUTE ON FUNCTION identity.close_session(sylva.sha256)                   TO sylva_login_public;
GRANT EXECUTE ON FUNCTION identity.register(text,text,text,text,text,text,text,text,text,citext,text,text)
  TO sylva_login_public;

-- The auditor pool could not mint an actor context, so a signed-in auditor had
-- no organisation context and every org-scoped policy saw NULL. Migration 0019
-- granted the mint to sylva_login_app and sylva_login_operator and stopped
-- there because no auditor could sign in yet. Now one can.
-- This does NOT let sylva_auditor mint: privileges flow from the granted role to
-- its members, never the other way, and ci.assert_signed_context() checks the
-- privilege roles by effective privilege and still passes.
GRANT EXECUTE ON FUNCTION sylva.mint_actor_ctx(uuid, uuid, interval) TO sylva_login_auditor;

-- ---------------------------------------------------------------------------
-- 6. The guard, with its self-test.
--
-- States the invariant this migration is closest to breaking: the identity
-- schema is reachable by the operator and the auditor, and by nobody else. A
-- guard that cannot fail is not a guard, so it is made to fail first.
-- ---------------------------------------------------------------------------
CREATE FUNCTION ci.assert_identity_is_sealed() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  -- 1. No table privilege on anything in identity, for any role that is not
  --    (or is not a member of) the owner, the operator or the auditor.
  SELECT string_agg(format('%s can %s %s', r.rolname, p.priv, c.oid::regclass), ', ')
    INTO v
    FROM pg_roles r
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES')) AS p(priv)
    JOIN pg_class c ON c.relnamespace = 'identity'::regnamespace AND c.relkind = 'r'
   WHERE r.rolname LIKE 'sylva\_%'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles a
        WHERE a.rolname IN ('sylva_owner','sylva_operator','sylva_auditor')
          AND pg_has_role(r.oid, a.oid, 'USAGE'))
     AND NOT pg_has_role(r.oid, c.relowner, 'USAGE')
     AND has_table_privilege(r.oid, c.oid, p.priv);
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v); END IF;

  -- 2. The privilege roles - the ones a request actually runs as, after
  --    SET LOCAL ROLE - hold no USAGE on the schema at all. A login role may,
  --    because that is how it reaches the SECURITY DEFINER functions.
  SELECT string_agg(format('%s holds USAGE on schema identity', r.rolname), ', ')
    INTO v
    FROM pg_roles r
   WHERE r.rolname IN ('sylva_web_anon','sylva_buyer','sylva_project_owner',
                       'sylva_investor','sylva_report','sylva_record')
     AND has_schema_privilege(r.oid, 'identity', 'USAGE');
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v); END IF;

  -- 3. The authentication functions must be SECURITY DEFINER, or they cannot
  --    work at all and somebody has "fixed" them by granting table access.
  SELECT string_agg(proname, ', ') INTO v
    FROM pg_proc
   WHERE pronamespace = 'identity'::regnamespace
     AND proname IN ('auth_salt','authenticate','open_session','resolve_session',
                     'close_session','register','whoami')
     AND NOT prosecdef;
  IF v IS NOT NULL THEN PERFORM ci.fail('identity_is_sealed', v || ' is not SECURITY DEFINER'); END IF;
END $$;

COMMENT ON FUNCTION ci.assert_identity_is_sealed() IS
  'Personal data is reachable by the operator, the auditor and the SECURITY '
  'DEFINER functions, and by nothing else. Tests effective privilege, never a '
  'role name, so an inherited grant cannot slip past it.';

DO $selftest$
DECLARE fired boolean := false;
BEGIN
  GRANT SELECT ON identity.user_account TO sylva_buyer;
  BEGIN PERFORM ci.assert_identity_is_sealed();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE SELECT ON identity.user_account FROM sylva_buyer;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity seal guard is toothless: sylva_buyer reading user_account went unnoticed';
  END IF;

  fired := false;
  GRANT USAGE ON SCHEMA identity TO sylva_web_anon;
  BEGIN PERFORM ci.assert_identity_is_sealed();
  EXCEPTION WHEN OTHERS THEN fired := true; END;
  REVOKE USAGE ON SCHEMA identity FROM sylva_web_anon;
  IF NOT fired THEN
    RAISE EXCEPTION 'identity seal guard is toothless: sylva_web_anon holding schema USAGE went unnoticed';
  END IF;

  PERFORM ci.assert_identity_is_sealed();
  RAISE NOTICE 'identity seal guard verified: fires twice, silent otherwise';
END $selftest$;
