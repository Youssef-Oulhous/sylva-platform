# Gap analysis against the concept note

**Audited:** 25 September 2026, against the running platform, the running database and the working tree.
**Requirement source:** `docs/reference/concept-note-2026-09-22.txt` (Sylva, 22 September 2026). Where this
document states a requirement it quotes that note. The README is not an authority here; where the README
and the note disagree, the note wins, and several places where the README overstates the build are listed
as gaps in their own right.

**Method.** Every verdict below rests on something that was run: a query against the live database, a
request to the running site, a page driven in a real browser, or a test executed. Findings that rested on
reading code and reasoning about what it would do were removed, and the count is given in section 8.

---

## 1. The verdict

The platform does what the note asks, in substance and in structure, and it does the two hardest things
genuinely well: the seven rules really are in the database rather than in application code — rules 1 to 6
refused every attack made on them, including a concurrent double over-commit and an attempt to forge an
approval, and rule 7, which the note says "cannot" be enforced in Postgres, largely is — and the project
page answers the four buyer findings of section 3 in the order section 3 puts them, with catchment
membership answered as a real spatial test rather than a distance proxy, water reported before biodiversity
and never merged into one score, and pseudonymity that resolves as at each entry's own date so that naming
is provably not retroactive. Against that, **the first release cannot ship as it stands**, and the reason is
small and specific: the two documents section 10 names by hand — "its idea note and design document" —
cannot be opened at all, because one missing word in a routing rule turns every per-document link on every
project page into a 404, and underneath that the pilot documents have no bytes behind them in any case. Four
more release-1 items are in the same condition: the "projects index with the catchment map" has no catchment
map and no basemap, "the vetting questionnaire" locks itself permanently for any applicant who saves a draft
and cannot be completed at all by any seeded demo organisation, and "the public record showing interest
events" prints "The source of this entry could not be read." against every event a real buyer creates,
because the one write path the product has omits the source column. None of these is a design failure or a
misunderstanding of the brief; all are small, all are in code that already exists, and the great majority
are an hour's work each. The honest summary is that this is a well-built platform with a broken last mile,
and that what is missing from the note is far less than what is present.

---

## 2. The note, section by section

| § | What the note asks for | Verdict |
|---|---|---|
| **1** The short version | Projects presented in enough depth to judge, a private way to get in touch, a deal agreed, every step recorded permanently | **Partly met** — presented, contactable and recorded; the deal itself is deferred by §10 |
| **2** The background | Deals on units that will exist later; units from different projects never added; the platform is not the registry | **Met** — forward deals are the default shape, cross-project addition is refused by the database, and every public page carries "This platform is not that registry and does not replace it" |
| **3** What we learned from the buyers | Catchment membership; water before biodiversity; who may claim what; anonymous by default, naming deal by deal | **Partly met** — all four are addressed on the project page; the index ignores all of them, exclusivity is prose only, and the naming choice can be made once and never revisited |
| **4** Who uses it | Five user types, each able to do their job | **Partly met** — all five exist as real database roles; owner, buyer, investor and auditor work end to end; the operator cannot read the questions two screens promise Sylva receives, and the auditor view withholds volumes and terms while stating a false reason |
| **5** What can be transacted | "Three deal shapes, offered side by side on each project" | **Partly met** — named and selectable, and the shape is captured at interest; not offered side by side on the project page, and which shapes a project offers is not data. §10 defers the machinery |
| **6** The project page | Eleven things, from the catchment view to the private question box | **Partly met** — nine of eleven are built and verified; documents cannot be opened, the evidence pack does not exist, and there is no satellite basemap |
| **7** The private side | Express interest opens a private room; agreements signed outside; no payments; nobody unvetted | **Partly met** — Express interest, vetting and the refusal of unapproved organisations all work and were driven end to end. The room itself is deferred by §10. No payment code exists anywhere |
| **8** The record and the seven rules | Nine entry types; pseudonymous public record; rules 1–6 in Postgres; rule 7 a habit and a test; RLS reviewed table by table | **Partly met** — rules 1–6 hold under direct attack, including as a superuser; the record is genuinely append-only. Pseudonyms collide across projects, publication writes no "listed" entry, and rule 7's test does not exist |
| **9** Practical constraints | EU region; personal data in one table; server-rendered and fast; analytics from day one; EN then DE; EU emblem, co-funding line and disclaimer on every page; plain design; every figure sourced | **Partly met** — server-rendered and fast (60–100 ms, and the full page renders with JavaScript disabled), no third-party anything, erasure proven to work. Analytics absent entirely; emblem and disclaimer are placeholders; 85 German strings unreachable; some public figures unsourced or contradicted |
| **10** What we build first | Six named items, live by end of October | **Not met as a whole** — buyer site registration and the Express interest button are done; the project page, the index, the vetting questionnaire and the public record each have a release-blocking defect |

---

## 3. Must fix before the first release

Only items the note's section 10 puts in the first release: *"the projects index with the catchment map, a
full page for each pilot project with its idea note and design document, registration of a buyer's own sites
so distances can be shown, the vetting questionnaire, the Express interest button, and the public record
showing interest events"* — plus the section 9 constraints that apply to all of it, and two items that block
shipping rather than a clause. Ranked by how badly they hurt.

### 1. Every per-document link on every project page returns a 404

> §10: *"a full page for each pilot project with its idea note and design document"*
> §6: *"Documents. Project idea note, project design document, monitoring plan and, later, verification reports."*

