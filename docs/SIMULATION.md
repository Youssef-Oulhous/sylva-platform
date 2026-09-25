# SIMULATION — what happened when every user was made to do every job the note gives them

Run date: 2026-09-25. Target: the live app at `http://127.0.0.1:3000`, database `sylva_dev`.
Method: real Chromium driven by `playwright-core` (never curl for pages), plus direct SQL as the real
application login roles with HMAC-signed actor contexts. Eight journeys, 199 steps attempted, **194 counted**
(5 dropped, see *Dropped*). An operation is recorded as working only where it was performed **and** the result
was confirmed independently — on the page, in the returned bytes, or in the database.

Promises are quoted from `docs/reference/concept-note-2026-09-22.txt`. Capability expectations come from
`docs/ROLES.md`.

---

## 1. Can each user do the job the note gives them?

Mostly yes, and the enforcement layer underneath them is genuinely strong — but two of the eight journeys
could not be completed, and the buyer's page lies to the buyer. An **anonymous visitor** can do everything the
note asks: read both pilot projects in English and German, download every public PDF, the boundary GeoJSON and
the document zip with a verified SHA-256 manifest, and read the public record — except download the reporting
evidence pack, which 404s on every project. A **buyer** can register, get vetted, register sites and see correct
catchment distances, express interest, receive a pseudonym, ask a private question and read the owner's answer —
but **the buyer-lifecycle journey could not be completed by the organisation that started it**: saving a vetting
draft makes `/vetting` return HTTP 500 permanently, with no UI to clear the draft, so that organisation can never
be approved and can never transact; the journey had to be finished by a second organisation. A **project owner**
can take a project from nothing to published and close all ten publication-gate items — but the claim rights,
outcome detail and durability statement it records **never appear on the published page**, and it cannot name
itself as developer or landowner of its own project. An **investor** gets exactly what §6 promises: financing
withheld before vetting, released at the same URL after one approval, financial model downloading as a real PDF,
with a buyer refused at both page and `GRANT` level — while its own dashboard tells it the opposite of what just
happened and is titled "Buyer dashboard". The **operator** can vet, decline, correct by appending, and is
genuinely unable to publish past the gate — but has **no screen** for confirming registry records, **no screen**
for writing a correcting entry in the transaction record, and cannot resolve a pseudonym to an identity on any
screen at all. The **auditor** does its whole job: reads drafts, real names, vetted-investor documents and the
pseudonym reconciliation, and cannot write anything by any route tried. The **unvetted organisation** is refused
correctly everywhere, and a **declined** organisation is refused correctly but told it is still "in review".

---

## 2. Journeys

| Journey | Steps | Passed | Failed | Not built / blocked | End to end |
|---|---|---|---|---|---|
| project-lifecycle (owner → operator → visitor) | 23 | 11 | 11 | 1 not built | **Yes** |
| buyer-lifecycle (arrival → answered question) | 24 | 16 | 8 | — | **No** — `/vetting` 500 after Save draft; finished by a 2nd org |
| investor-lifecycle | 23 | 12 | 10 | 1 blocked | **Yes** |
| operator-and-auditor | 26 | 18 | 6 | 2 not built | **No** — 2 of 7 operator duties have no screen |
| anonymous-and-documents | 19 | 10 | 9 | — | **Yes** |
| seven-rules-attack (62 SQL attacks + 6 browser checks) | 35 | 33 | 2 | — | **Yes** |
| cross-user-isolation | 9 | 9 | 0 | — | **Yes** |
| note-promises (§1–§10 walked clause by clause) | 35 | 24 | 11 | — | **Yes** |
| **Total** | **194** | **133** | **57** | **3 not built, 1 blocked** | **6 of 8** |

Dropped: **5** steps, whose evidence did not confirm what the step claimed.
1. *operator-and-auditor* — "auditor reads non-public record entries": the fixture contains no non-public
   entry (`record.entry` 14 rows = `record.v_public_entry` 14 rows), so nothing was observed; only grants were read.
2. *note-promises* — "read the concept note and ROLES.md": preparation, not an operation on the platform.
3–5. *buyer-lifecycle*, *investor-lifecycle*, *anonymous-and-documents* — three separate "no new server-side
   errors in `.local-run.log`" checks. The running server does not write to that file (proven in
   *project-lifecycle*: pid 581895 has fd 1 and 2 on a session scratchpad `prod.log`), so a clean
   `.local-run.log` supports no conclusion about errors.

---

## 3. BROKEN — ranked by how much it hurts a real user

### 1. Saving a vetting draft locks the organisation out of vetting for ever
**Who / what:** a newly registered buyer ("SIM Thirsty Brewing", org `939ea429-…`) filled the questionnaire and
clicked **Save draft** at `/vetting`, then reloaded the page.
**Expected:** the draft is there. `/vetting/status` promises it in so many words: *"You can save a draft and come
back to it."*
**Happened:** `HTTP 500` on `/vetting`, `/vetting?saved=1` and `/de/vetting` — "Application error: a server-side
exception has occurred. Digest: 1834327547". No textarea, no radios, no form. There is no UI to clear a draft, so
the organisation can never submit, can never be approved, and can never transact. The draft itself saved fine
(7 rows in `org.vetting_draft`). Proven draft-specific: exactly one organisation in the database has draft rows
and it is the only account that 500s; `buyer.a@`, `sim.buyer.lifecycle2@` → 200.
**Where:** `src/lib/vetting/queries.ts` ~176 — `draftIn()` selects `updated_at` with no `::text` cast (every other
timestamp in the file is cast), so node-postgres returns a `Date`; `src/lib/vetting/types.ts:159` `dateOf()` then
calls `ts.slice(0, 10)`. Live probe: `typeof updated_at = object Date … TypeError: v.slice is not a function`.
**Note:** §7 — *"Nobody reaches this stage without being vetted by us first"*; §10 lists the vetting questionnaire
in the first release.

