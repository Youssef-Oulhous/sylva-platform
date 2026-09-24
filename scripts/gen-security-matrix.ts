#!/usr/bin/env tsx
/**
 * Writes docs/SECURITY-MATRIX.md from tests/rls/matrix.ts.
 *
 * The document and the test suite are the same data rendered twice. A test in
 * tests/rls/matrix.test.ts re-renders this file and fails if the checked-in
 * copy differs, so a widened policy either updates both or fails CI.
 *
 * It needs no database: it prints what is ASSERTED. What actually happens is
 * the test run's job.
 */
import { writeFileSync } from 'node:fs';
import { renderMarkdown } from '../tests/rls/render';

const OUT = 'docs/SECURITY-MATRIX.md';

const md = renderMarkdown();
writeFileSync(OUT, md, 'utf8');
console.log(`${OUT}: ${md.split('\n').length} lines`);