**Gap.** Absent, for every reader. `GET /api/projects/demo-untere-havel-wetland-restoration/documents/b1000000-…-0001`
returns `HTTP/1.1 404` with the header `x-middleware-rewrite: /en/api/projects/…/documents/b1000000-…-0001`.
The matcher in `src/middleware.ts:66` is `['/((?!_next|_vercel|fonts|eu|.*\\..*).*)']` — it excludes
`_next`, `_vercel`, `fonts`, `eu` and any path containing a dot, but not `api`. So every API path whose last
segment has no dot is rewritten into the locale and matches no route. `documents.zip` and
`boundary.geojson` return 200 only because their names contain a dot, which is precisely why this has gone
unnoticed. Confirmed 404 for anonymous visitors, signed-in vetted buyers and the operator alike.

**Fix.** Add `api` to the negative lookahead: `['/((?!api|_next|_vercel|fonts|eu|.*\\..*).*)']`. Then add one
HTTP-level test that requests a document by its URL and asserts 200 and the content type — the existing 42
document tests call the function directly and never touch a URL, which is why they are green.

**Effort:** small.

### 2. The two pilot documents have no bytes, and the archive's manifest does not describe what it ships

> §10: *"a full page for each pilot project with its idea note and design document"*

**Gap.** Absent. `doc.document_version` records the pilot documents in bucket `sylva-demo-documents` with
keys `demo/1.pdf`…`demo/8.pdf`; no such bucket exists on disk, and the server logs
`{"msg":"document failure","where":"documentsZip.missing","detail":"stored object absent"}` for each. The
bulk archive therefore ships 131-byte stubs reading *"This document could not be read from storage when the
archive was built"* — while `MANIFEST.txt` states `bytes 121000` and a sha256 for that same entry, under the
sentence *"it is what an auditor compares a downloaded copy against"*. So fixing finding 1 alone does not
produce a readable document, and the manifest an auditor is told to trust describes bytes that were never
shipped. `scripts/seed-demo-documents.ts` exists to repair this and appears in no setup path; run on a
throwaway clone it wrote 8 real versions and the archive then carried real files.

**Fix.** Run `npx tsx scripts/seed-demo-documents.ts` against the demo database and add it to the setup steps
in README §3 and to `scripts/run-local.sh`. Separately, when an object is absent the archive must either
fail or mark that entry in `MANIFEST.txt` and omit its size and digest.

**Effort:** small.

### 3. Every interest event a real buyer creates lands on the public record with no source

> §9: *"Every figure on screen carries its source and date."*
> §10: *"the public record showing interest events"*

**Gap.** `record.entry` rows 13, 112 and 179 — every entry written by the running application, as opposed to
by a seed — have `source_ref_id` NULL. The public record says so in plain English: the newest row renders
*"The source of this entry could not be read."* while the seeded row above it renders *"Source: DEMO
transaction record, recorded by Sylva operations at the time of each event · Updated: Sep 23, 2026"*.
`INSERT_ENTRY_SQL` in `src/lib/interest/queries.ts` (≈line 258) does not list the column, and the column is
nullable with no default. Because the table is append-only, every row written before this is fixed stays
sourceless permanently. The project's own `tests/db/record.test.ts` already fails on it.

**Fix.** Create or reuse a `sylva.source_ref` inside the same transaction and set `source_ref_id`, then make
the column `NOT NULL` so no future writer can omit it. Do it before more rows accumulate.

**Effort:** small.

### 4. The projects index has no catchment map, and there is no satellite basemap anywhere

> §10: *"the projects index with the catchment map"*
> §6: *"The catchment view. The project boundary and the surrounding catchment on a satellite map."*

**Gap.** Partly absent. The index renders three inline SVG boundary thumbnails — no canvas, no tile layer,
no raster imagery, no shared map. The catchment polygon is not drawn on the index at all: the index query at
`src/lib/projects/queries.ts:110-113` selects `kind = 'boundary'` only, although catchment geometry exists
for both pilots. There is no basemap on the project page either, and the page states this itself: *"No
satellite basemap yet… A satellite view will be added once the tile provider is chosen, so that no third
party is told which project you are reading."* That reasoning is sound and consistent with §9, but the note
asks for satellite, and a water-dependent buyer currently sees two abstract outlines with no river, town or
coastline to place them against.

**Fix.** Include `kind = 'catchment'` in the index query and draw it behind the boundary; add an index-level
map of all published boundaries plus, for a signed-in buyer, its own site pins. For the basemap, choose an
EU-hosted or self-hosted raster source, add its origin to `img-src` in `src/middleware.ts`, and state its
source and date like every other figure. The provider choice is a client decision (section 7).

**Effort:** large (the map); small (the catchment layer on the index).

### 5. The index is blind to the signed-in buyer: no distance, no catchment, no filter, no sort

> §3: *"Location matters most… The water-dependent companies want a project in the same catchment as their own sites"*
> §10: *"the projects index with the catchment map"*

**Gap.** Absent. A DOM probe of `/projects` as a signed-in buyer returns zero forms, zero selects, zero
filter controls and zero query-string links, and the rendered text contains no distance, no kilometre figure
and no mention of catchment for either project — although the same session shows "23 km" on the project page.
The cause: `src/app/[locale]/projects/page.tsx` takes no `searchParams` and calls `listProjects(ANONYMOUS, locale)`,
so the index is read as an anonymous visitor even for a signed-in buyer and cannot know its sites. The one
thing eight interviewed organisations ranked first is invisible at the point where a buyer chooses which
project to open. The pattern exists in the codebase — `/record` has working filters.

**Fix.** Add `searchParams`, read the real actor, and set `export const dynamic = 'force-dynamic'`. Add
country / outcome-domain / status filters, plus a "same catchment as one of my sites" filter and a
"nearest to my sites" sort driven by the existing SQL at `src/lib/sites/queries.ts:120-152` — no new spatial
code. Show the nearest distance and the catchment answer on each card, marked private to the viewer.

**Effort:** medium.

### 6. Saving a vetting draft permanently breaks the vetting page for that organisation

