import { getTranslations } from 'next-intl/server';
import type { Actor } from '@/lib/db/actor';
import { storageDriver } from '@/lib/storage';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { documentMessage, logDocumentFailure, type DocumentErrorCode } from './errors';
import { downloadFileName } from './keys';
import { allowedMediaType } from './media';
import { servableDocument } from './queries';
import type { ServableDocument } from './types';

/**
 * Turning an authorised document into an HTTP response.
 *
 * A DOCUMENT IS NEVER SERVED FROM A PUBLIC URL. There is no route that maps a
 * storage key to a file and no signed URL is minted by this module. Every byte
 * leaves through here, after servableDocument() has already been filtered by
 * the row-level policies as the viewer's own database role. The storage key is
 * an internal detail that never appears in a URL, a page, or a header.
 *
 * NOT FOUND AND NOT ALLOWED ARE THE SAME ANSWER. A 403 that said "this exists
 * but is not for you" would make a document id an oracle: an attacker with a
 * list of ids could learn which projects have an investor-only financial model
 * and which deals have a signed letter of intent, without ever reading one.
 * Both cases are 404, with one sentence, and the distinction is recorded only
 * in the server log.
 */

export interface ServeOptions {
  /** ?download=1 - force an attachment even for a PDF. */
  readonly download?: boolean;
  /** When set, the document must belong to this project. The project-scoped
   *  route passes it so that /projects/A/documents/<a document of B> is a 404
   *  rather than a working link under a misleading path. */
  readonly expectProjectSlug?: string;
  /** For If-None-Match. */
  readonly ifNoneMatch?: string | null;
  /** HEAD: every header, no body. */
  readonly bodyless?: boolean;
  /** Which language the refusal is written in. */
  readonly locale?: string;
}

export async function serveDocument(
  actor: Actor,
  documentId: string,
  options: ServeOptions = {},
): Promise<Response> {
  if (!isUuid(documentId)) return refuse('document_not_found', 404, options.locale);

  let doc: ServableDocument | null;
  try {
    doc = await servableDocument(actor, documentId);
  } catch (err) {
    logDocumentFailure('serveDocument.read', err, { documentId });
    return refuse('unavailable', 503, options.locale);
  }

  if (!doc) return refuse('document_not_found', 404, options.locale);

  if (options.expectProjectSlug && doc.projectSlug !== options.expectProjectSlug) {
    // Not a leak either way: the viewer could already read this document, it
    // is just not under the path they asked for.
    return refuse('document_not_found', 404, options.locale);
  }

  const etag = `"${doc.contentSha256.toString('hex')}"`;
  if (options.ifNoneMatch && matchesEtag(options.ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers: baseHeaders(doc, etag) });
  }

  const ref = { bucket: doc.storageBucket, key: doc.storageKey };
  const driver = storageDriver();

  let storedSize: number | null;
  try {
    storedSize = await driver.size(ref);
  } catch (err) {
    logDocumentFailure('serveDocument.size', err, { documentId, versionId: doc.versionId });
    return refuse('storage_mismatch', 502, options.locale);
  }

  if (storedSize === null) {
    // The register says a document exists and the store does not have it. That
    // is a real fault and an operator needs to know; the reader gets a sentence
    // that does not pretend the document was never there.
    logDocumentFailure('serveDocument.missing', new Error('stored object absent'), {
      documentId, versionId: doc.versionId, region: doc.storageRegion,
    });
    return refuse('storage_mismatch', 502, options.locale);
  }

  if (storedSize !== doc.byteSize) {
    // The recorded size is part of the record. Serving bytes that disagree with
    // it would serve something the platform cannot vouch for.
    logDocumentFailure('serveDocument.sizeMismatch', new Error('size disagrees with record'), {
      documentId, versionId: doc.versionId, recorded: doc.byteSize, stored: storedSize,
    });
    return refuse('storage_mismatch', 502, options.locale);
  }

  const headers = baseHeaders(doc, etag);
  headers.set('Content-Length', String(doc.byteSize));
  headers.set('Content-Disposition', disposition(doc, options.download === true));

  if (options.bodyless) return new Response(null, { status: 200, headers });

  const opened = await driver.open(ref).catch((err: unknown) => {
    logDocumentFailure('serveDocument.open', err, { documentId });
    return null;
  });
  if (!opened) return refuse('storage_mismatch', 502, options.locale);

  return new Response(opened.stream, { status: 200, headers });
}

