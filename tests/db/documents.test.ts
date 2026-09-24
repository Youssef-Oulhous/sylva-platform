import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ANONYMOUS } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { withActor } from '@/lib/db/session';
import {
  InvalidStorageKeyError, LocalStorageDriver, StorageKeyInUseError,
  __setStorageDriverForTests, assertValidStorageKey, storageDriver,
} from '@/lib/storage';
import { checkUpload } from '@/lib/documents/media';
import { downloadFileName, newStorageKey } from '@/lib/documents/keys';
import { findServableDocument, listProjectDocuments, servableDocument } from '@/lib/documents/queries';
import { serveDocument } from '@/lib/documents/serve';
import { insertDocumentRows, uploadDocument, verifyStoredDocument } from '@/lib/documents/service';
import { DocumentError } from '@/lib/documents/errors';
import { zipStream } from '@/lib/documents/zip';

import { actorFor } from '../rls/principals';
import { ensureFixtures } from '../rls/fixtures';
import { DEAL_DOCUMENT, DOCUMENT, ORG, PROJECT } from '../rls/catalog';
import { inRolledBackTransaction, refusalOf } from './rollback';

/**
 * DOCUMENT STORAGE AND SECURE ACCESS.
 *
 * Four questions the brief asks, answered here against the real database, the
 * real row-level policies and a real file on disk:
 *
 *   - a public document is reachable anonymously
 *   - an investor-only document is not reachable by a buyer
 *   - a deal document is not reachable by a non-participant
 *   - a direct storage-key guess fails
 *
 * HOW THE FIXTURES WORK, AND WHY THEY LOOK LIKE THIS.
 *
 * doc.document and doc.document_version are append-only: UPDATE and DELETE are
 * revoked AND blocked by ENABLE ALWAYS triggers, so a test that commits a
 * document can never tidy it away. Two consequences, both deliberate:
 *
 *   READ fixtures are committed and IDEMPOTENT - fixed uuids, ON CONFLICT DO
 *   NOTHING - exactly like tests/rls/fixtures.ts. Running the suite a hundred
 *   times creates them once.
 *
 *   WRITE tests run inside inRolledBackTransaction(). They execute the same
 *   SQL, as the same privilege role, with a real HMAC-signed actor context,
 *   against the same policies and triggers. Only the COMMIT is missing. That is
 *   why insertDocumentRows() is exported separately from uploadDocument().
 *
 * The bytes live under .storage-test (gitignored), through the same
 * LocalStorageDriver the development server uses. Nothing here mocks the store.
 */

const OPERATOR = actorFor('operator');
const OWNER_A = actorFor('ownerA');
const OWNER_B = actorFor('ownerB');
const BUYER_A = actorFor('buyerA');
const BUYER_B = actorFor('buyerB');
const INVESTOR_A = actorFor('investorA');
const AUDITOR = actorFor('auditor');

const TEST_BUCKET = 'sylva-test-documents';
const TEST_REGION = 'eu-central-1';       // a named member state, per §12.
const TEST_ROOT = resolve(process.cwd(), '.storage-test');