> §10: *"the vetting questionnaire"*
> §7: *"Nobody reaches this stage without being vetted by us first."*

**Gap.** An applicant who registers, fills the questionnaire and clicks **Save draft** instead of **Submit
for review** is redirected to `/vetting?saved=1` showing *"Application error: a server-side exception has
occurred"*, and every later visit returns HTTP 500. The server log reads
`TypeError: a.slice is not a function … digest: 1834327547`. The draft saves correctly; the page cannot
render it. Cause: `draftIn()` in `src/lib/vetting/queries.ts:175` selects `answer_numeric::text AS answer_numeric, updated_at`
— the numeric column is cast, `updated_at` is not, so node-postgres returns a JS `Date` and `dateOf()` calls
`.slice` on it. The single gate the note makes a condition of the funding locks out the applicant.

**Fix.** Select `updated_at::text AS updated_at`, matching the convention on the same line, and harden
`dateOf()` to accept a `Date`. Add a page-level test that renders `/vetting` with a draft present.

**Effort:** small.

### 7. No seeded demo organisation can complete the vetting questionnaire

> §10: *"the vetting questionnaire"*

**Gap.** Five of the seven seeded organisations were given a submission row with zero answer rows, which
puts `/vetting` into read-only: *"0 of 8 questions answered"*, all eight marked NOT ANSWERED, all six radios
disabled, and the only submit button on the page being "Sign out". The read-only footer tells the reader a
new application can be submitted and then offers no way to do it — the editable form is reachable only by
typing `?revise=1`, which appears in no link. The feature works (it was driven end to end with a freshly
registered organisation), but it cannot be demonstrated on the platform as seeded.

**Fix.** Seed the demo organisations with their eight answers, or with no submission at all. Add the
"Submit a new application" link the footer already promises, pointing at `?revise=1`.

**Effort:** small.

### 8. The same buyer carries the same pseudonym on every project, while the public record says it cannot

> §8, rule 5: *"A buyer's identity is shown as a pseudonym unless that deal is flagged for disclosure."*
> §3: *"Participation is anonymous by default"* · §9: every claim on screen must be supported

**Gap.** `deal.deal_pseudonym` gives organisation `0c…0c` the label "Buyer 004" on both pilot projects and
`0d…0d` the label "Buyer 002" on both; a third organisation also holds "Buyer 002" on a third project, so
labels collide across organisations too. The label is generated from a per-project arrival counter
(`org.project_label_counter`), so buyers joining projects in the same order receive identical labels as the
normal outcome. Because the public record prints sector, country and size band beside the label, one
buyer's activity can be linked across projects — and where a deal is later disclosed, that name attaches to
the pseudonym elsewhere. Meanwhile `/record` states as fact: *"the same label on two projects is not the same
organisation."* The project's own test fails on this (`tests/db/record.test.ts:168`, expected 1 to be 2), and
the CI guard passes because it checks only that `org_id` is not readable, never that labels are distinct.

**Fix.** Either make the label carry no cross-project signal (derive the sequence from a keyed permutation of
project and organisation, or from a single platform-wide counter, keeping the per-project uniqueness
constraint), or delete the sentence from `/record` and `/for-buyers` in both languages. Whichever is chosen,
extend `ci.assert_pseudonym_is_per_deal()` to assert the property the text claims, so a guard that cannot
fail becomes one that can.

**Effort:** medium.

### 9. Publishing a project writes nothing to the permanent record

> §8: *"Every step is written to a permanent record: listed, offered, interest expressed…"*

**Gap.** Absent. `publishProjectIn()` at `src/lib/admin/queries.ts:646-665` issues a single
`UPDATE proj.project SET status='published'` and returns; it contains no `record.entry` insert, and no trigger
on `proj.project` writes one. A project published through the operator screen leaves one record entry — the
buyer's interest — and no listing. The only `listed` rows in the database came from seeds, so the public
record cannot show when a project was listed, and an auditor reconstructing a project's history sees it
appear already under negotiation.

**Fix.** Insert the `listed` entry in the same transaction as the status update, with a source reference —
better still from an `AFTER UPDATE` trigger, so it survives a rewrite of the admin code, which is the note's
stated reason for putting rules in the database.

**Effort:** small.

### 10. Three live controls on the public side lead nowhere

> §10: *"The first release… is the public side plus a way in"*

**Gap.** All three verified 404 against the running site.
- **"Download evidence pack"** on every project page points at `/api/projects/<slug>/evidence-pack.pdf` →
  `404`, a 5,312-byte HTML error page. No such route exists under `src/app/api`.
- **"Forgotten your password?"** on the sign-in page — the way in for every role — points at
  `/forgotten-password` → `404`. No such page exists.
- **/for-investors** links to `/projects/demo-marais-de-sevre-floodplain` and
  `/projects/demo-shannon-callows-peat-rewetting` → both `404`. Neither slug exists in `proj.project`.

**Fix.** Remove or disable each control until the thing behind it exists. A dead download on the page meant
to convince a CSRD assessor, and a dead reset link on the sign-in page, cost more than an honest absence.

**Effort:** small.

### 11. Two public pages publish availability figures that contradict the database, under citations that do not exist

> §9: *"Every figure on screen carries its source and date."*

**Gap.** `/for-investors` renders, for the real project "DEMO Untere Havel Wetland Restoration", period 2028:
expected 12,400 / buffer 1,000 / **committed 4,800** / **remaining 6,600**, stamped *"Source: Project design
document, v2.0, §7"*. `/how-it-works` renders the same project's 2029 period as **committed 2,000 /
remaining 7,200**, stamped *"v1.2, table 7"*. The database says committed 0 and remaining 11,400 / 9,200, and
the real document is v2.1, Table 4.2. Both blocks are hardcoded literals
(`src/app/[locale]/for-investors/page.tsx:106-158`, `src/app/[locale]/how-it-works/page.tsx:36-53`), and the
rule-7 linter cannot see a figure written out as a literal. These are the four numbers a buyer acts on.

