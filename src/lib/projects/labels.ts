/**
 * Labels for the codes that arrive from the database.
 *
 * The project page now reads reference codes — `project_idea_note`,
 * `landowner`, `vetted_buyer` — where it used to hold English prose in a
 * demo-data module. A code is not a sentence, so each one needs a message key.
 *
 * `src/messages/*.json` is owned by another agent, so this module follows the
 * pattern `src/lib/auth/errors.ts` established: every label is a KEY plus the
 * English sentence to show until that key lands. `label()` asks next-intl
 * whether the key exists and falls back rather than rendering "projectPage.
 * docKind.projectIdeaNote" at a reader. The keys are returned with this change
 * in `i18nKeys`, in English and in German.
 *
 * The keys are passed to `t()` as VALUES, not as literals, so `npm run
 * check:i18n` counts them as runtime keys rather than failing on keys that are
 * not in the catalogue yet. When they land, nothing here has to change.
 */

export interface Label {
  readonly key: string;
  readonly fallbackEn: string;
}

type Translator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has?: (key: string) => boolean;
};

/** Renders a label with next-intl if the key exists, in English if it does not. */
export function label(t: Translator, l: Label | undefined, fallback = ''): string {
  if (!l) return fallback;
  try {
    if (typeof t.has === 'function' && t.has(l.key)) return t(l.key);
  } catch {
    /* fall through to the English sentence */
  }
  return l.fallbackEn;
}

/** The same, for a key with no code behind it. */
export function labelFor(t: Translator, key: string, fallbackEn: string): string {
  return label(t, { key, fallbackEn });
}

const mk = (key: string, fallbackEn: string): Label => ({ key, fallbackEn });

/* -------------------------------------------------------------- doc.document_kind */

export const DOCUMENT_KIND: Record<string, Label> = {
  project_idea_note: mk('projectPage.docKind.projectIdeaNote', 'Project idea note'),
  project_design_document: mk('projectPage.docKind.projectDesignDocument', 'Project design document'),
  monitoring_plan: mk('projectPage.docKind.monitoringPlan', 'Monitoring plan'),
  verification_report: mk('projectPage.docKind.verificationReport', 'Verification report'),
  boundary_geojson: mk('projectPage.docKind.boundaryGeojson', 'Project boundary (GeoJSON)'),
  catchment_geojson: mk('projectPage.docKind.catchmentGeojson', 'Catchment (GeoJSON)'),
  registry_evidence: mk('projectPage.docKind.registryEvidence', 'Scheme registry evidence'),
  reporting_evidence_pack: mk('projectPage.docKind.reportingEvidencePack', 'Reporting evidence pack'),
  financial_model: mk('projectPage.docKind.financialModel', 'Financial model'),
  term_sheet: mk('projectPage.docKind.termSheet', 'Term sheet'),
  letter_of_intent: mk('projectPage.docKind.letterOfIntent', 'Letter of intent'),
  signed_agreement: mk('projectPage.docKind.signedAgreement', 'Signed agreement'),
  vetting_evidence: mk('projectPage.docKind.vettingEvidence', 'Vetting evidence'),
  other: mk('projectPage.docKind.other', 'Other document'),
};

/* ------------------------------------------------------- doc.visibility_class */

export const DOCUMENT_VISIBILITY: Record<string, Label> = {
  public: mk('projectPage.documents.visibility.public', 'Public'),
  vetted_buyer: mk('projectPage.documents.visibility.vettedBuyer', 'Vetted buyers'),
  vetted_investor: mk('projectPage.documents.visibility.vettedInvestor', 'Vetted investors'),
  deal_participants: mk('projectPage.documents.visibility.dealParticipants', 'Parties to the deal'),
  admin: mk('projectPage.documents.visibility.admin', 'Sylva only'),
  auditor: mk('projectPage.documents.visibility.auditor', 'Auditors only'),
};

/* ------------------------------------------------------------ proj.party_role */

export const PARTY_ROLE: Record<string, Label> = {
  // 'owner' is not a party_role code; it is the organisation that holds the
  // project on the platform, added to the list by the query.
  owner: mk('projectPage.partner.owner', 'Project owner'),
  developer: mk('projectPage.partner.developer', 'Project developer'),
  landowner: mk('projectPage.partner.landOwner', 'Land owner'),
  verifier: mk('projectPage.partner.verifier', 'Verifier'),
  partner: mk('projectPage.partner.other', 'Other partner'),
};

