/**
 * Strings the buyer workspace needs that the message catalogue does not have
 * yet.
 *
 * Exactly the mechanism of src/lib/documents/messages.ts, and for the same
 * reason: src/messages/en.json and de.json belong to another agent, so nothing
 * here writes to them. Each entry is a KEY plus an English sentence, and
 * `buyerText(t, code)` renders the key where it exists and the sentence where
 * it does not - so a person reads a sentence rather than
 * 'buyerArea.overview.title' while the two changes land in either order. The
 * keys and their German are handed back with this change.
 *
 * WHAT IS *NOT* HERE. Anything the catalogue already says. The buyer area was
 * one long page with a full set of translated strings under `buyerDashboard.*`
 * - every table caption, every column heading, every empty state, the vetting
 * panel, the disclosure panel - and splitting that page into five did not
 * change a single one of those sentences. They are reused as they stand. What
 * follows is only what genuinely did not exist before: the words for a page
 * heading where there used to be a section heading, the overview's attention
 * list, and the deal facts (shape, stage, per-deal pseudonym) that the old
 * interests table did not show.
 */

export type BuyerTextCode = keyof typeof TEXT;

const TEXT = {
  /* -------------------------------------------------------------- overview
     No key for the page's own H1: workspace.buyer.overview already says
     "Overview" and is already translated, and nav.ts is what puts that word in
     the navigation. The same goes for the other four pages - each takes its
     heading from workspace.buyer.*, so a heading and its nav entry cannot end
     up wording the same section differently. */
  overviewLead: {
    key: 'buyerArea.overview.lead',
    en: 'Where your organisation stands on this platform, and what is waiting '
      + 'for you. Each section below holds the detail.',
  },
  overviewMeta: {
    key: 'buyerArea.overview.meta',
    en: 'What your organisation has done on this platform, and what is waiting '
      + 'for you.',
  },

  attentionTitle: { key: 'buyerArea.attention.title', en: 'Needs your attention' },
  attentionNone: {
    key: 'buyerArea.attention.none',
    en: 'Nothing is waiting for you. Your organisation is approved, it has '
      + 'expressed interest in at least one project, and it has registered at '
      + 'least one site.',
  },
  attentionVettingNone: {
    key: 'buyerArea.attention.vettingNone',
    en: 'Your organisation has not submitted the vetting questionnaire. Until '
      + 'Sylva records a decision it cannot express interest in a project.',
  },
  attentionVettingWaiting: {
    key: 'buyerArea.attention.vettingWaiting',
    en: 'Your vetting questionnaire is with Sylva. No decision has been recorded yet.',
  },
  attentionVettingDeclined: {
    key: 'buyerArea.attention.vettingDeclined',
    en: 'Sylva declined this organisation for the buyer role. The recorded reason '
      + 'is on the organisation page.',
  },
  attentionNoInterests: {
    key: 'buyerArea.attention.noInterests',
    en: 'You have not expressed interest in any project yet.',
  },
  attentionNoSites: {
    key: 'buyerArea.attention.noSites',
    en: 'No sites are registered, so no project can be shown with its distance '
      + 'from your own operations.',
  },
  attentionDealOpen: {
    key: 'buyerArea.attention.dealOpen',
    en: 'A project owner has opened a deal room with you.',
  },

  countsTitle: { key: 'buyerArea.counts.title', en: 'What your record holds' },
  countsNote: {
    key: 'buyerArea.counts.note',
    en: 'Every figure here is a count of rows on your own record. None of them '
      + 'is a unit volume, and nothing here is added across projects.',
  },
  countInterests: { key: 'buyerArea.counts.interests', en: 'interests expressed' },
  countSites: { key: 'buyerArea.counts.sites', en: 'sites registered' },
  countDocuments: { key: 'buyerArea.counts.documents', en: 'documents you can reach' },
  countLabels: { key: 'buyerArea.counts.labels', en: 'public labels allocated' },

  sectionsTitle: { key: 'buyerArea.sections.title', en: 'Your sections' },
  goInterests: {
    key: 'buyerArea.sections.interests',
    en: 'Every interest your organisation has expressed, the deal it opened and '
      + 'the pseudonym it carries on the public record.',
  },
  goSites: {
    key: 'buyerArea.sections.sites',
    en: 'The places you care about, and how far each project is from them. '
      + 'Private to your organisation.',
  },
  goDocuments: {
    key: 'buyerArea.sections.documents',
    en: 'What your organisation lodged, and the documents of the projects it has '
      + 'expressed interest in.',
  },
  goOrganisation: {
    key: 'buyerArea.sections.organisation',
    en: 'The record Sylva holds for your organisation, its vetting decision and '
      + 'how it appears to everybody else.',
  },
  open: { key: 'buyerArea.action.open', en: 'Open' },

  /* ------------------------------------------------------------ interests */
  interestsLead: {
    key: 'buyerArea.interests.lead',
    en: 'Every interest your organisation has expressed, newest first. An '
      + 'interest that led nowhere stays in the list: the record is append-only. '
      + 'A volume is never shown across projects, so this list states what each '
      + 'project issues instead.',
  },
  colShape: { key: 'buyerArea.interests.colShape', en: 'Deal shape' },
  colStage: { key: 'buyerArea.interests.colStage', en: 'Stage' },
  colPseudonym: { key: 'buyerArea.interests.colPseudonym', en: 'Public pseudonym' },
  shapeNotSet: { key: 'buyerArea.interests.shapeNotSet', en: 'Not stated yet' },
  noDealYet: { key: 'buyerArea.interests.noDealYet', en: 'No deal room yet' },
  pseudonymPerDeal: { key: 'buyerArea.interests.pseudonymPerDeal', en: 'for this deal' },
  pseudonymPerProject: {
    key: 'buyerArea.interests.pseudonymPerProject',
    en: 'for this project',
  },
  pseudonymNone: {
    key: 'buyerArea.interests.pseudonymNone',
    en: 'Not allocated yet',
  },
  namedOnDeal: { key: 'buyerArea.interests.namedOnDeal', en: 'Named, by your choice' },
  pseudonymNote: {
    key: 'buyerArea.interests.pseudonymNote',
    en: 'A pseudonym is allocated separately for each project and again for each '
      + 'deal, so two of your entries cannot be linked to each other through it. '
      + 'Your legal name is shown only where you have chosen to be named.',
  },
  interestsDealNote: {
    key: 'buyerArea.interests.dealNote',
    en: 'Deal shape and stage are recorded by Sylva with the project owner. The '
      + 'deal room itself is not open to buyers in this release, so there is '
      + 'nothing here to click into.',
  },
  noVolumesNote: {
    key: 'buyerArea.interests.noVolumes',
    en: 'This list spans projects under different schemes, so it carries no '
      + 'volume column: the figures would not be comparable. What each project '
      + 'issues is stated instead, and a volume is shown one project at a time, '
      + 'on that project\u2019s own page.',
  },
  interestsCaption: {
    key: 'buyerArea.interests.caption',
    en: 'Interests expressed by your organisation, newest first, with the deal '
      + 'each one opened.',
  },

  /* ------------------------------------------------------------ documents */
  documentsLead: {
    key: 'buyerArea.documents.lead',
    en: 'Every document your organisation can reach: what it lodged with Sylva, '
      + 'and the documents of the projects it has expressed interest in.',
  },
  projectDocsTitle: { key: 'buyerArea.documents.projectTitle', en: 'Project documents' },
  projectDocsIntro: {
    key: 'buyerArea.documents.projectIntro',
    en: 'The documents of the projects you have expressed interest in. Which of '
      + 'them you are offered is decided for each file by the platform, for you, '
      + 'at the moment you ask for it.',
  },
  projectDocsEmptyTitle: {
    key: 'buyerArea.documents.projectEmptyTitle',
    en: 'No project documents to show',
  },
  projectDocsEmptyBody: {
    key: 'buyerArea.documents.projectEmptyBody',
    en: 'Express interest in a project and the documents Sylva may show you for '
      + 'that project appear here, alongside the ones on the project page.',
  },
  projectDocsCaption: {
    key: 'buyerArea.documents.projectCaption',
    en: 'Documents of the projects your organisation has expressed interest in.',
  },
  colProject: { key: 'buyerArea.documents.colProject', en: 'Project' },
  colReadableBy: { key: 'buyerArea.documents.colReadableBy', en: 'Who may read it' },
  colSize: { key: 'buyerArea.documents.colSize', en: 'Size' },
  serveNote: {
    key: 'buyerArea.documents.serveNote',
    en: 'A file is held in a named European Union region and is never served from '
      + 'a public address. Every download is checked again, for you, before a '
      + 'byte moves.',
  },

  /* --------------------------------------------------------- organisation */
  organisationLead: {
    key: 'buyerArea.organisation.lead',
    en: 'The record Sylva holds for your organisation, the vetting decision '
      + 'recorded against it, and how it appears to everybody else. Your '
      + 'organisation reads its own record here and no other.',
  },
  organisationMissing: {
    key: 'buyerArea.organisation.missing',
    en: 'This account is not attached to an organisation record, so there is '
      + 'nothing to show. Ask Sylva to look at it.',
  },

  /* ---------------------------------------------------------------- errors */
  unavailable: {
    key: 'buyerArea.error.unavailable',
    en: 'This part of your record could not be read just now. Nothing has been '
      + 'changed. Try again, and tell Sylva if it keeps happening.',
  },
  notPermitted: {
    key: 'buyerArea.error.notPermitted',
    en: 'This account may not read that part of the record.',
  },
} as const;