### 2. Claim rights, outcome detail and durability text never reach the published page
**Who / what:** owner "SIM Lifecycle Trust" recorded who may claim, for what, a full exclusions paragraph, the
outcome metric description and method, and a 40-year durability statement, then read its own published project
back as a signed-out visitor and as `buyer.a@`.
**Expected:** §6 — *"The partners on the ground"*, the claim-rights and outcomes sections; §3 — *"Who gets to
claim what can decide whether a buyer takes part."*
**Happened:** the Claim rights table shows the raw key `water_low_flow` and **"—" for WHO MAY CLAIM, WHAT MAY BE
CLAIMED and WHAT IS EXCLUDED**, directly beneath the instruction *"Read the exclusions column first"*. Outcomes
show `gw_level_summer`, EXPECTED "—", METHOD "—". The durability statement and land-control note are absent.
Identical signed out and as a vetted buyer.
**Where:** the text is in the database at `status='human_draft'`; public queries filter
`status IN ('published','reviewed')` — `src/lib/projects/queries.ts:459` (outcomes), `:526` (claim rights),
`:565` (durability). The owner's record form has a translation-status control in section 1 only; nothing in the UI
can promote sections 4, 5 or 6. The owner's own screen renders the text correctly, so the owner cannot notice.
The seeded demo projects are all `published`, which is why this was invisible before.

### 3. The reporting evidence pack does not exist — the route, the assembly, or the budget
**Who / what:** every role, every project. Clicked "Download evidence pack".
**Expected:** §6 — *"A reporting evidence pack … a measurable action, a fixed timeframe, expected impact, a budget
and a verification standard. We assemble exactly that as a downloadable pack."* §10 puts the full project page in
the first release. The button's own caption says "PDF · assembled when you download it".
**Happened:** no download fires; the browser navigates off the project page onto a bare
`404 / This page could not be found.` Re-confirmed while writing this: `GET
/api/projects/demo-untere-havel-wetland-restoration/evidence-pack.pdf` → **404 text/html**. Same on
`demo-marais-de-briere-restoration` and on the project created through the platform today. Same as an approved
vetted buyer. Behind it, nothing is assembled: `proj.evidence_pack_item` 0 rows, `proj.evidence_pack_build`
0 rows, for every project. The **budget** — one of the five parts the note enumerates — has no content and no
column anywhere: `proj.project_financials` holds `financing_need`, `revenue_streams_note`,
`financial_model_document_id` and no budget.
**Where:** href hard-coded at `src/components/project-detail/EvidencePackSection.tsx:74`;
`src/app/api/projects/[slug]/` contains only `boundary.geojson`, `documents/`, `documents.zip`.

### 4. Rule 2 is breakable: a registry reference of invisible whitespace is accepted
**Who / what:** operator, in SQL. `INSERT INTO credit.registry_record … external_record_id = <value>`.
**Expected:** §8 rule 2 — *"No allocation, transfer or retirement without a registry reference."* Migration 0101's
own comment: *"NOT NULL is not enough: '' and '   ' would satisfy it and R2 would be met by a blank reference.
The nonblank domain closes that."*
**Happened:** `''` and `'   '` were refused. A tab-plus-newline, a non-breaking space (U+00A0) and a zero-width
space (U+200B) were all **accepted**, could be marked confirmed, and a complete issue → allocate → retire chain was
recorded against one of them (registry record `e1674611-…`). Read back, the reference is 1–2 characters and
entirely invisible.
**Where:** `pg_get_constraintdef(nonblank_check)` = `CHECK ((btrim(VALUE) <> ''::text))`. One-argument `btrim`
trims only the ASCII space. The reference is the whole of R2's substance, so R2's only substantive test is
defeated by every whitespace character except one.

### 5. Publishing a project writes nothing to the permanent record
**Who / what:** operator published `sim-lifecycle-doeberitzer-fen`; the record was then read in the database and
on the public `/record` page.
**Expected:** §8 — *"Every step is written to a permanent record: listed, offered, interest expressed…"*
**Happened:** `record.entry` holds **0 rows** for the newly published project, and the public record's PROJECT
filter does not offer it. The only two `listed` entries in the database (entry_no 2 and 10, July 2026) belong to
the seeded projects and came from `db/seed`.
**Where:** `src/lib/admin/queries.ts:646` `publishProjectIn` runs a single
`UPDATE proj.project SET status='published'` and returns. The only non-internal trigger on `proj.project` is the
SY008 gate. `listed` exists as an entry type (migration 0012) and RLS permits an owner to append it (0076); no
code path ever does.

### 6. Every record entry the application writes has no source
**Who / what:** an approved buyer expressed interest; an anonymous visitor then read `/record`.
**Expected:** §9 — *"Every figure on screen carries its source and date."*
**Happened:** the new entry's SOURCE column reads **"The source of this entry could not be read."** while all
twelve seeded entries beside it read *"Source: DEMO transaction record, recorded by Sylva operations at the time
of each event · Updated: Sep 23, 2026"*. `record.entry.source_ref_id` is NULL for every entry created through the
UI (entry_no 27, 28) and set for entries 1–12.
**Where:** `INSERT_ENTRY_SQL` in `src/lib/interest/queries.ts` (~258) does not set `source_ref_id`, and the column
is nullable in the live schema although the comment above it and `src/lib/record/types.ts` both assert it is
NOT NULL.

### 7. A declined organisation is told the opposite of its decision, twice
**Who / what:** "SIM opaud-rc Declined Ltd" was declined with a recorded reason, then read its dashboard and
clicked Express interest.
**Expected:** it should be told it was declined, with the reason — the admin screen itself promises *"The recorded
reason is what the organisation is told."*
**Happened:** `/dashboard` prints **"WHAT THIS APPROVAL ALLOWS — Expressing interest in a published project…"**
directly under the DECLINED badge. The express-interest page says **"Your organisation has not been approved yet
/ IN REVIEW / Your questionnaire is with us and we will tell you the outcome by email"** and never shows the
reason. The same panel shows "IN REVIEW · your questionnaire is with us" to an organisation that has **not
submitted at all**, while its own closing line says "We have not received your vetting questionnaire yet" and
`/dashboard` correctly says "Not submitted".
**Where:** `src/components/buyer-dashboard/VettingPanel.tsx:117-131` renders ALLOWS and LIMITS unconditionally;
`src/lib/interest/gate.ts` collapses pending, declined and suspended into one `not_approved` state.
**Note:** §8 rule 6. The refusal itself is correctly enforced (see WORKS) — only the explanation is false.

