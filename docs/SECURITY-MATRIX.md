# Row-level security matrix

> **Generated file — do not edit.**
> `npm run gen:security-matrix` writes it from `tests/rls/matrix.ts`, which is the
> same data `tests/rls/matrix.test.ts` asserts against a live PostgreSQL. A test in
> that file re-renders this document and fails if the checked-in copy differs, so
> the two cannot drift apart.

The client's stated worst case is *"one buyer seeing another buyer's prices or
terms"*. This is the table-by-table answer to that, for ten principals and four
verbs, exercised by connecting **as the real PostgreSQL role with a signed actor
context**, so what is measured is policies and privileges rather than application
logic.

## The ten principals

| Principal | Runs as | Organisation | What it is |
|---|---|---|---|
| **Buyer A** | `sylva_buyer` | `0c000000…` | DEMO Nordbräu AG — approved buyer, two registered sites, one deal. |
| **Buyer B** | `sylva_buyer` | `0d000000…` | DEMO Verdant Foods NV — approved buyer. Must never see Buyer A. |
| **Owner A** | `sylva_project_owner` | `0a000000…` | DEMO Moorland Trust — owns project 1 (published) and project 3 (draft). |
| **Owner B** | `sylva_project_owner` | `0b000000…` | DEMO Rivières Vivantes — owns project 2 (published). |
| **Investor A** | `sylva_investor` | `0e000000…` | DEMO Rheinbank — vetted investor. |
| **Investor B** | `sylva_investor` | `0f000000…` | DEMO Fonds Bleu — vetted investor. |
| **Operator** | `sylva_operator` | `10000000…` | DEMO Sylva Operations — the platform operator. |
| **Auditor** | `sylva_auditor` | `11000000…` | DEMO Nordic Assurance — reads everything, writes nothing, ever. |
| **Unvetted** | `sylva_buyer` | `14000000…` | DEMO Unvetted Trading — registered, submitted its questionnaire, never decided. Holds the buyer role but no approval, so R6 refuses it a deal. |
| **Anonymous** | `sylva_web_anon` | — | A visitor with no account. Served by a login role that is a member of nothing. |

## How to read a cell

| Value | Meaning |
|---|---|
| `denied` | PostgreSQL refused on **privilege**. The role holds no grant on the table, the column, or the schema. The statement never reached a policy. |
| `no rows` | The statement was permitted and **row-level security returned nothing**. This is the cell that proves isolation. |
| a list of keys | Exactly the rows that principal may see, named. An extra key here would be a leak. |
| `all (n)` | Every row this table has in the fixture. |
| `ok` | The write was permitted and changed at least one row. |
| `no-rows` | The write was permitted, and row-level security left nothing to change. |
| `blocked` | The write was permitted at the table, and the **row violated a policy** (`WITH CHECK`). |
| `refused:CODE` | A **rule** refused it: `SY006` is R6, `23505` a uniqueness rule, `23514` a table CHECK. |
| `·` | Not probed on this table. |

Every write probe runs inside a transaction that is **always rolled back**, which
matters more than usual here: most of these tables are append-only, so a stray
probe row could never be removed.

Each read probe is restricted to the matrix's own set of object ids — the demo seed
plus the fixtures in `tests/rls/fixtures.ts` — and is unqualified within it: no
`WHERE` on an organisation, a status or a visibility. The restriction exists because
this database is shared with the other work streams, which create organisations and
projects while the suite runs; without it a cell would fail for a reason that has
nothing to do with security.

## The matrix

### `geo.buyer_site`

A corporate's facilities and abstraction points. Commercially sensitive on its own, and the input to the private distance figures on a project page.

