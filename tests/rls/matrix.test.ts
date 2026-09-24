/**
 * The matrix, asserted against a live PostgreSQL.
 *
 * The whole matrix is executed once in beforeAll - 600-odd statements, each in
 * its own transaction, each as a real privilege role with a real signed actor
 * context - and every cell is then asserted individually so a failure names the
 * table, the verb and the principal rather than "the matrix is wrong".
 *
 * The readable grid is printed after the run. It is the artefact a reviewer
 * actually reads, and it is rendered from the same data the assertions use.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { closeAllPools } from '@/lib/db/pool';
import { PRINCIPALS, PRINCIPAL_IDS } from './catalog';
import { ensureFixtures } from './fixtures';
import { TABLES } from './matrix';
import { runMatrix, type Cell } from './execute';
import { renderConsole, renderMarkdown } from './render';

let cells: Cell[] = [];

beforeAll(async () => {
  await ensureFixtures();
  cells = await runMatrix();
}, 300_000);

afterAll(async () => {
  console.log(renderConsole());
  await closeAllPools();
});

function cellFor(table: string, verb: Cell['verb'], principal: string): Cell {
  const c = cells.find((x) => x.table === table && x.verb === verb && x.principal === principal);
  if (!c) throw new Error(`no cell for ${table} ${verb} ${principal}`);
  return c;
}

describe('the matrix ran at all', () => {
  it('produced a cell for every principal on every table', () => {
    expect(cells.length).toBeGreaterThan(600);
    const selects = cells.filter((c) => c.verb === 'SELECT');
    expect(selects.length).toBe(TABLES.length * PRINCIPAL_IDS.length);
  });

  it('found rows somewhere, so a "no rows" cell means isolation and not an empty database', () => {
    const withRows = cells.filter(
      (c) => c.verb === 'SELECT' && typeof c.actual !== 'string' && c.actual.length > 0,
    );
    expect(withRows.length).toBeGreaterThan(100);
  });
});

for (const t of TABLES) {
  describe(t.id, () => {
    for (const p of PRINCIPAL_IDS) {
      const who = PRINCIPALS[p].label;

      it(`${who} SELECT`, () => {
        const c = cellFor(t.id, 'SELECT', p);
        expect(c.actual, `${t.id} · SELECT · ${who}`).toEqual(c.expected);
      });

      if (t.insert) {
        it(`${who} INSERT — ${t.insert.describe}`, () => {
          const c = cellFor(t.id, 'INSERT', p);
          expect(c.actual, `${t.id} · INSERT · ${who}`).toBe(c.expected);
        });
      }
      if (t.update) {
        it(`${who} UPDATE — ${t.update.describe}`, () => {
          const c = cellFor(t.id, 'UPDATE', p);
          expect(c.actual, `${t.id} · UPDATE · ${who}`).toBe(c.expected);
        });
      }
      if (t.remove) {
        it(`${who} DELETE — ${t.remove.describe}`, () => {
          const c = cellFor(t.id, 'DELETE', p);
          expect(c.actual, `${t.id} · DELETE · ${who}`).toBe(c.expected);
        });
      }
    }
  });
}

// ------------------------------------------------------ the standing rules

describe('rules that hold across every table in the matrix', () => {
  it('R4: nothing in the matrix is UPDATE-able except a buyer’s own site', () => {
    const permitted = cells
      .filter((c) => (c.verb === 'UPDATE' || c.verb === 'DELETE') && c.actual === 'ok')
      .map((c) => `${c.table}/${c.verb}/${c.principal}`)
      .sort();
    // Every entry is a row that is NOT part of the append-only record. This
    // list is the whole of the mutable surface, and it is asserted exactly so
    // that adding to it is a deliberate edit to this file rather than a
    // side effect of a migration nobody reread.
    expect(permitted).toEqual([
      // operational data a buyer maintains, not part of the record
      'geo.buyer_site/DELETE/buyerA',
      'geo.buyer_site/UPDATE/buyerA',
      // publication is an operator act; the gate trigger still guards it
      'org.organisation/UPDATE/operator',
      // an owner hands its own draft to Sylva (migration 0050). The policy
      // admits exactly one target status, and the owner holds no privilege on
      // published_at, so this cell cannot become a route to publication.
      'proj.project/UPDATE/ownerA',
      'proj.project/UPDATE/operator',
    ].sort());
  });

  it('the auditor never writes, anywhere', () => {
    const writes = cells.filter(
      (c) => c.principal === 'auditor' && c.verb !== 'SELECT' && c.actual !== 'denied',
    );
    expect(writes.map((c) => `${c.table}/${c.verb}=${c.actual}`)).toEqual([]);
  });

  it('the anonymous visitor never writes, anywhere', () => {
    const writes = cells.filter(
      (c) => c.principal === 'anonymous' && c.verb !== 'SELECT' && c.actual !== 'denied',
    );
    expect(writes.map((c) => `${c.table}/${c.verb}=${c.actual}`)).toEqual([]);
  });

  it('R5 + R7: the columns that must never be readable are not readable by anyone', () => {
    for (const table of ['deal.deal_terms_version.amount_raw']) {
      for (const p of PRINCIPAL_IDS) {
        expect(cellFor(table, 'SELECT', p).actual, `${table} · ${p}`).toBe('denied');
      }
    }
    for (const p of PRINCIPAL_IDS) {
      if (p === 'operator' || p === 'auditor') continue;
      expect(cellFor('deal.deal_pseudonym.org_id', 'SELECT', p).actual, p).toBe('denied');
      expect(cellFor('org.organisation.legal_name', 'SELECT', p).actual, p).toBe('denied');
    }
  });

  it('no principal reads a row keyed to the other side of its pair', () => {
    // The one deliberate exception is the counterparty attributes - country,
    // sector, size band - which the public record has to show beside a
    // pseudonym. Those tables carry a flag saying so.
    const publicTables = new Set(
      TABLES.filter((t) => t.counterpartyAttributesArePublic).map((t) => t.id),
    );
    const pairs: [string, string][] = [
      ['buyerA', 'buyerB'], ['buyerB', 'buyerA'],
      ['ownerA', 'ownerB'], ['ownerB', 'ownerA'],
      ['investorA', 'investorB'], ['investorB', 'investorA'],
    ];
    for (const c of cells) {
      if (c.verb !== 'SELECT' || typeof c.actual === 'string') continue;
      if (publicTables.has(c.table)) continue;
      for (const [mine, theirs] of pairs) {
        if (c.principal !== mine) continue;
        const leaked = c.actual.filter((k) => k.toLowerCase().includes(theirs.toLowerCase()));
        expect(leaked, `${c.table} · ${mine} reached ${theirs}`).toEqual([]);
      }
    }
  });
});

// --------------------------------------------------- the document cannot drift

describe('docs/SECURITY-MATRIX.md', () => {
  it('is exactly what the matrix renders, so the document cannot drift', () => {
    const onDisk = readFileSync('docs/SECURITY-MATRIX.md', 'utf8');
    expect(onDisk).toBe(renderMarkdown());
  });
});
