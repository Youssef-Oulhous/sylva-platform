/**
 * A boundary drawn as an inline SVG, with no basemap.
 *
 * Deliberate: a tiled basemap means every card on the index sends a request to
 * a tile provider, which discloses to that provider what the visitor is looking
 * at. Which provider Sylva uses is still an OPEN DECISION, and until it is
 * settled the index must not depend on one. The full map with a satellite
 * basemap belongs on the project page, where the disclosure is one project and
 * the user has chosen to look at it.
 *
 * The geometry here is already simplified server-side.
 */
export default function BoundaryThumb({
  geojson,
  label,
}: {
  geojson: string | null;
  label: string;
}) {
  if (!geojson) return null;

  let rings: number[][][];
  try {
    const g = JSON.parse(geojson) as
      | { type: 'Polygon'; coordinates: number[][][] }
      | { type: 'MultiPolygon'; coordinates: number[][][][] };
    rings = g.type === 'MultiPolygon' ? g.coordinates.flat() : g.coordinates;
  } catch {
    return null;
  }
  const pts = rings.flat();
  if (pts.length < 3) return null;

  const xs = pts.map((p) => p[0]!);
  const ys = pts.map((p) => p[1]!);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1e-6;
  const h = maxY - minY || 1e-6;
  const pad = 0.12;

  // Latitude is flipped for screen coordinates. No projection beyond that: at
  // the size of a thumbnail a proper projection would change nothing visible.
  const path = rings
    .map(
      (ring) =>
        ring
          .map((p, i) => {
            const x = ((p[0]! - minX) / w) * (1 - 2 * pad) + pad;
            const y = 1 - (((p[1]! - minY) / h) * (1 - 2 * pad) + pad);
            return `${i === 0 ? 'M' : 'L'}${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`;
          })
          .join(' ') + ' Z',
    )
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <rect width="100" height="100" fill="var(--surface-sunk)" />
      <path
        d={path}
        fill="var(--tint-bio)"
        stroke="var(--forest)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