/** A minimal but genuinely valid PDF: it starts with %PDF- and ends with EOF. */
function pdf(marker: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n% DEMO fixture document: ${marker}\n`
    + '1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    'latin1',
  );
}

/* ------------------------------------------------------------- fixtures -- */

const FIXTURE = {
  /** Public, on the published project 1. Reachable by everyone. */
  publicDoc: 'f1000000-0000-0000-0000-0000000000d1',
  publicVer: 'f2000000-0000-0000-0000-0000000000d1',
  publicKey: 'documents/test/public-d1.pdf',

  /**
   * visibility = 'admin' - Sylva only. On project 3, which is a DRAFT owned by
   * Owner A, so it can never reach a public page whatever happens. It is the
   * row migration 0056 exists for: before 0056 the owner's read policy had no
   * visibility test and handed this straight to Owner A.
   */
  adminDoc: 'f1000000-0000-0000-0000-0000000000d2',
  adminVer: 'f2000000-0000-0000-0000-0000000000d2',
  adminKey: 'documents/test/admin-d2.pdf',

  /** A register entry whose bytes were never written. The store has lost it. */
  lostDoc: 'f1000000-0000-0000-0000-0000000000d3',
  lostVer: 'f2000000-0000-0000-0000-0000000000d3',
  lostKey: 'documents/test/never-written-d3.pdf',
} as const;

const PUBLIC_BYTES = pdf('public on project 1');
const ADMIN_BYTES = pdf('admin class on the draft project');

async function ensureDocumentFixtures(): Promise<void> {
  await withActor(OPERATOR, async (tx) => {
    for (const [docId, verId, key, bytes, projectId, visibility, kind] of [
      [FIXTURE.publicDoc, FIXTURE.publicVer, FIXTURE.publicKey, PUBLIC_BYTES,
       PROJECT.p1, 'public', 'other'],
      [FIXTURE.adminDoc, FIXTURE.adminVer, FIXTURE.adminKey, ADMIN_BYTES,
       PROJECT.p3, 'admin', 'vetting_evidence'],
      [FIXTURE.lostDoc, FIXTURE.lostVer, FIXTURE.lostKey, PUBLIC_BYTES,
       PROJECT.p1, 'public', 'other'],
    ] as const) {
      await tx.query(
        `INSERT INTO doc.document (id, scope, kind, visibility, project_id)
         VALUES ($1::uuid, 'project', $2, $3::doc.visibility_class, $4::uuid)
         ON CONFLICT (id) DO NOTHING`,
        [docId, kind, visibility, projectId],
      );
      await tx.query(
        `INSERT INTO doc.document_version
           (id, document_id, version_no, storage_region, storage_bucket, storage_key,
            content_sha256, byte_size, media_type, locale, uploaded_by_org_id)
         VALUES ($1::uuid, $2::uuid, 1, $3, $4, $5, $6::bytea, $7::bigint,
                 'application/pdf', 'en', $8::uuid)
         ON CONFLICT (id) DO NOTHING`,
        [verId, docId, TEST_REGION, TEST_BUCKET, key,
         createHash('sha256').update(bytes).digest(), String(bytes.length),
         ORG.operator],
      );
    }
  });

  // The bytes, written once. put() refuses to overwrite - a key is never
  // reused - so this asks first. It also repairs a store somebody has deleted,
  // which is the one thing that would make these fixtures non-repeatable.
  const driver = storageDriver();
  for (const [key, bytes] of [
    [FIXTURE.publicKey, PUBLIC_BYTES],
    [FIXTURE.adminKey, ADMIN_BYTES],
  ] as const) {
    if (await driver.size({ bucket: TEST_BUCKET, key }) === null) {
      await driver.put(key, bytes);
    }
  }
  // FIXTURE.lostKey is never written. That is the point of it.
}

beforeAll(async () => {
  __setStorageDriverForTests(new LocalStorageDriver(TEST_ROOT, TEST_REGION, TEST_BUCKET));
  await ensureFixtures();          // deals, deal documents, investor financials
  await ensureDocumentFixtures();
}, 60_000);

afterAll(async () => {
  __setStorageDriverForTests(null);
  await closeAllPools();
});

/* ======================================================= THE FOUR ANSWERS = */

describe('a public document is reachable anonymously', () => {
  it('comes back as a row for a visitor with no session at all', async () => {
    const doc = await servableDocument(ANONYMOUS, FIXTURE.publicDoc);
    expect(doc).not.toBeNull();
    expect(doc!.visibility).toBe('public');
    expect(doc!.projectSlug).toBe('demo-untere-havel-wetland-restoration');
  });

  it('is served, with the bytes that were stored', async () => {
    const res = await serveDocument(ANONYMOUS, FIXTURE.publicDoc);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-length')).toBe(String(PUBLIC_BYTES.length));

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(PUBLIC_BYTES)).toBe(true);
  });

  it('is served under a name built from the kind and version, never a stored one', async () => {
    const res = await serveDocument(ANONYMOUS, FIXTURE.publicDoc);
    expect(res.headers.get('content-disposition'))
      .toContain('filename="other-v1.pdf"');
    // The storage key must not appear anywhere in what leaves the server.
    expect(JSON.stringify([...res.headers])).not.toContain(FIXTURE.publicKey);
  });

  it('refuses to guess: nosniff, a sandbox policy, and an ETag over the hash', async () => {
    const res = await serveDocument(ANONYMOUS, FIXTURE.publicDoc);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('etag'))
      .toBe(`"${createHash('sha256').update(PUBLIC_BYTES).digest('hex')}"`);
  });

  it('answers 304 when the caller already has that exact content', async () => {
    const etag = `"${createHash('sha256').update(PUBLIC_BYTES).digest('hex')}"`;
    const res = await serveDocument(ANONYMOUS, FIXTURE.publicDoc, { ifNoneMatch: etag });
    expect(res.status).toBe(304);
  });

  it('is 404 under another project’s path, though the reader may read it', async () => {
    const res = await serveDocument(ANONYMOUS, FIXTURE.publicDoc, {
      expectProjectSlug: 'demo-marais-de-briere-restoration',
    });
    expect(res.status).toBe(404);
  });
});

describe('an investor-only document is not reachable by a buyer', () => {
  // DOCUMENT.finP1 is the demo financial model on project 1, visibility
  // 'vetted_investor'. "Financing need, revenue streams, the financial model.
  // Visible only to investors we have vetted." - concept note, section 6.
  it('is invisible to an approved buyer', async () => {
    expect(await servableDocument(BUYER_A, DOCUMENT.finP1)).toBeNull();
    expect(await servableDocument(BUYER_B, DOCUMENT.finP1)).toBeNull();
  });

  it('is invisible to an anonymous visitor', async () => {
    expect(await servableDocument(ANONYMOUS, DOCUMENT.finP1)).toBeNull();
  });

  it('IS visible to a vetted investor, so the refusal is about the class', async () => {
    const doc = await servableDocument(INVESTOR_A, DOCUMENT.finP1);
    expect(doc).not.toBeNull();
    expect(doc!.visibility).toBe('vetted_investor');
  });

  it('the serving route answers 404, not 403 - a 403 would confirm it exists', async () => {
    const res = await serveDocument(BUYER_A, DOCUMENT.finP1);
    expect(res.status).toBe(404);
    // Same status and same sentence as a document id that never existed.
    const missing = await serveDocument(BUYER_A, 'f9999999-0000-0000-0000-000000000000');
    expect(missing.status).toBe(404);
    expect(await res.text()).toBe(await missing.text());
  });
});

describe('a deal document is not reachable by a non-participant', () => {
  // DEAL_DOCUMENT.a is the letter of intent in Buyer A's deal room with
  // Owner A, visibility 'deal_participants'.
  it('is readable by both counterparties and by nobody else of their kind', async () => {
    expect(await servableDocument(BUYER_A, DEAL_DOCUMENT.a)).not.toBeNull();
    expect(await servableDocument(OWNER_A, DEAL_DOCUMENT.a)).not.toBeNull();

    // The failure the concept note says matters most: another buyer.
    expect(await servableDocument(BUYER_B, DEAL_DOCUMENT.a)).toBeNull();
    // And another project owner.
    expect(await servableDocument(OWNER_B, DEAL_DOCUMENT.a)).toBeNull();
    // And an investor, who never sees a deal room at all.
    expect(await servableDocument(INVESTOR_A, DEAL_DOCUMENT.a)).toBeNull();
    expect(await servableDocument(ANONYMOUS, DEAL_DOCUMENT.a)).toBeNull();
  });

  it('the two deal rooms cannot see each other', async () => {
    expect(await servableDocument(BUYER_B, DEAL_DOCUMENT.b)).not.toBeNull();
    expect(await servableDocument(BUYER_A, DEAL_DOCUMENT.b)).toBeNull();
  });

  it('the auditor reads both, which is what an auditor is for', async () => {
    expect(await servableDocument(AUDITOR, DEAL_DOCUMENT.a)).not.toBeNull();
    expect(await servableDocument(AUDITOR, DEAL_DOCUMENT.b)).not.toBeNull();
  });
});

describe('a direct storage-key guess fails', () => {
  it('no route accepts a storage key: the serving route takes a uuid', async () => {
    for (const guess of [
      FIXTURE.publicKey,
      'demo/1.pdf',
      'documents/2026/09/anything.pdf',
      '../../../etc/passwd',
    ]) {
      const res = await serveDocument(ANONYMOUS, guess);
      expect(res.status).toBe(404);
    }
  });

  it('the register a page renders carries no storage key at all', async () => {
    const rows = await listProjectDocuments(ANONYMOUS, PROJECT.p1);
    expect(rows.length).toBeGreaterThan(0);
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain(FIXTURE.publicKey);
    expect(serialised).not.toContain('storageKey');
    expect(serialised).not.toContain('bucket');
  });

  it('the local driver refuses a key that tries to leave its bucket', async () => {
    const driver = new LocalStorageDriver(TEST_ROOT, TEST_REGION, TEST_BUCKET);
    for (const key of [
      '../secrets.pdf',
      'documents/../../secrets.pdf',
      '/etc/passwd',
      'documents/./../../x',
      'a\u0000b',
      'documents\\..\\x',
    ]) {
      await expect(driver.open({ bucket: TEST_BUCKET, key })).rejects
        .toBeInstanceOf(InvalidStorageKeyError);
    }
  });

  it('the key validator accepts an ordinary key and rejects the rest', () => {
    expect(() => assertValidStorageKey('documents/2026/09/abcDEF-123_x.pdf')).not.toThrow();
    for (const bad of ['', '/leading', 'trailing/', 'a//b', '..', 'a/../b', 'a b']) {
      expect(() => assertValidStorageKey(bad)).toThrow();
    }
  });

  it('a generated key carries 192 bits of randomness and describes nothing', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 2000; i += 1) keys.add(newStorageKey('.pdf'));
    expect(keys.size).toBe(2000);

    const one = newStorageKey('.pdf');
    expect(one).toMatch(/^documents\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{32}\.pdf$/);
    // Nothing about WHAT it is or WHOSE it is.
    for (const leak of ['financial', 'model', 'havel', 'project', 'investor', 'deal']) {
      expect(one).not.toContain(leak);
    }
  });

  it('a key is never reused, so a second write cannot repoint a version', async () => {
    const driver = storageDriver();
    const key = newStorageKey('.pdf');
    await driver.put(key, pdf('first'));
    await expect(driver.put(key, pdf('second'))).rejects
      .toBeInstanceOf(StorageKeyInUseError);
    // and the original bytes are untouched
    const back = await driver.read({ bucket: TEST_BUCKET, key });
    expect(back!.equals(pdf('first'))).toBe(true);
    await driver.remove({ bucket: TEST_BUCKET, key });
  });
});

/* =============================================== THE SIXTH VISIBILITY CLASS */

describe('an admin-class document is not the project owner’s', () => {
  // The test migration 0056 says will fail if that policy is reverted.
  it('Owner A does not see an admin document on Owner A’s own project', async () => {
    expect(await servableDocument(OWNER_A, FIXTURE.adminDoc)).toBeNull();

    const register = await listProjectDocuments(OWNER_A, PROJECT.p3);
    expect(register.some((d) => d.documentId === FIXTURE.adminDoc)).toBe(false);
  });

  it('Sylva and the auditor do see it, so the row is really there', async () => {
    expect(await servableDocument(OPERATOR, FIXTURE.adminDoc)).not.toBeNull();
    expect(await servableDocument(AUDITOR, FIXTURE.adminDoc)).not.toBeNull();
  });

  it('nobody else sees it either', async () => {
    for (const actor of [ANONYMOUS, BUYER_A, BUYER_B, INVESTOR_A, OWNER_B]) {
      expect(await servableDocument(actor, FIXTURE.adminDoc)).toBeNull();
    }
  });
});

/* ============================================== UPLOAD: WHAT IS ACCEPTED == */

describe('upload validation', () => {
  it('accepts the formats on the allow-list', () => {
    expect(checkUpload('application/pdf', pdf('ok')).ok).toBe(true);
    expect(checkUpload('application/geo+json',
      Buffer.from('{"type":"FeatureCollection","features":[]}')).ok).toBe(true);
    expect(checkUpload('text/csv', Buffer.from('period,volume\n2028,1200\n')).ok).toBe(true);
    expect(checkUpload('image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])).ok).toBe(true);
  });

  it('refuses a media type that is not on the list, by name', () => {
    const out = checkUpload('text/html', Buffer.from('<h1>hello</h1>'));
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.rejection.reason).toBe('media_type_not_allowed');
    // SVG in particular: it is an image and it carries script.
    expect(checkUpload('image/svg+xml', Buffer.from('<svg/>')).ok).toBe(false);
  });

  it('refuses an empty file', () => {
    const out = checkUpload('application/pdf', Buffer.alloc(0));
    expect(out.ok === false && out.rejection.reason).toBe('file_empty');
  });

  it('refuses a file larger than its format allows', () => {
    const huge = Buffer.concat([pdf('big'), Buffer.alloc(11 * 1024 * 1024)]);
    const out = checkUpload('application/geo+json', huge);
    expect(out.ok === false && out.rejection.reason).toBe('file_too_large');
  });

  it('REFUSES BYTES THAT DO NOT MATCH THE CLAIMED TYPE', () => {
    // The browser sets Content-Type from the file NAME, so this is exactly what
    // arrives when payload.html is renamed to report.pdf.
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const out = checkUpload('application/pdf', html);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.rejection.reason).toBe('content_does_not_match_type');

    // and the other way round
    expect(checkUpload('image/png', pdf('not a png')).ok).toBe(false);
    expect(checkUpload('application/geo+json', Buffer.from('not json')).ok).toBe(false);
    // valid JSON, but not GeoJSON
    expect(checkUpload('application/geo+json', Buffer.from('{"a":1}')).ok).toBe(false);
    // a plain zip is not an OOXML workbook
    expect(checkUpload(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(40).fill(0)]),
    ).ok).toBe(false);
  });

  it('uploadDocument refuses before it writes anything to the store', async () => {
    const before = await storageDriver().size({ bucket: TEST_BUCKET, key: FIXTURE.publicKey });
    await expect(uploadDocument(OPERATOR, {
      kind: 'other',
      visibility: 'public',
      locale: 'en',
      mediaType: 'application/pdf',
      bytes: Buffer.from('<html>not a pdf</html>'),
      anchor: { scope: 'project', projectId: PROJECT.p3 },
    })).rejects.toBeInstanceOf(DocumentError);
    expect(await storageDriver().size({ bucket: TEST_BUCKET, key: FIXTURE.publicKey }))
      .toBe(before);
  });
});

/* ============================================== UPLOAD: WHO MAY WRITE WHAT */

describe('who may put a document on a project', () => {
  const bytes = pdf('upload probe');
  const digest = createHash('sha256').update(bytes).digest();

  function args(projectId: string, visibility: 'public' | 'admin' = 'public') {
    return {
      request: {
        kind: 'project_idea_note',
        visibility,
        locale: 'en',
        mediaType: 'application/pdf',
        bytes,
        anchor: { scope: 'project', projectId },
      },
      mediaType: 'application/pdf',
      key: newStorageKey('.pdf'),
      digest,
      region: TEST_REGION,
      bucket: TEST_BUCKET,
    } as const;
  }

  it('an owner may attach a document to its OWN project (migration 0055)', async () => {
    const out = await inRolledBackTransaction(OWNER_A, (tx) =>
      insertDocumentRows(tx, args(PROJECT.p1)));
    expect(out.versionNo).toBe(1);
    expect(out.contentSha256).toBe(digest.toString('hex'));
    expect(out.storageRegion).toBe(TEST_REGION);
  });

  it('an owner may NOT attach one to somebody else’s project', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(OWNER_B, (tx) => insertDocumentRows(tx, args(PROJECT.p1))));
    expect(refusal.code).toBe('42501');
    expect(refusal.message).toMatch(/row-level security/i);
  });

  it('an owner may NOT create an admin-class document, even on its own project', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(OWNER_A, (tx) =>
        insertDocumentRows(tx, args(PROJECT.p1, 'admin'))));
    expect(refusal.code).toBe('42501');
  });

  it('a buyer may not attach a document to a project at all', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(BUYER_A, (tx) => insertDocumentRows(tx, args(PROJECT.p1))));
    expect(refusal.code).toBe('42501');
  });

  it('the operator may, anywhere', async () => {
    const out = await inRolledBackTransaction(OPERATOR, (tx) =>
      insertDocumentRows(tx, args(PROJECT.p2)));
    expect(out.documentId).toBeTruthy();
  });

  it('an owner stamps its own organisation as the uploader, and cannot forge it', async () => {
    const refusal = await refusalOf(() => inRolledBackTransaction(OWNER_A, async (tx) => {
      const doc = await tx.one<{ id: string }>(
        `INSERT INTO doc.document (scope, kind, visibility, project_id)
         VALUES ('project', 'other', 'public', $1::uuid) RETURNING id`,
        [PROJECT.p1],
      );
      await tx.query(
        `INSERT INTO doc.document_version
           (document_id, version_no, storage_region, storage_bucket, storage_key,
            content_sha256, byte_size, media_type, uploaded_by_org_id)
         VALUES ($1::uuid, 1, $2, $3, $4, $5::bytea, 100, 'application/pdf', $6::uuid)`,
        [doc.id, TEST_REGION, TEST_BUCKET, newStorageKey('.pdf'), digest, ORG.ownerB],
      );
    }));
    expect(refusal.code).toBe('42501');
  });

  it('a second upload of the same document is version 2, and version 1 stays', async () => {
    await inRolledBackTransaction(OWNER_A, async (tx) => {
      const first = await insertDocumentRows(tx, args(PROJECT.p1));
      const second = await insertDocumentRows(tx, {
        ...args(PROJECT.p1),
        request: { ...args(PROJECT.p1).request, supersedesDocumentId: first.documentId },
      });
      expect(second.versionNo).toBe(2);

      const rows = await tx.query<{ version_no: number }>(
        'SELECT version_no FROM doc.document_version WHERE document_id = $1::uuid ORDER BY version_no',
        [first.documentId],
      );
      expect(rows.map((r) => r.version_no)).toEqual([1, 2]);
    });
  });

  it('nobody can change a document’s visibility after the fact - R4', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(OPERATOR, (tx) => tx.query(
        'UPDATE doc.document SET visibility = visibility WHERE id = $1::uuid',
        [FIXTURE.publicDoc],
      )));
    expect(refusal.code).toBeTruthy();
  });
});

/* ============================================================ WITHDRAWAL == */

describe('withdrawal', () => {
  it('a withdrawn version stops being served, and the row survives', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      // Visible to begin with, inside this very transaction.
      expect(await findServableDocument(tx, FIXTURE.publicDoc)).not.toBeNull();

      await tx.query(
        `INSERT INTO doc.document_withdrawal
           (document_version_id, reason, withdrawn_by_org_id)
         VALUES ($1::uuid, 'DEMO test: withdrawn inside a rolled-back transaction', $2::uuid)`,
        [FIXTURE.publicVer, ORG.operator],
      );

      // Gone from the serving query - even for the operator, who can still see
      // the ROW. Migration 0010: "every serving route joins against this table
      // and 404s."
      expect(await findServableDocument(tx, FIXTURE.publicDoc)).toBeNull();

      const still = await tx.one<{ n: string }>(
        'SELECT count(*)::text AS n FROM doc.document_version WHERE id = $1::uuid',
        [FIXTURE.publicVer],
      );
      expect(still.n).toBe('1');
    });

    // The rollback really rolled back.
    expect(await servableDocument(ANONYMOUS, FIXTURE.publicDoc)).not.toBeNull();
  });

  it('an owner may withdraw on its own project and not on another’s', async () => {
    await inRolledBackTransaction(OWNER_A, async (tx) => {
      await tx.query(
        `INSERT INTO doc.document_withdrawal
           (document_version_id, reason, withdrawn_by_org_id)
         VALUES ($1::uuid, 'DEMO test: owner withdraws its own', sylva.actor_org_id())`,
        [FIXTURE.publicVer],
      );
    });

    const refusal = await refusalOf(() => inRolledBackTransaction(OWNER_B, (tx) => tx.query(
      `INSERT INTO doc.document_withdrawal
         (document_version_id, reason, withdrawn_by_org_id)
       VALUES ($1::uuid, 'DEMO test: not yours', sylva.actor_org_id())`,
      [FIXTURE.publicVer],
    )));
    expect(refusal.code).toBe('42501');
  });
});

/* ============================================================= INTEGRITY == */

describe('the stored bytes and the record agree', () => {
  it('verifies the recorded sha256 against the stored object', async () => {
    const out = await verifyStoredDocument(OPERATOR, FIXTURE.publicDoc);
    expect(out).toEqual({ ok: true, byteSize: PUBLIC_BYTES.length });
  });

  it('a document the store has lost is refused, not served as an empty file', async () => {
    const res = await serveDocument(ANONYMOUS, FIXTURE.lostDoc);
    expect(res.status).toBe(502);
    expect(await res.text()).toMatch(/could not be confirmed/i);

    const out = await verifyStoredDocument(OPERATOR, FIXTURE.lostDoc);
    expect(out).toEqual({ ok: false, reason: 'missing' });
  });

  it('the download name is built from the kind and version, never from input', () => {
    expect(downloadFileName('project_design_document', 2, '.pdf'))
      .toBe('project-design-document-v2.pdf');
    expect(downloadFileName('../../etc/passwd', 1, '.pdf')).toBe('etc-passwd-v1.pdf');
    expect(downloadFileName('a"; rm -rf /', 1, '.pdf')).toBe('a-rm-rf-v1.pdf');
  });
});

/* ================================================== THE BULK DOWNLOAD ==== */

describe('the bulk download carries only what the reader may have', () => {
  it('writes an archive a reader can open, with a manifest', async () => {
    const stream = zipStream([
      { name: 'MANIFEST.txt', bytes: async () => Buffer.from('DEMO manifest\n') },
      { name: 'other-v1.pdf', bytes: async () => PUBLIC_BYTES },
    ]);
    const chunks: Buffer[] = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const archive = Buffer.concat(chunks);

    // A real ZIP: local header, then the end-of-central-directory record.
    expect(archive.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(archive.subarray(archive.length - 22, archive.length - 18))
      .toEqual(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    // Two entries in the central directory.
    expect(archive.readUInt16LE(archive.length - 12)).toBe(2);
    // The member's bytes really are in there.
    expect(archive.includes(PUBLIC_BYTES)).toBe(true);
  });
});
