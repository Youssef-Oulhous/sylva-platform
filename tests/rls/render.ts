/**
 * One renderer, two outputs.
 *
 * The grid printed by `npm run test:rls` and the table in
 * docs/SECURITY-MATRIX.md are produced from the same function over the same
 * data, so the document states what the tests assert. If someone widens a
 * policy and updates the expectation, the document changes with it or the
 * drift test in matrix.test.ts fails.
 */
import { PRINCIPALS, PRINCIPAL_IDS, type PrincipalId } from './catalog';
import { TABLES, type TableSpec } from './matrix';
import type { ReadOutcome, WriteOutcome } from './probe';

export const VERBS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
export type Verb = (typeof VERBS)[number];

const NOT_PROBED = '·';

function spec(t: TableSpec, verb: Verb) {
  switch (verb) {
    case 'INSERT': return t.insert;
    case 'UPDATE': return t.update;
    case 'DELETE': return t.remove;
    default: return undefined;
  }
}

/** Every row key any principal is expected to reach on this table. */
function universe(t: TableSpec): string[] {
  const seen = new Set<string>();
  for (const id of PRINCIPAL_IDS) {
    const e = t.read.expect[id];
    if (typeof e !== 'string') for (const k of e) seen.add(k);
  }
  return [...seen].sort();
}

export function renderRead(outcome: ReadOutcome, all: readonly string[]): string {
  if (typeof outcome === 'string') return outcome;
  if (outcome.length === 0) return 'no rows';
  if (all.length > 1 && outcome.length === all.length) return `all (${all.length})`;
  return outcome.join(', ');
}

export function renderWrite(outcome: WriteOutcome | undefined): string {
  return outcome ?? NOT_PROBED;
}

export interface Line {
  principal: PrincipalId;
  cells: [read: string, insert: string, update: string, remove: string];
}

export function renderTable(t: TableSpec): Line[] {
  const all = universe(t);
  return PRINCIPAL_IDS.map((id) => ({
    principal: id,
    cells: [
      renderRead(t.read.expect[id], all),
      renderWrite(spec(t, 'INSERT')?.expect[id]),
      renderWrite(spec(t, 'UPDATE')?.expect[id]),
      renderWrite(spec(t, 'DELETE')?.expect[id]),
    ],
  }));
}

// ------------------------------------------------------- plain-text output

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

/** The grid the test run prints. Wide, but a reviewer reads it top to bottom. */
export function renderConsole(tables: readonly TableSpec[] = TABLES): string {
  const out: string[] = [];
  out.push('');
  out.push('='.repeat(100));
  out.push('ROW-LEVEL SECURITY MATRIX — what each principal may do, asserted against the live database');
  out.push('='.repeat(100));

  for (const t of tables) {
    const lines = renderTable(t);
    const w0 = Math.max(12, ...lines.map((l) => PRINCIPALS[l.principal].label.length));
    const w1 = Math.max(24, ...lines.map((l) => l.cells[0].length));
    const w2 = Math.max(8, ...lines.map((l) => l.cells[1].length));
    const w3 = Math.max(8, ...lines.map((l) => l.cells[2].length));

    out.push('');
    out.push(`── ${t.id} ${'─'.repeat(Math.max(0, 94 - t.id.length))}`);
    out.push(`   ${t.holds}`);
    if (t.insert) out.push(`   INSERT probe: ${t.insert.describe}`);
    out.push('');
    out.push(
      `   ${pad('principal', w0)}  ${pad('SELECT', w1)}  ${pad('INSERT', w2)}  ${pad('UPDATE', w3)}  DELETE`,
    );
    out.push(`   ${'-'.repeat(w0)}  ${'-'.repeat(w1)}  ${'-'.repeat(w2)}  ${'-'.repeat(w3)}  ------`);
    for (const l of lines) {
      out.push(
        `   ${pad(PRINCIPALS[l.principal].label, w0)}  ${pad(l.cells[0], w1)}  ` +
        `${pad(l.cells[1], w2)}  ${pad(l.cells[2], w3)}  ${l.cells[3]}`,
      );
    }
    if (t.finding) out.push(`   ⚠ ${t.finding}`);
  }

  out.push('');
  out.push('='.repeat(100));
  return out.join('\n');
}

