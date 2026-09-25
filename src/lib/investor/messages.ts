/**
 * Strings the investor workspace needs that the message catalogue does not have
 * yet.
 *
 * Exactly the mechanism of src/lib/dashboard/messages.ts and
 * src/lib/auditor/labels.ts, and for the same reason: src/messages/en.json and
 * de.json belong to another agent, so nothing here writes to them. Each entry is
 * a KEY plus the English sentence, and `investorText(t, code)` renders the key
 * where it exists and the sentence where it does not - so a person reads a
 * sentence rather than 'investorArea.overview.title' while the two changes land
 * in either order. The keys and their German are handed back with this change.
 *
 * WHAT IS *NOT* HERE. Anything the catalogue already says. `forInvestors.*`,
 * `projectPage.investor.*`, `buyerDashboard.org.*`, `project.*` and
 * `workspace.investor.*` already carry the field names, the organisation-record
 * labels, the vetting words and the section names, and they are reused as they
 * stand rather than re-said in investor's own dialect. What follows is only what
 * genuinely did not exist: this area had no pages at all until now.
 *
 * WHAT MAY NEVER BE ADDED HERE. A sentence stating a return, a yield, an IRR, a
 * multiple or a projection. The concept note gives none, proj.project_financials
 * holds none, and the brief forbids unsupported financial-return calculations.
 * Financing need and revenue streams are things the PROJECT states, with a
 * source; a return is a claim about the future that this platform does not make.
 */

export type InvestorTextCode = keyof typeof TEXT;

