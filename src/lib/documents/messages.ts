/**
 * Strings the document area needs that the message catalogue does not have yet.
 *
 * Exactly the mechanism of src/lib/owner/messages.ts, and for the same reason:
 * src/messages/en.json and de.json belong to another agent, so nothing here
 * writes to them. Each entry is a KEY plus an English sentence; `docText(t,
 * code)` renders the key where it exists and the sentence where it does not,
 * so a person reads a sentence rather than 'documentUi.upload.title' while the
 * two changes land in either order. The keys and their German are returned
 * with this change.
 */

export type DocumentTextCode = keyof typeof TEXT;

const TEXT = {
  /* ---------------------------------------------------------------- panel */
  uploadTitle: { key: 'documentUi.upload.title', en: 'Add a document' },
  uploadLead: {
    key: 'documentUi.upload.lead',
    en: 'Upload the file here. It is stored in the European Union, it is never '
      + 'served from a public address, and who may read it is decided by the '
      + 'visibility you choose below.',
  },
  registerTitle: { key: 'documentUi.register.title', en: 'Documents on the record' },
  registerEmpty: {
    key: 'documentUi.register.empty',
    en: 'No documents yet. The project idea note and the project design document '
      + 'are both on the list the platform checks before a project can be published.',
  },

  /* ---------------------------------------------------------------- fields */
  fieldKind: { key: 'documentUi.field.kind', en: 'What this document is' },
  fieldKindHint: {
    key: 'documentUi.field.kindHint',
    en: 'Chosen from the kinds the platform recognises. Two of them - the project '
      + 'idea note and the project design document - are required before publication.',
  },
  fieldVisibility: { key: 'documentUi.field.visibility', en: 'Who may read it' },
  fieldVisibilityHint: {
    key: 'documentUi.field.visibilityHint',
    en: 'Fixed when the file is uploaded. To change it, upload the file again '
      + 'under the visibility you want and withdraw the first one; the record '
      + 'keeps both.',
  },
  fieldLocale: { key: 'documentUi.field.locale', en: 'Language of the document' },
  fieldFile: { key: 'documentUi.field.file', en: 'File' },
  fieldFileHint: {
    key: 'documentUi.field.fileHint',
    en: 'PDF, GeoJSON, JSON, CSV, PNG, JPEG or Excel workbook. The contents are '
      + 'checked against the format, so a file with the wrong extension is refused.',
  },
  fieldReason: { key: 'documentUi.field.reason', en: 'Why it is being withdrawn' },

  /* --------------------------------------------------------------- actions */
  uploadAction: { key: 'documentUi.action.upload', en: 'Upload this document' },
  withdrawAction: { key: 'documentUi.action.withdraw', en: 'Withdraw this version' },
  openAction: { key: 'documentUi.action.open', en: 'Open' },
  downloadAction: { key: 'documentUi.action.download', en: 'Download' },

  /* ----------------------------------------------------------------- notes */
  appendNote: {
    key: 'documentUi.note.append',
    en: 'Uploading again adds a new version. The earlier version stays on the '
      + 'record and keeps its own hash.',
  },
  withdrawNote: {
    key: 'documentUi.note.withdraw',
    en: 'Withdrawing stops the file being served. It is not deleted: the version '
      + 'and its hash remain for the auditor and for anything on the record that '
      + 'cited it.',
  },
  storageNote: {
    key: 'documentUi.note.storage',
    en: 'Every file is held in a named European Union region and is served only '
      + 'after the platform has checked, for that reader, that they may have it.',
  },
  notAvailable: {
    key: 'documentUi.status.notAvailable',
    en: 'Withdrawn - nothing to download',
  },
  uploadedOutcome: { key: 'documentUi.outcome.uploaded', en: 'The document was uploaded.' },
  withdrawnOutcome: { key: 'documentUi.outcome.withdrawn', en: 'The version was withdrawn.' },

  /* ------------------------------------------------- the visibility classes */
  visPublic: { key: 'documentUi.visibility.public', en: 'Anyone' },
  visPublicHint: {
    key: 'documentUi.visibility.publicHint',
    en: 'Visible to every visitor once the project is published.',
  },
  visVettedBuyer: { key: 'documentUi.visibility.vettedBuyer', en: 'Buyers Sylva has approved' },
  visVettedInvestor: { key: 'documentUi.visibility.vettedInvestor', en: 'Investors Sylva has approved' },
  visDealParticipants: { key: 'documentUi.visibility.dealParticipants', en: 'The two parties to one deal' },
  visAdmin: { key: 'documentUi.visibility.admin', en: 'Sylva only' },
  visAuditor: { key: 'documentUi.visibility.auditor', en: 'Auditors only' },
} as const;

export function docText(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: DocumentTextCode,
): string {
  const m = TEXT[code];
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.en;
}

/** The key every code maps to. Used by the i18n hand-over, not by a page. */
export const DOCUMENT_TEXT_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(Object.values(TEXT).map((m) => [m.key, m.en]));

/** The visibility class as a sentence, for a badge or a select. */
export function visibilityText(
  t: { (key: string): string; has?: (key: string) => boolean },
  visibility: string,
): string {
  switch (visibility) {
    case 'public': return docText(t, 'visPublic');
    case 'vetted_buyer': return docText(t, 'visVettedBuyer');
    case 'vetted_investor': return docText(t, 'visVettedInvestor');
    case 'deal_participants': return docText(t, 'visDealParticipants');
    case 'admin': return docText(t, 'visAdmin');
    case 'auditor': return docText(t, 'visAuditor');
    default: return visibility;
  }
}
