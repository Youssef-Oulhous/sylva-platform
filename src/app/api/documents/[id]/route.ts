import { getActor } from '@/lib/auth/session';
import { localeFromRequest, serveDocument } from '@/lib/documents/serve';

/**
 * GET /api/documents/<document id>
 *
 * The one way bytes leave this platform. Everything the route does before
 * calling serveDocument() is read the request; the authorisation happens
 * inside, as the viewer's own PostgreSQL role, under the row-level policies on
 * doc.document and doc.document_version.
 *
 * This is the scope-agnostic entry point - it serves a project document, a
 * deal-room document and an organisation document alike, because the policy
 * that decides each of those lives on the row, not on the URL. The project
 * page uses the project-scoped route next to it, which adds a check that the
 * document really belongs to the project in the path; both end up here.
 *
 * NO CACHING BY THE FRAMEWORK. force-dynamic and revalidate 0: a route whose
 * answer depends on who is asking must never be prerendered or cached by
 * Next.js, and the response's own Cache-Control is set per visibility class in
 * serve.ts.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(request, await params, false);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(request, await params, true);
}

async function handle(
  request: Request,
  params: { id: string },
  bodyless: boolean,
): Promise<Response> {
  const url = new URL(request.url);
  const actor = await getActor();
  return serveDocument(actor, params.id, {
    download: url.searchParams.has('download'),
    ifNoneMatch: request.headers.get('if-none-match'),
    locale: localeFromRequest(request),
    bodyless,
  });
}
