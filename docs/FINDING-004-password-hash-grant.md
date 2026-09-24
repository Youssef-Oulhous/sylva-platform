# FINDING-004 — The operator and the auditor can read every password hash

**Severity:** Medium · **Status:** **CLOSED** in [`db/migrations/0042_c3_credentials_and_schema_usage.sql`](../db/migrations/0042_c3_credentials_and_schema_usage.sql)
**Found:** 24 Sep 2026, by the row-level security matrix · **Fixed:** 24 Sep 2026, by the authentication work
**Reproduced by:** `tests/rls/matrix.test.ts` → `identity.user_account.password_hash`

## What happens

Migration 0016 is written almost entirely in **column-list grants**, and says
why:

> Both are expressed as COLUMN-LIST GRANTS, never as "grant the table then
> revoke a column", because a later table-level GRANT would silently restore it.

Two grants in that file are not column lists:

```sql
GRANT SELECT ON identity.user_account, identity.person_label,
                identity.user_platform_role, identity.user_session,
                identity.erasure_event
  TO sylva_auditor;
GRANT SELECT ON identity.user_account, identity.person_label,
                identity.user_platform_role, identity.erasure_event
  TO sylva_operator;
```

They were correct when written: `identity.user_account` held a name, an email, a
job title and a locale, and the auditor is meant to see *"everything including
real names"*.

The authentication work then added `password_hash` to that table. **A table-level
`SELECT` grant covers columns added afterwards**, so the grant silently widened:

```
 rolname             | can read password_hash
---------------------+------------------------
 sylva_web_anon      | f
 sylva_buyer         | f
 sylva_project_owner | f
 sylva_investor      | f
 sylva_operator      | t   ←
 sylva_auditor       | t   ←
```

## Why it matters

A scrypt record is not a password, and both roles are trusted. But:

- The auditor's mandate is the **record**, not the credentials. Reading hashes is
  outside it, and an external auditor holding them is a question the grant
  agreement did not ask.
- A hash is an offline-attackable secret. Every additional principal that can
  read it is an additional place it can leak from.
- The rest of this schema is built so that a role cannot reach what it does not
  need. This is the one place that stopped being true, and it stopped being true
  **silently**, which is the part worth fixing.

The README already warns about the mirror image of this — `ALTER TABLE … DROP
COLUMN` discarding column grants. This is the other direction and has no guard.

## Fix

Replace the two table-level grants with column lists, in the migration range that
owns identity (authentication, 0040–0049):

```sql
REVOKE SELECT ON identity.user_account FROM sylva_operator, sylva_auditor;

GRANT SELECT (id, person_ref, org_id, email, full_name, job_title, locale,
              status, created_at)      -- every column EXCEPT password_hash
  ON identity.user_account TO sylva_auditor;
GRANT SELECT (id, person_ref, org_id, email, full_name, job_title, locale,
              status, created_at)
  ON identity.user_account TO sylva_operator;
```

(Take the exact list from `\d identity.user_account` at the time — naming the
columns is the point.)

Then add the guard that would have caught it, in the style the README
prescribes — effective privilege, never a role name:

```sql
CREATE FUNCTION ci.assert_no_credential_grants() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['sylva_web_anon','sylva_buyer','sylva_investor',
                           'sylva_project_owner','sylva_operator',
                           'sylva_auditor','sylva_report'] LOOP
    IF has_column_privilege(r, 'identity.user_account', 'password_hash', 'SELECT') THEN
      RAISE EXCEPTION 'credential regression: % can read password_hash', r;
    END IF;
  END LOOP;
END $$;
```

and give it a self-test in the same migration: grant the column, assert the guard
fires, revoke it. *"A guard that cannot fail is not a guard."*

## Closed

`db/migrations/0042` does exactly that, with two differences from the sketch
above:

- **`mfa_secret` is covered as well.** It is unused today, but it is a shared
  secret rather than a fact about a person, so it is held to the same rule. The
  granted column list is every column of `identity.user_account` except those
  two.
- **The guard excludes the ownership chain** — `NOT pg_has_role(r.oid,
  cl.relowner, 'USAGE')` — because a table's owner holds privileges implicitly
  and that is not a grant. README §11 is emphatic about this, and four
  migrations (0025-0030) were spent learning it.

`ci.assert_no_credential_grants()` has two self-tests in the same migration: it
must fire on a table-level `GRANT SELECT` (the mistake that caused this finding)
and on a direct `GRANT SELECT (password_hash)`.

`tests/rls/matrix.ts` now expects `denied` for every principal on
`identity.user_account.password_hash`, and `docs/SECURITY-MATRIX.md` has been
regenerated.

One column comment now says so on the object itself, where the next person to
write a grant will see it:

```
COMMENT ON COLUMN identity.user_account.password_hash IS
  'A scrypt record ... NO ROLE holds SELECT on this column - not the operator,
   not the auditor. ... Guarded by ci.assert_no_credential_grants().';
```