### 8. Choosing "A document" as a source kind can never succeed, and any refusal empties the whole form
**Who / what:** owner filled `/owner/projects/new` with a full English body and set Kind of source = "A document",
an option every one of the nine section forms offers.
**Expected:** either it saves, or the page says what is wrong with that choice.
**Happened:** `?error=unavailable` — *"This was not recorded / This service is not available at the moment. Try
again shortly."* No row written. Every field typed came back empty. Separately, a server-side refusal
(`?error=invalid_input&field=source_label`) also returned every field blank and marked nothing: no
`aria-invalid`, no error class, no `data-error` on any element.
**Where:** server log `{"where":"createProject","sqlstate":"23514","constraint":"source_document_present"}`.
`CHECK` on `sylva.source_ref`: `kind <> 'document' OR document_version_id IS NOT NULL` — and no owner form
collects a `document_version_id`. `CreateProjectForm`'s own comment says the per-section split exists because
*"Asking for all of it here would mean losing all of it to one refused field"*.
**Note:** §9 — *"every figure carries its source and date"*; §6 — a ten-minute read.

### 9. An outcome baseline typed without its as-of date is reported as saved and silently thrown away
**Who / what:** owner submitted an outcome with baseline `0.85` and the baseline as-of blank (both labelled
OPTIONAL).
**Expected:** record it, or say why it cannot be recorded.
**Happened:** `?saved=outcome` with no warning; the publication gate still listed "Outcome baseline" as MISSING
with no explanation why. Resubmitting with a date closed the item.
**Where:** `src/lib/owner/record.ts` `addOutcome` inserts `indicator_value` only
`if (o.baselineValue !== null && o.baselineAsOf !== null)`. `proj.indicator_value` has one row, at version 4;
versions 1–3 carry no baseline.

### 10. 85 translation keys are unreachable, so the German project page renders hard-coded English
**Who / what:** a German reader on `/de/projects/…`.
**Expected:** §9 — *"English first, German second, so a translation library from the first commit."*
**Happened:** the verification-status sentence, "What one unit is", the map note, the sign-in-to-ask note, the
evidence-pack note, all document names ("Monitoring plan", "Project design document", "Project idea note"),
document visibility labels, partner roles, deal-type labels, "As at 2026-09-10" and "THE FINANCIAL MODEL IS ON
THE PLATFORM, IN THE DOCUMENTS BELOW." all render in **English**, although a distinct German value exists for
every one of them in `de.json`.
**Where:** 85 keys were written as flat dotted keys at the JSON root (`"projectPage.docKind.monitoringPlan": …`)
instead of nested objects, so next-intl's `t.has()` cannot resolve them and `label()` in
`src/lib/projects/labels.ts` silently returns its English `fallbackEn`. Both catalogues have 2,625 keys, so no
audit that counts keys will catch it. Separately, `proj.project_financials` has **one** `revenue_streams_note`
column and no German counterpart, so the German page shows the English paragraph by design.
Three further strings on the German page are untranslated at source: "CATCHMENT AREA", the areas caption, and
"In this catchment" / "Not in this catchment".

### 11. Figures without a source and a date, and one source stamp that contradicts the line below it
**Who / what:** anonymous visitor, both project pages and the index.
**Expected:** §9 — *"Every figure on screen carries its source and date."*
**Happened:** three distinct failures.
- **PROJECT AREA** (4,722 ha / 5,390 ha) and **CATCHMENT AREA** (1,450 km² / 1,150 km²) in the GEOGRAPHY panel of
  section 01 carry no stamp at all; the nearest stamp belongs to a paragraph two blocks below.
  `src/components/project-detail/CatchmentMapPanel.tsx:118-136`.
- The map legend's area figures carry *"Source: DEMO Untere Havel Project Design Document v2.1, Table 4.2 ·
  Updated: Sep 12, 2026"* and the sentence printed **directly beneath that stamp** says *"Areas are computed by
  the platform from the boundary and catchment polygons above, not quoted from the documents."* Same component,
  lines 91-99.
- `/projects` carries **zero** source stamps while displaying eight availability figures (540/54/0/486 and
  12,400/1,000/0/11,400) that are individually sourced on the project pages. Document-table file sizes ("1 kB")
  are also unstamped and, unlike other platform-recorded values on the page, unlabelled as platform-recorded.

### 12. There is no 404 page, and 404s outside the locale tree are CSP-broken
**Who / what:** any visitor who mistypes a URL, follows a stale project link, or clicks "Download evidence pack".
**Expected:** §9 — *"Every page carries the EU emblem, the co-funding line and the disclaimer."*
**Happened:** every 404 is the stock Next.js page: body text exactly 33 characters, Times New Roman on white, no
header, no footer, **no emblem, no co-funding line, no disclaimer**, no design system. `find src -name
"not-found*"` returns nothing. On `/nope-404-zzz` and `/de/nope-404-zzz` the response also carries a CSP nonce
that no script in the document carries, so `strict-dynamic` refuses every chunk and every inline bootstrap
script — 13 and 12 violations, page not hydratable. This is the same defect class the brief warns about: fine in
curl, broken in a browser.

### 13. `/for-investors` — the investor's entry page — lists projects that do not exist, and its main CTA sends nothing
**Who / what:** approved investor clicked every row in "Projects seeking financing", then filled "Request access
to financial information" and clicked Send request.
**Expected:** §4 — investors *"come in once buyers have committed"*; the page claims *"the table below states
which projects have reached it"*. §7 — *"Nobody reaches this stage without being vetted by us first."*
**Happened:** of three rows, `demo-untere-havel-wetland-restoration` → 200, `demo-marais-de-sevre-floodplain` →
**404**, `demo-shannon-callows-peat-rewetting` → **404**. Their stage labels, deal types and pack dates are
literals, not read from commitment data (`src/app/[locale]/for-investors/page.tsx:106`, `DEMO_PIPELINE`). The
Send request button is `type="button"` on a `<form>` with no action
(`src/components/for-investors/AccessRequestForm.tsx:23, 118`): clicking it does nothing, URL unchanged. Small
print does disclose it — but the route that works (`/register` as Investor, then `/vetting`) is not what the page
offers.

