import { getActor } from '@/lib/auth/session';
import { localeFromRequest, serveDocument } from '@/lib/documents/serve';

/**
 * GET /api/projects/<slug>/documents/<document id>
 *
 * The link the project page's document register emits. It differs from
 * /api/documents/<id> in exactly one way: the document must belong to the
 * project named in the path. That is not an authorisation check - the policies
 * have already decided whether this viewer may read the row - it is a check
 * that the URL means what it says, so a link copied out of one project's page
 * cannot quietly serve another project's file under that project's name.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  return handle(request, await params, false);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  return handle(request, await params, true);
}

async function handle(
  request: Request,
  params: { slug: string; id: string },
  bodyless: boolean,
): Promise<Response> {
  const url = new URL(request.url);
  const actor = await getActor();
  return serveDocument(actor, params.id, {
    download: url.searchParams.has('download'),
    expectProjectSlug: params.slug,
    ifNoneMatch: request.headers.get('if-none-match'),
    locale: localeFromRequest(request),
    bodyless,
  });
}
