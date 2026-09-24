import { readAs } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import type { Tx } from '@/lib/db/session';
import type {
  DocumentListRow, DocumentScope, DocumentVisibility, ServableDocument,
} from './types';

/**
 * Reading a document, as the database decides it.
 *
 * THE AUTHORISATION IS THE QUERY. There is no `if (visibility === 'public')`
 * anywhere in this file, and there must never be one. The six visibility
 * classes are implemented by the row-level policies on doc.document and
 * doc.document_version (migration 0017, plus 0056 for the admin and auditor
 * classes). This query asks for a row by id; the policies decide whether a row
 * comes back. A viewer who may not see the document gets zero rows, which the
 * caller turns into a 404.
 *
 * That is not a stylistic preference. It is the property that makes the
 * serving route safe to review: the route can be read in one minute and the
 * only question it raises - "could this return someone else's document?" - is
 * answered by the policies and by tests/rls/matrix.ts, not by this code.
 *
 * WITHDRAWN VERSIONS. Migration 0010 says "every serving route joins against
 * this table and 404s". The policy on doc.document_version already hides a
 * withdrawn version from every application role, but NOT from the operator or
 * the auditor, who must still see that it existed. Seeing the row and being
 * served the bytes are different things, so the NOT EXISTS below is repeated
 * here in the serving query. It is the one filter in this file that is not
 * left to a policy, and it is deliberately redundant for five of the seven
 * roles.
 */

interface ServableRow extends Record<string, unknown> {
  document_id: string;
  scope: DocumentScope;
  kind: string;
  visibility: DocumentVisibility;
  project_id: string | null;
  project_slug: string | null;
  deal_id: string | null;
  org_id: string | null;
  version_id: string;
  version_no: number;
  storage_region: string;
  storage_bucket: string;
  storage_key: string;
  content_sha256: Buffer;
  byte_size: string;
  media_type: string;
  locale: string | null;
  uploaded_at: string;
  uploaded_by_org_id: string;
}

const SERVABLE_SQL = `
  SELECT d.id            AS document_id,
         d.scope,
         d.kind,
         d.visibility::text AS visibility,
         d.project_id,
         p.slug          AS project_slug,
         d.deal_id,
         d.org_id,
         v.id            AS version_id,
         v.version_no,
         v.storage_region,
         v.storage_bucket,
         v.storage_key,
         v.content_sha256,
         v.byte_size::text AS byte_size,
         v.media_type,
         v.locale,
         to_char(v.uploaded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SSZ') AS uploaded_at,
         v.uploaded_by_org_id
    FROM doc.document d
    JOIN doc.document_version v ON v.document_id = d.id
    LEFT JOIN proj.project p    ON p.id = d.project_id
   WHERE d.id = $1::uuid
     AND ($2::int IS NULL OR v.version_no = $2::int)
     AND NOT EXISTS (SELECT 1 FROM doc.document_withdrawal w
                      WHERE w.document_version_id = v.id)
   ORDER BY v.version_no DESC
   LIMIT 1`;

function toServable(r: ServableRow): ServableDocument {
  return {
    documentId: r.document_id,
    scope: r.scope,
    kind: r.kind,
    visibility: r.visibility,
    projectId: r.project_id,
    projectSlug: r.project_slug,
    dealId: r.deal_id,
    orgId: r.org_id,
    versionId: r.version_id,
    versionNo: r.version_no,
    storageRegion: r.storage_region,
    storageBucket: r.storage_bucket,
    storageKey: r.storage_key,
    contentSha256: r.content_sha256,
    // bigint arrives as text; Number is exact to 2^53 and a document is not.
    byteSize: Number(r.byte_size),
    mediaType: r.media_type,
    locale: r.locale,
    uploadedAt: r.uploaded_at,
    uploadedByOrgId: r.uploaded_by_org_id,
  };
}

/**
 * Inside an existing transaction. Exported so a test can run it as one role in
 * one unit of work, and so the bulk download can resolve many documents on one
 * connection rather than opening one transaction per file.
 */