// ---------------------------------------------------------- markdown output

function cell(s: string): string {
  return s === NOT_PROBED ? NOT_PROBED : `\`${s}\``;
}

export function renderMarkdown(tables: readonly TableSpec[] = TABLES): string {
  const out: string[] = [];

  out.push('# Row-level security matrix');
  out.push('');
  out.push('> **Generated file — do not edit.**');
  out.push('> `npm run gen:security-matrix` writes it from `tests/rls/matrix.ts`, which is the');
  out.push('> same data `tests/rls/matrix.test.ts` asserts against a live PostgreSQL. A test in');
  out.push('> that file re-renders this document and fails if the checked-in copy differs, so');
  out.push('> the two cannot drift apart.');
  out.push('');
  out.push('The client\'s stated worst case is *"one buyer seeing another buyer\'s prices or');
  out.push('terms"*. This is the table-by-table answer to that, for ten principals and four');
  out.push('verbs, exercised by connecting **as the real PostgreSQL role with a signed actor');
  out.push('context**, so what is measured is policies and privileges rather than application');
  out.push('logic.');
  out.push('');

  // ---- principals
  out.push('## The ten principals');
  out.push('');
  out.push('| Principal | Runs as | Organisation | What it is |');
  out.push('|---|---|---|---|');
  for (const id of PRINCIPAL_IDS) {
    const p = PRINCIPALS[id];
    out.push(`| **${p.label}** | \`${p.dbRole}\` | ${p.org ? `\`${p.org.slice(0, 8)}…\`` : '—'} | ${p.note} |`);
  }
  out.push('');

  // ---- legend
  out.push('## How to read a cell');
  out.push('');
  out.push('| Value | Meaning |');
  out.push('|---|---|');
  out.push('| `denied` | PostgreSQL refused on **privilege**. The role holds no grant on the table, the column, or the schema. The statement never reached a policy. |');
  out.push('| `no rows` | The statement was permitted and **row-level security returned nothing**. This is the cell that proves isolation. |');
  out.push('| a list of keys | Exactly the rows that principal may see, named. An extra key here would be a leak. |');
  out.push('| `all (n)` | Every row this table has in the fixture. |');
  out.push('| `ok` | The write was permitted and changed at least one row. |');
  out.push('| `no-rows` | The write was permitted, and row-level security left nothing to change. |');
  out.push('| `blocked` | The write was permitted at the table, and the **row violated a policy** (`WITH CHECK`). |');
  out.push('| `refused:CODE` | A **rule** refused it: `SY006` is R6, `23505` a uniqueness rule, `23514` a table CHECK. |');
  out.push('| `·` | Not probed on this table. |');
  out.push('');
  out.push('Every write probe runs inside a transaction that is **always rolled back**, which');
  out.push('matters more than usual here: most of these tables are append-only, so a stray');
  out.push('probe row could never be removed.');
  out.push('');
  out.push('Each read probe is restricted to the matrix\'s own set of object ids — the demo seed');
  out.push('plus the fixtures in `tests/rls/fixtures.ts` — and is unqualified within it: no');
  out.push('`WHERE` on an organisation, a status or a visibility. The restriction exists because');
  out.push('this database is shared with the other work streams, which create organisations and');
  out.push('projects while the suite runs; without it a cell would fail for a reason that has');
  out.push('nothing to do with security.');
  out.push('');

  // ---- the tables
  out.push('## The matrix');
  for (const t of tables) {
    const lines = renderTable(t);
    out.push('');
    out.push(`### \`${t.id}\``);
    out.push('');
    out.push(t.holds);
    out.push('');
    const probes: string[] = [];
    if (t.insert) probes.push(`**INSERT probe** — ${t.insert.describe}`);
    if (t.update) probes.push(`**UPDATE probe** — ${t.update.describe}`);
    if (t.remove) probes.push(`**DELETE probe** — ${t.remove.describe}`);
    if (probes.length) {
      for (const p of probes) out.push(`- ${p}`);
      out.push('');
    }
    out.push('| Principal | SELECT | INSERT | UPDATE | DELETE |');
    out.push('|---|---|---|---|---|');
    for (const l of lines) {
      out.push(
        `| ${PRINCIPALS[l.principal].label} | ${cell(l.cells[0])} | ${cell(l.cells[1])} ` +
        `| ${cell(l.cells[2])} | ${cell(l.cells[3])} |`,
      );
    }
    if (t.finding) {
      out.push('');
      out.push(`> ⚠ **Known weakness.** ${t.finding}`);
    }
  }
  out.push('');

  // ---- attacks
  out.push('## The attacks');
  out.push('');
  out.push('Named, individually, in `tests/rls/attacks.test.ts`. Each one is run, not reasoned');
  out.push('about — FINDING-001 was found by running the attack and not by reading the DDL.');
  out.push('');
  out.push('| # | Attack | Required result |');
  out.push('|---|---|---|');
  ATTACKS.forEach((a, i) => out.push(`| ${i + 1} | ${a.attack} | ${a.required} |`));
  out.push('');

  // ---- known weaknesses
  const findings = tables.filter((t) => t.finding);
  out.push('## Known weaknesses');
  out.push('');
  if (findings.length === 0) {
    out.push('None recorded.');
  } else {
    out.push('Asserted as they behave today, so that the behaviour is visible rather than');
    out.push('assumed. Each is a decision for whoever owns that part of the schema.');
    out.push('');
    for (const t of findings) {
      out.push(`- **\`${t.id}\`** — ${t.finding}`);
    }
  }
  out.push('');
  out.push('Written up in full:');
  out.push('');
  out.push('- [`FINDING-002`](FINDING-002-record-entry-cross-deal-append.md) — **closed** in migration 0076.');
  out.push('  A buyer could append a record entry carrying another buyer\'s deal id, which');
  out.push('  `record.v_public_entry` then published against that other buyer — permanently, because');
  out.push('  the record is append-only. `p_record_insert` now requires the writer to be a party to');
  out.push('  the deal, or the owner of the project when there is no deal.');
  out.push('  `ci.assert_record_insert_is_party_scoped()` is the guard, with a self-test.');
  out.push('- [`FINDING-003`](FINDING-003-whoami-unreachable.md) — **closed** in migration 0042.');
  out.push('  `identity.whoami()` was granted to `sylva_buyer`, `sylva_project_owner` and');
  out.push('  `sylva_investor`, none of which held `USAGE` on the `identity` schema, so the grant');
  out.push('  was inert. They now hold `USAGE` — which grants nothing on the tables — and');
  out.push('  `ci.assert_identity_is_sealed()` checks both halves.');
  out.push('- [`FINDING-004`](FINDING-004-password-hash-grant.md) — **closed** in migration 0042.');
  out.push('  The two table-level grants in migration 0016 are now column lists that omit');
  out.push('  `password_hash` and `mfa_secret`, so no role reads a credential.');
  out.push('  `ci.assert_no_credential_grants()` is the guard, with a self-test.');
  out.push('- [`FINDING-001`](FINDING-001-org-context-forgery.md) — closed in migration 0019, and');
  out.push('  regression-tested here by the first three attacks.');
  out.push('');

  out.push('## What this matrix does not cover');
  out.push('');
  out.push('- **Phase-2 tables** with no rows in the demo seed — `credit.*`, `deal.commitment_entry`,');
  out.push('  `proj.evidence_pack_*`. Their policies exist and `ci.assert_rls_complete()` checks');
  out.push('  that they have some, but no principal has been walked across them with data in place.');
  out.push('- **The public record view.** `record.v_public_entry` is owned by `sylva_record` and');
  out.push('  resolves pseudonyms as at the time of each entry. Its own behaviour deserves a');
  out.push('  matrix of its own once the record has disclosure events in it.');
  out.push('- **K-anonymity.** Every public row still carries sector, country and size band. Per-deal');
  out.push('  pseudonyms stop one buyer\'s deals being linked to each other; they do not stop a');
  out.push('  named row being matched to a pseudonymous one by those three attributes. That is open');
  out.push('  decision 2 in the README and cannot be closed by a policy.');
  out.push('- **Free text and uploaded files.** A message body or a signed PDF can contain a name.');
  out.push('  Row-level security decides who reads the row, not what is inside it.');
  out.push('');

  return out.join('\n');
}

