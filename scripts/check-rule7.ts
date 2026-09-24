#!/usr/bin/env tsx
/**
 * Rule 7 linter.
 *
 * "No screen, query, export or chart adds unit volumes across different
 * projects."  - concept note, section 8.
 *
 * The note says rule 7 cannot be enforced in Postgres. That turned out to be
 * only mostly true: sylva.unit_qty carries (project_id, unit_type_id, amount)
 * and sylva.sum_same_unit raises SY007 when asked to add across either, and
 * proj.project_unit_type makes a volume in the wrong project's unit type
 * unrepresentable. What the database still cannot stop is someone reaching past
 * the composite - `(qty).amount` in SQL, `.amount` in TypeScript - and adding
 * the bare numbers.
 *
 * So this is the rest of rule 7: a linter over the source, run in CI, plus the
 * tests in src/lib/units and tests/db. It is a review habit made executable.
 *
 * It is deliberately noisy rather than clever. A false positive costs a comment
 * on one line. A false negative puts a meaningless number on a buyer's screen.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN = ['src', 'db', 'tests', 'scripts'];
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'coverage']);

/** Files allowed to touch a bare amount, because they are what makes it safe. */
const ALLOWLIST = [
  'src/lib/units/qty.ts',        // defines UnitQty and the only legal addition
  'src/lib/units/qty.test.ts',   // asserts the rule
  'scripts/check-rule7.ts',      // this file
];

/** An explicit, greppable opt-out for a line a human has judged safe. */
const WAIVER = 'rule7-ok:';

/**
 * Exceptions that cannot carry an inline waiver because the file is an applied
 * migration and migrations are immutable once applied.
 *
 * Each one is a judgement, recorded here with its reason and printed on every
 * run so it stays visible rather than becoming invisible tolerance. Adding to
 * this list is a review decision, not a way to quiet the linter.
 */
const REVIEWED: { file: string; rule: string; reason: string }[] = [
  {
    file: 'db/migrations/0106_b6_phase_2.sql',
    rule: 'sql-sum-over-raw',
    reason:
      'ci.reconcile_position_balance() and ci.reconcile_committed_volume() are integrity ' +
      'reconcilers, not screens. Each sum is scoped by a key that pins one project and one ' +
      'unit type - parent_id for a position lineage, (project_id, unit_type_id, period_id) ' +
      'for a period balance - so no cross-project addition is possible. They compare a cached ' +
      'figure against the rows it was derived from and emit a discrepancy; they render nothing.',
  },
];

interface Finding {
  file: string; line: number; rule: string; text: string; severity: 'error' | 'warn';
}
const findings: Finding[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|sql)$/.test(name)) out.push(p);
  }
  return out;
}

// --- the checks -------------------------------------------------------------

const TS_CHECKS: { rule: string; re: RegExp; severity: 'error' | 'warn'; why: string }[] = [
  {
    // Deliberately loose: any line that both reduces and touches .amount.
    // The common shape is reduce((n, r) => n + r.amount, 0), where the arrow
    // parameters close a paren before .amount is reached, so anything that
    // tries to stay inside one paren group misses the exact case that matters.
    rule: 'reduce-over-amount',
    re: /\.reduce\s*\(.*\.amount/,
    severity: 'error',
    why: 'reduce() over .amount adds bare numbers. Use sumSameUnit(), which refuses across projects.',
  },
  {
    // Both directions: `x.amount + y` and `n + r.amount`.
    rule: 'arithmetic-on-amount',
    re: /\.amount\s*[+\-]|[+\-]\s*[A-Za-z_$][\w$.]*\.amount/,
    severity: 'error',
    why: 'arithmetic directly on .amount bypasses the project and unit-type check.',
  },
  {
    rule: 'accumulator-over-amount',
    re: /\b(acc|sum|total|n)\s*\+=\s*[A-Za-z_$][\w$.]*\.amount/,
    severity: 'error',
    why: 'accumulating .amount in a loop is the same bug written longhand.',
  },
  {
    rule: 'flat-amount-collection',
    re: /(flatMap|map)\s*\([^)]*=>\s*[A-Za-z_$.[\]]*\.amount\s*\)/,
    severity: 'warn',
    why: 'collecting bare amounts detaches them from their project. Collect UnitQty instead.',
  },
  {
    rule: 'total-naming',
    re: /\b(totalUnits|allUnits|platformTotal|grandTotal|totalVolume|sumOfUnits)\b/,
    severity: 'error',
    why: 'a name implying a total across projects. There is no such quantity.',
  },
];