### 14. The investor's dashboard states the opposite of what the platform just did
**Who / what:** investor "SIM Green Capital", immediately after the single approval that released
€1,200,000.00, the revenue streams and the financial model at the same URL.
**Happened:** the panel reads **"WHAT THIS APPROVAL IS NOT: It is not access to financing information. Access to
financial information is a separate vetting decision for investors."** It also promises three capabilities the
investor does not have — express interest (refused: "NOT A BUYER ACCOUNT"), a deal room (not built), registering
sites (`/dashboard/sites` silently redirects back to `/dashboard`) — and the page `h1` reads **"Buyer
dashboard"**. On the project page the approved investor is still offered an **"Express interest"** button, with
copy saying it opens a private conversation, which leads only to that refusal.
**Note:** §4 roles; ROLES.md "Investor — cannot register sites, that is a buyer's feature".

### 15. The operator cannot do two of the jobs §4 and §8 give it, and cannot resolve a pseudonym on any screen
**Who / what:** operator, every route enumerated.
**Expected:** §4 — *"Us, the operator. Sylva. We vet everyone who wants to transact, confirms records and
publishes."* §8 rule 4 — *"A mistake is corrected by a new entry that points at the wrong one."* ROLES.md — the
operator can *"see real organisation identities, including behind a pseudonym"*.
**Happened:**
- **No registry-confirmation screen.** `src/app/[locale]/admin` has exactly two routes, `vetting` and `projects`.
  No code writes `credit.registry_record` or `credit.registry_confirmation_event`, although `sylva_operator`
  holds INSERT on both. 0 rows in each, 0 credit positions. §8 rule 2 cannot be exercised through the product.
- **No record-correction screen.** The only `INSERT INTO record.entry` in the codebase is express interest
  (`src/lib/interest/queries.ts:259`); `corrects_entry_no` and `correction_reason` appear only in SELECTs. The one
  `correction` entry is seeded. The mechanism works for vetting decisions — this is a missing screen, not a
  missing design.
- **Pseudonym reconciliation exists only for the auditor.** `SET LOCAL ROLE sylva_operator` resolves Buyer 002 →
  DEMO Verdant Foods NV in SQL, but `/record` renders byte-identically for the operator and for an anonymous
  visitor, and the operator's entire link set is `/admin/vetting`, `/vetting`, `/record`. `/auditor/deals` says so
  itself: *"a public row and a named row can be reconciled here and nowhere else."*
- **Private questions have no operator inbox and the panel is mislabelled.** §6: *"Questions go to the project
  owner and to us."* The operator does receive them — but only by opening each project page one at a time, under
  the heading **"YOUR QUESTIONS ABOUT THIS PROJECT"**, showing three questions asked by two other organisations
  with no indication of who asked. `QUESTION_SQL` (`src/lib/projects/queries.ts:672`) is
  `WHERE q.project_id = $1` with no asker scope and relies on RLS, which gives the operator `USING(true)`.

### 16. A project owner cannot record itself as developer or landowner of its own project
**Who / what:** owner opened the Partners section's Organisation select on its own project.
**Expected:** §6 — *"The partners on the ground. Who develops the project, who owns the land, who verifies."*
**Happened:** the options were four DEMO organisations. **SIM Lifecycle Trust — the organisation that owns the
project — was absent from its own project's list.**
**Where:** `src/lib/owner/queries.ts` reads `org.v_public_party`, which names declared parties and owners of
already-published projects; a new owner is in neither set until it is already a declared party. Publication is
not blocked, because the verifier gate item can be satisfied from the DEMO list.

### 17. The site form silently refuses a coordinate with more than four decimals
**Who / what:** approved buyer entered the PostGIS-derived point 52.749208, 12.431029 on `/dashboard/sites` and
clicked Add site.
**Happened:** **no POST was made at all** — no submit event, `requestSubmit()` also inert, URL unchanged (no
`?done=`, no `?error=`), no `[role=alert]`, and `geo.buyer_site` row count 1 before and 1 after. Cause:
`<input type=number … step=0.0001>`, so `checkValidity()` reports *"The two nearest valid values are 52.7492 and
52.7493."* The field hint says only "Decimal degrees, written with a decimal point" and "Between -90 and 90"; the
4-decimal limit is never mentioned and nothing appears on the page.

### 18. An interest volume eleven times the remaining availability is accepted without a word
**Who / what:** approved buyer asked about 99,999 units for a period the same form displays as REMAINING 8,740.
**Happened:** accepted silently; `deal.interest_volume.requested_raw = 99999.000000`. No warning on the form or
the confirmation. **This is not a rule-1 breach** — availability still read RESERVED 0 / COMMITTED 0 / REMAINING
8,740 afterwards and no `commitment_entry` was created — but the form shows remaining and then accepts eleven
times it in silence.

### 19. The vetting questionnaire misdescribes itself, and the applicant and the operator read different questions
**Who / what:** project owner and investor applicants; also `/register`.
**Happened:**
- `/vetting` states *"…answers these eight questions"*, heads the section **"THE EIGHT QUESTIONS"** and says
  *"Five questions in your own words, then three that need a yes or a no"*, while the progress panel reads **"0 of
  4 questions answered"** and only four free-text fields exist, none yes/no. DB: buyer 8, investor 4, project
  owner 4 — the copy is hard-coded for the buyer questionnaire and shown to every role.
- The applicant was asked *"How does your organisation operate?"* under a buyer-framed WHY WE ASK; the operator's
  panel shows the same answer under *"How does your organisation operate, and who delivers the restoration on the
  ground?"*. `src/messages/en.json` `vettingForm.question` holds only the eight buyer codes, and `operations`
  overrides the per-role DB prompt.