- **INSERT probe** — register a site for the principal’s own organisation
- **UPDATE probe** — rename Buyer A's Bremen site
- **DELETE probe** — delete Buyer A's Bremen site

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `buyerA1, buyerA2` | `ok` | `ok` | `ok` |
| Buyer B | `buyerB1` | `ok` | `no-rows` | `no-rows` |
| Owner A | `denied` | `denied` | `denied` | `denied` |
| Owner B | `denied` | `denied` | `denied` | `denied` |
| Investor A | `denied` | `denied` | `denied` | `denied` |
| Investor B | `denied` | `denied` | `denied` | `denied` |
| Operator | `all (3)` | `denied` | `denied` | `denied` |
| Auditor | `all (3)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `ok` | `no-rows` | `no-rows` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `deal.deal`

The private room between one buyer and one project. R6 gates its creation.

- **INSERT probe** — open a deal on PROJECT 2 with the principal itself as the buyer
- **UPDATE probe** — move Deal A's stage by writing the cache directly
- **DELETE probe** — delete Deal A

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `dealA` | `ok` | `denied` | `denied` |
| Buyer B | `dealB` | `refused:23505` | `denied` | `denied` |
| Owner A | `dealA` | `denied` | `denied` | `denied` |
| Owner B | `dealB` | `denied` | `denied` | `denied` |
| Investor A | `denied` | `denied` | `denied` | `denied` |
| Investor B | `denied` | `denied` | `denied` | `denied` |
| Operator | `all (2)` | `refused:SY006` | `denied` | `denied` |
| Auditor | `all (2)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `refused:SY006` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `deal.deal_message`

The correspondence inside a deal room. Free text, and the most direct leak there is.

- **INSERT probe** — post a message into Buyer A's deal room, signed by the principal
- **UPDATE probe** — edit a message in Buyer A's deal room
- **DELETE probe** — delete a message in Buyer A's deal room

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `msg@dealA` | `ok` | `denied` | `denied` |
| Buyer B | `msg@dealB` | `blocked` | `denied` | `denied` |
| Owner A | `msg@dealA` | `ok` | `denied` | `denied` |
| Owner B | `msg@dealB` | `blocked` | `denied` | `denied` |
| Investor A | `denied` | `denied` | `denied` | `denied` |
| Investor B | `denied` | `denied` | `denied` | `denied` |
| Operator | `all (2)` | `refused:23514` | `denied` | `denied` |
| Auditor | `all (2)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `blocked` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `deal.deal_terms_version`

The agreed volume, price and claim rights, versioned. This is literally the “another buyer's prices or terms” the client named as the worst case.

- **INSERT probe** — propose version 2 of the terms on Buyer A's deal
- **UPDATE probe** — rewrite the price on Buyer A's terms in place
- **DELETE probe** — delete Buyer A's terms

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `terms@dealA` | `ok` | `denied` | `denied` |
| Buyer B | `terms@dealB` | `blocked` | `denied` | `denied` |
| Owner A | `terms@dealA` | `ok` | `denied` | `denied` |
| Owner B | `terms@dealB` | `blocked` | `denied` | `denied` |
| Investor A | `denied` | `denied` | `denied` | `denied` |
| Investor B | `denied` | `denied` | `denied` | `denied` |
| Operator | `all (2)` | `ok` | `denied` | `denied` |
| Auditor | `all (2)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `blocked` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `deal.deal_terms_version.amount_raw`

R7. The bare volume behind the unit_qty composite. No role anywhere holds SELECT on a *_raw column, because the composite is what carries the scope that makes the number mean anything.

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `denied` | · | · | · |
| Buyer B | `denied` | · | · | · |
| Owner A | `denied` | · | · | · |
| Owner B | `denied` | · | · | · |
| Investor A | `denied` | · | · | · |
| Investor B | `denied` | · | · | · |
| Operator | `denied` | · | · | · |
| Auditor | `denied` | · | · | · |
| Unvetted | `denied` | · | · | · |
| Anonymous | `denied` | · | · | · |

### `deal.project_question`

The private question box. "Questions go to the project owner and to us, not to a public comment feed."