**Fix.** Read the specimen from the same `proj.v_period_availability` query the project page uses — the
figures are public — or rename the specimen to a project no live project shares and drop the invented
locator. Add a check that fails when a hardcoded figure carries the name or slug of a real project.

**Effort:** small.

### 12. The index cards carry four figures each with no source or date

> §9: *"Every figure on screen carries its source and date."*

**Gap.** Every card on `/projects` renders EXPECTED ISSUANCE, BUFFER, COMMITTED and REMAINING with no source
stamp, on the first screen a buyer sees. The same figures on the project page carry *"Source: DEMO Untere
Havel Project Design Document v2.1, Table 4.2 · Updated: Sep 12, 2026"*. The provenance is already in the
query and already `NOT NULL` in the tables the card reads.

**Fix.** Render the source label and as-of date on the card, or replace the four figures with the unit type
and a pointer to the project page, so no unsourced figure is on screen.

**Effort:** small.

### 13. There is no usage analytics of any kind

> §9: *"Basic usage analytics from day one, self-hosted or EU-hosted, no third-party trackers."*

**Gap.** Absent. `platform.page_view_daily` holds 0 rows after several hundred requests during this audit,
and nothing in `src/` ever writes to it — the table, its grants and a CI note exist, and no page view is
recorded. `SYLVA_ANALYTICS_DRIVER=none`, and the variable appears nowhere outside `.env.example`. The
"no third-party trackers" half is fully satisfied: a real browser across nine pages recorded zero external
origins and the CSP is `connect-src 'self'`.

**Fix.** Record a row per page view into `platform.page_view_daily` from the server, keyed by a path
identifier rather than the raw URL so it cannot become a per-visitor trail, and grant the writing role
`INSERT`/`UPDATE`. That keeps everything in the EU database, needs no third party, and satisfies the clause
literally. Self-hosted Plausible is the larger alternative the environment variable already anticipates.

**Effort:** medium.

### 14. The EU emblem and the disclaimer are placeholders on every page, and the error pages carry neither

> §9: *"Every page carries the EU emblem, the co-funding line and the disclaimer."*

**Gap.** The co-funding line is present and correct on every content page in both languages. The other two
are not: the footer renders *"EU emblem required"* and *"The disclaimer required by the grant agreement has
not been configured."* There is no `public/eu/` directory and neither disclaimer environment variable is set.
Leaving them as visible placeholders rather than inventing grant wording is the right call and should not
change — but the requirement is unmet until Sylva supplies both (section 7). Separately, the 404 page is
Next.js's own default: 33 characters, no site chrome, no footer, no EU notice, no demo notice, English only,
and 11 blocked scripts, because that page is prerendered so the per-request nonce can never match it. There
is no `not-found.tsx` or `error.tsx` anywhere in the repository. A mistyped project link — the most likely
404 a forwarded URL produces — lands there.

**Fix.** For the emblem and disclaimer, see section 7; the wiring also needs checking, since the footer
never passes the flag that would render the asset. Independently, add `not-found.tsx` and `error.tsx` inside
the locale layout (and a `global-error.tsx` carrying its own EU notice) so error pages are pages.

**Effort:** small.

### 15. Eighty-five translation keys are unreachable, so German pages render English

> §9: *"English first, German second, so a translation library from the first commit."*

**Gap.** Both catalogues hold 116 top-level keys, of which **85 contain a literal dot** — for example
`projectPage.docKind.projectIdeaNote`. The translation library resolves a dotted key as a nested path, so a
flat key spelled with dots is unreachable: `t.has("projectPage.fallbackNotice")` is `false` while
`t.has("nav.projects")` is `true`. The lookup helper then silently falls back to hard-coded English, so at
least 14 labels render in English on the German project page — including the sentence *"Shown in English. No
reviewed translation of this text exists yet."*, which appears 20 times in English even though a reviewed
German translation sits three lines away in the same file. `npm run check:i18n` reports *"2625 messages in
parity"* because it checks presence, not reachability. The German that is reachable is real translation, not
copied English: zero identical three-word strings across the catalogues.

**Fix.** Nest the 85 keys into the existing objects in both catalogues and delete the flat duplicates. Then
make the checker fail on any top-level key containing a dot, and assert `t.has()` under both locales for
every key the label helpers reference, so a silent fallback becomes a build failure.

**Effort:** medium.

### 16. The project document form can file a signed agreement where every approved buyer can read it

> §8: *"One buyer seeing another buyer's prices or terms is the failure we most need to avoid."*

**Gap.** The owner's upload form offers the kinds *Signed agreement*, *Term sheet* and *Letter of intent*,
but the only anchor available is the whole project and the narrowest visibility offered is "Buyers Sylva has
approved". A signed agreement was uploaded to a pilot project this way, and a second buyer that was not a
party to that deal then saw it listed with working View and Download links. No policy is broken — the
database has a `deal_participants` visibility class and a correct party-scoped policy, and nothing can write
it — so the screen simply offers a combination the note forbids in substance.

**Fix.** Filter the kind list on the project form to project-scope kinds, or require deal scope and
`deal_participants` visibility for those three kinds and refuse them at the insert policy.

**Effort:** small.

### 17. The demo database contains test artefacts, one of them published on the public index

**Gap.** Not a note clause, but it is what a client would see. `org.organisation` holds
"AUDIT Test Buyer GmbH" and "AUDIT FRAUDIT368708 Water GmbH", breaking the DEMO prefix the rest of the data
keeps rigorously; `proj.project` holds a published `audit-e2e-812320`, and the public index renders
**"AUDIT E2E test project"** first of three. Test-fixture rows appear on the public record, two 0 kB
"Other document" rows appear in a pilot project's public document register, and the organisation seeded to be
unvetted has been permanently approved — which is why four of the project's own vetting and rule tests are
red. On a freshly built database every one of those tests passes.