const SQL_CHECKS: { rule: string; re: RegExp; severity: 'error' | 'warn'; why: string }[] = [
  {
    rule: 'sql-sum-over-raw',
    re: /\b(sum|avg|min|max)\s*\(\s*[A-Za-z_.]*_raw\b/i,
    severity: 'error',
    why: 'aggregating a *_raw column loses the project and unit type. Aggregate the *_qty composite with sylva.sum_same_unit.',
  },
  {
    rule: 'sql-sum-over-composite-field',
    re: /\b(sum|avg)\s*\(\s*\([^)]*\)\.amount/i,
    severity: 'error',
    why: 'reaching past the composite to .amount is the documented escape hatch. Use sylva.sum_same_unit.',
  },
];

function checkFile(abs: string) {
  const file = relative(ROOT, abs);
  if (ALLOWLIST.includes(file)) return;
  const isSql = file.endsWith('.sql');
  const checks = isSql ? SQL_CHECKS : TS_CHECKS;
  const lines = readFileSync(abs, 'utf8').split('\n');

  const reviewed = new Set(REVIEWED.filter((r) => r.file === file).map((r) => r.rule));

  lines.forEach((text, i) => {
    if (text.includes(WAIVER)) return;                 // explicitly waived
    const stripped = isSql
      ? text.replace(/--.*$/, '')
      : text.replace(/\/\/.*$/, '');
    for (const c of checks) {
      if (reviewed.has(c.rule)) continue;              // reviewed, see REVIEWED
      if (c.re.test(stripped)) {
        findings.push({ file, line: i + 1, rule: c.rule, text: text.trim().slice(0, 120), severity: c.severity });
      }
    }
  });

  // A grouped aggregate must group by BOTH scopes, not one.
  if (isSql) {
    const body = readFileSync(abs, 'utf8');
    // Defining the aggregate, or granting EXECUTE on it, is not a use of it.
    const usesAggregate = body
      .split('\n')
      .filter((l) => /sum_same_unit\s*\(/i.test(l))
      .some((l) => !/CREATE\s+AGGREGATE|GRANT\s+EXECUTE|REVOKE|COMMENT\s+ON/i.test(l));
    if (usesAggregate) {
      const grouped = /GROUP\s+BY[^;]*project_id[^;]*unit_type_id|GROUP\s+BY[^;]*unit_type_id[^;]*project_id/is.test(body);
      const perRow = /PRIMARY\s+KEY\s*\([^)]*project_id[^)]*unit_type_id/is.test(body);
      if (!grouped && !perRow) {
        findings.push({
          file, line: 0, rule: 'aggregate-without-both-scopes',
          text: 'sum_same_unit() used without GROUP BY project_id AND unit_type_id',
          severity: 'warn',
        });
      }
    }
  }
}

for (const dir of SCAN) {
  try { walk(join(ROOT, dir)).forEach(checkFile); } catch { /* directory absent */ }
}

// --- report -----------------------------------------------------------------

const errors = findings.filter((f) => f.severity === 'error');
const warns = findings.filter((f) => f.severity === 'warn');
const allChecks = [...TS_CHECKS, ...SQL_CHECKS];

if (REVIEWED.length > 0) {
  console.log('rule 7: reviewed exceptions in force —');
  for (const r of REVIEWED) {
    console.log(`  ${r.file}  [${r.rule}]`);
    console.log(`    ${r.reason}`);
  }
  console.log('');
}

if (findings.length === 0) {
  console.log('rule 7: clean — no cross-project or cross-unit-type arithmetic found');
} else {
  for (const f of findings) {
    const why = allChecks.find((c) => c.rule === f.rule)?.why ?? '';
    const at = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`${f.severity === 'error' ? 'ERROR' : ' warn'}  ${at}  [${f.rule}]`);
    console.log(`        ${f.text}`);
    if (why) console.log(`        ${why}`);
  }
  console.log(`\nrule 7: ${errors.length} error(s), ${warns.length} warning(s)`);
  console.log(`(a line judged safe by a human may be waived with a "${WAIVER}" comment, which stays greppable)`);
}

process.exit(errors.length > 0 ? 1 : 0);
