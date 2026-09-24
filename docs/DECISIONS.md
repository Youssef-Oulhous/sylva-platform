# Blocking design decisions

Status: **decided by the development partner, pending client confirmation.**

These five questions were raised by the requirements analysis as blocking. The concept
note and the developer brief do not answer them explicitly. Rather than stall the build,
each is decided below from what the two documents *do* say, optimised for runtime
performance and for the durability of the seven rules.

None of these is a silent invention: each is recorded here with its evidence, its
alternatives, and the consequence of the client overruling it. If the client disagrees,
the change is localised to the mechanism named in "Blast radius".

Sources: `reference/concept-note-2026-09-22.txt` (client, 22 Sep 2026) and the developer
brief (client, 23 Sep 2026).

---

## D1 — A credit is a LOT, not a single unit and not a bare number

**Decision.** The unit of storage is a `unit_lot`: one row representing a quantity of
*identical* units — same project, same period, same scheme, same unit type, same registry
record. State lives on the lot. Operations split lots rather than mutating quantities.

**Evidence for the tension.** Rule 3 ("once retired or cancelled, a *credit* never changes
state again") speaks of a credit as an entity with a lifecycle. Rule 1 ("committed *volume*
never exceeds expected issuance less the buffer") and the whole availability pane speak of
a quantity. Both are in the same list of seven.

**Why the lot resolves it.**

| Rule | How the lot satisfies it |
|---|---|
| R1 | Availability is `SUM(quantity)` over lots within one project-period. Same unit type by construction, so the sum is always meaningful. |
| R2 | `registry_record_id` is `NOT NULL` on any lot in an allocated, transferred or retired state — one reference per lot, which is how schemes actually issue. |
| R3 | `retired` and `cancelled` are terminal lot states. A terminal lot is never updated and never split again. |

**Why not row-per-unit.** A single pilot project expects ~12,400 units in one period.
Row-per-unit means millions of rows across the portfolio and 4,800 `UPDATE`s to retire one
tranche. It also duplicates the scheme registry's job of holding per-unit serials — and the
note is explicit that *"we are not the registry"* and that schemes *"do not give outside
systems write access"*. We would be maintaining a shadow serial table we can never reconcile.

**Why not a bare quantity.** A balance number has no identity, so R3 has nothing to make
terminal and R2 has nothing to hang a registry reference on. Both rules become application
conventions, which is exactly what the note says must not happen.

**Shape.**

```
unit_lot
  id
  project_id, period_id, unit_type_id      -- unit_type_id carries scheme + metric + UoM
  quantity                                  -- NUMERIC, CHECK (quantity > 0)
  state                                     -- expected | issued | allocated | transferred | retired | cancelled
  registry_record_id                        -- NOT NULL when state in (allocated, transferred, retired)
  parent_lot_id                             -- set when this lot was split off another
  created_event_id                          -- the append-only event that created it
```

Splitting is an insert of two child lots plus a terminal marker on the parent, all inside
one transaction, all written to the event record. Nothing is ever edited in place.

**Performance.** Hundreds of lots per project-period, not millions of units. A partial
index on `(project_id, period_id, unit_type_id) WHERE state NOT IN ('retired','cancelled')`
serves the availability pane in a single index-only scan.

**Blast radius if overruled.** Only the `unit_lot` table and the split function. The
availability, deal and record layers read through a view and do not change.

---

## D2 — "Committed" is two-tier: reserved at Term Sheet, committed at Signed

**Decision.** Rule 1 is enforced against `reserved + committed`, not against `committed`
alone.

| Deal stage | Effect on capacity |
|---|---|
| Interest | none |
| Letter of Intent | none |
| Term Sheet | **reserved** — holds capacity, carries an expiry date |
| Signed | **committed** — binding, no expiry |

**Evidence for the tension.** The note gives the stages (*"first interest, through a letter
of intent and a term sheet, to signed"*) and gives Rule 1, but never says which stage
consumes capacity.

**Why this split.**

- Expressing interest is free, one click, and the note designs it to be low-friction. If
  interest consumed capacity, a handful of curious buyers would lock out a project's entire
  2028 vintage and the platform would block the deals it exists to create.
- An LOI is a statement of intent. Treating it as a capacity claim gives it a weight the
  note does not give it.
- A term sheet is where volume and price are agreed. That is a real claim on the project's
  output and must hold capacity, or two term sheets can both progress to signed and jointly
  bust the cap — the exact failure Rule 1 exists to prevent.
- Reservations therefore need an expiry, or a stalled negotiation sterilises the project
  forever. Expiry release is itself an event in the record, never a deletion.

**Co-investment.** The note says a co-investor *"funds a share of the project directly and
the volume it does not need is sold to other buyers"*. So a co-investment carries an
entitlement volume that **does** consume capacity from the moment it is signed, with a
declared surplus that is released back to available. It is not the same as a purchase and
does not reduce to one.

**Enforcement.** A per-project-period balance row holding `expected`, `buffer`, `reserved`,
`committed`, guarded by a `CHECK (reserved + committed <= expected - buffer)`, updated only
by a `SERIALIZABLE`-safe trigger that takes a row lock on the balance. Two concurrent term
sheets cannot both pass.

**Also decided.** `expected_issuance` may not be lowered, and `buffer` may not be raised,
below what is already reserved plus committed. Without this the invariant can be broken
retroactively from the project side — a hole all three schema candidates initially had.

**Blast radius if overruled.** One trigger function and one enum mapping stage to capacity
effect. Moving the reservation point to LOI or to Signed is a one-line change.

---

## D3 — Events never reference a user; erasure deletes one row and breaks nothing

**Decision.** No foreign key exists from the append-only record to the user accounts
table. Events carry `(organisation_id, actor_ref, actor_role_at_time)`, where `actor_ref`
is an opaque stable UUID. The mapping from `actor_ref` to a person lives only in
`user_account`. Erasure scrubs that one row.

**Evidence.** The note: *"Personal data sits in one table only, the user accounts.
Everything else references organisations by ID. A person must be deletable without breaking
the permanent record; that is how the right to erasure and an append-only record coexist."*
It states the goal and not the mechanism.

**Why no FK is the whole answer.** With a foreign key there are only two outcomes, and both
are wrong: `ON DELETE RESTRICT` makes the person undeletable, `ON DELETE CASCADE` destroys
the permanent record. Rule 4 and the right to erasure are only compatible if the reference
is deliberately not enforced.

**What survives erasure:** organisation, role at the time, event type, timestamp, object,
prior state, new state, correcting-entry links, registry references, document hashes and
versions, deal stages, agreed terms.

**What is destroyed:** name, email, phone, job title, IP address, session records, and any
contact detail — everything in `user_account`.

**What resolves differently afterwards:** any screen that showed a person's name shows
*"Former member — {Organisation}"*. The record is unchanged; only the lookup fails, which
is the intended behaviour.

**The auditor.** The note grants auditors *"real names, where permitted"*. After erasure it
is no longer permitted, so the auditor sees the organisation and the role. This is a
narrowing of auditor visibility over time and must be stated in the audit documentation so
it is not read as tampering.

**Open, and genuinely legal, not technical.** Message bodies authored by an erased person
are retained, because they are business correspondence between two organisations and part of
the deal record. If a message body itself contains personal data, retention is a question
for the client's counsel and is not decided here.

**Blast radius if overruled.** None structurally — the absence of an FK is permissive. A
stricter policy is added on top.

---

## D4 — Catchments: the project supplies its own polygon; EU-Hydro is the reference layer

**Decision.** Two distinct things, never conflated:

1. **The project's catchment** is uploaded GeoJSON, supplied by the project owner, carrying
   a mandatory `source` and `as_of` date — like every other figure on the platform. This is
   what the project page displays and what the GeoJSON download returns.
2. **The reference catchment layer** is EU-Hydro (Copernicus Land Monitoring Service, EEA),
   with the Water Framework Directive River Basin Districts as the coarse label. Used for
   context on the map and to answer *"is my site in the same catchment?"*.

**Evidence.** The note names no data source, but requires *"the project boundary and the
surrounding catchment on a satellite map"*, requires boundaries to be GeoJSON and
downloadable, and requires that *"every figure on screen carries its source and date"*. A
catchment polygon is a figure.

**Why the project supplies it.** The catchment relevant to a restoration project is a
hydrological judgement made in that project's design document. Deriving it ourselves would
be us making an environmental claim — which the brief forbids — and it would carry no
provenance.

**Why EU-Hydro for the reference layer.** It is EU-produced, EU-hosted, openly licensed and
self-hostable, so it survives the "no non-EU dependency" constraint. Global alternatives
such as HydroBASINS carry licence and residency questions the pilot does not need.

**"Same catchment" is defined, not implied.** Two locations are in the same catchment when
they share the same reference catchment identifier *at a stated level*, and the level is
displayed next to the answer. A vague "same catchment" badge would be exactly the kind of
unsupported claim the brief rules out.

**Storage and performance.** `geography(MultiPolygon, 4326)` with a GiST index. Distance is
`ST_Distance` on geography — great-circle metres, stated on screen as straight-line distance,
not travel distance. Two representations are stored: full precision for the GeoJSON download,
and an `ST_SimplifyPreserveTopology` version served to the map, so a boundary with tens of
thousands of vertices does not become the page's performance problem.

**Blast radius if overruled.** The reference layer is swappable — it is one table and one
loader. The project-supplied polygon is the authoritative one either way.

---

## D5 — End of October ships the note's release, not the brief's 24 items

**Decision.** The first release is the scope the note itself defines in section 10. The
brief's 24-item list is the MVP *definition of done*, not the 31 October deliverable.

**Evidence.** The note: *"The first release, which we want live by the end of October, is
the public side plus a way in: the projects index with the catchment map, a full page for
each pilot project with its idea note and design document, registration of a buyer's own
sites so distances can be shown, the vetting questionnaire, the Express interest button, and
the public record showing interest events."* That is narrower than 24 items. Roughly five
weeks are available from 23 September.

**Ships by 31 October.** Projects index and catchment map · full project pages with idea
note and design document · buyer registration and organisation profile · buyer site
registration with private distance · vetting questionnaire · admin vetting and approval ·
Express Interest · public interest-event record · authentication and role-based permissions ·
PostgreSQL with RLS · document upload and storage · the project and unit data model · the
audit and event log · i18n machinery · EU hosting · the EU funding notice · analytics.

**Deliberately deferred.** The private deal room and messaging, the three deal shapes,
issuance, allocation, retirement and cancellation records, investor financial data and
investor access control, exports and advanced reporting. All of these are Phase 2 in the
brief already.

**Cut list, in the order things get cut if the date is at risk.**

1. German *content* — the i18n machinery and the German UI strings ship; translated project
   prose follows. The machinery is not cuttable: the note requires a translation library
   from the first commit.
2. The map/list toggle and the richer index filters — ship the list with country, outcome
   type and status filters only.
3. The evidence pack as a composed PDF — ship it as a manifest plus a document bundle, with
   the same stated contents and the same disclaimer.
4. Buyer site bulk import — single-site manual entry only.
5. Admin screens beyond the vetting queue and project publication — table-driven, unstyled.

**Never cut, at any point.** Row-level security and its cross-organisation test matrix; the
database enforcement of rules 1 to 6; the rule 7 guard; the append-only record; the audit
log. These are the product. A platform that ships on time without them is worse than one
that ships late.

**Blast radius if overruled.** If the client insists on all 24 items by 31 October, the
honest answer is that either the date or the security testing moves, and the security
testing must not be the thing that moves.