**Fix.** Rebuild the demo database and re-run the document seeding before any client demonstration. Give the
end-to-end fixtures a DEMO prefix and draft status so a stray one cannot reach the public index, and route
the committing test fixtures through the rollback helper that already exists.

**Effort:** small.

### 18. A fresh clone does not reproduce: the public record comes out empty, and the launcher is untracked

**Gap.** Not a note clause, but it blocks *"live by the end of October"*. Building from `git archive HEAD`,
all 54 migrations apply cleanly and then `db/seed/0007_demo_public_record.sql` fails on a foreign key,
leaving **0 record entries instead of 12** — so a colleague cloning today gets an empty public record, which
is a named release-1 deliverable. The fix exists only as 31 uncommitted lines in the working tree. Also
untracked: `scripts/run-local.sh` (which `npm start`, `start:dev`, `start:reset` and `stop` all invoke),
`db/seed/0008_demo_investor_financials.sql`, and `docs/ROLES.md`. The seed loop printed in the README has no
`ON_ERROR_STOP`, so the failure scrolls past unnoticed.

**Fix.** Commit the modified and untracked files, and add `-v ON_ERROR_STOP=1` to the documented seed loop.

**Effort:** small.

---

## 4. Should fix soon

Real gaps against the note that are not first-release blockers.

