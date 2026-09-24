-- ============================================================================
-- A2. IDENTITY  ·  the only place a natural person exists
-- ============================================================================
-- NOTHING outside schema identity declares a foreign key to any table in it.
-- That is the whole erasure design: DELETE FROM identity.user_account always
-- succeeds, no referential action fires, and therefore no append-only row is
-- ever UPDATEd - so the R4 guard needs no exception of any kind.
-- ci.assert_no_fk_into_identity() proves the invariant has not eroded.

CREATE TYPE identity.account_status AS ENUM
  ('invited','pending_verification','active','suspended');

CREATE TABLE identity.user_account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- person_ref is the opaque handle copied into append-only rows. It is NOT a
  -- foreign key anywhere. When the account is deleted the handle dangles for
  -- ever, which is exactly the intended behaviour.
  person_ref    uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,                      -- FK added after org.organisation
  email         citext NOT NULL UNIQUE,
  full_name     sylva.nonblank NOT NULL,
  job_title     text,
  phone         text,
  locale        text NOT NULL DEFAULT 'en' REFERENCES i18n.locale(code),
  password_hash text,
  mfa_secret    text,
  status        identity.account_status NOT NULL DEFAULT 'invited',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- The non-personal display string frozen into every record row. Survives erasure.
CREATE TABLE identity.person_label (
  person_ref uuid PRIMARY KEY,
  org_id     uuid NOT NULL,                         -- FK added after org.organisation
  ordinal    int  NOT NULL CHECK (ordinal > 0),
  label      sylva.nonblank NOT NULL,               -- e.g. 'representative #3'
  UNIQUE (org_id, ordinal)
);

CREATE TABLE identity.user_platform_role (
  user_id   uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE CASCADE,
  role_code text NOT NULL,                          -- FK added after org.actor_role
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE identity.user_session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE CASCADE,
  token_sha256 sylva.sha256 NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CHECK (expires_at > issued_at)
);
COMMENT ON TABLE identity.user_session IS
  'No ip_address and no user_agent column: both are personal data and would sit outside user_account. Request-level logs stay on the EU-hosted reverse proxy with short retention. OPEN DECISION if security incident response requires otherwise.';

-- Records THAT an erasure happened. Never who.
CREATE TABLE identity.erasure_event (
  entry_no   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_ref uuid NOT NULL,
  org_id     uuid NOT NULL,                         -- FK added after org.organisation
  erased_at  timestamptz NOT NULL DEFAULT now(),
  basis_note sylva.nonblank NOT NULL
);