/* -------------------------------------------------- proj.evidence_pack_element */

export const EVIDENCE_ELEMENT: Record<string, Label> = {
  measurable_action: mk(
    'projectPage.evidence.item.action',
    'The measurable action: what is restored and over what area',
  ),
  fixed_timeframe: mk(
    'projectPage.evidence.item.timeframe',
    'Timeframe: works, outcome periods and the committed management term',
  ),
  expected_impact: mk(
    'projectPage.evidence.item.impact',
    'Expected water and biodiversity outcomes, with baselines and stated uncertainty',
  ),
  budget: mk(
    'projectPage.evidence.item.budget',
    'Project budget, where the project owner has published it',
  ),
  verification_standard: mk(
    'projectPage.evidence.item.verification',
    'Verification: the scheme, the verifier and the monitoring plan',
  ),
};

/* ---------------------------------------------------------- deal.deal_shape */

export const DEAL_SHAPE: Record<string, Label> = {
  spot: mk('projectPage.dealType.spot', 'Spot volume'),
  forward: mk('projectPage.dealType.forward', 'Forward contract'),
  co_investment: mk('projectPage.dealType.coInvestment', 'Co-investment'),
};

/* ------------------------------------------------------------ proj.text_field */

export const TEXT_FIELD: Record<string, Label> = {
  catchment_context: mk('projectPage.textField.catchmentContext', 'Catchment context'),
  durability_note: mk('projectPage.textField.durabilityNote', 'Note on long-term protection'),
  partners_note: mk('projectPage.textField.partnersNote', 'Note on the partners'),
};

/* ------------------------------------------------- units.unit_type semantics */

export const VINTAGE_SHORT: Record<string, Label> = {
  period_of_outcome: mk('projectPage.keyFacts.periodOfOutcome', 'period of outcome'),
  period_of_issuance: mk('projectPage.keyFacts.periodOfIssuance', 'period of issuance'),
  undefined_by_scheme: mk('projectPage.keyFacts.periodUndefined', 'not defined by the scheme'),
};

/** The full sentence. These three keys already exist in the catalogue. */
export const VINTAGE_SENTENCE: Record<string, Label> = {
  period_of_outcome: mk(
    'project.vintageOutcome',
    'Periods refer to the period of the ecological outcome.',
  ),
  period_of_issuance: mk(
    'project.vintageIssuance',
    'Periods refer to the period in which units are issued.',
  ),
  undefined_by_scheme: mk(
    'project.vintageUndefined',
    'The scheme does not define what a period refers to.',
  ),
};

/* --------------------------------------------------------------- the timeline */

export const TIMELINE_KIND: Record<string, Label> = {
  platform_record: mk(
    'projectPage.timeline.kind.published',
    'Recorded on the platform',
  ),
  outcome_period: mk('projectPage.timeline.kind.outcomePeriod', 'Outcome period'),
  commitment: mk('projectPage.timeline.kind.commitment', 'Committed management'),
};

/* ------------------------------------------------------------------ countries */

/**
 * The country name. `mySites.country.<CODE>` already exists in both languages
 * for the member states the pilot covers; the English name recorded in
 * platform.eu_member_state is the fallback for any other.
 */
export function countryLabel(t: Translator, code: string, nameEn: string): string {
  return label(t, mk(`mySites.country.${code}`, nameEn));
}

/* ---------------------------------------- new sentences this page introduces */