| # | Requirement (note) | Gap | Fix | Effort |
|---|---|---|---|---|
| 1 | §3: *"it would not fund a project if the onward sale of credits took away its right to claim the benefit it had paid for"* | Exclusivity and the effect of onward sale are machine-readable on the buyer (`org.vetting_answer`: one demo buyer has `exclusivity_needed = t`) and free prose on the project, with nothing joining them. None of the four seeded exclusions texts answers the onward-sale question the note names. Refusing to adjudicate it is right and is documented; refusing to record it comparably is not | Add two source-stamped columns to `proj.claim_right` (`is_exclusive`, `onward_sale_effect` with a "not stated" value shown rather than hidden), put them in the publication gate, and show the buyer's own stated condition beside them as a comparison, explicitly not an adjudication | medium |
| 2 | §3: *"naming is the buyer's choice, deal by deal"* | The choice is a single checkbox on the interest form and can never be revisited. A buyer that agrees to be named at signature — the normal sequence, and the one the seeded data portrays — has no way to say so; one that ticked it by mistake cannot stop. The database is ready: the disclosure table is append-only and the buyer already holds insert on its own deals | Add a per-deal disclosure form on the buyer dashboard whose action inserts a new disclosure event. No schema change. Show the current state and the date it was decided | small |
| 3 | §3: *"a project in the same catchment as their own sites"* | The positive answer now renders (a site placed inside the catchment showed "In this catchment"), but no test covers it: the only catchment test asserts on `null` and on the dataset label, never on `true`, so the branch the water-dependent buyer is looking for can regress silently | Keep a demo site inside the catchment so both answers appear side by side, and add one assertion pinning `inCatchment === true` for it and `false` for a distant site | small |
| 4 | §6: *"Questions go to the project owner and to us"* · §4: *"Us, the operator. Sylva."* | The question box works end to end, but Sylva has no screen on which to read a question or an enquiry. `/admin/questions`, `/admin/deals` and `/admin/organisations` are all 404; only `/admin/projects` and `/admin/vetting` exist. Two buyer-facing pages state that Sylva receives every question. The database already grants the operator the reads | Add one table-driven admin page over the questions and their answers, with organisation name beside the public label — or change the copy to stop promising it | medium |
| 5 | §4: *"Auditors. Read-only access to everything including real names"* | `/auditor/deals` states *"The auditor role holds no privilege on those tables, so this view does not have them and does not pretend to."* That is false: as `sylva_auditor`, interest volumes (250 ha_yr) and agreed prices (41.50 and 128.00 EUR) both read back. The grants are column-level, which is why a table-level check said otherwise. An auditor who trusts the page draws a wrong conclusion about the platform's own access model | Surface the three tables, or correct the sentence to say the view has not been built. The current wording is the only version that must not ship | medium |
| 6 | §8, rule 4: *"A mistake is corrected by a new entry that points at the wrong one"* | Nothing is editable — the record survived UPDATE, DELETE and TRUNCATE even as the table owner, against always-enabled triggers. But the remedy rule 4 depends on is unreachable: there is no `/admin/record` route and no server action that writes a correction, so a wrong entry is permanent and uncorrectable by any user | Add an operator-only correction form writing a `correction` entry with a mandatory reason and a source. The database side already exists and is guarded | medium |
| 7 | §8: the record is *"evidence of what was agreed"* | A party to a deal can append any entry type about that deal with no supporting state: an `agreed` entry was accepted on a deal still at first interest. Cross-party appends are correctly refused. Not reachable through the product today, but the note's reason for putting rules in the database is that the application will be rewritten | Constrain entry type against the deal's recorded stage in a trigger, with a self-test in the migration. Cheap now, while there are no writers to break | medium |
| 8 | §3: *"naming is the buyer's choice"* | Sylva can insert a buyer's disclosure decision, and the row is indistinguishable from one the buyer wrote, because a check constraint attributes it to the buyer either way. Limited blast radius — it is forward-only and rewrites nothing published | Narrow the operator policy to withdrawals only, or add a "decided via" column tied to the inserting role so the audit view can show which | small |
| 9 | §8: *"Rule 7 cannot [be enforced in Postgres], so it is a review habit and a test"* | Rule 7 is enforced better than the note expected — cross-project addition raises in the database and no raw amount column is granted — but the supporting machinery is weaker than described. `tests/rules/` is an empty directory and `npm run test:rules` exits 1, so **rules 1, 2 and 3 have no test anywhere**; the rule-7 linter applies its two SQL checks only to `.sql` files while every query in this codebase is raw SQL inside `.ts` (a planted offending query passed clean); and nothing runs the linter, the 32 guards or the tests automatically — there is no CI | Run the SQL checks against `.ts` too; write the R1/R2/R3 tests into `tests/rules/`; add one workflow that migrates a clean database, seeds it, and runs typecheck, guards, tests, both linters and the build. Every one of those already passes | medium |
| 10 | §5 / §9 | Every project advertises all three deal shapes unconditionally — the list is a global lookup with no project in the query — including a spot volume, which the note defines as *"where units already exist"*, on projects with zero issued units and zero registry records. No source or as-of date sits behind the claim. The owner-side picker for this was translated into both languages and never built | Make the offered shapes per-project data with a source stamp, and refuse "spot" unless a confirmed registry record exists for the period | medium |
| 11 | §6: *"We assemble exactly that as a downloadable pack"* | The pack does not exist: no route, and both build tables hold 0 rows, so a vetted buyer is told *"The pack has not been assembled for this project yet."* The five named elements exist as labels, but **budget has no column anywhere in the database**, so it cannot be filled even in principle — and the public bullet softens it to "where the project owner has published it", which the note does not | Ship the reduced version already sanctioned internally — a manifest of the five elements with their sources and dates plus the public documents — and add a source-stamped budget figure with a field on the owner form | medium |
| 12 | §9: *"Every figure on screen carries its source and date"* | The owner form offers the source kind "A document" on all seven content sections with no field to name which document, so choosing it always fails a check constraint — and the resulting message is *"This service is not available at the moment. Try again shortly."*, which will fail identically forever. A constraint violation is presented as a transient outage, on the one field the owner must fill seven times per project | Show a document picker when that kind is chosen, hide the option until the project has a document, and map the constraint to a message that names what is missing | small |
| 13 | §6: *"shareable and indexable, so buyers can forward it to colleagues"* | The pages permit indexing but cannot be discovered or previewed: `/robots.txt` and `/sitemap.xml` both 404, and there are no Open Graph or canonical tags, so a forwarded link arrives as bare text and the locale duplication is unresolved | Add a robots file and a sitemap enumerating published projects in both locales, plus Open Graph and canonical metadata. No third party involved | small |
| 14 | §9: *"A person must be deletable without breaking the permanent record"* | The design is right and the deletion provably works — a user row was deleted inside a transaction, seven record entries and two questions survived, sessions cascaded away, and no foreign key points into the identity table — but only as the table owner from a psql prompt. No application role holds delete, **nobody at all holds insert on the erasure audit table**, and there is no erasure function or screen. A subject access request after go-live has no path through the product | Add a definer function that scrubs the person and writes the erasure event in one transaction, granted to the operator alone, with a screen behind it. Add a guard that no role holds bare delete, so the only route is the logged one | medium |
| 15 | §9: *"Hosting and database in a named EU member state region"* | Enforced properly for documents — a London/GB region insert is refused by a foreign key into the 27 member states. But the local storage driver stamps `eu-central-1` onto files sitting on the application server's own disk, and the interface tells the reader *"Every file is held in a named European Union region."* The code comment names this exact hazard and the local path does it anyway | Give the local driver its own region row, or render that sentence only when the cloud driver is active. Implement the cloud driver before go-live, since documents are release 1 | medium |
| 16 | §9 (no overclaiming) · §7 | Three screens promise things that do not exist: the interest confirmation says *"The project owner replies to you by email"* and the blocked state says *"we will tell you the outcome by email"*, when no mail transport of any kind exists in the codebase and the reply in fact appears on the project page; and the buyer dashboard prints *"Deal room open"* under **Next step** with nothing that opens one | Reword all three to what actually happens. Email notification is a new dependency and an EU-hosting decision, not a copy change | small |
| 17 | §4: *"two groups that want different things from the same page"* | The page carries both readers' material in a defensible order, and `/for-buyers` spells out the two reading orders — but nothing on the project page orients a reader to their group, and a buyer sent a project URL by a colleague never passes through that page | Add two labelled entry points in the contents rail, jumping to the catchment map and to the evidence section. No new data | small |
| 18 | §8, rule 5 | The buyer dashboard panel whose stated job is to show public exposure prints *"BUYER Buyer 003 · Reproduced as the public record renders it"* for an entry the public record renders as **"DEMO Nordbräu AG — NAMED"**. It reads the per-organisation label rather than the per-deal one the record uses, and never consults the disclosure decision. Nothing leaks; the buyer is misinformed about the one thing §3 says can decide participation | Build the specimen from the same view the record uses, scoped to the caller's own entries, so it shows NAMED when named and the deal label when not | small |
| 19 | §5 | The project owner can see which shape each buyer asked to discuss; the buyer cannot see what it itself submitted. The translated strings for the column already exist and are unused | Add the column to the buyer's interests table, rendering "Undecided" for an unset shape | small |
| 20 | §8: the rules must be verifiable | The tests that prove rules 4 and 6 write irreversibly into the append-only chains they test, so they pass once per database: running the suite permanently approved the organisation seeded to be unvetted, after which four vetting and rule tests fail and a real regression would be indistinguishable from demo drift | Give those tests a throwaway organisation per run, or wrap them in the rollback helper that already exists | small |
| 21 | Deliverability | The documented setup path does not work: `.env.example` copied as the README instructs cannot connect (no `PGUSER`, no psql path, SSL required against a trust server), `npm run db:seed` and `npm run db:reset` both point at a `db/seed/seed.ts` that does not exist — `db:reset` drops the database, rebuilds the schema and then loads no data — one seed is not repeatable, the install script the tooling points at is missing, and `npm run lint` drops into an interactive prompt and exits 1 | Fix the example environment file, point the seed script at the loop that works, guard the non-idempotent seed, and either remove the lint script or add a configuration | small |
| 22 | Trust in the project's own documentation | The README's honest-status section is wrong in the client's favour almost everywhere: 41 migrations against 54, 22 CI guards against 32, 762 tests against 1,037, 2,303 translation keys against 2,625, 5 seeds against 9, and "**All seven business rules enforced in PostgreSQL**" when rule 7 is not (a cross-project total was produced in one line as an anonymous visitor). It also claims the rule-7 linter fails the build, which nothing invokes | Regenerate the counts from the database and the build, restate the rule-7 line accurately, and note that the suite is not yet idempotent so a reader who sees failures knows why | small |
| 23 | §9: plain, document-like | Two internal states are shown to visitors: a **RESERVED** column on the public availability table that can only ever read 0, because nothing can write it until the deal room exists, and a **"PHASE 2"** roadmap badge on the financing section shown to anonymous visitors and buyers | Hide the reserved column or mark it not yet in use, and remove the roadmap badge from the public page | small |

