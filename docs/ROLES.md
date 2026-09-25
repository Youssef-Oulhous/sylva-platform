# Who can do what

Every row below was verified against the running platform on 24 September 2026 —
by signing in as that account and trying it, not by reading the specification.

Demo password for every account: `demo-password-not-for-production`

Two independent things decide access, and both must allow an action:

| | Mechanism | Forgeable? |
|---|---|---|
| **Role** | the PostgreSQL role, set with `SET LOCAL ROLE` | No — a role cannot `SET ROLE` to a role it is not a member of |
| **Organisation** | an HMAC-signed context verified inside a `SECURITY DEFINER` function | No — see `docs/FINDING-001` |

So the application does not decide who sees what. It asks, and the database answers.

---

## Anonymous visitor

No account. Everything here is public and indexable.

**Can**
- Read the landing page, the explainer pages, and the projects index
- Open any **published** project page and read all eleven sections
- Download a project's boundary GeoJSON and its public documents
- Read the public transaction record

**Cannot**
- See an unpublished or draft project — RLS returns nothing, not a 403
- See any buyer's site locations — `permission denied for table buyer_site`
- See investor financials — `permission denied for table project_financials`
- See a buyer's real name unless that specific deal was disclosed
- Write anything at all — `ci.assert_web_anon_is_read_only()` proves it

---

## Company — buyer  ·  `buyer.a@demo.sylva.example`

Lands on `/dashboard`. Second buyer for isolation testing: `buyer.b@`.

**Can**
- Everything an anonymous visitor can
- **Register company sites** — add, edit, remove (`/dashboard/sites`)
- **See the distance from its own sites to each project**, and whether the site
  shares the project's catchment. Straight-line, to the project boundary.
  Verified: 23 km and 241 km from the two demo breweries to the Havel project.
- **Express interest** in a project — creates the deal, allocates a per-deal
  pseudonym and appends to the permanent record, in one transaction
- Ask the project owner and Sylva a **private question** (no public comments exist)
- Complete the **vetting questionnaire** and track its status
- See its own organisation and vetting status, interests, sites and documents

**Cannot**
- See another buyer's sites, deals, questions, documents or identity
- See investor financials — the block renders **WITHHELD**
- Reach `/owner`, `/admin/*` or `/auditor` — redirected to `/dashboard`
- Publish anything

---

## Investor  ·  `investor.a@demo.sylva.example`

Lands on `/dashboard`. Second investor: `investor.b@`.

**Can**
- Everything an anonymous visitor can
- **See the financing block on a project page**, which nobody else sees:
  financing need (demo: €1,200,000), revenue streams, and the financial model
  document. Same URL as everyone else — the difference is what the database returns.
- Ask a private question
- Complete vetting and track its status

**Cannot**
- Register sites — that is a buyer's feature
- **Express interest.** Only `sylva_buyer` holds `INSERT` on `deal.deal`.
  See *Known gaps* below: the concept note's investor journey does end in
  "express interest", so this is an open product decision rather than a settled rule.
- Reach `/owner`, `/admin/*` or `/auditor`

**Deliberately absent:** no expected return, yield or IRR anywhere. The concept
note supplies none and the brief forbids unsupported financial-return
calculations. Financing need and revenue streams are things the project states;
a return would be a claim about the future that this platform does not make.

---

## Seller — project owner  ·  `owner.a@demo.sylva.example`

Lands on `/owner`. Second owner: `owner.b@`.

**Can**
- **Create a project** and fill it in: title and summary in English and German,
  outcomes with baselines and verifier, claim rights with their exclusions,
  durability commitments, partners, periods with expected issuance and buffer,
  declared unit types, and the boundary geometry
- **Upload project documents**
- **Submit for review**
- **Answer buyers' private questions** (`/owner/questions`)
- See exactly **what is still blocking publication** — the same list the database
  checks, not a separate copy of it
- See who has expressed interest

**Cannot**
- **Publish its own project.** Only an operator can, and only once the gate passes.
- Touch another owner's project — RLS scopes every write to projects it owns
- Reach `/admin/*` or `/auditor` — redirected to `/owner`
- Edit anything already recorded: content tables are append-only, so a change
  inserts `version_no + 1` and the previous version stays visible

---

## Operator — Sylva staff  ·  `operator@demo.sylva.example`

Lands on `/admin/vetting`.

**Can**
- **Vet organisations**: approve, decline or suspend, each with a mandatory reason.
  The approval state is *derived* from the recorded decision by trigger — it is
  never written directly, which is what makes R6 auditable rather than merely true.
- **Publish a project**, once the publication gate passes
- See **real organisation identities**, including behind a pseudonym
- Administer reference data: schemes, unit types, sectors, questionnaires
- Read the full record, including non-public entries

**Cannot**
- Force publication past the gate. The control is disabled while an item is
  missing, and if the interface were bypassed the database still raises `SY008`.
- Edit or delete anything in the permanent record. A mistake is corrected by a
  **new** entry pointing at the wrong one, and the wrong one stays visible.

---

## Auditor  ·  `auditor@demo.sylva.example`

Lands on `/auditor`.

**Can**
- Read **everything**: projects including drafts, all documents, the full record
  including non-public entries, registry references, deal records, verification
- See **organisation names always** — an organisation name is not personal data

**Cannot**
- Write anything, anywhere. Not a convention: `ci.assert_auditor_is_read_only()`
  walks every table and view in the database and fails if `sylva_auditor` holds
  `INSERT`, `UPDATE`, `DELETE` or `TRUNCATE` on any of them.

**Expected behaviour, not a fault:** an individual person's name disappears from
the record after that person is erased. The organisation, the role and the action
remain. That is the erasure design working, and the auditor page says so.

---

## Registered but not yet approved  ·  `unvetted@demo.sylva.example`

The state every organisation passes through. Worth showing a client.

**Can** — browse everything public, register sites, submit the vetting questionnaire

**Cannot** — **express interest**. R6 refuses at the database: no deal exists for
an organisation that has not been approved. The refusal comes from a trigger, so
it holds regardless of what any screen does.

---

## Known gaps

Found by testing, not yet fixed.

1. **Express interest dead-ends for an investor and for an unvetted organisation.**
   The form renders and submits, the database correctly refuses, nothing crashes
   and nothing leaks — but the person is redirected to the home page with no
   explanation. It should say why and what to do next. This is the platform's
   main call to action, so it matters more than its size suggests.
2. **Investors cannot express interest at all.** The note's investor journey ends
   in "express interest", but only `sylva_buyer` can create a deal. Either the
   grant widens, or the investor path is something else — a product decision.
3. **Document upload is not wired to a screen.** The actions, the storage driver
   and the authorised download route exist; the upload UI does not.
4. **Deal rooms, messages and terms are Phase 2** and not built.