/* ------------------------------------------------------------- headers --- */

function baseHeaders(doc: ServableDocument, etag: string): Headers {
  const headers = new Headers();
  headers.set('Content-Type', contentType(doc.mediaType));
  headers.set('ETag', etag);

  // The browser must not second-guess the type. Without this a file we have
  // sniffed and stored as text/csv could still be rendered as HTML by a
  // browser doing content sniffing, in this origin.
  headers.set('X-Content-Type-Options', 'nosniff');

  // Defence in depth for the formats served inline. 'sandbox' with no tokens
  // denies scripts, forms, popups and same-origin credentials to the embedded
  // document; the PDF viewer and the image decoder do not need any of them.
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");

  if (doc.visibility === 'public') {
    // A published project's idea note is public material and caching it is
    // wanted. Still revalidated, so a withdrawal takes effect within the hour.
    headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  } else {
    // Everything else is one organisation's. no-store, and Vary: Cookie so
    // that no intermediary can key a restricted document on the URL alone.
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('Vary', 'Cookie');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return headers;
}

function contentType(mediaType: string): string {
  // Text formats need a charset or the browser guesses, and its guess is
  // locale-dependent. Everything stored here is UTF-8: media.ts refuses text
  // that is not valid UTF-8.
  if (mediaType.startsWith('text/') || mediaType === 'application/json'
      || mediaType === 'application/geo+json') {
    return `${mediaType}; charset=utf-8`;
  }
  return mediaType;
}

/**
 * The download name is rebuilt from the kind and the version. The uploader's
 * file name is never stored and therefore cannot reach this header - which is
 * where a name containing a quote, a newline or a right-to-left override would
 * otherwise do its work.
 */
function disposition(doc: ServableDocument, forceDownload: boolean): string {
  const media = allowedMediaType(doc.mediaType);
  const name = downloadFileName(doc.kind, doc.versionNo, media?.extension ?? '');
  const inline = !forceDownload && media?.inline === true;
  return `${inline ? 'inline' : 'attachment'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/* -------------------------------------------------------------- refusal --- */

/**
 * A refusal a person can read.
 *
 * text/plain rather than JSON: these URLs are followed by a browser clicking a
 * link in a document register, and a sentence is what should appear. The
 * message key travels in a header so that a client that has the catalogue can
 * localise it, and the body is localised here when the catalogue already has
 * the key - the English sentence is the fallback until it does.
 */
async function refuse(
  code: DocumentErrorCode,
  status: number,
  locale?: string,
): Promise<Response> {
  const message = documentMessage(code);
  const key = message?.key ?? `documentError.${code}`;
  let body = message?.fallbackEn ?? 'This document is not available.';

  if (!message) {
    // Codes that belong to the shared auth vocabulary keep their sentence.
    const { authMessage, isAuthErrorCode } = await import('@/lib/auth/errors');
    if (isAuthErrorCode(code)) body = authMessage(code).fallbackEn;
  }

  const wanted = locale && isLocale(locale) ? locale : defaultLocale;
  try {
    const t = await getTranslations({ locale: wanted });
    if (t.has(key)) body = t(key);
  } catch {
    // No request-scoped i18n here, or the key is absent. The English sentence
    // above is a real sentence, not a code, so this is a degradation and not a
    // failure. See src/lib/auth/errors.ts for the same argument.
  }

  return new Response(`${body}\n`, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Sylva-Message-Key': key,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** Exported so the bulk route and the boundary route refuse identically. */
export { refuse as documentRefusal };

/* --------------------------------------------------------------- small --- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function matchesEtag(header: string, etag: string): boolean {
  if (header.trim() === '*') return true;
  return header.split(',').some((candidate) => {
    const v = candidate.trim().replace(/^W\//, '');
    return v === etag;
  });
}

/** next-intl writes NEXT_LOCALE; API routes sit outside the [locale] segment
 *  and so have no locale of their own to read. */
export function localeFromRequest(request: Request): string {
  const cookie = request.headers.get('cookie') ?? '';
  const match = /(?:^|;\s*)NEXT_LOCALE=([A-Za-z-]+)/.exec(cookie);
  const value = match?.[1];
  return value && isLocale(value) ? value : defaultLocale;
}