---

## 5. Later, by design

The note defers these itself. They are not oversights, and they should not be counted as gaps.

> §10: *"Then: the private deal room, the three deal shapes, issuance and retirement records, investor data, exports."*

1. **The private deal room** — messages, draft terms, document versions and the stage ladder. The schema is
   built and correct (stages, allowed transitions, per-deal documents, party-scoped policies) with no screens
   attached, and the interest confirmation says so in its own words rather than pretending. The one thing to
   note is that the buyer dashboard's copy currently claims a room is open (section 4, item 16).
2. **The three deal shapes as transactable machinery** — the capacity model behind them. Reserving capacity
   at term sheet is designed and half-built: the reserved column and its constraint exist, and nothing can
   write them, so rule 1 only bites at signature and the failure it exists to prevent — two term sheets
   jointly busting a period's cap — is not prevented today. Correctly sequenced; worth stating plainly so
   nobody reads the availability pane as evidence that reservation works.
3. **Issuance and retirement records**, and with them the operator's record-confirmation screen. Of the
   operator's three named duties in §4 — *"We vet everyone who wants to transact, confirm records and
   publish"* — vetting and publishing work and were driven end to end; *"confirm records"* has no interface,
   `/admin/record` is a 404, and no registry record has ever been written. The grants and the confirmation
   table already exist. It belongs with issuance, but the phrase should not go unaccounted for in the plan.
4. **Investor data** — the read path is built and verified (a vetted investor sees a financing need of
   €1,200,000 with its source and date; a buyer, an unvetted organisation and an anonymous visitor all see
   WITHHELD with the field names listed). There is no write path: the owner form has ten sections and none of
   them is financials, so the figures an investor sees exist only because a seed wrote them, and any project
   created by a real owner has an empty financing section. Correctly sequenced, but the read path shipping
   ahead of the write path should be stated rather than left looking finished.
5. **Exports.** None exist, which also means §8's "no export adds unit volumes across projects" has no
   surface to test yet.
6. **Verification reports** as a document kind — §6 says *"and, later, verification reports"*, and the
   project page already states "No verification report yet" rather than leaving a gap.

---

## 6. Built beyond the note

| Built | Asked for? | Does it earn its place? |
|---|---|---|
| Rule 7 enforced **in the database** — cross-project addition raises an error, and no raw amount column is granted to any application role | No; §8 says *"Rule 7 cannot [be enforced in Postgres]"* | **Yes.** This is the single best thing in the build: the rule the note expected to rest on discipline now refuses at the lowest level |
| A **per-deal** pseudonym, over and above a per-organisation one, resolved as at each entry's own timestamp | §8 asks only for a label per buyer | **Yes.** It is what makes *"naming is the buyer's choice, deal by deal"* true rather than approximate, and it is why disclosure is provably not retroactive. It does need the collision in section 3 item 8 fixed |
| Four explainer pages: `/how-it-works`, `/for-buyers`, `/for-investors`, `/about` | No | **Mixed.** `/for-buyers` earns its place — it is where the two buyer reading orders of §4 are actually spelled out. `/for-investors` currently costs more than it earns: it carries a fabricated project pipeline with two dead links and figures that contradict the database |
| 32 CI guards, a rule-7 linter, a translation-parity checker, a generated security matrix, and self-tests inside the migrations | No | **Yes**, and they are the reason this audit could verify as much as it did — with the caveat that nothing runs them automatically and two of them cannot fail (section 4, items 9 and 22) |
| Live database assurance on the auditor's own screen — three integrity assertions executed on page load and reported as passed | No | **Yes.** It is the right instinct for a page whose purpose is assurance |
| Deal shape captured at Express interest, ahead of §10's deferral of the three shapes | Ahead of schedule | **Yes**, as a statement of intent — provided nobody reads it as the machinery being built |
| Document version withdrawal, with the withdrawn version left visible as "not yet available" | No | **Yes.** It is the append-only discipline of rule 4 applied to documents |
| Five vetting questions beyond the note's three (onward sale, offset use, exclusivity, water dependence, claim publication) | §7 names three | **Yes.** They come straight out of §3's buyer findings, and they are the structured half of the exclusivity gap in section 4 item 1 |
| A second typeface (a monospace sibling, for figures and identifiers) and a second accent colour (water blue beside forest green) | §9 says *"One typeface, one accent colour"* | **Justified divergence, for Sylva to confirm.** The monospace is from the same superfamily so the page still reads as one type system, and the second colour lets a reader tell a water outcome from a biodiversity one at a glance, which serves §3 and §6 directly. Flagged in section 7 rather than changed |