- Three of the four owner questions carry no hint and no WHY WE ASK, although the page states *"Every question
  below states why it is asked."*
- `/register` advertises **"QUESTIONNAIRE 4 parts · 18 questions"** with a source stamp; it is a hard-coded
  constant (`src/components/for-buyers/VettingPreview.tsx:44`) and no questionnaire has 18 questions.
- `/vetting/status` heads a five-row table (NOT STARTED, SUBMITTED, APPROVED, DECLINED, SUSPENDED) **"The four
  states"**.

### 20. Rule 7's escape hatch is open to the anonymous role, and the linter standing in for enforcement catches one shape in four
**Who / what:** `sylva_web_anon` and operator, in SQL.
**Happened:** `SELECT sum(amount) FROM (SELECT (expected_issuance_qty).amount AS amount FROM
proj.v_period_availability) t` returns **33,050** to an unauthenticated connection — 12,400 + 10,000 + 9,500
hectare-years under one scheme added to 540 + 610 index points under another. Three further shapes succeeded
(`sum((x).amount)`, a space before `.amount`, a `LATERAL`). `scripts/check-rule7.ts` catches one of the four and
reports "rule 7: clean" on the repo as it stands. The composite column grant carries its `.amount` field with it,
so the `*_raw` revoke does not cover this path.
**Note:** §8 concedes R7 cannot be enforced in Postgres, so this is a gap in the compensating control, not a
broken promise — but the compensating control is currently one regex wide.

### 21. Contradictory period wording on the Brière project
Section 06 prints *"Periods refer to the period in which units are issued."* immediately followed by *"A period
names the year in which the ecological outcome occurs. Units for that outcome may be issued later… Do not read a
period as the date units become available."* The second sentence is rendered unconditionally
(`src/components/project-detail/AvailabilitySection.tsx:57`) and is correct only for outcome-basis schemes such as
Havel's. The same wrong pairing appears in the header chip: "NEAREST PERIOD 2029 period of issuance".
§2 — *"Units from different projects are not interchangeable."*

### 22. Smaller defects, confirmed
- The financing block tells the reader the financial model is *"in the documents below"*. Financing is section 11,
  the last; the document register is section 07, above it — and the sentence is plain text with no link or anchor.
- The catchment panel tells a **signed-in** investor *"Unknown while you are signed out. Register your sites to
  see this."* Both halves are wrong for that viewer (`CatchmentMapPanel.tsx:157-162`, shown whenever
  `proximity === null`).
- "Forgotten your password?" (`src/components/sign-in/SignInForm.tsx:90`) points at `/forgotten-password`, which
  does not exist — a redirect to a bare 404 for all nine accounts, and an RSC prefetch 404 on every sign-in view.
- §6 promises project pages *"shareable and indexable"*. The `<head>` has only charset, viewport, title,
  description and robots: no canonical, no `og:*`/`twitter:*` (a forwarded link previews as a bare URL), no
  `hreflang` to the German copy. `/sitemap.xml` and `/robots.txt` both 404 (re-confirmed).
- Inside the documents section the withdraw form's required `reason` input precedes the upload button in the DOM,
  so a naive "first submit button" click hits withdraw and nothing happens, silently.
- The financing block shows a "PHASE 2" badge although the investor data is built and renders live figures.
- After Submit for review the identity strip still says "A draft is visible only to your organisation and to
  Sylva".
- A forced privileged write by a signed-in non-operator is correctly refused, but the reason is never shown
  (`requireOperator` → `/sign-in?error=wrong_role` → a signed-in auditor is bounced to `/auditor`) and **nothing
  is logged** — no `record.access_log` row for the attempt.
- The documented server log is dead: `.local-run.log` was last written Sep 24 23:33 and holds 20 stale
  `documentsZip.missing` lines for document ids that no longer exist. The running server (pid 581895) writes
  stdout and stderr to a session scratchpad `prod.log`, where the real `createProject` failure was found. Anyone
  following the brief's diagnostic path sees a silent log.

---

## 4. WORKS — performed and confirmed

**Anonymous visitor**
- All nine public pages render real content in a real browser, English and German (3.2k–14.4k chars each); no page-level JS errors; CSP nonce matches the DOM on locale pages.
- Project page server-rendered and fast: TTFB 80 ms, DOMContentLoaded 259 ms, load 330 ms, 33.6 kB; renders fully with JavaScript disabled, tables and map included.
- All eleven §6 sections present and populated on both seeded projects and on the project created through the platform today.
- Six public PDFs download as real `%PDF-1.4` bytes, inline and as attachments, every SHA-256 matching `doc.document_version`.
- Both boundary GeoJSON files: 200 `application/geo+json`, parse as MultiPolygon Features with closed 35-point rings and licence/source/as-of in properties (re-confirmed 200 today).
- Both `documents.zip` archives open; `MANIFEST.txt` gives kind, version, upload time, media type, bytes, SHA-256 and visibility per file, all verified against the extracted bytes.
- Financing shows three WITHHELD markers and the figure "1,200,000" is absent from the HTML, not merely hidden.
- The draft project is unreachable by slug, in both locales, by API, from the index ("2 projects"), from the record filter, and through every privileged route — 404, never 403, no leak of its name.
- `/record` filter genuinely filters (12 entries → 3) and the filtered view is a shareable URL.
- Express interest signed out ends in an explanatory "SIGN IN REQUIRED" panel, not the dead end ROLES.md still lists as known gap 1.
- The catchment map renders as inline SVG with no third-party tiles; legend swatch colours match the drawn paths.
- No third-party trackers: a full project-page load contacts zero external hosts.
- "We are not the registry" appears on all nine pages checked; "Units from different projects … are never added together" on the index; §3's four buyer findings on `/for-buyers` in §3's order with their interview source.