export function buyerText(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: BuyerTextCode,
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
export const BUYER_TEXT_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(Object.values(TEXT).map((m) => [m.key, m.en]));

/**
 * Reference labels that carry an English label only.
 *
 * deal.deal_shape and deal.deal_stage hold `label_en` and no German column -
 * unlike platform.sector, which holds both - so rendering the reference row
 * directly put "Forward contract" in the middle of an otherwise German table.
 * The CODE is looked up in the catalogue and the English reference label is the
 * fallback, so a shape or a stage added to the table later appears in English
 * rather than as a missing key. Same shape as DocumentsSection's kindLabel.
 */
function fromCatalogue(
  t: { (key: string): string; has?: (key: string) => boolean },
  key: string,
  fallback: string,
): string {
  try {
    if (typeof t.has === 'function' && t.has(key)) return t(key);
  } catch {
    /* fall through */
  }
  return fallback;
}

export function dealShapeLabel(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: string | null,
  labelEn: string | null,
): string | null {
  if (code === null) return null;
  return fromCatalogue(t, `buyerArea.dealShape.${code}`, labelEn ?? code);
}

export function dealStageLabel(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: string,
  labelEn: string | null,
): string {
  return fromCatalogue(t, `buyerArea.dealStage.${code}`, labelEn ?? code);
}

/**
 * The shape and stage keys, for the hand-over. They are built from a database
 * code, so `npm run check:i18n` cannot see them; this is the list.
 */
export const DEAL_REFERENCE_KEYS: Readonly<Record<string, string>> = {
  'buyerArea.dealShape.spot': 'Spot volume',
  'buyerArea.dealShape.forward': 'Forward contract',
  'buyerArea.dealShape.co_investment': 'Co-investment',
  'buyerArea.dealStage.interest_expressed': 'Interest expressed',
  'buyerArea.dealStage.letter_of_intent': 'Letter of intent',
  'buyerArea.dealStage.term_sheet': 'Term sheet',
  'buyerArea.dealStage.signed': 'Signed',
  'buyerArea.dealStage.withdrawn_by_buyer': 'Withdrawn by you',
  'buyerArea.dealStage.declined_by_owner': 'Declined by the project owner',
  'buyerArea.dealStage.declined_by_operator': 'Declined by Sylva',
  'buyerArea.dealStage.lapsed': 'Lapsed',
};