---

## 7. Needs the client, not a developer

1. **The EU emblem file and the exact disclaimer wording from the grant agreement, in English and German.**
   This is the only blocking client input on the critical path to the end of October. The build deliberately
   refuses to draft the wording — *"The exact wording must be taken from the grant agreement and must not be
   drafted here"* — which is right, and it means §9's requirement cannot be met until Sylva supplies both.
2. **The satellite tile provider.** §6 asks for a satellite basemap; §9 forbids third-party trackers. The
   build has left this open on purpose, with the reason on the page: naming a provider tells that provider
   which project a buyer is reading. Sylva needs to choose between an EU-hosted or self-hosted raster source
   proxied through the application, and accepting no basemap for now.
3. **The named EU hosting region, and the document storage provider.** §9 asks for *"a named EU member state
   region such as Frankfurt, Paris or Dublin, not a generic 'Europe' region"*. There is no deployment
   artefact of any kind in the repository, so this is unverifiable today and undecided.
4. **Whether pseudonyms must be unlinkable across projects.** The note requires a label such as "Buyer 014";
   it never requires unlinkability. The platform currently claims it on a public page and does not provide
   it. Sylva must decide whether to make the claim true or withdraw it — a real decision, because the fix
   changes how labels are allocated.
5. **Whether disclosure applies to a whole deal or only forward from the moment it is decided.** The build
   chose forward-only, reasoning from rule 4 that nothing already published is rewritten. The consequence is
   that a deal later disclosed shows both the label and the real name in its own timeline, which publishes
   the mapping. §3 says naming is a choice *"deal by deal"* and does not address earlier entries. Both
   readings are defensible; only Sylva can choose.
6. **Whether the reporting evidence pack and Sylva's own question inbox are first-release.** §10 names
   neither. Both are already visible to users — the pack has a live download button, and two pages tell
   buyers that Sylva receives every question — so they are promises in front of users today whether or not
   they are in scope.
7. **Whether the platform should record exclusivity and the onward-sale effect in a comparable form.** The
   build refuses to compute a legal determination, which is right and documented. Recording the answer as a
   field, without adjudicating it, is a different question, and §3 says this *"can decide whether a buyer
   takes part"*.
8. **Whether German is an acceptance criterion for the first release.** §9 says *"English first, German
   second"* without a date. Fixing the unreachable keys is a developer task; whether German must be complete
   on day one is Sylva's call.
9. **Whether "one typeface, one accent colour" is to be read strictly.** Two deliberate divergences exist,
   both reasoned in the code (section 6). They should be accepted or overruled, not left implicit.

---

## 8. What could not be verified, and why

**Findings dropped.** Two findings were removed because their evidence described reasoning rather than
something run: a prediction that fixing the document routing would produce a 502 from the file-size guard
rather than a download (the guard was read, never triggered — the underlying facts, that the recorded sizes
and digests do not match the stored bytes, were measured and are reported in section 3 item 2), and a
prediction about how the footer would behave once the EU emblem file is supplied (the emblem's absence was
verified; the wiring's behaviour was not). A further handful of findings were set aside as not
client-relevant rather than unevidenced — for example a stale comment on a database column.

**Not verified, and why.**

- **The actual hosting and database region.** There is no Dockerfile, no infrastructure definition and no
  provider configuration anywhere in the repository, so §9's region requirement cannot be checked by reading
  this codebase. What was verified is that the *document* region string is constrained to the 27 member
  states by a foreign key, and that a London/GB entry is refused.
- **Whether a security header breaks document upload in the running demo.** One agent recorded the owner's
  upload failing with a transport error caused by an upgrade-insecure-requests directive over plain HTTP;
  two others successfully uploaded documents through the same form in the same session, and the first noted a
  stale build artefact as a confound. Contradictory evidence, so no verdict. Worth ten minutes on a clean
  build before go-live.
- **The German half of the platform beyond the project page and the message-parity check.** Every browser
  run behind the findings above was in English. The dashboard, vetting, owner and admin screens were not
  read in German, so the 14 confirmed English-on-German labels are a floor, not a ceiling. Translation
  *quality* also needs a native reader; only genuineness was checked.
- **The commitment and deal-room layer under real conditions.** Those tables are empty and no application
  code writes to them, so the forward and co-investment verdicts rest on inserts made directly against the
  database and rolled back. That proves the model is expressive and the constraints bite; it says nothing
  about behaviour under load or concurrency, and the proximity query that joins every site against every
  published project was tested at two projects and four sites, not at portfolio size.
- **Whether all 29 current test failures are demo drift.** Every test file passes alone and together on a
  freshly built database, and the failures name exactly the rows that drifted, so drift is the strong
  explanation — but not all 29 were traced individually.
- **The note's own ten-minute test.** *"A finance analyst reads a project page in ten minutes and knows what
  is being sold, where, on what evidence, with what claim rights and on what terms."* Four of the five
  questions are answered well and quickly; "where" is the weak one, for want of a basemap. That is a
  judgement from reading the page, not a test with an analyst, and it should be run with a real one.
- **Document upload for the investor-only and buyer-only visibility classes end to end.** Public documents
  were uploaded and served; the restricted classes were observed only from seeded rows.
- **Whether the index ever had filters that later regressed.** Only the current code and the running page
  were checked, not the history.

**One disclosure about the audit itself.** Several agents worked against the same running demo database
concurrently and wrote to it, in an append-only schema where most of it cannot be undone. Left behind: a
published test project, two AUDIT-prefixed organisations, an approval of the organisation seeded to be
unvetted, extra deals, questions, buyer sites, document rows and a vetting draft. This is the drift reported
in section 3 item 17, and it is the reason a database rebuild is listed there as a release task.