**Buyer**
- Registration creates organisation and first user in one transaction, signed in, **not** approved (0 rows in `org.org_role_approval`).
- Questionnaire submits: 8 answers stored verbatim; `/vetting/status` shows SUBMITTED with the application reference.
- Two company sites registered through the form; distances 11 km "In this catchment" and 496 km "Not in this catchment", both matching PostGIS to the kilometre; add, rename and remove all confirmed (`?done=added/updated/removed`).
- Express interest creates `deal.deal` (stage `interest_expressed`), allocates the per-deal pseudonym ("Buyer 006", "Buyer 008") and writes `deal.interest_volume` with its stated source line.
- The public record shows the event under the label with sector, country and size band, and never the legal name.
- A private question reaches the owner, the owner's reply is stored (`deal.project_question_answer`), and the buyer reads it back attributed and dated.
- An unapproved buyer is refused at express interest with an explanation and a link to vetting — no form is rendered at all.
- `/dashboard` lists the expressed interest with project, scheme, unit type, stage and record reference.

**Project owner**
- Project created as a draft with its first page text and provenance; nine section forms each appended a version and closed one gate item, 10 → 0.
- The on-screen gate matched `proj.publication_gaps()` at **every one of the ten steps**, same items, same order, reaching empty together.
- Every section form requires `source_kind`, `source_label` and `source_as_of`; boundary additionally requires its own geometry as-of and a licence; periods a forecast as-of. Blank source refused by the browser **and** by the server.
- Two PDFs uploaded through the UI, each registered with a v1 version and a byte size — ROLES.md known gap 3 ("upload UI does not exist") is closed.
- Submit for review moves the status to IN REVIEW; the owner has no publish control anywhere, and `ci.assert_owner_cannot_self_publish` passes.
- `/owner/questions` shows the asker only as "Buyer 006 · LABEL FOR THIS DEAL · sector · country · size", never the legal name; the reply is recorded and marked "not published".
- The publication-gate panel names each missing item and states its source: *"the publication gate function, proj.publication_gaps() … not a copy of it kept elsewhere"*.

**Investor**
- Registration applies for the investor role and grants no approval.
- Financing WITHHELD before vetting, with the field names listed and an explanation; released at the **same URL** after one approval — €1,200,000.00, three revenue streams, the model reference and its as-of date.
- The financial model downloads as a real 1,449-byte `%PDF-1.4`; the vetted-investor document also appears in the investor's `documents.zip` (7,781 bytes) and not in the public one (5,949 bytes) — the bundle is assembled per role.
- Nothing anywhere states a return, yield, IRR, NPV, payback or projection: a 13-page sweep in both locales and a grep of `src/` and `src/messages/` return only the platform's own denials, and `proj.project_financials` has no column a return could live in.
- The private question box works end to end for an investor; the draft project stays 404.
- The refusal of express interest is explicit and explained ("NOT A BUYER ACCOUNT"), closing ROLES.md known gap 1 on that path.

**Operator**
- The queue lists applications with legal name, sector, country, role and state, and shows all answers as submitted.
- A decision with no reason is refused with a visible explanation — *"A decision needs a reason of at least ten characters. The record is append-only…"* — and writes nothing.
- Approve and decline each append one entry; the panel re-derives the state from the chain ("State read from N entries recorded against this application").
- A wrong decision is corrected by appending: four entries stayed visible, the superseded ones marked, the state re-read each time. Nothing was edited.
- Approval state is never written: `sylva_operator` holds UPDATE on 12 reference tables and not on `org.org_role_approval`; INSERT and UPDATE both refused 42501; `ci.assert_approval_is_derived()` passes.
- The publish button is genuinely `disabled=true` on a gate-incomplete project and `disabled=false` at 10 of 10; stripping the attribute and forcing the POST was refused by the database with **SY008**, all ten missing items named, and the project is still a draft.
- Publishing a complete project worked and put it on the public index; only the intended project was published.

**Auditor**
- All six auditor pages render, each badged "THIS ROLE CANNOT CHANGE ANYTHING", and the landing page re-runs three CI assertions live, each printing "passed".
- Reads the draft project with its gate gaps, every organisation's legal name and registration number, every vetting decision with its reason, documents with SHA-256 and storage region, verification indicators with verifier names, page-text versions and geometry.
- `/auditor/deals` prints the buyer's legal name beside the public label — the only place a public row and a named row can be reconciled.
- Downloads everything: both vetted-investor financial models and both full project ZIPs.
- Writes nothing. No edit control on any page (only two read filters). Six direct writes as `sylva_auditor` all refused 42501. Two forced POSTs of the operator's own server actions changed nothing. `sylva_auditor` holds SELECT on 76 tables and zero INSERT/UPDATE/DELETE/TRUNCATE.

**Platform-wide**
- `ci.run_all()` returns "all CI assertions passed" — 38 assertions, including `assert_no_volume_without_scope`, `assert_one_unit_type_per_row`, `assert_rls_complete`, `assert_pseudonym_map_is_not_public`, `assert_web_anon_is_read_only`, `assert_no_personal_columns_outside_identity`, `assert_no_soft_delete`, `assert_auditor_is_read_only`.
- Personal data lives only in `identity.user_account`; the record carries opaque person labels ("representative #1"), so it survives erasure.
- `platform.storage_region` names three real member-state regions and document versions reference them.
- One typeface throughout (IBM Plex Sans), zero `<img>` elements on any page, declarative hedged copy.
- German is a real translation, not a prefix: `lang="de"`, German navigation, footer, all eleven section headings, the whole record page and the full questionnaire including Ja/Nein; both catalogues hold 2,625 keys with none missing (the 85 unreachable ones are a resolver defect, item 10).
- Availability is stated per project, per period, per unit type with the unit label on every number and **no total anywhere**, on the index and on every project page.

---

## 5. THE SEVEN RULES

62 SQL attacks as the real login roles with genuine signed actor contexts, plus 6 browser checks. Every write ran
inside a transaction that was rolled back, except one deliberate two-connection R1 race, restored with a
compensating release entry (net effect on availability zero; two traceable `SIM` commitment rows remain as the
audit trail).