- **INSERT probe** — ask project 1 a private question as the principal
- **UPDATE probe** — edit Buyer A's question
- **DELETE probe** — delete Buyer A's question

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `q@p1:buyerA` | `ok` | `denied` | `denied` |
| Buyer B | `q@p2:buyerB` | `ok` | `denied` | `denied` |
| Owner A | `q@p1:buyerA, q@p1:investorA` | `denied` | `denied` | `denied` |
| Owner B | `q@p2:buyerB` | `denied` | `denied` | `denied` |
| Investor A | `q@p1:investorA` | `ok` | `denied` | `denied` |
| Investor B | `no rows` | `ok` | `denied` | `denied` |
| Operator | `all (3)` | `ok` | `denied` | `denied` |
| Auditor | `all (3)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `ok` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `deal.deal_pseudonym`

R5. The label the public record shows instead of a name. One per DEAL, so naming one deal does not name the others. The label itself is public - that is what a pseudonym is for.

- **UPDATE probe** — rewrite Deal A's label
- **DELETE probe** — recycle Deal A's label by deleting it

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `all (2)` | · | `denied` | `denied` |
| Buyer B | `all (2)` | · | `denied` | `denied` |
| Owner A | `all (2)` | · | `denied` | `denied` |
| Owner B | `all (2)` | · | `denied` | `denied` |
| Investor A | `all (2)` | · | `denied` | `denied` |
| Investor B | `all (2)` | · | `denied` | `denied` |
| Operator | `all (2)` | · | `denied` | `denied` |
| Auditor | `all (2)` | · | `denied` | `denied` |
| Unvetted | `all (2)` | · | `denied` | `denied` |
| Anonymous | `all (2)` | · | `denied` | `denied` |

### `deal.deal_pseudonym.org_id`

R5. WHICH organisation a label belongs to. This one column is the whole pseudonym: it is withheld by column-level grant from every role that can read the public record.

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `denied` | · | · | · |
| Buyer B | `denied` | · | · | · |
| Owner A | `denied` | · | · | · |
| Owner B | `denied` | · | · | · |
| Investor A | `denied` | · | · | · |
| Investor B | `denied` | · | · | · |
| Operator | `all (2)` | · | · | · |
| Auditor | `all (2)` | · | · | · |
| Unvetted | `denied` | · | · | · |
| Anonymous | `denied` | · | · | · |

### `doc.document`

Idea notes, design documents, monitoring plans, financial models and the letters of intent inside a deal room. Six visibility classes on one table. Since migration 0055 an owner may attach a document to its own project, in the three classes that are its to choose; since 0056 the admin and auditor classes are withheld from the owner on read as well as on write, because they hold material ABOUT the owner rather than the owner's own.

- **INSERT probe** — attach a new public document to project 1
- **UPDATE probe** — widen a document's visibility in place
- **DELETE probe** — delete a document

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `loi@dealA, mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `denied` | `denied` | `denied` |
| Buyer B | `loi@dealB, mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `denied` | `denied` | `denied` |
| Owner A | `fin@P1, loi@dealA, mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `ok` | `denied` | `denied` |
| Owner B | `fin@P2, loi@dealB, mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `blocked` | `denied` | `denied` |
| Investor A | `fin@P1, fin@P2, mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `denied` | `denied` | `denied` |
| Investor B | `fin@P1, fin@P2, mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `denied` | `denied` | `denied` |
| Operator | `all (10)` | `ok` | `denied` | `denied` |
| Auditor | `all (10)` | `denied` | `denied` | `denied` |
| Unvetted | `mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `denied` | `denied` | `denied` |
| Anonymous | `mon@P1, mon@P2, pdd@P1, pdd@P2, pin@P1, pin@P2` | `denied` | `denied` | `denied` |

### `doc.document_version`

The bytes: storage region, bucket, key and content hash. A version is visible exactly where its document is, minus anything withdrawn. The insert probe below targets a DEAL-room document, which migration 0055 withholds from an owner on purpose: an owner may add a version to a document on its own PROJECT, never to one inside somebody's deal room.

