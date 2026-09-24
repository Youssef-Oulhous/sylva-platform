/**
 * Put bytes behind the demo documents, so the local site actually serves them.
 *
 *   npx tsx scripts/seed-demo-documents.ts
 *
 * WHY A SCRIPT AND NOT A SEED FILE. db/seed/*.sql inserted doc.document and
 * doc.document_version rows with placeholder storage keys ('demo/1.pdf') and a
 * content_sha256 taken over a STRING rather than over any file. No file was
 * ever written, and no file can be written to match that hash - sha256 does not
 * invert. So those rows are a register with nothing behind it, and the serving
 * route correctly refuses them with "its stored copy could not be confirmed".
 *
 * A .sql seed cannot write a file. This script can, so it does the honest
 * thing: it adds a NEW VERSION of each demo document through the real upload
 * path - real validation, a real unguessable key, a real sha256 over the real
 * bytes - and leaves version 1 exactly where it is. That is R4 working rather
 * than being worked around: the placeholder version stays on the record, and
 * the register shows v2 as current.
 *
 * IDEMPOTENT. A document that already has a version in the configured bucket is
 * skipped, so running this twice does not add a third version.
 *
 * DEMO ONLY. Every file it writes says DEMO on its first line. Never run it
 * against a deployment.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { readAs } from '../src/lib/db/session';
import { closeAllPools } from '../src/lib/db/pool';
import { uploadDocument } from '../src/lib/documents/service';
import { storageDriver } from '../src/lib/storage';
import type { Actor } from '../src/lib/db/actor';

/** The bucket db/seed/*.sql and tests/rls/fixtures.ts wrote into. */
const DEMO_BUCKET = 'sylva-demo-documents';

const OPERATOR: Actor = {
  kind: 'operator',
  orgId: '10000000-0000-0000-0000-000000000010', // DEMO Sylva Operations
  personRef: 'b0000000-0000-0000-0000-0000000000b7',
};

interface Row extends Record<string, unknown> {
  id: string;
  kind: string;
  project_slug: string | null;
  already: boolean;
}

/**
 * A small, valid PDF. Not a real document and it does not pretend to be one:
 * it says DEMO, it names the document kind it stands in for, and it says where
 * the real file would come from.
 */
function placeholder(kind: string, project: string | null): Buffer {
  const lines = [
    'DEMO PLACEHOLDER - this is not a real document.',
    '',
    `Stands in for: ${kind}`,
    `Project: ${project ?? 'n/a'}`,
    '',
    'On the pilot platform this file is the one the project owner uploaded.',
    'Here it exists only so that the document register, the authorisation',
    'check and the download route can be exercised end to end.',
  ];
  const text = lines.map((l) => `(${l.replace(/[()\\]/g, '')}) Tj T*`).join('\n');
  const content = `BT /F1 11 Tf 56 760 Td 15 TL\n${text}\nET`;

  // A one-page PDF with a cross-reference table. Assembled by hand rather than
  // with a library, because a placeholder is not worth a dependency.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
      + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
    + `startxref\n${xref}\n%%EOF\n`;

  return Buffer.from(body, 'latin1');
}

async function main(): Promise<void> {
  const driver = storageDriver();
  console.log(`store: ${driver.name} · region ${driver.region} · bucket ${driver.bucket}`);

  // Only PROJECT documents the DEMO SEED created. Two restrictions, each for
  // its own reason:
  //   storage_bucket = 'sylva-demo-documents'  is what db/seed/*.sql and
  //     tests/rls/fixtures.ts wrote, so this script cannot touch anything real
  //     and cannot touch the fixtures in tests/db/documents.test.ts.
  //   scope = 'project'  leaves the deal-room documents alone. They belong to
  //     the row-level security fixtures, they are nobody's public register,
  //     and adding a version to one moves a target the matrix probes.
  const rows = await readAs(OPERATOR, (tx) => tx.query<Row>(
    `SELECT d.id, d.kind, p.slug AS project_slug,
            EXISTS (SELECT 1 FROM doc.document_version v
                     WHERE v.document_id = d.id AND v.storage_bucket = $2) AS already
       FROM doc.document d
       LEFT JOIN proj.project p ON p.id = d.project_id
      WHERE d.scope = 'project'
        AND EXISTS (SELECT 1 FROM doc.document_version v
                     WHERE v.document_id = d.id AND v.storage_bucket = $1)
      ORDER BY p.slug, d.kind`,
    [DEMO_BUCKET, driver.bucket],
  ));

  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.already) { skipped += 1; continue; }

    const bytes = placeholder(row.kind, row.project_slug);
    const out = await uploadDocument(OPERATOR, {
      kind: row.kind,
      visibility: 'public',          // ignored: the document already exists
      locale: 'en',
      mediaType: 'application/pdf',
      bytes,
      anchor: { scope: 'project', projectId: '00000000-0000-0000-0000-000000000000' },
      supersedesDocumentId: row.id,  // a NEW VERSION of an existing document
    });
    console.log(
      `   + ${row.project_slug ?? '-'} · ${row.kind} -> v${out.versionNo} `
      + `(${out.byteSize} bytes, ${out.contentSha256.slice(0, 12)}…)`,
    );
    added += 1;
  }

  console.log(`>> ${added} versions written, ${skipped} documents already had bytes`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeAllPools());
