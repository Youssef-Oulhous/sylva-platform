# FINDING-005 — `record.access_log.actor_db_role` records the logging function's owner, not the caller

**Severity:** low (no data is exposed; the audit trail is wrong about one field)
**Status:** open, fix designed, not applied — needs a migration
**Found:** 24 Sep 2026, by calling `record.log_access()` from the auditor view and
reading the row back

## What happens

`record.log_access()` (migration 0012) is `SECURITY DEFINER` and fills the
`actor_db_role` column from `current_user`:

```sql
INSERT INTO record.access_log (actor_org_id, actor_person_ref, actor_db_role, …)
VALUES (sylva.actor_org_id(), sylva.actor_person_ref(), current_user, …)
```

Inside a `SECURITY DEFINER` function `current_user` is the function's **owner**,
not the caller. The function is owned by the schema owner, so every row the
platform will ever write records:

```
actor_db_role = postgres        (locally; sylva_owner on a deployed database)
```

Reproduced live: a read performed as `sylva_auditor`, through `withActor()`,
with a valid signed context, wrote a row whose `actor_db_role` is `postgres`.

`actor_org_id` and `actor_person_ref` are **correct** — `sylva.actor_org_id()`
reads the signed context, which travels in a GUC and is unaffected. Only the
role column is wrong.

## Why it matters

The access log exists to say who read what. A column that names the superuser
on every line is not merely useless: it is actively misleading in the one
document an assurance reader would use to check that nobody read more than they
should have. It also hides the distinction the whole security model is built
on — whether a read was made as `sylva_auditor`, `sylva_operator` or
`sylva_buyer`.

This is the same class of mistake as FINDING-003: something that looks like it
works, does not, and only a live call shows it.

## Workaround now in place

`src/lib/auditor/queries.ts` passes the caller's role as an **argument**:

```sql
SELECT record.log_access($1, $2, $3,
   jsonb_build_object('view', 'auditor', 'caller_role', current_user))
```

An argument expression is evaluated in the **caller's** context, so this
`current_user` is `sylva_auditor`. The auditor's access-log page prints that
value and explains the column beside it. This is a plaster: rows written by any
other caller still carry the wrong role, and a caller could in principle put
anything in the detail.

## Fix

One migration, in whichever range owns `record`:

```sql
-- session_user is the LOGIN role and is not changed by SET LOCAL ROLE, so it
-- is not the answer either. The caller's effective role has to be passed in.
CREATE OR REPLACE FUNCTION record.log_access(
  p_action text, p_object_kind text, p_object_id text,
  p_detail jsonb DEFAULT '{}'::jsonb,
  p_db_role text DEFAULT current_user          -- evaluated in the CALLER's context
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO record.access_log (actor_org_id, actor_person_ref, actor_db_role,
                                 action, object_kind, object_id, detail)
  VALUES (sylva.actor_org_id(), sylva.actor_person_ref(), p_db_role,
          p_action, p_object_kind, p_object_id, p_detail);
$$;
```

A default argument is evaluated at the call site, so existing callers get the
right value without changing a line, and a caller that wants to lie about its
role could already have done so by other means — it cannot reach the table
directly, which is what matters.

Worth adding with it: a CI guard asserting that no `SECURITY DEFINER` function
writes `current_user` into a column named `*_role` or `*_by`, since this
mistake is invisible in the DDL and only shows up in the data.

## Note

`record.access_log` is append-only, so the rows already written cannot be
corrected in place. Under R4 that is correct: a wrong row stays and the fix
applies from the migration forward.