- **INSERT probe** — upload version 2 of the letter of intent in Buyer A's deal room
- **UPDATE probe** — repoint a stored document at other bytes
- **DELETE probe** — delete a stored version

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `ver@loi@dealA, ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `denied` | `denied` | `denied` |
| Buyer B | `ver@loi@dealB, ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `denied` | `denied` | `denied` |
| Owner A | `ver@fin@P1, ver@loi@dealA, ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `blocked` | `denied` | `denied` |
| Owner B | `ver@fin@P2, ver@loi@dealB, ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `blocked` | `denied` | `denied` |
| Investor A | `ver@fin@P1, ver@fin@P2, ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `denied` | `denied` | `denied` |
| Investor B | `ver@fin@P1, ver@fin@P2, ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `denied` | `denied` | `denied` |
| Operator | `all (10)` | `ok` | `denied` | `denied` |
| Auditor | `all (10)` | `denied` | `denied` | `denied` |
| Unvetted | `ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `denied` | `denied` | `denied` |
| Anonymous | `ver@mon@P1, ver@mon@P2, ver@pdd@P1, ver@pdd@P2, ver@pin@P1, ver@pin@P2` | `denied` | `denied` | `denied` |

### `org.organisation`

Counterparty attributes: country, sector, size band. These are public by design - they are what the public record shows beside a pseudonym.

- **INSERT probe** — create an organisation
- **UPDATE probe** — rename Buyer A's organisation
- **DELETE probe** — delete Buyer A's organisation

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `all (11)` | `denied` | `denied` | `denied` |
| Buyer B | `all (11)` | `denied` | `denied` | `denied` |
| Owner A | `all (11)` | `denied` | `denied` | `denied` |
| Owner B | `all (11)` | `denied` | `denied` | `denied` |
| Investor A | `all (11)` | `denied` | `denied` | `denied` |
| Investor B | `all (11)` | `denied` | `denied` | `denied` |
| Operator | `all (11)` | `ok` | `ok` | `denied` |
| Auditor | `all (11)` | `denied` | `denied` | `denied` |
| Unvetted | `all (11)` | `denied` | `denied` | `denied` |
| Anonymous | `all (11)` | `denied` | `denied` | `denied` |

### `org.organisation.legal_name`

R5. The real name. Withheld by COLUMN privilege rather than by policy, so no bug in any template can leak it: the query fails with 42501 instead.

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `denied` | · | · | · |
| Buyer B | `denied` | · | · | · |
| Owner A | `denied` | · | · | · |
| Owner B | `denied` | · | · | · |
| Investor A | `denied` | · | · | · |
| Investor B | `denied` | · | · | · |
| Operator | `all (11)` | · | · | · |
| Auditor | `all (11)` | · | · | · |
| Unvetted | `denied` | · | · | · |
| Anonymous | `denied` | · | · | · |

### `org.vetting_submission`

What an organisation told Sylva about its intended claim, its operations and its approach to sustainability. Competitively sensitive.

- **INSERT probe** — submit a buyer questionnaire for the principal’s own organisation
- **UPDATE probe** — rewrite Buyer A's submission
- **DELETE probe** — delete Buyer A's submission

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `vsub@buyerA` | `ok` | `denied` | `denied` |
| Buyer B | `vsub@buyerB` | `ok` | `denied` | `denied` |
| Owner A | `vsub@ownerA` | `ok` | `denied` | `denied` |
| Owner B | `vsub@ownerB` | `ok` | `denied` | `denied` |
| Investor A | `vsub@investorA` | `ok` | `denied` | `denied` |
| Investor B | `vsub@investorB` | `ok` | `denied` | `denied` |
| Operator | `all (7)` | `ok` | `denied` | `denied` |
| Auditor | `all (7)` | `denied` | `denied` | `denied` |
| Unvetted | `vsub@unvetted` | `ok` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `org.vetting_answer`

The answers themselves. Reachable only through a submission the principal owns.

- **INSERT probe** — add an answer to BUYER B's vetting submission
- **UPDATE probe** — rewrite an answer in Buyer A's submission
- **DELETE probe** — delete an answer in Buyer A's submission

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `vans@buyerA` | `blocked` | `denied` | `denied` |
| Buyer B | `vans@buyerB` | `ok` | `denied` | `denied` |
| Owner A | `no rows` | `blocked` | `denied` | `denied` |
| Owner B | `no rows` | `blocked` | `denied` | `denied` |
| Investor A | `no rows` | `blocked` | `denied` | `denied` |
| Investor B | `no rows` | `blocked` | `denied` | `denied` |
| Operator | `all (2)` | `ok` | `denied` | `denied` |
| Auditor | `all (2)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `blocked` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `org.vetting_decision`

