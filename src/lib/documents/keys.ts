import { randomBytes } from 'node:crypto';

/**
 * Storage keys.
 *
 * The rule is one sentence: a storage key must not be guessable, and it must
 * not describe what it holds.
 *
 * WHY, concretely. On the local driver the key is never reachable over HTTP at
 * all, so guessing it buys nothing. On an S3-compatible store it is different:
 * a signed URL carries the key, keys end up in provider access logs, in
 * lifecycle rules and in support tickets, and a bucket whose ACL is loosened by
 * accident for ten minutes turns every predictable key into a download. A key
 * of the shape `projects/untere-havel/financial-model-v2.pdf` would then leak
 * both the bytes and, from the key alone, the fact that an investor-only
 * financial model exists for a named project.
 *
 * So a key carries 192 bits of randomness and nothing else but a coarse date
 * partition and the file extension:
 *
 *     documents/2026/09/HqE2c9P4bH8k8s1pQ0fJc9y4zVQnLm3T.pdf
 *
 * The date partition is there because object stores list better that way and
 * because it makes a retention rule expressible; it discloses only that
 * something was uploaded that month, which the document's own uploaded_at
 * already says to anyone allowed to see the row.
 *
 * The extension is kept so that a human staring at a bucket, or a storage
 * lifecycle rule, can tell a PDF from a workbook. It says nothing the media
 * type on the row does not already say to the same reader.
 *
 * NOT in the key: the project, the organisation, the deal, the document kind,
 * the visibility class, the uploader, or the original file name. The original
 * file name in particular is attacker-controlled and is thrown away on
 * purpose - the download name is rebuilt from the document's kind and version
 * in serve.ts, so a file called `..\..\invoice.pdf` or one with an RTL
 * override in it cannot reach a Content-Disposition header.
 */

const PREFIX = 'documents';

/** 24 random bytes, base64url: 192 bits, no padding, key-safe characters. */
export function newStorageKey(extension: string, now: Date = new Date()): string {
  const year = now.getUTCFullYear().toString().padStart(4, '0');
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${PREFIX}/${year}/${month}/${randomSegment()}${safeExtension(extension)}`;
}

/**
 * base64url can begin with '-' or '_', and a key segment must begin with an
 * alphanumeric - assertValidStorageKey in src/lib/storage/types.ts insists on
 * it, because a name starting with a dash is an argument to half the command
 * line tools an operator would ever point at a bucket.
 *
 * Redrawing rather than rewriting the offending character: rewriting would make
 * two of the sixty-four possible first characters three times as likely as the
 * rest, and a key generator with a biased first character is a key generator
 * somebody will eventually have to reason about. Sixty-two of the sixty-four
 * characters pass, so the first draw is accepted about thirty-one times in
 * thirty-two.
 */
function randomSegment(): string {
  for (;;) {
    const candidate = randomBytes(24).toString('base64url');
    if (/^[A-Za-z0-9]/.test(candidate)) return candidate;
  }
}

/** Only ever one of the extensions in the media allow-list; belt and braces. */
function safeExtension(extension: string): string {
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '';
}

/**
 * The name the browser saves the file under. Built from the document's kind
 * and version, never from anything the uploader typed.
 *
 *   project_design_document + v2 + .pdf  ->  project-design-document-v2.pdf
 */
export function downloadFileName(
  kind: string,
  versionNo: number,
  extension: string,
): string {
  const stem = kind.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    || 'document';
  return `${stem}-v${versionNo}${safeExtension(extension)}`;
}
