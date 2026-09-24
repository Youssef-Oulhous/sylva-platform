# FINDING-002 — A buyer can append a record entry about another buyer's deal

**Severity:** Low as a read, expensive as a write · **Status:** **CLOSED** in `db/migrations/0076_d2_record_entry_insert_is_party_scoped.sql`, 24 Sep 2026 · **Found:** 24 Sep 2026, by the row-level security matrix
**Reproduced by:** `tests/rls/matrix.test.ts` → `record.entry` → *Buyer B INSERT*

## Closed

Fixed while auditing the public record, which is the surface the weakness actually
reaches. `p_record_insert` now requires the writer to be a party to the deal the
entry names, or — where there is no deal — the owner of the project it names.
`ci.assert_record_insert_is_party_scoped()` guards the predicate and has a
self-test that puts the old one back and requires the guard to fire.

Three cells in `tests/rls/matrix.ts` moved from `ok` to `blocked`, exactly as
*Why it is not fixed in this change* below predicted: Buyer B, Owner B and the
unvetted organisation. `docs/SECURITY-MATRIX.md` was regenerated from the same
source. Everything below is the finding as written; it is kept because the
reasoning is what a future widening of this policy has to answer.

## Why it was worse than "low"

The original severity was judged on reads, and on reads it was right: nothing
leaked. What it missed is where these rows are *displayed*.

`record.v_public_entry` resolves an entry's counterparty against
`coalesce(deal_buyer_org_id, actor_org_id)` — that is, against the organisation
whose deal the row names, not against its author. A forged row therefore appeared
on `/record` under **that** organisation's deal label, or under its legal name if
it had disclosed that deal. One buyer could put a public, permanent statement in
another buyer's mouth. R4 then means it can never be removed, only explained.

## What happens

`record.entry` is the only table in the matrix whose INSERT policy checks that a
row is stamped with the **writer's own** organisation, and not that the writer is
a party to the thing the row is about:

```sql
CREATE POLICY p_record_insert ON record.entry FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (actor_org_id = sylva.actor_org_id());
```

Every other column is free. `deal_id`, `deal_buyer_org_id` and
`deal_owner_org_id` are constrained only by a composite foreign key back to
`deal.deal`, which checks that the three values describe a **real** deal — not
that they describe *this writer's* deal.

So Buyer B, connected as `sylva_buyer` with its own valid context, can insert:

```
entry_type         interest_expressed
project_id         project 1
deal_id            Buyer A's deal
deal_buyer_org_id  Buyer A
deal_owner_org_id  Owner A
actor_org_id       Buyer B          ← its own, so the policy is satisfied
```

Confirmed against the live database. Owner B and the unvetted organisation can
do the same thing.

## What it is not

- **Not a read leak.** Buyer B still cannot `SELECT` that deal, its messages, its
  terms or its documents. Every one of those returns zero rows, asserted
  table by table in the matrix.
- **Not impersonation.** The same policy that permits this refuses
  `actor_org_id = <Buyer A>`, so a forged row always carries its real author.
- **Not currently reachable through the product.** Nothing in the application
  builds this statement, and Buyer B has no route to Buyer A's `deal_id`: it is
  a UUID it cannot read anywhere. The finding is about what the database permits,
  which is the level this schema chose to defend at — *"the rules belong in the
  database … because application code gets rewritten"*.

## Why it still matters

R4. The record is append-only: `UPDATE` and `DELETE` are revoked and
trigger-blocked. A junk entry cannot be removed, only corrected by a further
entry that points at it — and the wrong one stays visible, for ever, in a record
whose whole purpose is to be evidence of what was agreed.

An append-only record is exactly the place where a weak write check is expensive,
because the cost of a bad row is not "fix it" but "explain it".

## Suggested fix

Narrow the `WITH CHECK` so that a deal-bearing entry can only be written by a
party to that deal. The shape below composes with the existing clause and needs
no new column, because the counterparties are already denormalised onto the row:

```sql
DROP POLICY p_record_insert ON record.entry;
CREATE POLICY p_record_insert ON record.entry FOR INSERT
  TO sylva_buyer, sylva_project_owner
  WITH CHECK (
    actor_org_id = sylva.actor_org_id()
    AND (
      deal_id IS NULL
      OR deal_buyer_org_id = sylva.actor_org_id()
      OR deal_owner_org_id = sylva.actor_org_id()
    )
    -- an entry with no deal must still be about something the writer owns
    AND (deal_id IS NOT NULL
         OR actor_org_id = sylva.actor_org_id())
  );
```

Consider also constraining `project_id` on a deal-less entry — a `listed` entry
should come from the project's owner — and giving the new policy a self-test in
the migration, in the style migrations 0027–0030 established: grant the wrong
thing, assert the guard fires, revoke it.

## Why it is not fixed in this change

The row-level security matrix was built with no migration range of its own;
`record.entry` belongs to the record work (migrations 0075–0079). Fixing a policy
from outside the range that owns it is how two migrations end up disagreeing
about the same table.

The matrix therefore **asserts the current behaviour**, with the finding printed
on every run and carried into `docs/SECURITY-MATRIX.md` under *Known weaknesses*.
When the policy is narrowed, three cells in `tests/rls/matrix.ts` change from
`ok` to `blocked` and the finding comes out. That is the intended workflow: the
test suite is where the weakness is visible, not where it is hidden.
