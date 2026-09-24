import { getActor } from '@/lib/auth/session';
import { documentRefusal, localeFromRequest } from '@/lib/documents/serve';
import { downloadFileName } from '@/lib/documents/keys';
import { allowedMediaType } from '@/lib/documents/media';
import { servableProjectDocuments } from '@/lib/documents/queries';
import { logDocumentFailure } from '@/lib/documents/errors';
import { storageDriver } from '@/lib/storage';
import { zipStream, type ZipMember } from '@/lib/documents/zip';

/**
 * GET /api/projects/<slug>/documents.zip
 *
 * "Download all documents" on the project page.
 *
 * THE ARCHIVE CONTAINS WHAT THIS VIEWER MAY READ, AND NOTHING ELSE. It is
 * assembled from servableProjectDocuments(), which runs the same
 * per-document query as the single-file route, once per document, inside one
 * read-only transaction as the viewer's own role. An anonymous visitor gets
 * the public documents; a vetted investor's archive additionally holds the
 * financial model; nobody's archive holds a deal document from a deal they are
 * not party to. There is no "include everything for convenience" branch here
 * and there must never be one: a bulk download is where such a branch would be
 * least visible and most damaging.
 *
 * A MANIFEST IS INCLUDED. Every figure on this platform carries its source and
 * date; a zip of unlabelled PDFs would throw that away at the moment a reader
 * takes the documents off the platform. MANIFEST.txt states, per file, the
 * document kind, the version, the upload date, the SHA-256 recorded on the
 * platform and the visibility class it was served under.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const locale = localeFromRequest(request);
  const actor = await getActor();

  let found: Awaited<ReturnType<typeof servableProjectDocuments>>;
  try {
    found = await servableProjectDocuments(actor, slug);
  } catch (err) {
    logDocumentFailure('documentsZip.read', err, { slug });
    return documentRefusal('unavailable', 503, locale);
  }

  // No project this viewer may see, or a project with nothing in it for them.
  if (!found || found.documents.length === 0) {
    return documentRefusal('document_not_found', 404, locale);
  }

  const driver = storageDriver();
  const used = new Set<string>();
  const members: ZipMember[] = [];
  const manifest: string[] = [
    `Sylva document register - project ${slug}`,
    `Assembled ${new Date().toISOString()}`,
    '',
    'Each file below is served under the visibility class shown. The SHA-256 is',
    'the digest recorded on the platform when the version was uploaded; it is',
    'what an auditor compares a downloaded copy against.',
    '',
  ];

  for (const doc of found.documents) {
    const extension = allowedMediaType(doc.mediaType)?.extension ?? '';
    const name = unique(used, downloadFileName(doc.kind, doc.versionNo, extension));
    members.push({
      name,
      modified: new Date(doc.uploadedAt),
      bytes: async () => {
        const bytes = await driver.read({ bucket: doc.storageBucket, key: doc.storageKey });
        if (!bytes) {
          // A member the store has lost. The archive still carries the rest;
          // the manifest already names it, so the gap is visible rather than
          // silent.
          logDocumentFailure('documentsZip.missing', new Error('stored object absent'), {
            documentId: doc.documentId, versionId: doc.versionId,
          });
          return Buffer.from(
            `This document could not be read from storage when the archive was built.\n`
            + `Document ${doc.documentId}, version ${doc.versionNo}.\n`,
            'utf8',
          );
        }
        return bytes;
      },
    });
    manifest.push(
      `${name}`,
      `  kind        ${doc.kind}`,
      `  version     ${doc.versionNo}`,
      `  uploaded    ${doc.uploadedAt}`,
      `  media type  ${doc.mediaType}`,
      `  bytes       ${doc.byteSize}`,
      `  sha256      ${doc.contentSha256.toString('hex')}`,
      `  visibility  ${doc.visibility}`,
      '',
    );
  }

  const manifestBytes = Buffer.from(manifest.join('\n'), 'utf8');
  members.unshift({ name: 'MANIFEST.txt', bytes: async () => manifestBytes });

  const archiveName = `${slug.replace(/[^a-z0-9-]+/gi, '-')}-documents.zip`;
  return new Response(zipStream(members), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      // Length is unknown until the last member is read, so the archive is
      // sent chunked. That is what streaming buys, and a progress bar without
      // a total is a fair price for not holding 160 MB in heap per request.
      'Content-Disposition': `attachment; filename="${archiveName}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function unique(used: Set<string>, name: string): string {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n += 1) {
    const candidate = `${stem}-${n}${ext}`;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
}
