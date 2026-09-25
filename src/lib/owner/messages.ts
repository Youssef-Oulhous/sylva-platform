/**
 * Strings this area needs that the message catalogue does not have yet.
 *
 * src/messages/en.json and de.json are owned by another agent, so nothing here
 * writes to them. Each string below is a KEY plus an English sentence, and
 * `ownerText(t, code)` renders the key where it exists and the sentence where
 * it does not. The keys and their German are returned with this change so they
 * can be added in one pass; until then a person reads a real sentence rather
 * than "ownerUi.savedCreated".
 *
 * This is the same mechanism src/lib/auth/errors.ts uses, and it has a second
 * benefit: scripts/check-i18n.ts resolves literal t('…') calls, so a literal
 * key that does not exist yet would fail the build. A key held in a table and
 * looked up by code does not, which is what makes the two agents able to work
 * in either order.
 */

export type OwnerTextCode = keyof typeof TEXT;

const TEXT = {
  /* ------------------------------------------------------ the counterparty */
  partyUnlabelled: {
    key: 'ownerUi.party.unlabelled',
    en: 'Not yet labelled',
  },
  partyUnlabelledNote: {
    key: 'ownerUi.party.unlabelledNote',
    en: 'A label is issued when a deal opens. Until then this organisation is '
      + 'shown by its sector, country and size band only.',
  },
  partyLabelNote: {
    key: 'ownerUi.party.labelNote',
    en: 'The label belongs to one deal, not to the organisation. The same '
      + 'organisation carries a different label on a different deal, and two '
      + 'labels cannot be matched to each other.',
  },

  /* ------------------------------------------------------------- dashboard */
  openRecord: { key: 'ownerUi.openRecord', en: 'Open the record' },
  addProject: { key: 'ownerUi.addProject', en: 'Add a project' },
  backToDashboard: { key: 'ownerUi.backToDashboard', en: 'Back to your projects' },
  liveNote: {
    key: 'ownerUi.liveNote',
    en: 'Everything on this page is read from the database as this organisation, '
      + 'now. The publication list is the list the database itself checks.',
  },

  /* -------------------------------------------------------------- outcomes */
  saved: { key: 'ownerUi.saved', en: 'Recorded.' },
  savedCreated: {
    key: 'ownerUi.savedCreated',
    en: 'The project was created as a draft. Its record is below.',
  },
  notSaved: { key: 'ownerUi.notSaved', en: 'This was not recorded' },

  /* ------------------------------------------------------------ provenance */
  sourceHeading: { key: 'ownerUi.source.heading', en: 'Where this comes from' },
  sourceLead: {
    key: 'ownerUi.source.lead',
    en: 'Every figure and every statement on a project page carries its source '
      + 'and the date it is stated as of. Both are recorded with the entry, not '
      + 'afterwards.',
  },
  // Not 'ownerUi.source.kind': that name is a GROUP below (…kind.document and
  // friends), and a catalogue key cannot be a string in one place and a group
  // in another. scripts/check-i18n.ts asserts exactly that.
  sourceKind: { key: 'ownerUi.source.kindLabel', en: 'Kind of source' },
  sourceKindDocument: { key: 'ownerUi.source.kind.document', en: 'A document' },
  sourceKindExternal: {
    key: 'ownerUi.source.kind.external',
    en: 'A published dataset or report',
  },
  sourceKindOperator: { key: 'ownerUi.source.kind.operator', en: 'Stated by Sylva' },
  sourceKindOwner: {
    key: 'ownerUi.source.kind.owner',
    en: 'Stated by this project',
  },
  sourceKindCalculated: {
    key: 'ownerUi.source.kind.calculated',
    en: 'Calculated by Sylva',
  },
  sourceLabelField: { key: 'ownerUi.source.labelField', en: 'Source' },
  sourceLabelHint: {
    key: 'ownerUi.source.labelHint',
    en: 'Name the document or the statement, as a reader would cite it.',
  },
  sourceUrlField: { key: 'ownerUi.source.urlField', en: 'Link to the source' },

  /* ------------------------------------------------------------ the record */
  appendNote: {
    key: 'ownerUi.appendNote',
    en: 'Each save records a new version. Nothing is overwritten and the '
      + 'previous version stays on the record.',
  },
  recordThis: { key: 'ownerUi.recordThis', en: 'Record this' },
  alreadyRecorded: { key: 'ownerUi.alreadyRecorded', en: 'Already recorded' },
  nothingRecorded: { key: 'ownerUi.nothingRecorded', en: 'Nothing recorded yet.' },
  entryVersion: { key: 'ownerUi.entryVersion', en: 'Version' },
  contentLocale: { key: 'ownerUi.contentLocale', en: 'Language of this entry' },
  translationStatus: { key: 'ownerUi.translationStatus', en: 'State of this text' },
  statusMachineDraft: { key: 'ownerUi.translation.machineDraft', en: 'Machine draft' },
  statusHumanDraft: { key: 'ownerUi.translation.humanDraft', en: 'Draft' },
  statusReviewed: { key: 'ownerUi.translation.reviewed', en: 'Reviewed' },
  statusPublished: { key: 'ownerUi.translation.published', en: 'Ready for the page' },
  translationStatusHint: {
    key: 'ownerUi.translationStatusHint',
    en: 'Only text marked ready for the page is shown to a reader. The '
      + 'publication list will not pass until the English title and summary are.',
  },

  /* ------------------------------------------------------- unit type spine */
  unitSectionTitle: { key: 'ownerUi.unit.title', en: 'Scheme and unit type' },
  unitSectionLead: {
    key: 'ownerUi.unit.lead',
    en: 'What this project issues, and under whose rules. Every volume recorded '
      + 'below is measured in this unit and is never added to a volume of '
      + 'another project.',
  },
  unitTypeField: { key: 'ownerUi.unit.field', en: 'Unit type' },
  unitAlreadySet: {
    key: 'ownerUi.unit.alreadySet',
    en: 'Recorded. A project keeps the unit type it was declared under.',
  },

  /* --------------------------------------------------------------- geometry */
  boundaryTitle: { key: 'ownerUi.boundary.title', en: 'Boundary and catchment' },
  boundaryLead: {
    key: 'ownerUi.boundary.lead',
    en: 'The project supplies its own polygon, with the licence it is published '
      + 'under and the date it is stated as of. Sylva does not derive a '
      + 'boundary or a catchment for a project: that would be making an '
      + 'environmental claim on its behalf.',
  },
  geometryKind: { key: 'ownerUi.boundary.kind', en: 'What this polygon is' },
  geometryBoundary: { key: 'ownerUi.boundary.kindBoundary', en: 'The project boundary' },
  geometryCatchment: { key: 'ownerUi.boundary.kindCatchment', en: 'The catchment' },
  geojsonField: { key: 'ownerUi.boundary.geojson', en: 'GeoJSON' },
  geojsonHint: {
    key: 'ownerUi.boundary.geojsonHint',
    en: 'One Polygon or MultiPolygon in WGS 84. Paste the geometry object, not '
      + 'a whole FeatureCollection.',
  },
  licenceField: { key: 'ownerUi.boundary.licence', en: 'Licence' },
  licenceHint: {
    key: 'ownerUi.boundary.licenceHint',
    en: 'Under what terms this polygon may be republished on the project page.',
  },
  datasetField: { key: 'ownerUi.boundary.dataset', en: 'Reference dataset' },
  datasetHint: {
    key: 'ownerUi.boundary.datasetHint',
    en: 'Required for a catchment: name the layer it was taken from and the '
      + 'level it is stated at.',
  },
  boundaryVersions: { key: 'ownerUi.boundary.versions', en: 'Versions recorded' },

  /* ------------------------------------------------------- repeated entries */
  entryKeyField: { key: 'ownerUi.entryKey', en: 'Reference' },
  entryKeyHint: {
    key: 'ownerUi.entryKeyHint',
    en: 'A short stable reference of your own, in lower case. Recording the same '
      + 'reference again replaces the entry with a new version and keeps the old '
      + 'one on the record.',
  },
  measureUnitField: { key: 'ownerUi.measureUnit', en: 'What it is measured in' },
  measureUnitHint: {
    key: 'ownerUi.measureUnitHint',
    en: 'Free text, printed beside every value. An indicator is deliberately not '
      + 'a tradeable unit and can never enter an availability figure.',
  },
  baselineAsOfField: { key: 'ownerUi.baselineAsOf', en: 'Baseline as of' },
  horizonField: { key: 'ownerUi.horizon', en: 'For how many years' },
  startsOnField: { key: 'ownerUi.startsOn', en: 'Starts' },
  endsOnField: { key: 'ownerUi.endsOn', en: 'Ends' },
  responsibleField: { key: 'ownerUi.responsible', en: 'Who has committed to it' },
  notStated: { key: 'ownerUi.notStated', en: 'Not stated' },
  statementField: { key: 'ownerUi.statement', en: 'The commitment' },
  partyOrgField: { key: 'ownerUi.partyOrg', en: 'Organisation' },
  partyOrgHint: {
    key: 'ownerUi.partyOrgHint',
    en: 'Chosen from the organisations this platform may name publicly. Where a '
      + 'landowner is a private individual, leave this and describe the '
      + 'arrangement below without naming anyone.',
  },
  partyRoleField: { key: 'ownerUi.partyRole', en: 'What they do' },
  partyDescriptionField: { key: 'ownerUi.partyDescription', en: 'Description' },

  /* ---------------------------------------------------------------- periods */
  periodLabelField: { key: 'ownerUi.periodLabel', en: 'Period' },
  periodLabelHint: {
    key: 'ownerUi.periodLabelHint',
    en: 'As the scheme names it - a vintage year, or a stated window.',
  },
  periodsRecorded: { key: 'ownerUi.periodsRecorded', en: 'Periods recorded' },
  needsUnitTypeFirst: {
    key: 'ownerUi.needsUnitTypeFirst',
    en: 'Record the scheme and unit type before a period. A volume means nothing '
      + 'without the unit it is measured in.',
  },

  /* -------------------------------------------------------------- documents */
  documentsNotBuilt: {
    key: 'ownerUi.documentsNotBuilt',
    en: 'Document upload is not built yet. Two of the items the publication list '
      + 'checks are documents, so a project cannot be published until it is - '
      + 'send the idea note and the design document to Sylva in the meantime.',
  },

  /* --------------------------------------------------------- submit for review */
  submitTitle: { key: 'ownerUi.submit.title', en: 'Send to Sylva' },
  submitLead: {
    key: 'ownerUi.submit.lead',
    en: 'Sylva reviews the record and publishes it. Publication is not a step '
      + 'you can take yourself, and the database refuses it on any account but '
      + "Sylva's.",
  },
  submitAction: { key: 'ownerUi.submit.action', en: 'Send for review' },
  submitOnlyFromDraft: {
    key: 'ownerUi.submit.onlyFromDraft',
    en: 'A project can be sent for review while it is a draft, or after Sylva '
      + 'has asked for changes. This one is neither.',
  },
  submitDone: {
    key: 'ownerUi.submit.done',
    en: 'Sent. Sylva has it, and will either publish it or ask for changes.',
  },

  /* ------------------------------------------------------- the question box */
  replySend: { key: 'ownerUi.reply.send', en: 'Send reply' },
  replyRecorded: {
    key: 'ownerUi.reply.recorded',
    en: 'Sent. A reply is a new entry; it does not change the question and it '
      + 'does not change an earlier reply.',
  },
  replyAppendNote: {
    key: 'ownerUi.reply.appendNote',
    en: 'A reply cannot be edited or withdrawn once sent. A correction is a '
      + 'further reply.',
  },
  questionRef: { key: 'ownerUi.questionRef', en: 'Reference' },

  /* --------------------------------------------------------------- creation */
  createTitle: { key: 'ownerUi.create.title', en: 'Add a project' },
  createLead: {
    key: 'ownerUi.create.lead',
    en: 'A project starts as a draft holding its name, its country and its '
      + 'summary. Everything else is recorded on the draft afterwards, one '
      + 'section at a time, each with its own source.',
  },
  createAction: { key: 'ownerUi.create.action', en: 'Create the draft' },
  countryField: { key: 'ownerUi.create.country', en: 'Country' },

  /* --------------------------------------- the record, as navigable sections */
  // The record used to be one page of thirteen forms. It is now one page per
  // section, so these are the labels of the section navigation and the words a
  // step page uses to say where it sits in the whole.
  stepNavLabel: {
    key: 'ownerUi.step.navLabel',
    en: 'Sections of this project record',
  },
  stepOverview: { key: 'ownerUi.step.overview', en: 'Overview' },
  stepTextTitle: { key: 'ownerUi.step.textTitle', en: 'Name and summary' },
  stepIntro: {
    key: 'ownerUi.step.intro',
    en: 'One section of the record, with its own source and its own save. The '
      + 'publication list on the project overview shows how the whole record '
      + 'stands.',
  },
  stepOpen: { key: 'ownerUi.step.open', en: 'Open this section' },
  stepPrevious: { key: 'ownerUi.step.previous', en: 'Previous section' },
  stepNext: { key: 'ownerUi.step.next', en: 'Next section' },
  backToProject: { key: 'ownerUi.backToProject', en: 'Back to this project' },
  backToProjects: { key: 'ownerUi.backToProjects', en: 'Back to your projects' },
  recordSectionsTitle: {
    key: 'ownerUi.record.sectionsTitle',
    en: 'The record, section by section',
  },
  recordSectionsLead: {
    key: 'ownerUi.record.sectionsLead',
    en: 'Each section is recorded on its own page, with its own source and its '
      + 'own date. Nothing is overwritten: a save appends a version and the '
      + 'previous one stays on the record.',
  },

  /* ------------------------------------------- what actually reaches a buyer */
  // The defect this fixes: an owner recorded claim rights, outcome detail and
  // durability, the rows went in at 'human_draft', and the public project page
  // only shows 'published' or 'reviewed' - so the published page carried a raw
  // key and three dashes while the owner had every reason to think the section
  // was done. The forms now ask, and the record says which answer it got.
  publicStateOn: { key: 'ownerUi.publicState.on', en: 'On the public page' },
  publicStateOff: { key: 'ownerUi.publicState.off', en: 'Not on the public page' },
  publicStateOffNote: {
    key: 'ownerUi.publicState.offNote',
    en: 'This is on the record but a buyer does not see it. Only an entry '
      + 'marked ready for the page, or reviewed, reaches the public project '
      + 'page. Record it again with "Ready for the page" chosen.',
  },
  publicStateHint: {
    key: 'ownerUi.publicState.hint',
    en: 'Choose "Ready for the page" when this entry is final. An entry left as '
      + 'a draft is kept on the record for ever but is never shown to a buyer.',
  },
  publicStateCount: {
    key: 'ownerUi.publicState.count',
    en: 'Entries on this page that a buyer cannot see yet',
  },

  /* ------------------------------------------------------- the organisation */
  orgTitle: { key: 'ownerUi.org.title', en: 'Your organisation' },
  orgLead: {
    key: 'ownerUi.org.lead',
    en: 'The organisation record Sylva holds for you, and where its vetting for '
      + 'the project owner role stands. Sylva vets an organisation before it '
      + 'can transact.',
  },
  orgRecordTitle: { key: 'ownerUi.org.recordTitle', en: 'The organisation record' },
  orgNoRecord: {
    key: 'ownerUi.org.noRecord',
    en: 'No organisation record can be read for this account.',
  },
  orgCountry: { key: 'ownerUi.org.country', en: 'Country' },
  orgSector: { key: 'ownerUi.org.sector', en: 'Sector' },
  orgSizeBand: { key: 'ownerUi.org.sizeBand', en: 'Size' },
  orgRegistered: { key: 'ownerUi.org.registered', en: 'On the platform since' },
  orgSource: { key: 'ownerUi.org.source', en: 'Your organisation record' },
  orgOnlyDate: {
    key: 'ownerUi.org.onlyDate',
    en: 'The organisation record carries one date - when it was created. There '
      + 'is no "last updated", so none is shown.',
  },

  /* ------------------------------------------------------------- the overview */
  overviewNeedsYou: { key: 'ownerUi.overview.needsYou', en: 'What needs you' },
  overviewClear: {
    key: 'ownerUi.overview.clear',
    en: 'Nothing is waiting on you right now.',
  },
  overviewGoTo: { key: 'ownerUi.overview.goTo', en: 'Go there' },
  overviewProjectsNote: {
    key: 'ownerUi.overview.projectsNote',
    en: 'Each project is recorded section by section. Open a project to see '
      + 'which sections are still missing.',
  },
} as const;

export function ownerText(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: OwnerTextCode,
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
export const OWNER_TEXT_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(Object.values(TEXT).map((m) => [m.key, m.en]));