/**
 * The named attacks, listed here so the document and the test file cannot
 * disagree about which ones exist. tests/rls/attacks.test.ts asserts that every
 * id below has a test and vice versa.
 */
export interface AttackSpec { id: string; attack: string; required: string }

export const ATTACKS: readonly AttackSpec[] = [
  { id: 'forged-context',
    attack: 'Buyer A forges an actor context for Buyer B — swap the organisation, keep the HMAC',
    required: '`0 rows`, and `sylva.actor_org_id()` resolves to NULL' },
  { id: 'expired-context',
    attack: 'Buyer A presents a correctly signed but **expired** context',
    required: '`0 rows`' },
  { id: 'reset-context-mid-transaction',
    attack: 'Buyer A re-`SET`s the context GUC to Buyer B after dropping to `sylva_buyer` (FINDING-001, test 2, verbatim)',
    required: '`0 rows`' },
  { id: 'mint-own-context',
    attack: 'Buyer A tries to mint its own actor context',
    required: '`denied` — `sylva_buyer` has no EXECUTE on `sylva.mint_actor_ctx`' },
  { id: 'read-signing-key',
    attack: 'Buyer A reads the context signing key',
    required: '`denied` — no application role holds any privilege on `sylva.context_key`' },
  { id: 'anonymous-reads-buyer-site',
    attack: 'An anonymous visitor reads any buyer site',
    required: '`denied` — privilege, not policy' },
  { id: 'auditor-writes',
    attack: 'The auditor attempts INSERT, UPDATE and DELETE on every table in the matrix',
    required: '`denied` everywhere, without exception' },
  { id: 'unvetted-opens-deal',
    attack: 'An organisation Sylva has not approved creates a deal',
    required: '`SY006` — R6, raised by trigger' },
  { id: 'unmask-pseudonym',
    attack: 'Buyer A reads the pseudonym-to-organisation mapping for Buyer B',
    required: '`denied` — `org_id` is withheld by column grant' },
  { id: 'anonymous-reads-draft-project',
    attack: 'An anonymous visitor reads an unpublished project',
    required: '`0 rows`' },
  { id: 'unvetted-investor-reads-financials',
    attack: 'An investor reads `proj.project_financials` without a vetted-investor approval',
    required: '`0 rows`' },
  { id: 'cross-org-site',
    attack: 'Buyer A registers a site belonging to Buyer B’s organisation',
    required: '`blocked` by `WITH CHECK`' },
  { id: 'cross-org-vetting',
    attack: 'Buyer A submits a vetting questionnaire on behalf of Buyer B',
    required: '`blocked` by `WITH CHECK`' },
  { id: 'cross-deal-message',
    attack: 'Buyer B writes a message into Buyer A’s deal room',
    required: '`blocked` by `WITH CHECK`' },
  { id: 'privilege-role-cannot-authenticate',
    attack: 'A signed-in privilege role calls `identity.auth_salt`, `authenticate`, `resolve_session` or `close_session`',
    required: '`denied` for all six roles — only `sylva_login_public` may authenticate' },
  { id: 'pool-escalation',
    attack: 'The anonymous connection pool tries to `SET ROLE sylva_buyer`',
    required: 'refused by PostgreSQL — `sylva_login_public` is a member of nothing else' },
  { id: 'whoami-is-scoped',
    attack: 'Buyer A reads `identity.user_account` directly, then through `identity.whoami()`',
    required:
      'the table is `denied`; the function resolves to its own row and never ' +
      'another organisation’s (reachable since migration 0042 — see FINDING-003)' },
];
