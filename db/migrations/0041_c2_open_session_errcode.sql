-- ============================================================================
-- C2. CORRECTION  ·  identity.open_session used an SQLSTATE that was taken
-- ============================================================================
-- 0040 raised SY023 for "this account is not active". SY023 already means
-- "the record entry you are correcting does not exist" (migration 0012,
-- record.set_correction_depth). Two meanings for one code makes the
-- application's error mapping ambiguous, and the whole point of that mapping is
-- that a person reads a sentence rather than a code.
--
-- Migrations are immutable once applied, so this is the correction: same
-- function, SY024, which is free.
--
-- SQLSTATEs in use, for whoever adds the next one:
--   SY001 R1 capacity     SY003 R3 terminal state   SY004 R2 registry ref
--   SY005 stale stage     SY006 R6 unapproved org   SY007 R7 mixed units
--   SY008 publication gate                          SY009 deal precondition
--   SY020 email already registered                  SY021 role not registrable
--   SY022 unknown reference code                    SY023 missing correction target
--   SY024 account not active                        SY0CI CI assertion failed
-- ============================================================================

CREATE OR REPLACE FUNCTION identity.open_session(
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

  PERFORM 1 FROM identity.user_account u
    WHERE u.id = p_user_id AND u.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'open_session: account is not active'
      USING ERRCODE = 'SY024';
  END IF;

  DELETE FROM identity.user_session s WHERE s.expires_at < now();

  INSERT INTO identity.user_session (user_id, token_sha256, expires_at)
  VALUES (p_user_id, p_token_sha256, now() + p_ttl)
  RETURNING id, identity.user_session.expires_at INTO r;

  UPDATE identity.user_account u SET last_login_at = now() WHERE u.id = p_user_id;

  session_id := r.id;
  expires_at := r.expires_at;
  RETURN NEXT;
END $f$;

-- CREATE OR REPLACE keeps the existing grants, but say it out loud rather than
-- rely on it: this function is callable by sylva_login_public and nothing else.
DO $check$
BEGIN
  IF NOT has_function_privilege('sylva_login_public',
       'identity.open_session(uuid,sylva.sha256,interval)', 'EXECUTE') THEN
    RAISE EXCEPTION 'open_session lost its grant to sylva_login_public';
  END IF;
  IF has_function_privilege('sylva_web_anon',
       'identity.open_session(uuid,sylva.sha256,interval)', 'EXECUTE') THEN
    RAISE EXCEPTION 'open_session is reachable by sylva_web_anon';
  END IF;
END $check$;