export const UI = {
  fallbackNotice: mk(
    'projectPage.fallbackNotice',
    'Shown in English. No reviewed translation of this text exists yet.',
  ),
  areaComputed: mk(
    'projectPage.map.areaComputedNote',
    'Areas are computed by the platform from the boundary and catchment polygons above, not quoted from the documents.',
  ),
  catchmentArea: mk('projectPage.map.catchmentArea', 'Catchment area'),
  sitesDistance: mk('projectPage.map.sites.distance', 'Straight-line distance'),
  sitesInCatchment: mk('projectPage.map.sites.inCatchment', 'In this catchment'),
  sitesNotInCatchment: mk('projectPage.map.sites.notInCatchment', 'Not in this catchment'),
  sitesNoCatchment: mk(
    'projectPage.map.sites.noCatchment',
    'This project has published no catchment polygon, so the question has no answer here.',
  ),
  sitesLevelNote: mk(
    'projectPage.map.sites.levelNote',
    'Answered against the catchment polygon supplied by the project, named below. It is not a hydrological judgement made by the platform.',
  ),
  verificationDone: mk(
    'projectPage.verification.outcomeVerified',
    'A verification report is on the platform. See the documents below.',
  ),
  verificationPending: mk(
    'projectPage.verification.notYetVerified',
    'No verification report yet. Only the project’s own documents are on the platform; the ecological result has not been independently verified.',
  ),
  noOutcomes: mk(
    'projectPage.outcomes.none',
    'No indicator has been recorded for this domain.',
  ),
  noClaims: mk(
    'projectPage.claims.none',
    'No claim terms have been recorded for this project yet.',
  ),
  noDurability: mk(
    'projectPage.durability.none',
    'No long-term commitment has been recorded for this project yet.',
  ),
  noForecast: mk(
    'projectPage.availability.noForecast',
    'No forecast has been recorded for this period yet.',
  ),
  noPeriods: mk(
    'projectPage.availability.none',
    'No period has been declared for this project yet.',
  ),
  noDocuments: mk(
    'projectPage.documents.none',
    'No document is on the platform for this project yet.',
  ),
  evidenceNotAssembled: mk(
    'projectPage.evidence.notAssembled',
    'The pack has not been assembled for this project yet. The list above is what it will contain.',
  ),
  evidenceRestricted: mk(
    'projectPage.evidence.restricted',
    'The assembled contents are shown to buyers Sylva has vetted. The list of what the pack contains is public.',
  ),
  evidenceAssembledOn: mk('projectPage.evidence.assembledOn', 'Assembled'),
  questionsSignIn: mk(
    'projectPage.questions.signIn',
    'Sign in to send a question. It goes to the project owner and to Sylva, and is not published.',
  ),
  questionsYours: mk('projectPage.questions.yours', 'Your questions about this project'),
  questionsNone: mk(
    'projectPage.questions.none',
    'You have not asked anything about this project yet.',
  ),
  questionsAwaiting: mk('projectPage.questions.awaiting', 'Awaiting an answer'),
  // Replaces projectPage.questions.replyHint, which says the asker's
  // organisation is not named to the project owner. It is: deal.project_question
  // carries asker_org_id and the owner's policy on that table is
  // `owner_org_id = sylva.actor_org_id()`, so the owner reads it. What the owner
  // cannot resolve is the PERSON - asker_person_ref is opaque and the identity
  // schema is sealed to every application role.
  questionsIdentity: mk(
    'projectPage.questions.identityNote',
    'The project owner and Sylva see which organisation asked. They do not see which person asked, and there is no reply address to give: the answer appears here.',
  ),
  questionsAnsweredBy: mk('projectPage.questions.answeredBy', 'Answered by'),
  questionSent: mk('projectPage.questions.sent', 'Your question has been sent.'),
  investorAsOf: mk('projectPage.investor.asOf', 'As at'),
  investorFinancingNeed: mk('projectPage.investor.field.financingNeed', 'Financing required'),
  investorRevenue: mk('projectPage.investor.field.revenueStreams', 'Revenue streams'),
  investorModel: mk('projectPage.investor.field.model', 'Financial model'),
  investorModelOnPlatform: mk(
    'projectPage.investor.modelOnPlatform',
    'The financial model is on the platform, in the documents below.',
  ),
  investorModelAbsent: mk(
    'projectPage.investor.modelAbsent',
    'No financial model has been filed yet.',
  ),
  statusNotPublished: mk(
    'projectPage.header.notPublished',
    'This project is no longer offered. The page is kept so that links to it keep working and the record stays readable.',
  ),
  unitDefinition: mk('projectPage.header.unitDefinition', 'What one unit is'),
  timelinePlatformSource: mk(
    'projectPage.timeline.platformRecord',
    'Recorded by the platform, not quoted from a document.',
  ),
} as const;
