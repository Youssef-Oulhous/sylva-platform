import { codeForDatabaseError, type AuthErrorCode } from '@/lib/auth/errors';
import type { MediaRejection } from './media';

/**
 * Document failures, as sentences.
 *
 * Same contract as src/lib/auth/errors.ts and for the same reason: a person
 * gets something they can act on, an operator gets the SQLSTATE in the log,
 * and a stranger is told nothing about what tables or files exist. The one
 * addition here is that an upload can fail for reasons that are the person's
 * to fix - the wrong format, a file that is too big - and those deserve a
 * specific sentence rather than "check the highlighted section".
 *
 * Note what is NOT distinguished: 'not found' and 'not allowed to see it' are
 * the same answer. A serving route that said "this document exists but is not
 * for you" would turn a document id into an oracle for which projects have an
 * investor-only financial model. See serve.ts.
 */

export type DocumentErrorCode =
  | AuthErrorCode
  | 'document_not_found'
  | 'media_type_not_allowed'
  | 'file_empty'
  | 'file_too_large'
  | 'content_does_not_match_type'
  | 'storage_unavailable'
  | 'storage_mismatch';

interface Message {
  readonly key: string;
  readonly fallbackEn: string;
}

const MESSAGES: Record<string, Message> = {
  document_not_found: {
    key: 'documentError.notFound',
    fallbackEn: "This document is not available. It may have been withdrawn, or you may not have access to it.",
  },
  media_type_not_allowed: {
    key: 'documentError.mediaTypeNotAllowed',
    fallbackEn: 'That file format is not accepted. Upload a PDF, a GeoJSON or JSON file, a CSV, a PNG or JPEG image, or an Excel workbook.',
  },
  file_empty: {
    key: 'documentError.fileEmpty',
    fallbackEn: 'That file is empty. Choose the file again.',
  },
  file_too_large: {
    key: 'documentError.fileTooLarge',
    fallbackEn: 'That file is larger than this platform accepts for its format.',
  },
  content_does_not_match_type: {
    key: 'documentError.contentDoesNotMatchType',
    fallbackEn: 'The contents of that file do not match the format its name claims. Check that the file is not damaged and that it has the right extension.',
  },
  storage_unavailable: {
    key: 'documentError.storageUnavailable',
    fallbackEn: 'The document store did not accept the file. Nothing was recorded. Try again shortly.',
  },
  storage_mismatch: {
    key: 'documentError.storageMismatch',
    fallbackEn: 'This document is recorded on the platform but its stored copy could not be confirmed, so it has not been served. Sylva has been notified.',
  },
};

export function documentMessage(code: DocumentErrorCode): Message | null {
  return MESSAGES[code] ?? null;
}

export function codeForMediaRejection(rejection: MediaRejection): DocumentErrorCode {
  return rejection.reason;
}

/** Database SQLSTATE -> a code. Delegates, so the two layers cannot drift. */
export function codeForDocumentError(err: unknown): DocumentErrorCode {
  return codeForDatabaseError(err);
}

export class DocumentError extends Error {
  constructor(readonly code: DocumentErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DocumentError';
  }
}

/** What goes in the log. Never the bytes, never the storage key. */
export function logDocumentFailure(
  where: string,
  err: unknown,
  context: Readonly<Record<string, string | number | null>> = {},
): void {
  const e = err as { code?: unknown; message?: unknown } | null;
  console.error(JSON.stringify({
    level: 'error',
    msg: 'document failure',
    where,
    ...context,
    sqlstate: typeof e?.code === 'string' ? e.code : null,
    detail: typeof e?.message === 'string' ? e.message : String(err),
  }));
}