const TEXT = {
  /* ------------------------------------------------------------- overview */
  overviewTitle: { key: 'investorArea.overview.title', en: 'Overview' },
  overviewLead: {
    key: 'investorArea.overview.lead',
    en: 'Where your organisation stands on this platform, what this area shows '
      + 'you and what it does not. Each section below holds the detail.',
  },
  overviewMeta: {
    key: 'investorArea.overview.meta',
    en: 'An investor organisation’s standing on the Sylva platform, and the '
      + 'financing information it may read.',
  },

  /* ------------------------------------------------ where an investor comes in
   * §4: investors "need financial data, and they come in once buyers have
   * committed". That is an OBSERVATION about how this market sequences, and the
   * platform does not turn it into a gate - proj.project_financials is released
   * by the vetting decision and by nothing else, and the table comment on it
   * records that as an open decision rather than a rule. So the sentence below
   * says both halves: what the note observes, and what the platform actually
   * enforces. Stating the observation as a rule would be inventing one. */
  sequenceTitle: {
    key: 'investorArea.sequence.title',
    en: 'Where an investor comes in',
  },
  sequenceBody: {
    key: 'investorArea.sequence.body',
    en: 'Sylva’s founding note describes investors as coming in once buyers have '
      + 'committed volume: units exist only after an independent body has verified '
      + 'the result, so most agreements here are commitments to future units '
      + 'rather than sales of existing stock.',
  },
  sequenceNotAGate: {
    key: 'investorArea.sequence.notAGate',
    en: 'That is how the market tends to order itself, and this platform does not '
      + 'turn it into a rule. Financing information is released by Sylva’s vetting '
      + 'decision on your organisation and by nothing else: no commitment '
      + 'threshold gates it. So the list of projects seeking finance is not a list '
      + 'of projects where buyers have already committed. Each project’s own page '
      + 'states what has been committed and what is left, per period, in that '
      + 'project’s own units.',
  },

  /* -------------------------------------------------------------- standing */
  standingTitle: { key: 'investorArea.standing.title', en: 'Vetting status' },
  standingApproved: {
    key: 'investorArea.standing.approved',
    en: 'Sylva has approved this organisation for the investor role. Financing '
      + 'information on published projects is open to you.',
  },
  standingWaiting: {
    key: 'investorArea.standing.waiting',
    en: 'Your investor questionnaire is with Sylva. No decision has been recorded '
      + 'yet, and financing information stays closed until one is.',
  },
  standingDeclined: {
    key: 'investorArea.standing.declined',
    en: 'Sylva has not approved this organisation for the investor role. The '
      + 'recorded decision and the reason Sylva gave are on the organisation page.',
  },
  standingNone: {
    key: 'investorArea.standing.none',
    en: 'No investor questionnaire has been recorded for this organisation. '
      + 'Financing information stays closed until Sylva records a decision.',
  },
  standingGate: {
    key: 'investorArea.standing.gate',
    en: 'This is not a setting in this interface. The row-level policy on the '
      + 'financing table asks sylva.is_vetted_investor(), so an unapproved '
      + 'organisation is returned no financing row by the database itself.',
  },
  standingSource: {
    key: 'investorArea.standing.source',
    en: 'Platform vetting record',
  },

  /* ------------------------------------------------------------- can / not */
  canTitle: { key: 'investorArea.can.title', en: 'What this area shows you' },
  canFinancing: {
    key: 'investorArea.can.financing',
    en: 'The financing need and the revenue streams each project has documented, '
      + 'with the source and date each figure was read from.',
  },
  canModel: {
    key: 'investorArea.can.model',
    en: 'The financial model, where the project owner has filed one, as a file '
      + 'you can download.',
  },
  canProjectPage: {
    key: 'investorArea.can.projectPage',
    en: 'Every published project page in full: outcomes, what is measured, the '
      + 'verifier, claim rights, long-term protection and the documents behind them.',
  },
  canQuestions: {
    key: 'investorArea.can.questions',
    en: 'A question to a project owner, asked on that project’s own page, and the '
      + 'answer once it is given.',
  },
  canRecord: {
    key: 'investorArea.can.record',
    en: 'The entries in the transaction record that your own organisation is a '
      + 'party to.',
  },

  cannotTitle: { key: 'investorArea.cannot.title', en: 'What this area does not show' },
  cannotReturns: {
    key: 'investorArea.cannot.returns',
    en: 'No return, no yield, no IRR and no projection. None is held anywhere on '
      + 'this platform. A financing need and a revenue stream are things a project '
      + 'states about itself; a return would be a claim about the future, and Sylva '
      + 'does not make one.',
  },
  cannotRanking: {
    key: 'investorArea.cannot.ranking',
    en: 'No ranking, no score and no recommendation. The projects are listed in '
      + 'alphabetical order and nothing on this platform advises you which to finance.',
  },
  cannotTotals: {
    key: 'investorArea.cannot.totals',
    en: 'No platform total. Two projects seeking finance are two separate '
      + 'conversations, and each issues units under its own scheme, so a summed '
      + 'figure across them would mean nothing. Rule 7.',
  },
  cannotBuyers: {
    key: 'investorArea.cannot.buyers',
    en: 'No other organisation’s position. A buyer’s registered sites, its '
      + 'commitments and its deal rooms are not readable by an investor account, '
      + 'and that is a database privilege rather than a hidden section.',
  },
  cannotSettlement: {
    key: 'investorArea.cannot.settlement',
    en: 'No payment, no escrow and no settlement. Agreements are signed away from '
      + 'this platform and the signed document is filed here as evidence.',
  },

  /* ------------------------------------------------------------- the counts */
  countsTitle: { key: 'investorArea.count.title', en: 'What you can read today' },
  countProjects: {
    key: 'investorArea.count.projects',
    en: 'projects seeking finance',
  },
  countInterests: { key: 'investorArea.count.interests', en: 'interest entries' },
  countNote: {
    key: 'investorArea.count.note',
    en: 'Both figures count ROWS this organisation may read - projects, and '
      + 'entries in the transaction record. Neither is a unit volume and neither '
      + 'is added to anything.',
  },

  /* ---------------------------------------------------- go-to-section blurbs */
  goTitle: { key: 'investorArea.go.title', en: 'The rest of this area' },
  goProjects: {
    key: 'investorArea.go.projects',
    en: 'Financing need, revenue streams and the financial model, project by project.',
  },
  goInterests: {
    key: 'investorArea.go.interests',
    en: 'The interest entries in the transaction record that name your organisation.',
  },
  goOrganisation: {
    key: 'investorArea.go.organisation',
    en: 'Your organisation record as Sylva holds it, and every vetting decision on it.',
  },

  /* ---------------------------------------------------- projects seeking finance */
  projectsTitle: {
    key: 'investorArea.projects.title',
    en: 'Projects seeking finance',
  },
  projectsLead: {
    key: 'investorArea.projects.lead',
    en: 'A project appears here when its owner has filed financing information for '
      + 'it. Every figure is the project’s own statement, with the source and the '
      + 'date it was read from underneath it.',
  },
  projectsMeta: {
    key: 'investorArea.projects.meta',
    en: 'Financing need, revenue streams and the financial model for projects '
      + 'seeking finance.',
  },
  projectsEmpty: {
    key: 'investorArea.projects.empty',
    en: 'No project has filed financing information yet. This is the whole list, '
      + 'not a filtered one.',
  },
  projectsUnitNote: {
    key: 'investorArea.projects.unitNote',
    en: 'Each project issues units under its own scheme, named beside it. Units of '
      + 'two different schemes are not the same thing and are never added together '
      + 'or compared as a quantity on this platform.',
  },
  projectsVersion: {
    key: 'investorArea.projects.version',
    en: 'Financing statement v{version}',
  },
  projectsOwner: { key: 'investorArea.projects.owner', en: 'Project owner' },
  /* NOT projectPage.investor.asOf. src/lib/projects/labels.ts declares that key
   * and supplies "As at" as its own fallback, but the catalogue has never held
   * it - so t() on it renders the key itself, which is what SIMULATION item 10
   * is about. This area carries its own entry and hands the key back. */
  projectsAsOf: { key: 'investorArea.projects.asOf', en: 'Figures as at' },
  projectsUnit: { key: 'investorArea.projects.unit', en: 'Unit issued' },
  projectsOpenProject: {
    key: 'investorArea.projects.openProject',
    en: 'Open the project page',
  },
  projectsDownloadModel: {
    key: 'investorArea.projects.downloadModel',
    en: 'Download the financial model',
  },
  projectsModelNone: {
    key: 'investorArea.projects.modelNone',
    en: 'No financial model has been filed for this project.',
  },
  projectsModelClosed: {
    key: 'investorArea.projects.modelClosed',
    en: 'A financial model is filed for this project but is not released to your '
      + 'organisation. Nothing about its contents is shown here.',
  },
  projectsOrderNote: {
    key: 'investorArea.projects.orderNote',
    en: 'Listed alphabetically by project name. That is not a ranking: nothing on '
      + 'this platform scores a project or recommends one to finance.',
  },
  /* The German column for revenue_streams_note does not exist in the schema, so
   * a reader in German is shown the note as the project filed it. Said out loud
   * rather than passed off as a translation. */
  projectsLocaleNote: {
    key: 'investorArea.projects.localeNote',
    en: 'A project’s statement of its revenue streams is shown in the language its '
      + 'owner filed it in. It is quoted, not translated: Sylva does not restate '
      + 'what a project says about its own finances.',
  },
  projectsVersionNote: {
    key: 'investorArea.projects.versionNote',
    en: 'A financing statement is versioned and never edited. The figures above are '
      + 'the newest version filed for each project; the earlier versions stay in '
      + 'the database and an auditor can read them.',
  },
  projectsNotAdvice: {
    key: 'investorArea.projects.notAdvice',
    en: 'Nothing on this page is investment advice, and verification of an '
      + 'ecological outcome is not a statement about financial return. The two are '
      + 'assessed separately.',
  },

  /* --------------------------------------------------- the not-vetted state */
  gateTitle: {
    key: 'investorArea.gate.title',
    en: 'Financing information is closed to this organisation',
  },
  gateBody: {
    key: 'investorArea.gate.body',
    en: 'Sylva releases a project’s financing need, its revenue streams and its '
      + 'financial model to investor organisations it has approved. Until that '
      + 'decision is recorded the database returns no financing row to this '
      + 'account, so the list below is empty for that reason and not because no '
      + 'project is seeking finance. Nothing is hidden behind a blurred figure: '
      + 'where a value is withheld, nothing stands in for it.',
  },
  gateStatusLink: { key: 'investorArea.gate.statusLink', en: 'See your vetting status' },

  /* ------------------------------------------------------------- interests */
  interestsTitle: { key: 'investorArea.interests.title', en: 'My interests' },
  interestsLead: {
    key: 'investorArea.interests.lead',
    en: 'Entries in the transaction record that name your organisation as the '
      + 'party who expressed interest in a project. The record is append-only, so '
      + 'an entry that has been superseded still appears here.',
  },
  interestsMeta: {
    key: 'investorArea.interests.meta',
    en: 'The interest entries in the transaction record that name this organisation.',
  },
  interestsEmpty: {
    key: 'investorArea.interests.empty',
    en: 'The transaction record holds no interest entry for your organisation.',
  },
  interestsWhoCanTitle: {
    key: 'investorArea.interests.whoCanTitle',
    en: 'Why this list is empty for an investor account',
  },
  interestsWhoCan: {
    key: 'investorArea.interests.whoCan',
    en: 'Expressing interest in a project is a buyer’s action in this release: it '
      + 'is what opens a private room with the project owner about taking a volume '
      + 'of units. An investor account holds read access to the transaction record '
      + 'and no insert on it, so this list stays empty for an investor until '
      + 'financing conversations are recorded - which is Phase 2, not a section '
      + 'missing from this page. To reach a project owner now, ask a question on '
      + 'the project’s own page.',
  },
  interestsNoVolume: {
    key: 'investorArea.interests.noVolume',
    en: 'This list spans several projects and therefore carries no quantity '
      + 'column. What it shows instead is the unit each project issues, which is '
      + 'the fact that makes those projects incomparable. Rule 7.',
  },
  interestsColProject: { key: 'investorArea.interests.colProject', en: 'Project' },
  interestsColUnit: { key: 'investorArea.interests.colUnit', en: 'Unit and scheme' },
  interestsColExpressed: { key: 'investorArea.interests.colExpressed', en: 'Expressed on' },
  interestsColEntry: { key: 'investorArea.interests.colEntry', en: 'Record entry' },
  interestsCaption: {
    key: 'investorArea.interests.caption',
    en: 'Interest entries in the transaction record naming this organisation',
  },
  interestsSource: {
    key: 'investorArea.interests.source',
    en: 'Platform transaction record',
  },

  /* ---------------------------------------------------------- organisation */
  organisationTitle: { key: 'investorArea.organisation.title', en: 'Organisation' },
  organisationLead: {
    key: 'investorArea.organisation.lead',
    en: 'Your organisation record as Sylva holds it, and every vetting decision '
      + 'recorded against it.',
  },
  organisationMeta: {
    key: 'investorArea.organisation.meta',
    en: 'The organisation record Sylva holds, and the vetting decisions on it.',
  },
  organisationMissing: {
    key: 'investorArea.organisation.missing',
    en: 'No organisation record could be read for this account.',
  },
  decisionsTitle: { key: 'investorArea.decisions.title', en: 'Vetting decisions' },
  decisionsLead: {
    key: 'investorArea.decisions.lead',
    en: 'One row per questionnaire submitted. org.vetting_decision is '
      + 'append-only: a suspension after an approval does not erase the approval, '
      + 'and this page does not either. Where the recorded decision and the '
      + 'effective answer differ, the effective one is the answer that decides '
      + 'what you may read.',
  },
  decisionsEmpty: {
    key: 'investorArea.decisions.empty',
    en: 'No vetting questionnaire has been recorded for this organisation.',
  },
  decisionsCaption: {
    key: 'investorArea.decisions.caption',
    en: 'Vetting submissions and decisions recorded for this organisation',
  },
  decisionsColRole: { key: 'investorArea.decisions.colRole', en: 'Role applied for' },
  decisionsColSubmitted: { key: 'investorArea.decisions.colSubmitted', en: 'Submitted' },
  decisionsColDecided: { key: 'investorArea.decisions.colDecided', en: 'Decided' },
  decisionsColDecision: { key: 'investorArea.decisions.colDecision', en: 'Recorded decision' },
  decisionsColEffective: { key: 'investorArea.decisions.colEffective', en: 'In force now' },
  decisionsColReason: { key: 'investorArea.decisions.colReason', en: 'Reason Sylva recorded' },
  decisionsNotDecided: { key: 'investorArea.decisions.notDecided', en: 'No decision recorded' },
  decisionsNoReason: { key: 'investorArea.decisions.noReason', en: 'No reason recorded' },
  decisionsInForce: { key: 'investorArea.decisions.inForce', en: 'In force' },
  decisionsNotInForce: { key: 'investorArea.decisions.notInForce', en: 'Not in force' },
  decisionsBy: { key: 'investorArea.decisions.by', en: 'Decided by Sylva' },
  /* Why the "recorded decision" cell is not translated. org.vetting_decision
   * holds more states than a three-word vocabulary can carry - suspended and
   * revoked are not the same fact as declined - and flattening them would
   * misreport the chain. The recorded value is printed as recorded, and the
   * plain-language answer is the "in force now" column beside it. */
  decisionsRawNote: {
    key: 'investorArea.decisions.rawNote',
    en: 'The recorded decision is printed as Sylva recorded it, in the words the '
      + 'vetting record uses. It is not restated in other words here, because a '
      + 'suspension and a decline are different facts and the difference matters. '
      + 'The plain answer to “what may my organisation do today” is the column '
      + 'beside it.',
  },
  decisionsNoEta: {
    key: 'investorArea.decisions.noEta',
    en: 'No target time for a decision is published, so this page does not '
      + 'estimate one.',
  },

  /* ------------------------------------------------------------- refusals */
  errorDenied: {
    key: 'investorArea.error.denied',
    en: 'The database refused this read for your account, so this section cannot '
      + 'be shown. It is not empty - it is unreadable by you. Nothing is wrong '
      + 'with your organisation record.',
  },
  errorUnavailable: {
    key: 'investorArea.error.unavailable',
    en: 'This section could not be read just now. Nothing has been changed. '
      + 'Please try again, and tell Sylva if it keeps happening.',
  },
} as const;

type Translator = {
  (key: string, values?: Record<string, string | number>): string;
  has?: (key: string) => boolean;
};

export function investorText(t: Translator, code: InvestorTextCode): string {
  const m = TEXT[code];
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.en;
}

/** The same, for the two sentences that carry a value. */
export function investorTextWith(
  t: Translator,
  code: InvestorTextCode,
  values: Record<string, string | number>,
): string {
  const m = TEXT[code];
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key, values);
  } catch {
    /* fall through to the English sentence */
  }
  return m.en.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * Which sentence a failed read gets. 42501 is PostgreSQL's "insufficient
 * privilege", and saying so matters here more than anywhere: an investor who is
 * shown an empty financing list must be able to tell "nothing to show" from
 * "not readable by you". Never a stack trace, and never the SQL.
 */
export function investorErrorCode(err: unknown): InvestorTextCode {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  return code === '42501' ? 'errorDenied' : 'errorUnavailable';
}

/** The key every code maps to. Used by the i18n hand-over, not by a page. */
export const INVESTOR_TEXT_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(Object.values(TEXT).map((m) => [m.key, m.en]));
