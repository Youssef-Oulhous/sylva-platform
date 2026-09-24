import { getActor } from '@/lib/auth/session';
import { readAs } from '@/lib/db/session';
import { documentRefusal, localeFromRequest } from '@/lib/documents/serve';
import { logDocumentFailure } from '@/lib/documents/errors';

/**
 * GET /api/projects/<slug>/boundary.geojson
 *
 * "Boundaries are GeoJSON; the file should be downloadable" - concept note,
 * section 6. The catchment panel on the project page links here.
 *
 * WHY THIS IS NOT A DOCUMENT DOWNLOAD. geo.project_geometry holds the
 * authoritative geometry and may also carry geojson_document_version_id, a
 * reference to the file it was loaded from. Serving the stored FILE would
 * serve whatever was uploaded, which can differ from what the map draws after
 * a reprojection or a repair. Serving geo.project_boundary_geojson() serves
 * the geometry the platform actually holds, at full precision, with its source
 * label, licence and as-of date in the Feature's properties - so the file a
 * reader takes away carries its provenance the way every figure on screen
 * does.
 *
 * Authorisation is the row-level policy on geo.project_geometry, reached
 * through the actor's own role. The function is granted to every reading role
 * but it reads that table, so a draft project's boundary does not come back to
 * a visitor who may not see the draft.
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

  let feature: unknown = null;
  let isPublic = false;
  try {
    const row = await readAs(actor, async (tx) => tx.maybe<{
      feature: unknown; published: boolean;
    }>(
      `SELECT geo.project_boundary_geojson(p.id) AS feature,
              (p.status = 'published')          AS published
         FROM proj.project p
        WHERE p.slug = $1`,
      [slug],
    ));
    feature = row?.feature ?? null;
    isPublic = row?.published === true;
  } catch (err) {
    logDocumentFailure('boundaryGeojson.read', err, { slug });
    return documentRefusal('unavailable', 503, locale);
  }

  if (feature === null) return documentRefusal('document_not_found', 404, locale);

  const body = `${JSON.stringify(feature, null, 2)}\n`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug.replace(/[^a-z0-9-]+/gi, '-')}-boundary.geojson"`,
      'Cache-Control': isPublic
        ? 'public, max-age=3600, must-revalidate'
        : 'private, no-store, max-age=0',
      ...(isPublic ? {} : { Vary: 'Cookie', 'X-Robots-Tag': 'noindex, nofollow' }),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
