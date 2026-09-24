-- ===========================================================================
-- SEED 0 · bootstrap — run this FIRST, before the demo data
--
-- The HMAC key that signs the actor context (see db/migrations/0019 and
-- docs/FINDING-001-org-context-forgery.md). Without it sylva.actor_ctx()
-- returns no row, every organisation-scoped query returns nothing, and the
-- symptom looks like "row-level security is broken" rather than "no key".
--
-- Development generates a random key here. A DEPLOYED environment must NOT
-- run this file: generate the key out of band, store it in the secret manager,
-- and insert it once. Rotating the key invalidates every outstanding context
-- immediately, which is the intended emergency control.
-- ===========================================================================

INSERT INTO sylva.context_key (id, key)
VALUES (1, gen_random_bytes(32))
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sylva.context_key WHERE id = 1) THEN
    RAISE EXCEPTION 'bootstrap failed: no actor-context signing key';
  END IF;
  RAISE NOTICE 'actor-context signing key present';
END $$;
