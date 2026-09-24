/**
 * The shapes the document layer works in.
 *
 * `DocumentVisibility` repeats the doc.visibility_class enum from migration
 * 0010 rather than importing the project page's copy, because this module is
 * the one that has to reason about all six classes and a divergence here
 * should be a type error rather than a silent widening.
 */

export type DocumentVisibility =
  | 'public'
  | 'vetted_buyer'
  | 'vetted_investor'
  | 'deal_participants'
  | 'admin'
  | 'auditor';

export const DOCUMENT_VISIBILITIES: readonly DocumentVisibility[] = Object.freeze([
  'public', 'vetted_buyer', 'vetted_investor', 'deal_participants', 'admin', 'auditor',
]);

/** The visibility classes an organisation may choose for its OWN project's
 *  documents. 'admin' and 'auditor' are Sylva's; 'deal_participants' belongs
 *  to a deal room and is set when the document is attached to a deal. The
 *  database says the same thing in the INSERT policy from migration 0055;
 *  this list is what the form offers, not what enforces it. */
export const OWNER_SETTABLE_VISIBILITIES: readonly DocumentVisibility[] = Object.freeze([
  'public', 'vetted_buyer', 'vetted_investor',
]);

export type DocumentScope = 'project' | 'deal' | 'organisation';

/**
 * One document version, with everything the serving route needs and nothing
 * it does not. The row only exists if a row-level policy let the viewer read
 * it: there is no "visible" flag here, because a document this viewer may not
 * see does not come back at all.
 */
export interface ServableDocument {
  readonly documentId: string;
  readonly scope: DocumentScope;
  readonly kind: string;
  readonly visibility: DocumentVisibility;
  readonly projectId: string | null;
  readonly projectSlug: string | null;
  readonly dealId: string | null;
  readonly orgId: string | null;

  readonly versionId: string;
  readonly versionNo: number;
  readonly storageRegion: string;
  readonly storageBucket: string;
  readonly storageKey: string;
  readonly contentSha256: Buffer;
  readonly byteSize: number;
  readonly mediaType: string;
  readonly locale: string | null;
  readonly uploadedAt: string;
  readonly uploadedByOrgId: string;
}

/** A document row as a register lists it - no storage key, because a list is
 *  rendered into HTML and a storage key has no business in a page. */
export interface DocumentListRow {
  readonly documentId: string;
  /** The version the register would serve, so a withdrawal form can name it.
   *  Null where there is nothing servable. NOT a storage key: this identifies
   *  a ROW, and reaching the bytes still goes through the serving route. */
  readonly versionId: string | null;
  readonly kind: string;
  readonly visibility: DocumentVisibility;
  readonly versionNo: number | null;
  readonly mediaType: string | null;
  readonly byteSize: number | null;
  readonly uploadedAt: string | null;
  readonly locale: string | null;
  /** False where the document exists but has no version this viewer may read
   *  - typically because the only version was withdrawn. */
  readonly available: boolean;
}

export interface UploadRequest {
  readonly kind: string;
  readonly visibility: DocumentVisibility;
  readonly locale: string | null;
  readonly mediaType: string;
  readonly bytes: Buffer;
  /** Anchor. Exactly one of these three, matching doc.document's CHECK. */
  readonly anchor:
    | { readonly scope: 'project'; readonly projectId: string }
    | {
        readonly scope: 'deal';
        readonly projectId: string;
        readonly dealId: string;
        readonly buyerOrgId: string;
        readonly ownerOrgId: string;
      }
    | { readonly scope: 'organisation'; readonly orgId: string };
  /** Adds a version to an existing document instead of creating a new one. */
  readonly supersedesDocumentId?: string;
}

export interface UploadResult {
  readonly documentId: string;
  readonly versionId: string;
  readonly versionNo: number;
  readonly byteSize: number;
  readonly contentSha256: string;
  readonly storageRegion: string;
}
