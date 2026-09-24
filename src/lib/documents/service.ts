import { createHash, timingSafeEqual } from 'node:crypto';
import { withActor, type Tx } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import { storageDriver } from '@/lib/storage';
import { DocumentError, logDocumentFailure } from './errors';
import { newStorageKey } from './keys';
import { allowedMediaType, checkUpload, normaliseMediaType } from './media';
import { findServableDocument } from './queries';
import type { UploadRequest, UploadResult } from './types';

/**
 * Putting a document on the platform.
 *
 * ORDER OF OPERATIONS, AND WHY IT IS THIS WAY ROUND
 *
 *   1. validate the bytes
 *   2. write the bytes to storage, at a fresh unguessable key
 *   3. INSERT doc.document (+) doc.document_version inside one transaction
 *   4. if step 3 fails, delete the blob written in step 2
 *
 * The other order - row first, bytes second - is worse here, and the reason is
 * R4. doc.document and doc.document_version are append-only: UPDATE and DELETE
 * are revoked AND trigger-blocked. A row inserted before a failed upload can
 * never be removed. It would sit in the register for ever, pointing at a key
 * that holds nothing, and the only way to "fix" it is a withdrawal, which is a
 * permanent statement that a real document was withdrawn. That is a lie in the
 * record to cover a transient storage error.
 *
 * Failing the other way round leaves an orphan blob, which is invisible to
 * everyone, costs a few kilobytes, and is deleted in step 4 anyway. Step 4 is
 * the ONLY sanctioned call to StorageDriver.remove(), and it can only touch a
 * key that this request generated moments ago and that no row references.
 *
 * WHAT THE DATABASE STILL DECIDES. Nothing here checks who may upload what.
 * The INSERT runs as the actor's privilege role under the policies from
 * migration 0055: a project owner may insert only for a project its own
 * organisation owns and only in the three visibility classes that are its to
 * choose; an operator may insert anywhere. A bug in this file cannot turn an
 * owner into an operator, and a 42501 coming back out of here is the system
 * working.
 */

export async function uploadDocument(
  actor: Actor,
  request: UploadRequest,
): Promise<UploadResult> {
  const mediaType = normaliseMediaType(request.mediaType);
  const check = checkUpload(mediaType, request.bytes);
  if (!check.ok) throw new DocumentError(check.rejection.reason);

  const media = check.media;
  const driver = storageDriver();
  const key = newStorageKey(media.extension);
  const digest = createHash('sha256').update(request.bytes).digest();

  try {
    await driver.put(key, request.bytes);
  } catch (err) {
    logDocumentFailure('uploadDocument.put', err, { driver: driver.name });
    throw new DocumentError('storage_unavailable');
  }

  try {
    return await withActor(actor, async (tx) => insertDocumentRows(tx, {
      request, mediaType, key, digest, region: driver.region, bucket: driver.bucket,
    }));
  } catch (err) {
    // Step 4. Best effort: a blob that outlives a failed insert is harmless,
    // an exception thrown from a cleanup path is not.
    await driver.remove({ bucket: driver.bucket, key }).catch(() => { /* orphan */ });
    if (err instanceof DocumentError) throw err;
    logDocumentFailure('uploadDocument.insert', err, { driver: driver.name });
    throw err;
  }
}

export interface DocumentRowArgs {
  readonly request: UploadRequest;
  readonly mediaType: string;
  readonly key: string;
  readonly digest: Buffer;
  readonly region: string;
  readonly bucket: string;
}

/**
 * The DATABASE half of an upload, inside a transaction the caller owns.
 *
 * Split out from uploadDocument so that a test can run exactly this SQL, under
 * exactly these policies and triggers, inside a transaction that is rolled
 * back - see tests/db/rollback.ts for why every write test on this schema has
 * to work that way. Both tables are append-only, so a write test that
 * committed could never clean up after itself and would leave a document on a
 * real demo project's register for ever.
 */