R6. Approval is DERIVED from these rows by trigger and never written directly, which is what makes R6 auditable rather than merely true.

- **INSERT probe** — approve the unvetted organisation as a buyer
- **UPDATE probe** — reverse Buyer A's approval in place
- **DELETE probe** — delete Buyer A's approval

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `vdec@buyerA` | `denied` | `denied` | `denied` |
| Buyer B | `vdec@buyerB` | `denied` | `denied` | `denied` |
| Owner A | `vdec@ownerA` | `denied` | `denied` | `denied` |
| Owner B | `vdec@ownerB` | `denied` | `denied` | `denied` |
| Investor A | `vdec@investorA` | `denied` | `denied` | `denied` |
| Investor B | `vdec@investorB` | `denied` | `denied` | `denied` |
| Operator | `all (6)` | `ok` | `denied` | `denied` |
| Auditor | `all (6)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `denied` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `proj.project`

Draft versus published, and who may move a project between the two. A draft project is an unannounced piece of commercial activity and must not be reachable before Sylva publishes it. Since migration 0050 an owner may create its own project and hand it to Sylva for review; publishing it remains an operator act, refused to an owner both by the policy below and by the withheld published_at column privilege that proj.project's CHECK makes indispensable.

- **INSERT probe** — create a project owned by the principal
- **UPDATE probe** — hand the draft project to Sylva for review
- **DELETE probe** — delete the draft project

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `p1:published, p2:published` | `denied` | `denied` | `denied` |
| Buyer B | `p1:published, p2:published` | `denied` | `denied` | `denied` |
| Owner A | `all (3)` | `ok` | `ok` | `denied` |
| Owner B | `p1:published, p2:published` | `ok` | `no-rows` | `denied` |
| Investor A | `p1:published, p2:published` | `denied` | `denied` | `denied` |
| Investor B | `p1:published, p2:published` | `denied` | `denied` | `denied` |
| Operator | `all (3)` | `ok` | `ok` | `denied` |
| Auditor | `all (3)` | `denied` | `denied` | `denied` |
| Unvetted | `p1:published, p2:published` | `denied` | `denied` | `denied` |
| Anonymous | `p1:published, p2:published` | `denied` | `denied` | `denied` |

### `proj.project_financials`

"Financing need, revenue streams, the financial model. Visible only to investors we have vetted." Deny by default: no policy exists for the public or buyer roles at all.

- **INSERT probe** — record a new version of project 1’s financials
- **UPDATE probe** — rewrite project 1's financing need in place
- **DELETE probe** — delete project 1's financials

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `denied` | `denied` | `denied` | `denied` |
| Buyer B | `denied` | `denied` | `denied` | `denied` |
| Owner A | `fin@p1` | `denied` | `denied` | `denied` |
| Owner B | `fin@p2` | `denied` | `denied` | `denied` |
| Investor A | `all (2)` | `denied` | `denied` | `denied` |
| Investor B | `all (2)` | `denied` | `denied` | `denied` |
| Operator | `all (2)` | `ok` | `denied` | `denied` |
| Auditor | `all (2)` | `denied` | `denied` | `denied` |
| Unvetted | `denied` | `denied` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `record.entry`

R4. The permanent record. web_anon has no privilege on it at all and reads record.v_public_entry instead, which resolves the pseudonym as at the time of each entry. Since migration 0076 an entry may only be appended by a party to the deal it names, or by the owner of the project it names: the record is append-only and published, so a row written about somebody else is a permanent public statement they never made.

- **INSERT probe** — append an entry about Buyer A's deal, stamped with the principal’s own organisation
- **UPDATE probe** — correct a record entry by editing it
- **DELETE probe** — delete a record entry

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `interestDealA` | `ok` | `denied` | `denied` |
| Buyer B | `interestDealB` | `blocked` | `denied` | `denied` |
| Owner A | `interestDealA, listedP1` | `ok` | `denied` | `denied` |
| Owner B | `interestDealB, listedP2` | `blocked` | `denied` | `denied` |
| Investor A | `no rows` | `denied` | `denied` | `denied` |
| Investor B | `no rows` | `denied` | `denied` | `denied` |
| Operator | `all (4)` | `ok` | `denied` | `denied` |
| Auditor | `all (4)` | `denied` | `denied` | `denied` |
| Unvetted | `no rows` | `blocked` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `identity.user_account`

Every piece of personal data on the platform, in one table. No application role holds USAGE on the schema; a person reads their own row through the SECURITY DEFINER function identity.whoami().

- **INSERT probe** — create a user account
- **UPDATE probe** — rename Buyer A's user
- **DELETE probe** — delete Buyer A's user

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `denied` | `denied` | `denied` | `denied` |
| Buyer B | `denied` | `denied` | `denied` | `denied` |
| Owner A | `denied` | `denied` | `denied` | `denied` |
| Owner B | `denied` | `denied` | `denied` | `denied` |
| Investor A | `denied` | `denied` | `denied` | `denied` |
| Investor B | `denied` | `denied` | `denied` | `denied` |
| Operator | `all (9)` | `denied` | `denied` | `denied` |
| Auditor | `all (9)` | `denied` | `denied` | `denied` |
| Unvetted | `denied` | `denied` | `denied` | `denied` |
| Anonymous | `denied` | `denied` | `denied` | `denied` |

### `identity.user_account.password_hash`

The scrypt credential record written by the authentication work. A secret, not a fact about a person, and nothing on the platform ever needs to display it. Read only inside identity.auth_salt() and identity.authenticate(), which are SECURITY DEFINER.

| Principal | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Buyer A | `denied` | · | · | · |
| Buyer B | `denied` | · | · | · |
| Owner A | `denied` | · | · | · |
| Owner B | `denied` | · | · | · |
| Investor A | `denied` | · | · | · |
| Investor B | `denied` | · | · | · |
| Operator | `denied` | · | · | · |
| Auditor | `denied` | · | · | · |
| Unvetted | `denied` | · | · | · |
| Anonymous | `denied` | · | · | · |

## The attacks

Named, individually, in `tests/rls/attacks.test.ts`. Each one is run, not reasoned
about — FINDING-001 was found by running the attack and not by reading the DDL.

| # | Attack | Required result |
|---|---|---|
| 1 | Buyer A forges an actor context for Buyer B — swap the organisation, keep the HMAC | `0 rows`, and `sylva.actor_org_id()` resolves to NULL |
| 2 | Buyer A presents a correctly signed but **expired** context | `0 rows` |
| 3 | Buyer A re-`SET`s the context GUC to Buyer B after dropping to `sylva_buyer` (FINDING-001, test 2, verbatim) | `0 rows` |
| 4 | Buyer A tries to mint its own actor context | `denied` — `sylva_buyer` has no EXECUTE on `sylva.mint_actor_ctx` |
| 5 | Buyer A reads the context signing key | `denied` — no application role holds any privilege on `sylva.context_key` |
| 6 | An anonymous visitor reads any buyer site | `denied` — privilege, not policy |
| 7 | The auditor attempts INSERT, UPDATE and DELETE on every table in the matrix | `denied` everywhere, without exception |
| 8 | An organisation Sylva has not approved creates a deal | `SY006` — R6, raised by trigger |
| 9 | Buyer A reads the pseudonym-to-organisation mapping for Buyer B | `denied` — `org_id` is withheld by column grant |
| 10 | An anonymous visitor reads an unpublished project | `0 rows` |
| 11 | An investor reads `proj.project_financials` without a vetted-investor approval | `0 rows` |
| 12 | Buyer A registers a site belonging to Buyer B’s organisation | `blocked` by `WITH CHECK` |
| 13 | Buyer A submits a vetting questionnaire on behalf of Buyer B | `blocked` by `WITH CHECK` |
| 14 | Buyer B writes a message into Buyer A’s deal room | `blocked` by `WITH CHECK` |
| 15 | A signed-in privilege role calls `identity.auth_salt`, `authenticate`, `resolve_session` or `close_session` | `denied` for all six roles — only `sylva_login_public` may authenticate |
| 16 | The anonymous connection pool tries to `SET ROLE sylva_buyer` | refused by PostgreSQL — `sylva_login_public` is a member of nothing else |
| 17 | Buyer A reads `identity.user_account` directly, then through `identity.whoami()` | the table is `denied`; the function resolves to its own row and never another organisation’s (reachable since migration 0042 — see FINDING-003) |

## Known weaknesses

None recorded.

Written up in full:

- [`FINDING-002`](FINDING-002-record-entry-cross-deal-append.md) — **closed** in migration 0076.
  A buyer could append a record entry carrying another buyer's deal id, which
  `record.v_public_entry` then published against that other buyer — permanently, because
  the record is append-only. `p_record_insert` now requires the writer to be a party to
  the deal, or the owner of the project when there is no deal.
  `ci.assert_record_insert_is_party_scoped()` is the guard, with a self-test.
- [`FINDING-003`](FINDING-003-whoami-unreachable.md) — **closed** in migration 0042.
  `identity.whoami()` was granted to `sylva_buyer`, `sylva_project_owner` and
  `sylva_investor`, none of which held `USAGE` on the `identity` schema, so the grant
  was inert. They now hold `USAGE` — which grants nothing on the tables — and
  `ci.assert_identity_is_sealed()` checks both halves.
- [`FINDING-004`](FINDING-004-password-hash-grant.md) — **closed** in migration 0042.
  The two table-level grants in migration 0016 are now column lists that omit
  `password_hash` and `mfa_secret`, so no role reads a credential.
  `ci.assert_no_credential_grants()` is the guard, with a self-test.
- [`FINDING-001`](FINDING-001-org-context-forgery.md) — closed in migration 0019, and
  regression-tested here by the first three attacks.

## What this matrix does not cover

- **Phase-2 tables** with no rows in the demo seed — `credit.*`, `deal.commitment_entry`,
  `proj.evidence_pack_*`. Their policies exist and `ci.assert_rls_complete()` checks
  that they have some, but no principal has been walked across them with data in place.
- **The public record view.** `record.v_public_entry` is owned by `sylva_record` and
  resolves pseudonyms as at the time of each entry. Its own behaviour deserves a
  matrix of its own once the record has disclosure events in it.
- **K-anonymity.** Every public row still carries sector, country and size band. Per-deal
  pseudonyms stop one buyer's deals being linked to each other; they do not stop a
  named row being matched to a pseudonymous one by those three attributes. That is open
  decision 2 in the README and cannot be closed by a policy.
- **Free text and uploaded files.** A message body or a signed PDF can contain a name.
  Row-level security decides who reads the row, not what is inside it.