| Rule | Attack | What the database did | Held |
|---|---|---|---|
| **R1** no commitment beyond expected issuance minus buffer | 11,401 against 11,400 sellable; two individually-legal commitments in one transaction; **two simultaneous commitments on two connections**; a downward forecast revision below what is committed; direct `UPDATE proj.period_balance`; `DROP CONSTRAINT` | 23514 `r1_reserved_plus_committed_within_sellable` on the single and on the summed value; the second connection **blocked on the balance row lock** (55P03 lock timeout) and its retry was refused after the winner committed; the downward revision was recorded with `effective=false` and a `blocked_reason`, availability unmoved; 42501 on the table (`reserved_raw` is granted to no role at all); "must be owner of table" on the DDL | **Yes** |
| **R2** no allocation, transfer or retirement without a registry reference | `''`; `'   '`; **tab+newline**; **U+00A0**; **U+200B**; NULL reference; unconfirmed reference; reference from another scheme/project/unit type | `''` and `'   '` refused by the `nonblank` domain; **tab+newline, U+00A0 and U+200B all accepted, confirmed, and a full issue → allocate → retire chain recorded**; NULL 23502; unconfirmed 23503 `r2_registry_reference_is_confirmed`; wrong scope 23503 `r2_registry_record_same_scope` | **No** — `btrim/1` trims only the ASCII space |
| **R3** terminal states are final | retired → allocated with a truthful parent; the same lying about the parent's kind; `UPDATE`/`DELETE`/`TRUNCATE` the retired row; move 400 out of a 200-unit position | 23514 `r3_terminal_is_final`; 23503 `r3_parent_kind_is_real` (the composite FK proves the claimed kind against the real one); 42501 on all three verbs; 23514 `conservation` | **Yes** |
| **R4** append-only, corrections are new entries | `UPDATE`/`DELETE`/`TRUNCATE record.entry` as all five principals (15 statements); correct the same entry twice; point a correction at itself; at a nonexistent entry; `session_replication_role='replica'`; `DISABLE TRIGGER ALL`; `NO FORCE ROW LEVEL SECURITY`; `ADD COLUMN is_deleted`; `GRANT UPDATE … TO sylva_operator`; `SET ROLE postgres`; edits to `vetting_decision`, `organisation_pseudonym`, `deal_disclosure_event`, `position_balance`, `interest_volume` | 42501 on all 15; 23505 `ux_record_corrected_once`; SY023 twice; 42501 on the GUC; "must be owner" on the DDL; the GRANT succeeded as a statement and granted nothing (`has_table_privilege` false before and after, subsequent UPDATE still 42501); `SET ROLE` refused; pseudonym label "can only be updated to DEFAULT". The corrected entry stayed visible with `is_superseded=true` | **Yes** |
| **R5** pseudonymous by default | buyer reads another buyer's `legal_name`; via a join; via `deal.deal_pseudonym.org_id`; via `deal.counterparty_legal_name()`; via `identity.user_account`; via `record.entry.actor_org_id`; and the same on screen | 42501 on `org.organisation` (column-level: `legal_name` granted only to operator, auditor, record); 42501 on **both** pseudonym tables, so the join never forms; the function is not granted to `sylva_buyer` at all; `record.v_public_entry` returned labels with `counterparty_is_named=false` and only sector/country/size; the public record page never printed an undisclosed name, and identity is resolved as of each entry's own timestamp | **Yes** |
| **R6** no deal for an unapproved organisation | unvetted org inserts a deal; **the operator inserts the same deal on its behalf**; forge `org_role_approval` by INSERT and by UPDATE; then the control — record a real approval and retry | **SY006** *"R6: organisation … is not an approved buyer (status: no decision on record); no deal can be created for it"* — identically for the operator, because R6 is about the organisation, not the actor; 42501 on both forgery attempts; with a genuine decision recorded the trigger flipped the cache and the same deal was accepted (then rolled back). Through the UI, a declined organisation's forced POST returned `?error=not_approved` mapped from SY006, 0 deal rows | **Yes** |
| **R7** never add units across projects or unit types | `sum(committed_raw)`; `sum(committed_qty)`; `sum(remaining_qty) GROUP BY period_label`; `sum(amount_qty)`; `sum(requested_qty)`; `max(remaining_qty)`; then **four ways of reaching past the composite to `.amount`**, as operator and as `sylva_web_anon` | 42501 on every `*_raw` path (no role holds those columns); 42883 `function sum(sylva.unit_qty) does not exist` for every composite aggregate and every role; the honest aggregate refused on purpose with **SY007** naming both projects, and succeeded when grouped. **But all four `.amount` forms succeeded for the anonymous role, returning 33,050**, and `scripts/check-rule7.ts` catches one of the four | **No** (as a technical control; §8 concedes it is not enforceable in Postgres) |

Rules held: **5 of 7**. R2 is a real defect. R7's failure is the residual risk the note already admits, but the
compensating control is weaker than it looks.

---

## 6. ISOLATION — every cross-organisation attack

**Breaches: 0.** The failure §8 calls *"the failure we most need to avoid"* did not occur by any route tried:
interface, form tampering, direct role-level SQL, or actor-context forgery.