export async function insertDocumentRows(
  tx: Tx,
  args: DocumentRowArgs,
): Promise<UploadResult> {
  const { request, mediaType, key, digest, region, bucket } = args;

  const documentId = request.supersedesDocumentId
    ?? await insertDocument(tx, request);

  const me = await tx.one<{ org_id: string; person_ref: string | null }>(
    'SELECT sylva.actor_org_id() AS org_id, sylva.actor_person_ref() AS person_ref',
  );

  const version = await tx.one<{ id: string; version_no: number }>(
    `INSERT INTO doc.document_version
       (document_id, version_no, storage_region, storage_bucket, storage_key,
        content_sha256, byte_size, media_type, locale,
        uploaded_by_org_id, uploaded_by_person_ref)
     SELECT $1::uuid,
            COALESCE((SELECT max(v.version_no) FROM doc.document_version v
                       WHERE v.document_id = $1::uuid), 0) + 1,
            $2, $3, $4, $5::bytea, $6::bigint, $7, $8, $9::uuid, $10::uuid
     RETURNING id, version_no`,
    [
      documentId, region, bucket, key, digest,
      String(request.bytes.length), mediaType, request.locale,
      me.org_id, me.person_ref,
    ],
  );

  return {
    documentId,
    versionId: version.id,
    versionNo: version.version_no,
    byteSize: request.bytes.length,
    contentSha256: digest.toString('hex'),
    storageRegion: region,
  };
}

async function insertDocument(tx: Tx, request: UploadRequest): Promise<string> {
  const a = request.anchor;
  if (a.scope === 'project') {
    const row = await tx.one<{ id: string }>(
      `INSERT INTO doc.document (scope, kind, visibility, project_id)
       VALUES ('project', $1, $2::doc.visibility_class, $3::uuid) RETURNING id`,
      [request.kind, request.visibility, a.projectId],
    );
    return row.id;
  }
  if (a.scope === 'deal') {
    const row = await tx.one<{ id: string }>(
      `INSERT INTO doc.document
         (scope, kind, visibility, project_id, deal_id,
          deal_buyer_org_id, deal_owner_org_id)
       VALUES ('deal', $1, $2::doc.visibility_class, $3::uuid, $4::uuid,
               $5::uuid, $6::uuid) RETURNING id`,
      [request.kind, request.visibility, a.projectId, a.dealId, a.buyerOrgId, a.ownerOrgId],
    );
    return row.id;
  }
  const row = await tx.one<{ id: string }>(
    `INSERT INTO doc.document (scope, kind, visibility, org_id)
     VALUES ('organisation', $1, $2::doc.visibility_class, $3::uuid) RETURNING id`,
    [request.kind, request.visibility, a.orgId],
  );
  return row.id;
}

/* ------------------------------------------------------------ integrity -- */

export type IntegrityResult =
  | { readonly ok: true; readonly byteSize: number }
  | { readonly ok: false; readonly reason: 'not_readable' | 'missing' | 'size' | 'digest' };

/**
 * Does the stored object still hash to what the record says it does?
 *
 * The serving route does NOT call this: hashing means buffering the whole file,
 * which would turn a streamed 40 MB download into 40 MB of server heap, and the
 * size check in serve.ts already catches the failure mode that actually occurs
 * (a truncated or missing object). This is for an operator's integrity sweep
 * and for the test that proves content_sha256 means something.
 */
export async function verifyStoredDocument(
  actor: Actor,
  documentId: string,
  versionNo: number | null = null,
): Promise<IntegrityResult> {
  const doc = await withActor(actor, async (tx) => {
    await tx.query('SET TRANSACTION READ ONLY');
    return findServableDocument(tx, documentId, versionNo);
  });
  if (!doc) return { ok: false, reason: 'not_readable' };

  const bytes = await storageDriver()
    .read({ bucket: doc.storageBucket, key: doc.storageKey })
    .catch(() => null);
  if (!bytes) return { ok: false, reason: 'missing' };
  if (bytes.length !== doc.byteSize) return { ok: false, reason: 'size' };

  const actual = createHash('sha256').update(bytes).digest();
  const expected = doc.contentSha256;
  const same = actual.length === expected.length && timingSafeEqual(actual, expected);
  return same ? { ok: true, byteSize: bytes.length } : { ok: false, reason: 'digest' };
}

/** The extension a stored media type downloads under. Null if not on the list,
 *  which for an already-stored row means it predates the allow-list. */
export function extensionFor(mediaType: string): string {
  return allowedMediaType(mediaType)?.extension ?? '';
}
