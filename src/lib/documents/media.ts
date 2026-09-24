/**
 * What may be uploaded, how big, and whether the bytes are what the upload
 * claims they are.
 *
 * Three separate checks, and all three have to pass. They fail differently on
 * purpose, because the person can act on each:
 *
 *   1. ALLOW-LIST. A media type not on this list is refused by name. The list
 *      is short because the platform shows a short list of things: the project
 *      idea note, the design document, the monitoring plan, verification
 *      reports, boundaries, the financial model. Anything else is 'other' and
 *      still has to be one of these formats.
 *
 *   2. SIZE. Per-type, not one global number: a 25 MB "GeoJSON boundary" is
 *      either a mistake or an attempt to make the map page unusable, and
 *      saying so is more useful than a generic limit.
 *
 *   3. SNIFF. The claimed type is checked against the leading bytes. This is
 *      the check that matters and it is not about file extensions. A browser
 *      sets Content-Type from the file name, so `payload.html` renamed to
 *      `report.pdf` arrives claiming application/pdf. Serving that back with
 *      Content-Type: application/pdf is safe, but a store that accepts it is a
 *      store that will hand a future, less careful serving route an HTML
 *      document. Refuse it at the door.
 *
 * What this is NOT: virus scanning. A PDF can be a valid PDF and still be
 * hostile. Scanning needs a scanner, which is a deployment decision and a new
 * dependency; the README says so in "Not yet done" and this comment is the
 * second place it is said.
 */

export const MiB = 1024 * 1024;

export interface AllowedMediaType {
  /** The IANA type, exactly as it is written to doc.document_version. */
  readonly mediaType: string;
  /** The extension used when building a download file name. With the dot. */
  readonly extension: string;
  readonly maxBytes: number;
  /** True when these bytes can be this type. */
  readonly sniff: (bytes: Buffer) => boolean;
  /**
   * Whether a browser may render it in a tab rather than download it.
   * Inline rendering of an uploaded file runs it in THIS origin, so only
   * formats that cannot carry script are inline: a PDF (rendered by the
   * browser's sandboxed viewer), a PNG and a JPEG. JSON, CSV and XLSX are
   * always an attachment. SVG and HTML are not on the list at all, for the
   * same reason.
   */
  readonly inline: boolean;
}

function startsWith(bytes: Buffer, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

/** Valid UTF-8, and no control characters other than tab, CR and LF. */
function isPlainText(bytes: Buffer): boolean {
  if (bytes.includes(0x00)) return false;
  const text = bytes.toString('utf8');
  // Node substitutes U+FFFD for invalid sequences; a round trip that changes
  // length is a round trip that was not valid UTF-8 to begin with.
  if (Buffer.byteLength(text, 'utf8') !== bytes.length) return false;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false;
  }
  return true;
}

function isJson(bytes: Buffer): boolean {
  if (!isPlainText(bytes)) return false;
  try {
    JSON.parse(bytes.toString('utf8'));
    return true;
  } catch {
    return false;
  }
}

/** GeoJSON is JSON with a `type` member drawn from the RFC 7946 set. */
function isGeoJson(bytes: Buffer): boolean {
  if (!isPlainText(bytes)) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null) return false;
  const type = (parsed as { type?: unknown }).type;
  return typeof type === 'string' && [
    'FeatureCollection', 'Feature', 'Point', 'MultiPoint', 'LineString',
    'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection',
  ].includes(type);
}

/**
 * An OOXML workbook is a ZIP whose FIRST local file header names
 * `[Content_Types].xml`. Checking the header rather than just `PK\x03\x04`
 * rejects an ordinary .zip renamed to .xlsx. It does NOT distinguish a .docx
 * from a .xlsx - both are OOXML - and pretending otherwise would be a comment
 * that lies. The consequence of that gap is small: both are attachments,
 * neither is rendered, and the kind is chosen by the uploader anyway.
 */