| Attack | Who → what | Result |
|---|---|---|
| Read another buyer's registered sites | buyer A → buyer B's `geo.buyer_site` | Dashboard showed only A's two sites; direct query as `sylva_buyer` returned A's 2 rows, 0 for B |
| Read another buyer's deals | buyer A → `deal.deal` | 1 row (A's own); `WHERE buyer_org_id = B` → 0 |
| Read another buyer's vetting answers | buyer A → `org.vetting_answer` | 8 rows, all A's submission |
| Read another buyer's questions | buyer A → `deal.project_question` | 0 rows; on the project page B's block reads "You have not asked anything about this project yet" |
| Read non-public documents | buyer A → `doc.document` | 8 rows, all `visibility='public'`; the vetted-investor model 404s for a buyer in its own browser session with header `x-sylva-message-key: documentError.notFound` |
| Address another org's deal id in a URL | buyer A → every route | No buyer-facing route takes a deal id; `/auditor/deals` redirects to `/dashboard` |
| **Forge an actor context** (raw org-id set; valid signature with the org UUID swapped; self-forged HMAC; correctly-signed but expired) | buyer A → buyer B | All four resolve to **NULL**, 0 rows. `mint_actor_ctx` denied to the buyer role; `sylva.context_key` granted to no application role (FINDING-001 fix in force) |
| Unmask a pseudonym | buyer, investor, project owner | `org_id` on both pseudonym tables and `SELECT` on `org.organisation` are granted only to operator and auditor; labels are public, the mapping is not |
| Write to another owner's project | owner A → owner B's project | `UPDATE` affected 0 rows; `INSERT` refused 42501 "new row violates row-level security policy"; other owners' drafts invisible |
| Public record discloses an undisclosed buyer | anonymous, buyer B | Only pseudonyms ("Buyer 002", "Buyer 004", "Buyer 006", "Buyer 008") plus project owners and the one buyer with a `deal_disclosure_event`; "Verdant", "Rheinbank", "Fonds Bleu", "Unvetted Trading" absent |
| Rendered-text leak sweep | buyer A, 8 reachable pages | Zero markers of buyer B (name, site, org id) on any page |
| Cross-role route access | buyer, investor → `/owner`, `/admin/*`, `/auditor/*` | Redirect, never a leak; regex for the draft project's name false on every landing page |
| After sign-out | ex-buyer → 11 authenticated routes | All 11 redirect to `/sign-in?next=…`; none rendered |
| Investor financial data | buyer.a → §11 and the model file | 3× WITHHELD, figure absent from the HTML, no link to the document, 404 on the file; at the database `sylva_buyer` and `sylva_web_anon` get *"permission denied for table project_financials"* — a **GRANT** refusal, not a policy that could be loosened by mistake |

One method note: a UI-tampering probe did write once — a legitimate edit of the tester's **own** site, because
Next.js server actions bind fields through an encrypted closure and the DOM-swapped hidden id never transmitted.
It was restored to its seeded values and the fixture verified.

---

## 7. NOT BUILT

### Deferred by §10 / ROLES.md — absence is expected
- **Deal rooms, messages and draft-terms versions** (§7). Only the first stage marker exists ("Interest
  expressed — the first of four stages, ending at signed"). No progression to letter of intent, term sheet or
  signed could be exercised.
- **Issuance, allocation, transfer and retirement screens.** Consequently **R2 and R3 cannot be exercised as a
  user at all** — they were attacked only in SQL. `credit.credit_position`, `credit.registry_record` and
  `credit.registry_confirmation_event` are all built, granted and **empty** (0 rows each).
- **Investors expressing interest.** `sylva_investor` holds no INSERT on `deal.deal`. The refusal is now
  explained; the capability is a product decision, not a bug — but the button that leads to it is still offered
  (§3 item 14).

### Missing — the note promises it and nothing does it
- **The evidence-pack route, its assembly, and the budget it must contain** (§6, §10). No route, 0 items,
  0 builds, no budget column anywhere. Ranked #3 above.
- **`listed` on publish** (§8). The record never starts for a project published through the platform. Ranked #5.
- **An operator screen to confirm registry records** (§4 *"confirms records"*). Tables, grants and the
  confirmation-event table exist, unused.
- **An operator screen to write a correcting entry in the transaction record** (§8 rule 4). The mechanism works
  for vetting decisions; the transaction record has one INSERT path in the whole codebase.
- **Erasure.** §9: *"A person must be deletable without breaking the permanent record."* The design is sound and
  demonstrable — personal data in one table, opaque person labels in the record — but the operation cannot be
  performed by anyone: `identity.erasure_event` 0 rows, writable only by `sylva_owner`, no function matching
  `%eras%`, no screen. Only descriptive copy exists.
- **Usage analytics.** §9: *"Basic usage analytics from day one, self-hosted or EU-hosted, no third-party
  trackers."* The no-trackers half is honoured absolutely (zero external hosts on a full page load). The
  analytics half does not exist: `platform.page_view_daily` is empty after an entire multi-agent session, and no
  application code references it — only the migrations that create it.
- **A catchment map on the projects index** (§10 names it explicitly). `/projects` has no map at all beyond a
  114×114 px boundary thumbnail per card, and **no filter, search or select of any kind** — so a buyer cannot
  find projects by catchment, which §3 names as the buyers' first question.
- **A 404 page**, **a password-reset page**, **a sitemap and robots.txt**, and **a German column for
  `revenue_streams_note`**.

### Awaiting client material — labelled on screen, not a code defect
- **The EU emblem and the grant disclaimer.** §9 and §2: *"every page must carry the EU emblem and the line …
  with a short disclaimer."* The co-funding line is present on every page in both locales. The emblem is a
  `role="img"` placeholder reading "EU emblem required" / "EU-Emblem erforderlich" — no `<img>`, no `<svg>` — and
  the disclaimer is replaced by *"The disclaimer required by the grant agreement has not been configured. The
  exact wording must be taken from the grant agreement and must not be drafted here."*
  `src/components/eu/EuFundingNotice.tsx` renders `/eu/emblem.svg` and `SYLVA_EU_DISCLAIMER_EN/_DE` when
  supplied. Honest and deliberate — **but §9 is not satisfied today, on any page.**

---

## Fixture

No seeded organisation was approved, declined or suspended. `unvetted@demo.sylva.example` still has no row in
`org.org_role_approval` and is still SUBMITTED in the operator queue. No seeds were re-run, no migrations
applied, the server was not restarted. Seeded availability is back to 0 committed / 0 reserved on all five period
balances, confirmed in the database and on the project page. What was deliberately left behind, all traceable:
the `SIM *` organisations, one published `SIM` project, the deals, interest volumes, questions and answers they
generated, and two `SIM` commitment rows (commit 7000, release 7000) that net to zero. One live reproduction case
is left standing on purpose: `SIM Thirsty Brewing` (`939ea429-…`) with a saved draft and a 500ing `/vetting`.
All scratch scripts deleted.
