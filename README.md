# Sylva — European wetland restoration platform

A platform where European wetland restoration projects are presented to corporate
buyers and investors, so they can evaluate a project, get in touch privately, agree
a deal, and have every step recorded permanently.

**Mental model:** a property listing site + a private deal room + a permanent
transaction record.

It is **not** a marketplace, not a carbon platform, not e-commerce, not a bank, and
**not a credit registry**. Each credit scheme runs its own official registry; this
platform holds *references* to those records plus the supporting documents. Our
record is evidence of what was agreed **here**, not the authoritative record of what
exists.

Sylva operates it as part of an **EU-funded pilot**.

---

## 1. Read these first, in this order

Everything below is downstream of these three. If this README ever contradicts them,
they win.

| # | File | What it is |
|---|------|-----------|
| 1 | [`docs/reference/concept-note-2026-09-22.txt`](docs/reference/concept-note-2026-09-22.txt) | **The client's concept note. The product source of truth.** 10 sections, ~1,800 words. Read all of it. |
| 2 | [`docs/reference/frontend-master-prompt.md`](docs/reference/frontend-master-prompt.md) | The client's design contract. 48 sections. What the UI must and must not be. |
| 3 | [`docs/DECISIONS.md`](docs/DECISIONS.md) | Five blocking decisions already made, with evidence and blast radius. Read before you change the data model. |

Then, when you need them:

| File | What it is |
|------|-----------|
| [`docs/architecture/sylva-architecture.excalidraw`](docs/architecture/sylva-architecture.excalidraw) | **The whole system on one canvas.** Drag it onto [excalidraw.com](https://excalidraw.com) to open and edit. |
| [`docs/architecture/sylva-architecture.svg`](docs/architecture/sylva-architecture.svg) | The same picture, openable in any browser, no tool needed. |
| [`docs/FINDING-001-org-context-forgery.md`](docs/FINDING-001-org-context-forgery.md) | A critical security hole found by testing, and how it was closed. Read it to understand the auth model. |
| [`docs/SECURITY-MATRIX.md`](docs/SECURITY-MATRIX.md) | **Who may read and write what.** Ten principals × twenty tables × four verbs, generated from `tests/rls/matrix.ts` and asserted against a live database by `npm run test:rls`. Read it before you widen any policy. |
| [`docs/FINDING-002`](docs/FINDING-002-record-entry-cross-deal-append.md) · [`-003`](docs/FINDING-003-whoami-unreachable.md) · [`-004`](docs/FINDING-004-password-hash-grant.md) | Three open findings the matrix raised. None is a read leak; all three are one migration each. |

---

## 2. Where the project actually is

Honest status. Nothing below is aspirational.

### Done and tested

- **Database**: 41 migrations, 81 tables, 220+ RLS policies, 124 triggers, **22 CI guards, all passing on a from-scratch database**.
- **All seven business rules enforced in PostgreSQL** (see §5).
- **Security model**: 6 login roles, none with `BYPASSRLS`, none superuser. Cross-organisation isolation tested against a live database.
- **Demo data**: 2 published projects under **different schemes with incompatible unit types**, 11 organisations, 9 users, geometry, documents, availability.
- **i18n**: English and German, 2,303 keys, **full parity**, checked by `npm run check:i18n`.
- **762 automated tests**, all passing.
- Verified end to end: `db/apply.sh --fresh` + seeds reproduces the whole database from nothing.
- **Rule 7 linter** wired into `npm run check:rule7`.

### Frontend — 20 routes exist, all 20 are demo-ready

| Route | |
|---|---|
| `/` landing | `/projects` index |
| `/projects/[slug]` **the project page, 11 sections** | `/projects/[slug]/express-interest` |
| `/how-it-works` · `/for-buyers` · `/for-investors` | `/about` |
| `/record` · `/sign-in` · `/register` | `/vetting` · `/vetting/status` |
| `/dashboard` · `/dashboard/sites` | `/owner` · `/owner/projects/new` |
| `/owner/questions` · `/admin/vetting` | `/admin/projects` |
| Verified with no sideways scroll at 390/768/1280/1900px | |

**The five that used to render raw translation keys** — `/about`, `/vetting/status`,
`/owner`, `/owner/projects/new`, `/admin/projects` — were repaired on 24 Sep 2026. The
components had always been complete; the keys were simply missing from
`src/messages/*.json`. **`npm run check:i18n` now fails the build on a missing key**, so
that cannot happen again silently. See §11.

### Authentication — built and tested

Sign-in, registration, sessions and sign-out are wired to the database. 24 tests in
`tests/db/auth.test.ts`. See §6.4.

- Passwords are **scrypt** (`node:crypto`), 16-byte random salt, parameters stored
  with the hash. No native addon, so it installs on a machine with no compiler.
- **No application role can read `identity.user_account`**, so authentication is six
  `SECURITY DEFINER` functions in `db/migrations/0040`, granted to
  `sylva_login_public` and to nothing else.
- The session cookie holds a 32-byte opaque token; the database stores only
  `sha256(token)`. The raw token is never sent to the database at all.
- **Demo password: `demo-password-not-for-production`**, for every account in
  `db/seed/0001_demo_reference.sql` (`buyer.a@demo.sylva.example`,
  `owner.a@…`, `operator@…`, `auditor@…`, …). Set by
  `db/seed/0006_demo_passwords.sql`; regenerate it with
  `npx tsx scripts/make-demo-passwords.ts`.

### Not built at all

All other data mutations, the deal room, document upload/storage, the map basemap,
analytics, email, password reset. **Most pages are still frontend-only** and read
from a `demo-data.ts` const, except the projects index, the project page, and the
sign-in and registration forms, which read and write the real database.

---

## 3. Get it running

You need **Node 20.9+**. You do **not** need Docker, sudo, or a system PostgreSQL —
the database runs entirely inside `~/.local`.

```bash
# 1. install the local database (PostgreSQL 16 + PostGIS 3.5, no sudo)
#    already installed on the original machine; on a new one:
curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest -o /tmp/mm.tar.bz2
python3 -c "import tarfile,shutil,os; t=tarfile.open('/tmp/mm.tar.bz2','r:bz2'); \
  f=t.extractfile('bin/micromamba'); os.makedirs(os.path.expanduser('~/.local/bin'),exist_ok=True); \
  p=os.path.expanduser('~/.local/bin/micromamba'); shutil.copyfileobj(f,open(p,'wb')); os.chmod(p,0o755)"
export MAMBA_ROOT_PREFIX=~/.local/opt/micromamba
~/.local/bin/micromamba create -y -p ~/.local/opt/micromamba/envs/sylva-pg \
  -c conda-forge "postgresql=16" postgis

# 2. start it
./scripts/dev-db.sh start

# 3. create the schema and load the demo data
cp .env.example .env.local        # then check PGPORT etc. match
./db/apply.sh --fresh
for f in db/seed/*.sql; do ./scripts/dev-db.sh psql -d sylva_dev -q -f "$f"; done
#    db/seed/0006_demo_passwords.sql sets every demo account's password to
#    demo-password-not-for-production. Also demo-only; never run in a deployment.
#    db/seed/0000_bootstrap.sql runs first and inserts the actor-context
#    signing key. Without it every organisation-scoped query returns nothing
#    and it looks like RLS is broken. A DEPLOYED environment must not run that
#    file - generate the key out of band and insert it once.

# verify: all twenty database guards should pass
./scripts/dev-db.sh psql -d sylva_dev -c "
  DO \$\$ DECLARE r record; BEGIN
    FOR r IN SELECT proname FROM pg_proc
             WHERE pronamespace='ci'::regnamespace AND proname LIKE 'assert%'
    LOOP EXECUTE format('SELECT ci.%I()', r.proname); END LOOP;
    RAISE NOTICE 'all guards passed';
  END \$\$;"

# 4. install and run
npm install
npm run dev                       # http://localhost:3000
```

> On the original machine there was **no compiler, no Docker and no passwordless
> sudo**, which is why the database is a userland conda install rather than a
> container. If your machine has Docker, `postgis/postgis:16-3.5` is equivalent and
> simpler — just point `.env.local` at it.

### Everyday commands

```bash
npm run dev            # dev server
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm test               # all tests
npm run check:rule7    # the Rule 7 linter — this one can fail your build
npm run check:i18n     # en/de parity + every t('key') resolves — this one too
./db/apply.sh          # apply any new migrations
./scripts/dev-db.sh psql -d sylva_dev     # a psql prompt
```

---

## 4. Architecture

```
Browser
  │  server-rendered pages, EN at /… and DE at /de/…
  ▼
Next.js 15 (App Router, React 19, Server Components)
  │  src/lib/db/session.ts  ── withActor(actor, fn)
  │     BEGIN
  │     mint a SIGNED actor context      (as the login role)
  │     SET LOCAL sylva.actor_ctx = …
  │     SET LOCAL ROLE sylva_buyer|…     (drop to the privilege role)
  │     …your queries…
  │     COMMIT                            (SET LOCAL unwinds with the transaction)
  ▼
PostgreSQL 16 + PostGIS 3.5
     RLS + privileges + triggers + CHECK constraints = the seven rules
```

**Why this shape.** The concept note says the rules *"belong in the database as
constraints, triggers and permissions, not in application code, because application
code gets rewritten and the rules must survive that."* So the database is the
authority and the application is a client of it. If you rewrite the whole frontend,
the rules still hold.

### Tech choices, and why

| Choice | Why | Rejected |
|---|---|---|
| **Next.js 15 App Router** | The note demands project pages be server-rendered, fast, shareable and indexable. Server Components give that without a client bundle. | SPA — not indexable |
| **`pg` (node-postgres), raw SQL** | An ORM fights RLS: it hides the connection, and the connection is where the security context lives. | Prisma, Drizzle |
| **4 connection pools, one per login role** | An anonymous request is served by `sylva_login_public`, which is a member of nothing. An authorization bug in app code *cannot* turn a visitor into a buyer — Postgres refuses. | one pool + app-level checks |
| **next-intl** | EN/DE from the first commit, as the note requires. | hand-rolled |
| **CSS Modules** | No build-time framework lock-in, no utility-class soup in a document-like UI. | Tailwind |
| **IBM Plex, self-hosted** | One family. Tabular figures for the availability tables. Loading fonts from a CDN would send every reader's IP outside the EU. | Google Fonts CDN |
| **PostGIS** | Boundaries, catchments, geodesic distance. | app-side geo maths |

### Directory map

```
db/
  migrations/         31 files. 0001–0025 = release 1, 0101–0106 = phase 2.
                      IMMUTABLE once applied — apply.sh refuses a changed file.
  seed/               5 files. Demo data. Every org name starts with "DEMO ".
  apply.sh            migration runner with checksums
scripts/
  dev-db.sh           start | stop | status | psql
  check-rule7.ts      the Rule 7 linter
src/
  app/[locale]/       routes. layout.tsx holds the EU notice + demo banner.
  components/         one folder per page area + ui/ + eu/
  lib/
    db/               actor.ts (role mapping) · pool.ts · session.ts (withActor)
    units/qty.ts      UnitQty + addSameUnit — the app half of Rule 7
    projects/         the only real data queries so far
    i18n/             config · routing · request
  messages/           en.json · de.json — 2,303 keys, must stay in parity
  styles/             tokens.css · globals.css
docs/                 the three source-of-truth files + decisions + findings
tests/db/             integration tests against a real database
tests/rls/            the row-level security matrix. catalog.ts = the principals
                      and fixture ids · matrix.ts = THE expectations, and the
                      source docs/SECURITY-MATRIX.md is generated from ·
                      context.ts = the attacker's shell, the one place that does
                      not go through withActor()
```

---

## 5. The seven rules — the heart of the product

From the concept note, section 8. **These are not guidelines.** The note says six of
them belong in Postgres; rule 7 it says cannot be. That turned out to be only mostly
true.

| # | Rule | Where it lives | Test |
|---|------|----------------|------|
| **R1** | Committed volume never exceeds expected issuance less the buffer | `CHECK (reserved_raw + committed_raw <= expected_issuance_raw - buffer_raw)` on `proj.period_balance` | `ci.assert_r1_counts_reservations()` |
| **R2** | No credit allocated, transferred or retired without a registry reference | `NOT NULL` + FK to a **confirmed** `credit.registry_record`, and a `sylva.nonblank` domain so an empty string cannot satisfy it | migration 0102 |
| **R3** | Once retired or cancelled, a credit never changes state again | terminal-state `CHECK` + append-only triggers | `ci.assert_r3_literals_match_lookup()` |
| **R4** | The record is append-only; a mistake is corrected by a **new** entry pointing at the wrong one, and the wrong one stays visible | revoked `UPDATE`/`DELETE` privileges **plus** row, statement and `TRUNCATE` triggers, `ENABLE ALWAYS` | `ci.assert_append_only_complete()` |
| **R5** | Buyer identity is pseudonymous unless that deal is flagged for disclosure | `deal.deal_pseudonym`, **one label per deal**; `org_id` withheld by column-level grant | `ci.assert_pseudonym_is_per_deal()` |
| **R6** | No deal for an organisation that has not been approved | approval is **derived** from a recorded `org.vetting_decision` by trigger, never written directly | migration 0005 |
| **R7** | No screen, query, export or chart adds unit volumes across different projects | **three layers — see below** | `npm run check:rule7` + `src/lib/units/qty.test.ts` |

### Rule 7 deserves its own explanation

Units from different projects measure different things. One project sells
**hectare-years**; another sells **points on an index**. Adding them produces a
meaningless number. The demo data is built to make this concrete — the two published
projects deliberately use incompatible unit types, so a bad total fails in
development rather than quietly in production.

Three layers:

1. **PostgreSQL.** `sylva.unit_qty` is a composite type `(project_id, unit_type_id, amount)`.
   The only aggregate over it, `sylva.sum_same_unit`, **raises `SY007`** if asked to
   add across either. And `proj.project_unit_type` is a composite-FK spine that makes
   a volume in a unit type the project does not sell **unrepresentable**.

   ```sql
   SELECT (sylva.sum_same_unit(b.remaining_qty)).amount FROM proj.period_balance b;
   -- ERROR: R7: refusing to add unit volumes across projects (… and …)
   -- HINT:  Units of different projects are not interchangeable. Add project_id to GROUP BY.
   ```

2. **TypeScript.** `src/lib/units/qty.ts`. `UnitQty` carries its scope; `addSameUnit`
   throws `IncomparableUnitsError`. Query rows always select `project_id`,
   `unit_type_id` and the amount **together**, and wrap them immediately.

3. **The linter.** `npm run check:rule7`. Catches the escape hatches — `.reduce(… .amount)`,
   `total += x.amount`, `a.amount + b.amount`, `sum(col_raw)` in SQL, and names like
   `totalUnits`. **Exit code 1 fails the build.** Reviewed exceptions live in a
   `REVIEWED` array in the script and are printed on every run, so they stay visible.

**What no layer can stop:** someone reaching past the composite — `(qty).amount` in
SQL, `.amount` in TypeScript — and adding the bare numbers. That is why the linter
and the tests exist. Treat any new `.amount` outside a formatter as a review flag.

---

## 6. Security model

The client's stated worst case: *"One buyer seeing another buyer's prices or terms is
the failure we most need to avoid."*

### Two independent axes

| | Mechanism | Forgeable? |
|---|---|---|
| **Role** (buyer / owner / investor / operator / auditor) | the PostgreSQL role, via `SET LOCAL ROLE`. `is_operator()` tests `current_user`. | **No.** A role cannot `SET ROLE` to a role it is not a member of. |
| **Organisation** | an HMAC-signed context in a GUC, verified inside a `SECURITY DEFINER` function | **No, since migration 0019.** It *was* — see below. |

### Read FINDING-001 before you touch auth

The organisation context was originally a bare session variable:

```sql
SELECT nullif(current_setting('sylva.actor_org_id', true), '')::uuid
```

Any connected role could re-`SET` it. Proven live: `sylva_buyer`, holding a valid
context for organisation A, re-set the GUC to organisation B and read B's private
site. **Found by running the attack, not by reading the DDL.**

Fixed in [`db/migrations/0019_a17_signed_actor_context.sql`](db/migrations/0019_a17_signed_actor_context.sql):
the app sends one signed value `org:person:expiry:hmac`, verified against a key in
`sylva.context_key` that **no application role holds any privilege on**. A buyer can
still set the GUC; it cannot forge a valid one, and cannot read the key to make one.

Guarded by `ci.assert_signed_context()`. **If that ever fails, stop and fix it.**

### Roles

```
sylva_login_public    → sylva_web_anon                     anonymous visitors
sylva_login_app       → sylva_buyer | sylva_project_owner | sylva_investor
sylva_login_operator  → sylva_operator                     Sylva staff
sylva_login_auditor   → sylva_auditor                      read-only, funder + external
sylva_login_report    → sylva_report
sylva_login_migrate   → sylva_owner                        migrations only
```

None holds `BYPASSRLS`. None is a superuser. Privilege roles **cannot log in**.

### 6.4 Authentication

The identity schema is sealed: `GRANT USAGE ON SCHEMA identity` goes to
`sylva_operator`, `sylva_auditor` and — since migration 0040 — `sylva_login_public`,
which is a **login** role holding no table privilege there. `sylva_web_anon`,
`sylva_buyer`, `sylva_project_owner`, `sylva_investor`, `sylva_report` and
`sylva_record` hold none, so no query the application actually runs can reach it.
`ci.assert_identity_is_sealed()` proves both halves and has a self-test.

Sign-in is deliberately **two calls**, because PostgreSQL cannot compute scrypt and
handing the stored hash to the application would undo the seal:

| | |
|---|---|
| `identity.auth_salt(email)` | returns the scrypt parameters and salt — **never** the derived key. For an address with no account it returns a **decoy** salt, derived from the address under the context key, so the caller does the same work and a wrong email costs the same as a wrong password. |
| `identity.authenticate(email, derived_key)` | compares **inside the database**, over sha256 digests, and returns the account row or no row. |

Sessions: `identity.open_session` / `resolve_session` / `close_session`.
Registration: `identity.register` — organisation, account, record label and role in
one transaction, and **no approval**. R6 still refuses that organisation a deal.

The application side is `src/lib/auth/`: `password.ts`, `tokens.ts`, `queries.ts`,
`session.ts` (`getActor()`, cached per request), `guards.ts`, `actions.ts`. The one
unit of work that runs before an actor exists is `withLoginRole()` in
`src/lib/db/session.ts`; everything else still goes through `withActor()`.

Two findings from the row-level security matrix belonged to this work and are
**closed in migration 0042**:

- [`FINDING-003`](docs/FINDING-003-whoami-unreachable.md) — `identity.whoami()`
  was granted to three roles that had no `USAGE` on the schema, so the grant was
  inert and a buyer could not read its own name. They now hold `USAGE`, which
  grants nothing on the tables.
- [`FINDING-004`](docs/FINDING-004-password-hash-grant.md) — migration 0016
  granted `identity.user_account` to the operator and the auditor **without a
  column list**, so filling `password_hash` silently widened it to cover a
  secret. Now a column list, and `ci.assert_no_credential_grants()` keeps it one.

**Not built:** password reset, email verification, MFA (`mfa_secret` exists and is
unused), and **rate limiting** — scrypt at ~16 MiB per attempt is the only brake on
credential stuffing today.

### Personal data and erasure

Personal data lives in **one table**, `identity.user_account`. Crucially:

> **`person_ref` is a foreign key to nothing.**

That is the whole erasure design. With an FK there are only two outcomes and both are
wrong: `RESTRICT` makes the person undeletable, `CASCADE` destroys the permanent
record. Deleting a user is one row; the record keeps `(organisation_id, actor_ref,
role_at_time)` and the lookup simply fails, which is intended. `ci.assert_no_fk_into_identity()`
proves the invariant has not eroded.

**Not covered, and you must design it:** free text and uploaded files. Messages,
questionnaire answers and signed PDFs contain names. The one-table design covers
structured data only. See §10.

---

## 7. Database

### Conventions that will surprise you

- **Migrations are immutable once applied.** `apply.sh` stores a SHA-256 and refuses
  a changed file. Add a new migration instead. This is deliberate.
- **Most tables are append-only.** `UPDATE` and `DELETE` are revoked *and*
  trigger-blocked. To change page text you insert `version_no + 1`; the old version
  stays visible. This bites you the first time — it is R4 working.
- **`*_raw` numeric columns are never granted** to an application role. Only the
  `*_qty` composites are readable, because the composite carries the scope that makes
  the number mean something. `ci.assert_no_raw_amount_grants()` enforces it.
- **Every displayed figure needs provenance.** `source_ref_id` is `NOT NULL` on the
  tables that hold displayed values. You cannot insert a figure without a source and
  an as-of date. Even a buyer's own site coordinate needs one.
- **Publication is a database gate.** `proj.enforce_publication_gate()` refuses to
  publish a project missing any of: english page text, boundary, claim rights,
  outcomes, outcome baseline, durability, verifier, project idea note, project design
  document, availability.
- **EU hosting is a foreign key.** `platform.storage_region.member_state` references
  `platform.eu_member_state`. A London or Zurich region is a constraint violation,
  not a policy.

### Schemas

```
sylva      shared types: unit_qty, nonblank, sha256 · source_ref · actor context
identity   user_account, person_label, user_session, erasure_event — ALL personal data
org        organisation, pseudonyms, vetting (questionnaire → submission → decision → approval)
proj       project, text, outcomes, claim rights, durability, periods, balances, geometry gate
geo        project_geometry (boundary | catchment), buyer_site
units      scheme, unit_type (metric + UoM + vintage semantics)
doc        document, document_version, withdrawal
deal       deal, stages, pseudonyms, terms, commitments
credit     registry_record, credit_position  (phase 2)
record     entry, entry_type, v_public_entry — the append-only record
platform   reference data, EU member states, storage regions, locales
ci         20 assert_* guards — run these in CI
i18n       locale + translation status
```

### The CI guards

```bash
./scripts/dev-db.sh psql -d sylva_dev -c "
  SELECT p.proname FROM pg_proc p
  WHERE p.pronamespace='ci'::regnamespace AND p.proname LIKE 'assert%';"
```

22 of them. **Run every one in CI after migrating.** They encode guarantees that are
otherwise invisible: no FK into identity, no personal columns outside identity, no
raw amount grants, append-only complete, RLS complete, auditor read-only, web_anon
read-only, no float columns, no soft delete, signed context intact, pseudonym per
deal, public views still granted.

> **Two migrations in a row broke the public read surface by accident.** `DROP VIEW`
> discards privileges silently, and `ALTER TABLE … DROP COLUMN` discards column
> grants. `ci.assert_public_views_are_granted()` exists because of that and names the
> columns explicitly. If you rebuild a view or a generated column, **re-grant**.

---

## 8. Frontend

### Design contract, in one paragraph

Professional, trustworthy, analytical, document-oriented, calm. One typeface
(**IBM Plex**, self-hosted). One accent (**forest green `#1F4D3A`**) plus **water
blue `#1B5A78`** reserved for water outcomes and map chrome. No photography, no
illustration, no gradients, no emoji, no decorative animation, no marketing language.
Tables for data. Every figure carries its source and date. It should read like an
institutional due-diligence document — **not a SaaS dashboard, not a campaign site**.

All colours were contrast-measured, not guessed: forest **9.30:1**, water **7.29:1**,
body ink **16.83:1**, muted **5.17:1**. All pass WCAG AA; most pass AAA.

### Rules that are easy to break

- **Never total units across projects.** Always print the unit label beside a number.
- **Every figure gets a `<SourceStamp>`.**
- **No hardcoded user-facing strings.** Everything through `next-intl`.
- **Grid and flex children need `min-width: 0`.** `globals.css` sets this globally —
  the default (`min-width: auto` = min-content) let one wide table stretch the whole
  page sideways on mobile. There is also `overflow-x: clip` as a backstop; **`clip`
  not `hidden`**, because `hidden` silently breaks every `position: sticky`
  descendant and the project page relies on sticky section nav.
- **Wide tables go in `<div className="table-scroll">`.**

Verified at 390 / 768 / 1280 / 1900 px.

### Internationalisation

English first, German second, from the first commit. `src/messages/en.json` and
`de.json` — **2,303 keys, exact parity**. Check it:

```bash
npm run check:i18n
```

`scripts/check-i18n.ts` checks four things and **exits 1 on any of them**:

1. **Parity** — en and de hold the same keys, and a key that is a group in one is a
   group in the other.
2. **Resolution** — every literal `t('…')` in `src/` resolves to a key that exists,
   under the namespace that file's translator was created with. *This is the check the
   five broken pages would have failed.*
3. **ICU** — every message parses. A stray brace is a request-time error otherwise.
4. **Arguments** — a message takes the same named arguments in both languages, so a
   German sentence cannot quietly lose its `{count}`.

What it cannot check is a key built at runtime — `` t(`owner.gate.item.${code}.label`) ``
or a key held as a string in a `demo-data.ts`. It counts those and prints the count.
**Rendering the page is what verifies them**, which is why `tests/i18n/messages.test.ts`
also pins the keys that only appear on a branch the demo data does not take.

Locale content vs UI strings are different things. Translated *project content* lives
in the database with a `translation_status` (`machine_draft` → `human_draft` →
`reviewed` → `published`) and a `source_sha256`, so a **stale translation becomes a
flagged row rather than a silently wrong one**. Only `published`/`reviewed` is shown;
fallback is **per field**, so one untranslated section does not turn a German page
into an English one.

---

## 9. What to build next — in dependency order

The client wanted a first release covering *"the public side plus a way in"*.

1. ~~Fix the five broken pages~~ — **done, 24 Sep 2026.** `npm run check:i18n` keeps them fixed.
2. ~~**Authentication.**~~ **Done** — see §6.4. What is still missing on top of it:
   password reset, email verification, and rate limiting on the sign-in form.
3. **Wire the real data** into the pages that currently use `demo-data.ts`. The
   pattern to copy is `src/lib/projects/queries.ts` + `tests/db/projects.test.ts`.
4. ~~**The RLS test matrix.**~~ **Done, 24 Sep 2026.** `npm run test:rls` — ten
   principals × twenty tables × four verbs, plus seventeen named attacks, run
   **as the real PostgreSQL role with a signed actor context**. The readable grid
   is printed by the test run and published as
   [`docs/SECURITY-MATRIX.md`](docs/SECURITY-MATRIX.md), generated from the same
   source so it cannot drift. It raised FINDING-002, -003 and -004.
5. **Document upload/storage.** EU object storage, private buckets only, short-lived
   signed URLs issued only after a server-side authorization check. A document is
   never served from a public URL.
6. **Express interest, for real.** Writes the event, notifies owner + operator, shows
   the confirmation. **No deal room in release 1** — the page already says so.
7. **Owner and admin flows.** Project submission into the publication gate; the
   vetting queue.
8. **The map.** MapLibre GL + an EU-hosted tile style. Until the tile provider is
   chosen the project page draws boundaries as inline SVG on purpose — a tile request
   tells the provider which project the reader is looking at.
9. **Analytics, email, EU region config.** Required from day one by the note; not
   started.

Then phase 2: the deal room, the three deal shapes, issuance/allocation/retirement/
cancellation, investor data, exports.

---

## 10. Open decisions — these need the client, not you

Do not invent answers. Inventing a business rule is worse than flagging a gap.

| # | Question | Why it matters |
|---|---|---|
| 1 | **EU emblem asset + the exact disclaimer wording** from the grant agreement | Every page must carry them. Currently renders a **deliberately conspicuous red placeholder**. Do not guess the wording. |
| 2 | **K-anonymity on the public record** | Every row shows sector + country + size band. Per-deal pseudonyms stop a buyer's deals being linked to each other, but a *named* row still matches a pseudonymous one by those three attributes. With a handful of pilot buyers that identifies a company. Options: suppress below a minimum buyer count, or accept it. |
| 3 | **Availability disclosure** | expected / buffer / reserved / committed / remaining are mutually determining — publish any four and the fifth follows by subtraction. With one buyer in a period, `committed` **is** that buyer's deal volume. Options: bands, a suppression threshold, or accept. |
| 4 | **Evidence pack budget** | The note lists a budget among the pack's contents, but budgets are investor-only. Which figure goes in, and who may download it? |
| 5 | **Sites before vetting** | May a registered but not-yet-vetted buyer add sites? Recommended **yes** — sites are private and it helps them decide whether to apply. |
| 6 | **Auditors vs erasure** | Does the grant agreement require retaining named individuals for a fixed period? That would override erasure. |
| 7 | **Erasure of free text and files** | Messages and signed PDFs contain names. Needs a rule — redact a copy and keep the hash? Legal question, not technical. |
| 8 | **Same catchment, at what level?** | Point-in-polygon against which reference layer, at which level. Recommended: EU-Hydro (Copernicus/EEA) with the level stated on screen. |
| 9 | **Map tile provider** | A data-protection question as much as a rendering one. |
| 10 | **Demo-data notice removal plan** for launch. | |

Decisions 1–3 are the ones the client must answer before go-live.

---

## 11. Known issues

### ~~The five broken pages~~ — fixed 24 Sep 2026

`/about`, `/vetting/status`, `/owner`, `/owner/projects/new` and `/admin/projects` used
to render raw translation keys such as `ownerProjectForm.field.nameEn`. The `.tsx` and
`.css` had always been complete and typecheck-clean; the keys were missing from
`src/messages/*.json`.

Three namespaces were added — `owner` (97 keys), `adminProjects` (102) and
`ownerProjectForm` (247) — in English and in German. `/about` and `/vetting/status`
turned out to need nothing: their keys were already present, and the note above them in
this README was stale.

**If you add a page, add its keys in the same commit.** `npm run check:i18n` will refuse
the build otherwise, and `tests/i18n/messages.test.ts` runs it.

Two things that still bite:

- **The dev server caches `messages/*.json` at boot** in some configurations. If a key
  you just added still renders as a key, `rm -rf .next` and restart before believing it.
- **`check:i18n` cannot see a key built at runtime.** `` t(`owner.gate.item.${code}.label`) ``
  and keys held as strings in a `demo-data.ts` are resolved by rendering the page, not by
  the linter. Load the page in both languages and grep the visible text — not the HTML,
  whose RSC payload legitimately contains key strings:

  ```bash
  curl -s localhost:3000/de/owner \
    | sed -e 's/<script[^>]*>.*<\/script>//g' -e 's/<[^>]*>/\n/g' \
    | grep -E '^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$'
  ```

### Gotchas that will cost you an hour each

| Symptom | Cause |
|---|---|
| Page shows raw keys after you fixed them | Dev server cached `messages/*.json` at boot. `rm -rf .next` and restart. |
| `permission denied for view …` after a migration | `DROP VIEW` discarded its grants. Re-`GRANT`. |
| `permission denied for table …` after adding a column | `ALTER TABLE … DROP COLUMN` discarded column grants. Re-`GRANT` the `*_qty` columns. |
| `UPDATE is never permitted` | Correct. The table is append-only. Insert a new version. |
| Page scrolls sideways on mobile | A grid/flex child without `min-width: 0`. |
| A CI guard fails on your machine but not in CI | The **table owner** differs: `postgres` locally, `sylva_owner` deployed. Migrations 0025–0030 exist entirely because of this. |

### If you write a new CI guard, read this first

Four migrations (0025, 0026/0027, 0028, 0030) were spent on **one idea**, and a
fifth (0031) fixed a real policy bug those were masking:

> A privilege guard must ask **"can this role actually do this?"**, never
> **"is this role's name on my list?"**

- `information_schema.*_privileges` shows **grants**. It does not follow role
  membership, so a privilege reaching a role indirectly is invisible — a false
  **negative**, the dangerous direction. `sylva_login_operator` is a member of
  `sylva_operator`; name-matching misses it entirely.
- A table's **owner** always holds privileges implicitly. That is not a grant.
  Exclude the ownership chain with `pg_has_role(role, owner, 'USAGE')`.
- Use `has_table_privilege()` / `has_column_privilege()`. They see reality.
- **Give every guard a self-test.** Migrations 0027–0030 each grant the
  forbidden privilege, assert the guard fires, then revoke it. A guard that
  cannot fail is not a guard — and one of mine could not, which is how the
  `deal_pseudonym` policy shipped without a `TO` clause.

### Not yet done

No CI pipeline configured. No deployment. No error tracking. No rate limiting. No
virus scanning on uploads. `SYLVA_STORAGE_DRIVER=local` is a development stub.

---

## 12. Deployment requirements

- **A named EU member-state region.** Frankfurt, Paris or Dublin — **not** a generic
  "Europe" region, which can include London or Zurich. This applies to the app,
  database, backups, logs, object storage **and email**, not just the database.
- Fonts are self-hosted. **Keep them that way** — a CDN font request sends the
  reader's IP outside the EU on every page view.
- The CSP in `next.config.ts` has **no third-party script origin**, deliberately. The
  note requires no third-party trackers; a CSP that admits one makes that promise
  unverifiable. Adding the map tile origin to `connect-src` is a conscious decision,
  not a config tweak.
- Analytics must be self-hosted or EU-hosted and must never record buyer-identifying
  behaviour — that would undermine the pseudonymity the rest of the system protects.

---

## 13. The one-paragraph version

The database is the product. It holds the seven rules the client cannot afford to
have broken, and it holds them as constraints, triggers and privileges so they
survive any rewrite of the code above. The frontend is a document-like reading
experience over that database, in English and German, that a finance analyst can read
in ten minutes. Most of it is still demo data and unwired forms. The hardest and
least visible part — the schema, the isolation between organisations, and the rule
that says two projects' units can never be added together — is done and tested.

Start with the concept note. Then run it. Then read `docs/DECISIONS.md`.
