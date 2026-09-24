# FINDING-003 — `identity.whoami()` cannot be called by the roles it was granted to

**Severity:** Medium — it blocks a feature, it does not leak anything
**Status:** **CLOSED** in [`db/migrations/0042_c3_credentials_and_schema_usage.sql`](../db/migrations/0042_c3_credentials_and_schema_usage.sql)
**Found:** 24 Sep 2026, by the row-level security matrix · **Fixed:** 24 Sep 2026, by the authentication work
**Reproduced by:** `tests/rls/attacks.test.ts` → *Buyer A reads `identity.user_account` directly, then through `identity.whoami()`*

## What happens

Personal data lives in one schema, `identity`, and no application role holds
`USAGE` on it. The sanctioned way for a signed-in person to read their own row
is a `SECURITY DEFINER` function, and migration 0016 grants it:

```sql
GRANT EXECUTE ON FUNCTION identity.whoami()
  TO sylva_buyer, sylva_project_owner, sylva_investor, sylva_operator;
```

The grant is real. It is also inert, because **calling a function requires
`USAGE` on the schema that contains it**, and three of those four roles do not
have it:

```
 rolname             | identity USAGE | whoami EXECUTE
---------------------+----------------+----------------
 sylva_buyer         | f              | t
 sylva_project_owner | f              | t
 sylva_investor      | f              | t
 sylva_operator      | t              | t
 sylva_auditor       | t              | f
 sylva_web_anon      | f              | f
```

So:

```
sylva_buyer=> SELECT org_id FROM identity.whoami();
ERROR:  permission denied for schema identity
```

The operator works. A buyer, a project owner and an investor cannot read their
own name, email or locale by any route at all.

## Why it was not noticed

Nothing calls `identity.whoami()` yet — the README lists authentication as *not
built*. The function, the grant and the CI guard that keeps personal data out of
reach all passed review because each one is individually correct. The gap is
between two of them, which is the kind of thing only a principal-by-principal
test catches.

`ci.assert_no_personal_columns_outside_identity()` and
`ci.assert_no_fk_into_identity()` both still hold. Nothing is exposed. The seal
is, if anything, tighter than intended.

## Fix

One line, in whichever migration the auth work is landing (range 0040–0049):

```sql
GRANT USAGE ON SCHEMA identity
  TO sylva_buyer, sylva_project_owner, sylva_investor;
```

`USAGE` on a schema grants nothing on the tables in it — those are still
protected by the table privileges migration 0016 never gave out, and by
`identity.user_account`'s own policy, which names only `sylva_operator` and
`sylva_auditor`. The row-level security matrix asserts that directly: after this
grant, `SELECT … FROM identity.user_account` as a buyer must still be `denied`.

Worth adding alongside it a CI guard in the shape the README prescribes — test
effective privilege, never a role name:

```sql
-- every role granted EXECUTE on a function in `identity` must be able to
-- reach the schema it lives in, or the grant is decoration
```

## How the test suite handles it meanwhile

`tests/rls/attacks.test.ts` asserts the invariant that belongs to this suite —
**`whoami()` never resolves to another organisation** — in whichever of the two
states the schema is in when it runs. It checks
`has_schema_privilege(current_user, 'identity', 'USAGE')` first:

- no `USAGE`: the call must fail with `42501`, and this finding is the reason;
- `USAGE`: the call must return exactly one row, and that row must be the
  caller's own.

So the auth fix lands without breaking the matrix, and a fix that made
`whoami()` resolve to the wrong person would fail it immediately.


---

## Closed

`db/migrations/0042` grants `USAGE ON SCHEMA identity` to `sylva_buyer`,
`sylva_project_owner` and `sylva_investor`. `USAGE` on a schema grants nothing on
the tables in it: no table privilege was ever given to those three, and
`identity.user_account`'s policy names only `sylva_operator` and `sylva_auditor`.
`tests/rls/matrix.test.ts` asserts that directly and still reports `denied` for
all three.

It also revokes `USAGE ON ALL SEQUENCES IN SCHEMA identity` from the same three
roles. That grant was written in migration 0016 and was inert only because they
could not reach the schema; it would have become live with this change.

The guard the finding asks for is check 4 of `ci.assert_identity_is_sealed()`,
restated as a rule rather than as one fix:

> Every role holding `EXECUTE` on a function in `identity` must hold `USAGE` on
> the schema it lives in. A grant that cannot be exercised is decoration, and
> decoration hides gaps.

Its self-test grants `EXECUTE ON identity.whoami()` to `sylva_report` — which has
no `USAGE` — asserts the guard fires, and revokes it.