export async function findServableDocument(
  tx: Tx,
  documentId: string,
  versionNo: number | null = null,
): Promise<ServableDocument | null> {
  const row = await tx.maybe<ServableRow>(SERVABLE_SQL, [documentId, versionNo]);
  return row ? toServable(row) : null;
}

/** The serving route's question, answered as this actor. Null means 404. */
export async function servableDocument(
  actor: Actor,
  documentId: string,
  versionNo: number | null = null,
): Promise<ServableDocument | null> {
  return readAs(actor, (tx) => findServableDocument(tx, documentId, versionNo));
}

/* ------------------------------------------------------------- registers -- */

interface ListRow extends Record<string, unknown> {
  document_id: string;
  version_id: string | null;
  kind: string;
  visibility: DocumentVisibility;
  version_no: number | null;
  media_type: string | null;
  byte_size: string | null;
  uploaded_at: string | null;
  locale: string | null;
}

/**
 * The document register for one project.
 *
 * The LEFT JOIN LATERAL is what produces `available: false`: a document whose
 * only readable version has been withdrawn still appears, with nothing to
 * download. That is deliberate. A register that silently drops a withdrawn
 * document tells a reader that it never existed, and on a platform whose whole
 * claim is an append-only record, that is the wrong lie to tell.
 */
const PROJECT_LIST_SQL = `
  SELECT d.id AS document_id, d.kind, d.visibility::text AS visibility,
         v.id AS version_id,
         v.version_no, v.media_type, v.byte_size::text AS byte_size,
         v.locale,
         to_char(v.uploaded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SSZ') AS uploaded_at
    FROM doc.document d
    LEFT JOIN LATERAL (
      SELECT x.* FROM doc.document_version x
       WHERE x.document_id = d.id
         AND NOT EXISTS (SELECT 1 FROM doc.document_withdrawal w
                          WHERE w.document_version_id = x.id)
       ORDER BY x.version_no DESC
       LIMIT 1) v ON true
   WHERE d.project_id = $1::uuid
   ORDER BY d.kind, d.created_at`;

function toListRow(r: ListRow): DocumentListRow {
  return {
    documentId: r.document_id,
    versionId: r.version_id,
    kind: r.kind,
    visibility: r.visibility,
    versionNo: r.version_no,
    mediaType: r.media_type,
    byteSize: r.byte_size === null ? null : Number(r.byte_size),
    uploadedAt: r.uploaded_at,
    locale: r.locale,
    available: r.version_no !== null,
  };
}

export async function listProjectDocuments(
  actor: Actor,
  projectId: string,
): Promise<DocumentListRow[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<ListRow>(PROJECT_LIST_SQL, [projectId]);
    return rows.map(toListRow);
  });
}

/** Every document of a project this viewer may actually be served, in one
 *  transaction. Used by the bulk download. */
export async function servableProjectDocuments(
  actor: Actor,
  projectSlug: string,
): Promise<{ projectId: string; documents: ServableDocument[] } | null> {
  return readAs(actor, async (tx) => {
    const project = await tx.maybe<{ id: string }>(
      'SELECT id FROM proj.project WHERE slug = $1',
      [projectSlug],
    );
    if (!project) return null;

    const ids = await tx.query<{ id: string }>(
      'SELECT id FROM doc.document WHERE project_id = $1::uuid ORDER BY kind, created_at',
      [project.id],
    );
    const documents: ServableDocument[] = [];
    for (const { id } of ids) {
      const doc = await findServableDocument(tx, id);
      if (doc) documents.push(doc);
    }
    return { projectId: project.id, documents };
  });
}

/** The project's id and slug, as this viewer may see them. Null when the
 *  project is not published and this viewer is not entitled to a draft. */
export async function projectRef(
  actor: Actor,
  slug: string,
): Promise<{ id: string; slug: string } | null> {
  return readAs(actor, (tx) => tx.maybe<{ id: string; slug: string }>(
    'SELECT id, slug FROM proj.project WHERE slug = $1',
    [slug],
  ));
}
