# FINDING-001 — Organisation context is forgeable

**Severity:** Critical · **Status:** open, fix designed · **Found:** 23 Sep 2026, live test on PostgreSQL 16.10 + PostGIS 3.5

This is the exact failure the concept note names as the one to avoid:
*"One buyer seeing another buyer's prices or terms is the failure we most need to avoid."*

## What happens

Role is enforced by the database role (`current_user`) and holds. Organisation is
enforced by a plain session variable and does not.

```sql
SELECT current_setting('sylva.actor_org_id', true)::uuid   -- sylva.actor_org_id()
```

Any principal that can execute SQL in the session can reset that variable.

## Reproduction (verbatim, against the loaded schema)

```
### TEST 1  Buyer A, context = A          -> DEMO A brewery Koeln          PASS
### TEST 2  Buyer A flips the org var to B -> DEMO B plant Lyon             FAIL
### TEST 3  anonymous role                 -> permission denied             PASS
### TEST 4  auditor                        -> both sites                    PASS
### TEST 5  auditor DELETE                 -> permission denied             PASS
```

Test 2 is the finding: still connected as `sylva_buyer`, a second `SET` of
`sylva.actor_org_id` to another organisation's UUID returned that organisation's
private site.

Buyer site coordinates are the mildest thing reachable this way. The same predicate
shape guards deal rooms, messages, terms and private documents.

## Why the rest of the model still held

- `sylva_web_anon` has no grant on the table at all — privilege, not policy.
- `sylva_auditor` can read but `DELETE` is denied — read-only is real.
- No role holds `BYPASSRLS`; no role is a superuser.
- `is_operator()` / `is_auditor()` test `current_user`, not a variable, so the
  **role** half of the model is not forgeable. Only the **organisation** half is.

## Fix

Keep the GUC, make it unforgeable. The app sets one signed context value; the
resolver verifies it inside a `SECURITY DEFINER` function whose signing key lives in
a table with no grant to any application role.

```sql
-- key table: no GRANT to sylva_buyer / sylva_investor / sylva_project_owner
CREATE TABLE sylva.context_key(id int PRIMARY KEY DEFAULT 1, key bytea NOT NULL);

CREATE OR REPLACE FUNCTION sylva.actor_org_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, sylva AS $$
DECLARE raw text; parts text[]; mac bytea;
BEGIN
  raw := nullif(current_setting('sylva.actor_ctx', true), '');
  IF raw IS NULL THEN RETURN NULL; END IF;
  parts := string_to_array(raw, ':');            -- org:person:expiry_epoch:hmac_hex
  IF to_timestamp(parts[3]::bigint) < now() THEN RETURN NULL; END IF;
  SELECT hmac(parts[1]||':'||parts[2]||':'||parts[3], key, 'sha256')
    INTO mac FROM sylva.context_key WHERE id = 1;
  IF encode(mac,'hex') <> parts[4] THEN RETURN NULL; END IF;   -- forged: no context
  RETURN parts[1]::uuid;
END $$;
```

A buyer can still `SET sylva.actor_ctx`, but cannot produce a valid HMAC for an
organisation it does not belong to, and cannot read the key to make one. Expiry caps
replay of a captured context.

Required alongside it:

1. The application sets the context with `SET LOCAL` inside the request transaction,
   never `SET`, so it cannot survive into a pooled connection's next checkout.
2. `REVOKE` on `sylva.context_key` from every application role, asserted in CI.
3. A CI test that repeats TEST 2 above and requires zero rows.
4. The same test repeated for deals, messages, terms and documents — not only sites.

## Test to add

```
rls/org-context-forgery.test  —  for every org-scoped table:
  connect as <role>, set a valid context for org A,
  then set a forged context for org B,
  assert 0 rows and assert the forged context resolves to NULL.
```

## Note on severity

This does not mean the schema is weak. The privilege layer, the role layer, the
append-only layer and the auditor read-only layer all held under test. One predicate
source was trusted that should not have been. It was found by running the attack, not
by reading the DDL — which is the argument for the RLS test matrix being built before
the features, not after.