function isOoxml(bytes: Buffer): boolean {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false;
  if (bytes.length < 30) return false;
  const nameLength = bytes.readUInt16LE(26);
  if (nameLength === 0 || 30 + nameLength > bytes.length) return false;
  return bytes.subarray(30, 30 + nameLength).toString('latin1') === '[Content_Types].xml';
}

export const ALLOWED_MEDIA_TYPES: readonly AllowedMediaType[] = Object.freeze([
  {
    mediaType: 'application/pdf',
    extension: '.pdf',
    maxBytes: 40 * MiB,
    // %PDF-  . The header may legally be preceded by junk, but a file that
    // does not start with it is not a file this platform is going to accept.
    sniff: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
    inline: true,
  },
  {
    mediaType: 'application/geo+json',
    extension: '.geojson',
    maxBytes: 10 * MiB,
    sniff: isGeoJson,
    inline: false,
  },
  {
    mediaType: 'application/json',
    extension: '.json',
    maxBytes: 10 * MiB,
    sniff: isJson,
    inline: false,
  },
  {
    mediaType: 'text/csv',
    extension: '.csv',
    maxBytes: 10 * MiB,
    sniff: isPlainText,
    inline: false,
  },
  {
    mediaType: 'image/png',
    extension: '.png',
    maxBytes: 8 * MiB,
    sniff: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    inline: true,
  },
  {
    mediaType: 'image/jpeg',
    extension: '.jpg',
    maxBytes: 8 * MiB,
    sniff: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
    inline: true,
  },
  {
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
    maxBytes: 25 * MiB,
    sniff: isOoxml,
    inline: false,
  },
]);

const BY_TYPE = new Map(ALLOWED_MEDIA_TYPES.map((m) => [m.mediaType, m]));

export function allowedMediaType(mediaType: string): AllowedMediaType | null {
  return BY_TYPE.get(normaliseMediaType(mediaType)) ?? null;
}

/** 'Application/PDF; charset=binary' and 'application/pdf' are the same type. */
export function normaliseMediaType(value: string): string {
  return value.split(';')[0]!.trim().toLowerCase();
}

export type MediaRejection =
  | { readonly reason: 'media_type_not_allowed'; readonly mediaType: string }
  | { readonly reason: 'file_empty' }
  | { readonly reason: 'file_too_large'; readonly maxBytes: number; readonly byteSize: number }
  | { readonly reason: 'content_does_not_match_type'; readonly mediaType: string };

export type MediaCheck =
  | { readonly ok: true; readonly media: AllowedMediaType }
  | { readonly ok: false; readonly rejection: MediaRejection };

/**
 * The whole gate, in the order that gives the most useful message: a type we
 * will never take, then a file that is empty, then one that is too big, then
 * one whose bytes disagree with its label.
 *
 * A global ceiling can be lowered (never raised) with SYLVA_MAX_UPLOAD_BYTES,
 * so a deployment behind a proxy with its own body limit can match it and get
 * this sentence instead of the proxy's 413.
 */
export function checkUpload(mediaType: string, bytes: Buffer): MediaCheck {
  const media = allowedMediaType(mediaType);
  if (!media) {
    return {
      ok: false,
      rejection: { reason: 'media_type_not_allowed', mediaType: normaliseMediaType(mediaType) },
    };
  }
  if (bytes.length === 0) {
    return { ok: false, rejection: { reason: 'file_empty' } };
  }

  const ceiling = globalCeiling();
  const maxBytes = ceiling === null ? media.maxBytes : Math.min(media.maxBytes, ceiling);
  if (bytes.length > maxBytes) {
    return {
      ok: false,
      rejection: { reason: 'file_too_large', maxBytes, byteSize: bytes.length },
    };
  }

  if (!media.sniff(bytes)) {
    return {
      ok: false,
      rejection: { reason: 'content_does_not_match_type', mediaType: media.mediaType },
    };
  }
  return { ok: true, media };
}

function globalCeiling(): number | null {
  const raw = process.env.SYLVA_MAX_UPLOAD_BYTES;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
