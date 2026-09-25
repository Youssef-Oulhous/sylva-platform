import { label, labelFor, type Label } from '@/lib/projects/labels';

/**
 * Sentences the four new operator pages need.
 *
 * `src/messages/en.json` and `de.json` are owned by another agent, so nothing
 * here writes to them. Each entry below is a KEY plus the English sentence to
 * show until that key lands, and `label()` asks next-intl whether the key
 * exists rather than rendering "adminArea.record.title" at a reader. The keys
 * and their German are handed over with this change.
 *
 * Keys reach `t()` as VALUES, never as literals, so scripts/check-i18n.ts
 * counts them as runtime keys instead of failing on keys the catalogue does
 * not carry yet. When they land, nothing in this file changes.
 *
 * The namespace is `adminArea.` and not `adminUi.`: the latter belongs to the
 * vetting and project-review screens that already existed, and mixing the two
 * would make it impossible to tell which pass a string arrived with.
 */

export { label, labelFor };
export type { Label };

const mk = (key: string, fallbackEn: string): Label => ({ key, fallbackEn });

type Translator = {
  (key: string, values?: Record<string, string | number>): string;
  has?: (key: string) => boolean;
};

/**
 * The plural forms a fallback sentence can carry.
 *
 * Several of the labels below are counts, and a count reads wrong in both
 * languages without plural rules - "1 entries", "1 Einträge". So the
 * English fallbacks are written as ICU messages, the same text handed over for
 * the catalogue, and this resolves the two forms an English fallback needs
 * (`=0`, `one`, `other`) rather than printing the ICU source at a reader. It is
 * deliberately not a general ICU implementation: the moment the key lands,
 * next-intl renders the real thing and this code never runs for that label.
 */
function renderFallback(
  text: string,
  values: Record<string, string | number>,
): string {
  const plural = /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^{}]*\})*)\}/g;
  const withPlurals = text.replace(plural, (whole, name: string, body: string) => {
    const raw = values[name];
    if (raw === undefined) return whole;
    const n = Number(raw);
    const forms = new Map<string, string>();
    const arm = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
    for (let m = arm.exec(body); m !== null; m = arm.exec(body)) {
      forms.set(m[1]!, m[2]!);
    }
    const chosen =
      forms.get(`=${n}`) ?? (n === 1 ? forms.get('one') : undefined) ?? forms.get('other');
    if (chosen === undefined) return whole;
    return chosen.replace(/#/g, String(raw));
  });
  return withPlurals.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/** `label()`, for a message that takes values. */
export function labelWith(
  t: Translator,
  l: Label,
  values: Record<string, string | number>,
): string {
  try {
    if (typeof t.has === 'function' && t.has(l.key)) return t(l.key, values);
  } catch {
    /* fall through to the English sentence */
  }
  return renderFallback(l.fallbackEn, values);
}

/* ======================================================= shared furniture */

export const AREA = {
  eyebrow: mk('adminArea.eyebrow', 'Sylva operations'),
  /** Said on every page that shows another organisation's private material. */
  restricted: mk(
    'adminArea.restricted',
    'This page shows material that belongs to other organisations. The database '
    + 'is what restricts it, not this page: every query here runs as the '
    + 'operator role, and no other role holds a policy that would return these '
    + 'rows.',
  ),
  countsAreRows: mk(
    'adminArea.countsAreRows',
    'Every figure on this page counts rows — applications, projects, questions, '
    + 'entries. None of them is a unit volume, so nothing here is added across '
    + 'projects.',
  ),
  readFailed: mk(
    'adminArea.readFailed',
    'This section could not be read from the database just now. Nothing has '
    + 'been changed. Reload the page, and if it keeps failing the database is '
    + 'not answering.',
  ),
  notRecorded: mk('adminArea.notRecorded', 'Not recorded'),
  open: mk('adminArea.open', 'Open'),
  nothingWaiting: mk('adminArea.nothingWaiting', 'Nothing is waiting here.'),
} as const;

/* ========================================================= /admin overview */

export const OVERVIEW = {
  title: mk('adminArea.overview.title', 'What is waiting'),
  lead: mk(
    'adminArea.overview.lead',
    'The work an operator owes somebody else: applications waiting for a '
    + 'decision, projects waiting to be reviewed, and questions nobody has '
    + 'answered. Each line is a link to the screen where the work is done.',
  ),
  sourceLabel: mk(
    'adminArea.overview.sourceLabel',
    'Sylva operations queue, read from the database',
  ),

  vettingTitle: mk('adminArea.overview.vettingTitle', 'Applications to decide'),
  vettingLead: mk(
    'adminArea.overview.vettingLead',
    'An organisation cannot take part in a deal until Sylva has approved it, so '
    + 'an application left here is an organisation left unable to transact.',
  ),
  vettingEmpty: mk(
    'adminArea.overview.vettingEmpty',
    'No application is waiting for a decision.',
  ),
  vettingAll: mk('adminArea.overview.vettingAll', 'Open the vetting queue'),

  projectsTitle: mk('adminArea.overview.projectsTitle', 'Projects to review'),
  projectsLead: mk(
    'adminArea.overview.projectsLead',
    'Projects that are not on the public index yet. The number beside each one '
    + 'is how many of the ten publication-gate items are still missing, read '
    + 'from proj.publication_gaps() a moment ago.',
  ),
  projectsEmpty: mk(
    'adminArea.overview.projectsEmpty',
    'Every project recorded is published.',
  ),
  projectsAll: mk('adminArea.overview.projectsAll', 'Open project review'),
  gapsNone: mk('adminArea.overview.gapsNone', 'Gate complete — ready to publish'),
  gapsSome: mk(
    'adminArea.overview.gapsSome',
    '{count, plural, one {# gate item missing} other {# gate items missing}}',
  ),

  questionsTitle: mk('adminArea.overview.questionsTitle', 'Questions unanswered'),
  questionsLead: mk(
    'adminArea.overview.questionsLead',
    'A question asked about a project goes to the project owner and to Sylva. '
    + 'These are the ones no answer has been recorded against.',
  ),
  questionsEmpty: mk(
    'adminArea.overview.questionsEmpty',
    'Every question asked has an answer recorded against it.',
  ),
  questionsAll: mk('adminArea.overview.questionsAll', 'Read the questions'),

  orgsTitle: mk('adminArea.overview.orgsTitle', 'Organisations with no approval'),
  orgsLead: mk(
    'adminArea.overview.orgsLead',
    'Registered, and holding no approval for any role. The database will refuse '
    + 'a deal for each of them until a decision is recorded.',
  ),
  orgsEmpty: mk(
    'adminArea.overview.orgsEmpty',
    'Every organisation registered holds at least one approval.',
  ),
  orgsAll: mk('adminArea.overview.orgsAll', 'Open the organisations list'),

  recordTitle: mk('adminArea.overview.recordTitle', 'The transaction record'),
  recordLead: mk(
    'adminArea.overview.recordLead',
    'Append-only. Nothing on it is edited or deleted; a mistake is corrected by '
    + 'a later entry that points at it and the original stays visible.',
  ),
  recordEntries: mk(
    'adminArea.overview.recordEntries',
    '{count, plural, one {# entry} other {# entries}}',
  ),
  recordNotPublic: mk(
    'adminArea.overview.recordNotPublic',
    '{count, plural, one {# entry the public record does not reach} other {# entries the public record does not reach}}',
  ),
  recordCorrections: mk(
    'adminArea.overview.recordCorrections',
    '{count, plural, one {# correcting entry} other {# correcting entries}}',
  ),
  recordAll: mk('adminArea.overview.recordAll', 'Open the transaction record'),
  recordLatest: mk('adminArea.overview.recordLatest', 'Most recent entry'),

  /* The figure strips. A plain noun under each number, never a second copy of
     the number: "12" over "12 organisations registered" reads as two facts. */
  figProjects: mk('adminArea.overview.figProjects', 'Projects recorded'),
  figPublished: mk('adminArea.overview.figPublished', 'On the public index'),
  figQuestionsOpen: mk('adminArea.overview.figQuestionsOpen', 'Unanswered'),
  figQuestionsTotal: mk('adminArea.overview.figQuestionsTotal', 'Asked in total'),
  figOrgs: mk('adminArea.overview.figOrgs', 'Registered'),
  figOrgsApproved: mk('adminArea.overview.figOrgsApproved', 'Holding an approval'),
  figEntries: mk('adminArea.overview.figEntries', 'Entries'),
  figNotPublic: mk(
    'adminArea.overview.figNotPublic',
    'Entries the public record does not reach',
  ),
  figCorrections: mk('adminArea.overview.figCorrections', 'Correcting entries'),
  vettingCount: mk(
    'adminArea.overview.vettingCount',
    '{count, plural, =0 {none waiting} one {# waiting} other {# waiting}}',
  ),
  colApplications: mk('adminArea.overview.colApplications', 'Applications'),
  colQuestion: mk('adminArea.overview.colQuestion', 'The question'),

  waitingDays: mk(
    'adminArea.overview.waitingDays',
    '{count, plural, =0 {today} one {# day} other {# days}}',
  ),
  waitingSince: mk('adminArea.overview.waitingSince', 'Waiting'),
  colOrganisation: mk('adminArea.overview.colOrganisation', 'Organisation'),
  colRole: mk('adminArea.overview.colRole', 'Role applied for'),
  colProject: mk('adminArea.overview.colProject', 'Project'),
  colStatus: mk('adminArea.overview.colStatus', 'State'),
  colAsked: mk('adminArea.overview.colAsked', 'Asked'),
  colGate: mk('adminArea.overview.colGate', 'Publication gate'),
  vettingCaption: mk(
    'adminArea.overview.vettingCaption',
    'Applications with no decision recorded against them, longest waiting first',
  ),
  projectsCaption: mk(
    'adminArea.overview.projectsCaption',
    'Projects not yet on the public index, and what their publication gate still wants',
  ),
  questionsCaption: mk(
    'adminArea.overview.questionsCaption',
    'Questions with no recorded answer, longest waiting first',
  ),
} as const;

/* =========================================================== /admin/record */

export const RECORD = {
  title: mk('adminArea.record.title', 'Transaction record'),
  lead: mk(
    'adminArea.record.lead',
    'Every entry the record holds, including the ones the public page cannot '
    + 'reach, with each counterparty under its real name. The public version '
    + 'shows a pseudonym such as “Buyer 003” unless that deal was flagged for '
    + 'disclosure, and it drops entries on projects that were never published.',
  ),
  whyIdentity: mk(
    'adminArea.record.whyIdentity',
    'Naming the counterparty is restricted to Sylva operators and to auditors. '
    + 'A buyer’s identity is pseudonymous on the public record by rule, and '
    + 'resolving it is a duty of operating the platform — confirming a record, '
    + 'answering an audit — not a convenience.',
  ),
  sourceLabel: mk(
    'adminArea.record.sourceLabel',
    'record.entry, read as a Sylva operator',
  ),

  filterTitle: mk('adminArea.record.filterTitle', 'Narrow the record'),
  filterProject: mk('adminArea.record.filterProject', 'Project'),
  filterEvent: mk('adminArea.record.filterEvent', 'Event type'),
  filterScope: mk('adminArea.record.filterScope', 'Which entries'),
  scopeAll: mk('adminArea.record.scopeAll', 'All entries'),
  scopeNotPublic: mk(
    'adminArea.record.scopeNotPublic',
    'Only entries the public record does not reach',
  ),
  scopeCorrections: mk('adminArea.record.scopeCorrections', 'Only correcting entries'),
  allProjects: mk('adminArea.record.allProjects', 'All projects'),
  allEvents: mk('adminArea.record.allEvents', 'All event types'),
  apply: mk('adminArea.record.apply', 'Apply'),
  clear: mk('adminArea.record.clear', 'Clear'),
  filterInUrl: mk(
    'adminArea.record.filterInUrl',
    'The filter is part of the address of this page, so a filtered view opens '
    + 'the same way for whoever it is sent to.',
  ),
  ignoredProject: mk(
    'adminArea.record.ignoredProject',
    'The address asked for a project this record does not hold, so the project '
    + 'filter was not applied.',
  ),
  ignoredEvent: mk(
    'adminArea.record.ignoredEvent',
    'The address asked for an event type that does not exist, so the event '
    + 'filter was not applied.',
  ),

  count: mk(
    'adminArea.record.count',
    '{count, plural, =0 {No entries} one {# entry} other {# entries}} match this filter.',
  ),
  showing: mk('adminArea.record.showing', 'Showing {from}–{to} of {total}'),
  prev: mk('adminArea.record.prev', 'Previous'),
  next: mk('adminArea.record.next', 'Next'),
  empty: mk(
    'adminArea.record.empty',
    'No entry matches that filter. Nothing has been hidden; there is nothing there.',
  ),

  caption: mk(
    'adminArea.record.caption',
    'Every recorded entry, with its counterparty named and whether the public record reaches it',
  ),
  colRef: mk('adminArea.record.colRef', 'Entry'),
  colOccurred: mk('adminArea.record.colOccurred', 'Occurred'),
  colEvent: mk('adminArea.record.colEvent', 'Event'),
  colProject: mk('adminArea.record.colProject', 'Project'),
  colCounterparty: mk('adminArea.record.colCounterparty', 'Counterparty'),
  colRecordedBy: mk('adminArea.record.colRecordedBy', 'Recorded by'),
  colPublic: mk('adminArea.record.colPublic', 'On the public record'),
  colCorrection: mk('adminArea.record.colCorrection', 'Corrections'),
  colSource: mk('adminArea.record.colSource', 'Source'),

  publicYes: mk('adminArea.record.publicYes', 'Yes'),
  publicNo: mk('adminArea.record.publicNo', 'No'),
  notPublicBecauseProject: mk(
    'adminArea.record.notPublicBecauseProject',
    'the project is not published',
  ),
  notPublicBecauseType: mk(
    'adminArea.record.notPublicBecauseType',
    'this event type is not public',
  ),
  publicNames: mk('adminArea.record.publicNames', 'named publicly'),
  publicPseudonym: mk('adminArea.record.publicPseudonym', 'shown publicly as {label}'),
  publicNoLabel: mk(
    'adminArea.record.publicNoLabel',
    'no public label allocated',
  ),
  counterpartyOwner: mk('adminArea.record.counterpartyOwner', 'Project owner'),
  counterpartyBuyer: mk('adminArea.record.counterpartyBuyer', 'Buyer'),
  recordedByPerson: mk('adminArea.record.recordedByPerson', 'Recorded under the label'),
  corrects: mk('adminArea.record.corrects', 'Corrects {ref}'),
  supersededBy: mk('adminArea.record.supersededBy', 'Corrected by {ref}'),
  correctionReason: mk('adminArea.record.correctionReason', 'Reason:'),
  correctionNone: mk('adminArea.record.correctionNone', '—'),
  sourceMissing: mk(
    'adminArea.record.sourceMissing',
    'No source recorded against this entry',
  ),
  refFull: mk('adminArea.record.refFull', 'Full entry reference: {ref}'),

  /* --------------------------------------------------- the correction form */
  correctTitle: mk('adminArea.record.correctTitle', 'Record a correcting entry'),
  correctLead: mk(
    'adminArea.record.correctLead',
    'A mistake in the record is corrected by adding an entry that points at the '
    + 'wrong one. Choose the entry, say what is wrong with it, and the '
    + 'correction is written as a new row.',
  ),
  correctWarning: mk(
    'adminArea.record.correctWarning',
    'Nothing is edited and nothing is deleted. The entry you correct keeps its '
    + 'row, its wording and its date, and stays visible on this page and on the '
    + 'public record for ever — marked as corrected, with your reason beside '
    + 'it. This cannot be undone, and a correcting entry cannot be withdrawn: '
    + 'it can only be corrected in turn.',
  ),
  correctEntry: mk('adminArea.record.correctEntry', 'Entry to correct'),
  correctChoose: mk('adminArea.record.correctChoose', 'Choose an entry'),
  correctReason: mk('adminArea.record.correctReason', 'What is wrong with it'),
  correctReasonHint: mk(
    'adminArea.record.correctReasonHint',
    'At least ten characters. This wording is part of the record for ever and '
    + 'cannot be edited afterwards, so write it for a reader in five years.',
  ),
  correctSubmit: mk('adminArea.record.correctSubmit', 'Record the correction'),
  correctDone: mk(
    'adminArea.record.correctDone',
    'Recorded. The correcting entry is in the table above, and the entry it '
    + 'points at is marked as corrected.',
  ),
  correctNoneEligible: mk(
    'adminArea.record.correctNoneEligible',
    'Every entry in this view has already been corrected. An entry may be '
    + 'corrected once; a correcting entry that is itself wrong is corrected in '
    + 'the same way.',
  ),
  correctEligible: mk(
    'adminArea.record.correctEligible',
    '{count, plural, one {# entry in this view can still be corrected} other {# entries in this view can still be corrected}}',
  ),
  correctOnlyThisPage: mk(
    'adminArea.record.correctOnlyThisPage',
    'The list offers the entries shown above. Filter the record to reach '
    + 'another one.',
  ),
} as const;

/* ======================================================== /admin/questions */

export const QUESTIONS = {
  title: mk('adminArea.questions.title', 'Questions'),
  lead: mk(
    'adminArea.questions.lead',
    'A question asked about a project goes to the project owner and to Sylva. '
    + 'There is no public comment feed, so this page is where Sylva reads them.',
  ),
  whyIdentity: mk(
    'adminArea.questions.whyIdentity',
    'The organisation that asked is named here, and so is the one that '
    + 'answered. A question is not part of the public record and neither is '
    + 'this page; only Sylva operators, auditors, the project owner and the '
    + 'asker can read a question at all.',
  ),
  sourceLabel: mk(
    'adminArea.questions.sourceLabel',
    'deal.project_question, read as a Sylva operator',
  ),
  answerRule: mk(
    'adminArea.questions.answerRule',
    'Answers are recorded by the project owner. Nothing on this page writes '
    + 'one: whether Sylva answers on an owner’s behalf is not settled by the '
    + 'pilot material, so it is not offered here.',
  ),

  listTitle: mk('adminArea.questions.listTitle', 'Every question asked'),
  filterSubmit: mk('adminArea.questions.filterSubmit', 'Show these'),
  filterAll: mk('adminArea.questions.filterAll', 'All questions'),
  filterOpen: mk('adminArea.questions.filterOpen', 'Unanswered only'),
  filterAnswered: mk('adminArea.questions.filterAnswered', 'Answered only'),
  filterLabel: mk('adminArea.questions.filterLabel', 'Which questions'),

  count: mk(
    'adminArea.questions.count',
    '{count, plural, =0 {No questions} one {# question} other {# questions}}',
  ),
  openCount: mk(
    'adminArea.questions.openCount',
    '{count, plural, =0 {none unanswered} one {# unanswered} other {# unanswered}}',
  ),
  empty: mk(
    'adminArea.questions.empty',
    'No question matches that filter.',
  ),
  emptyAll: mk(
    'adminArea.questions.emptyAll',
    'No question has been asked yet. One appears here the moment a buyer or an '
    + 'investor sends it.',
  ),

  asked: mk('adminArea.questions.asked', 'Asked'),
  askedBy: mk('adminArea.questions.askedBy', 'Asked by'),
  about: mk('adminArea.questions.about', 'About'),
  answered: mk('adminArea.questions.answered', 'Answered'),
  answeredBy: mk('adminArea.questions.answeredBy', 'Answered by'),
  unanswered: mk('adminArea.questions.unanswered', 'Unanswered'),
  waiting: mk('adminArea.questions.waiting', 'Waiting {days}'),
  waitingDays: mk(
    'adminArea.questions.waitingDays',
    '{count, plural, =0 {since today} one {# day} other {# days}}',
  ),
  askerLabel: mk('adminArea.questions.askerLabel', 'Appears on the record as'),
  askerLabelNone: mk(
    'adminArea.questions.askerLabelNone',
    'No record label allocated — this organisation has asked a question and has '
    + 'no deal on this project',
  ),
  noPublicThread: mk(
    'adminArea.questions.noPublicThread',
    'There is no public comment thread anywhere on this platform. A question is '
    + 'read by the asker, the project owner, Sylva and an auditor, and by nobody '
    + 'else; it never appears on the project page or on the public record.',
  ),
  owner: mk('adminArea.questions.owner', 'Project owner'),
  viewProject: mk('adminArea.questions.viewProject', 'Open the project page'),
  answerCount: mk(
    'adminArea.questions.answerCount',
    '{count, plural, one {# answer recorded} other {# answers recorded}}',
  ),
} as const;

/* ==================================================== /admin/organisations */

export const ORGS = {
  title: mk('adminArea.orgs.title', 'Organisations'),
  lead: mk(
    'adminArea.orgs.lead',
    'Every organisation registered on the platform, the roles it asked for, the '
    + 'approval it holds for each, and the decisions those approvals were read '
    + 'from.',
  ),
  derivedNote: mk(
    'adminArea.orgs.derivedNote',
    'An approval is never set. It is read back from the decision chain by a '
    + 'trigger, so an approval with no decision behind it, or a decision that '
    + 'has not produced the approval it should have, is a fault worth reporting.',
  ),
  r6Note: mk(
    'adminArea.orgs.r6Note',
    'No deal can be created for an organisation Sylva has not approved. An '
    + 'organisation with an empty approval column is one the database will '
    + 'refuse a deal to today.',
  ),
  sourceLabel: mk(
    'adminArea.orgs.sourceLabel',
    'org.organisation with its approvals and decisions, read as a Sylva operator',
  ),
  peopleNote: mk(
    'adminArea.orgs.peopleNote',
    'People are counted, not listed. Personal data sits in one table and a page '
    + 'that printed every employee of every organisation would be collecting it '
    + 'into one screen for no stated purpose.',
  ),

  listTitle: mk('adminArea.orgs.listTitle', 'Every organisation registered'),
  caption: mk(
    'adminArea.orgs.caption',
    'Organisations, the approval held for each role, and the decisions it was read from',
  ),
  colOrg: mk('adminArea.orgs.colOrg', 'Organisation'),
  colCountry: mk('adminArea.orgs.colCountry', 'Country'),
  colClass: mk('adminArea.orgs.colClass', 'Sector and size'),
  colApprovals: mk('adminArea.orgs.colApprovals', 'Approval held'),
  colDecisions: mk('adminArea.orgs.colDecisions', 'Decisions recorded'),
  colPeople: mk('adminArea.orgs.colPeople', 'People'),
  noApproval: mk('adminArea.orgs.noApproval', 'No approval'),
  noDecision: mk('adminArea.orgs.noDecision', 'No decision recorded'),
  applications: mk(
    'adminArea.orgs.applications',
    '{count, plural, =0 {no applications} one {# application} other {# applications}}',
  ),
  peopleCount: mk(
    'adminArea.orgs.peopleCount',
    '{count, plural, =0 {no accounts} one {# account} other {# accounts}}',
  ),
  decisionCurrent: mk(
    'adminArea.orgs.decisionCurrent',
    'The approval above is read from this decision',
  ),
  decide: mk('adminArea.orgs.decide', 'Decide'),
  count: mk(
    'adminArea.orgs.count',
    '{count, plural, one {# organisation} other {# organisations}}',
  ),

  /* -------------------------------------------------- pseudonym resolution */
  resolveTitle: mk('adminArea.orgs.resolveTitle', 'Resolve a pseudonym'),
  resolveLead: mk(
    'adminArea.orgs.resolveLead',
    'A buyer appears on the public record as a label such as “Buyer 003” unless '
    + 'that deal was flagged for disclosure. Enter a label to read which '
    + 'organisation is behind it.',
  ),
  resolveWhy: mk(
    'adminArea.orgs.resolveWhy',
    'Only a Sylva operator and an auditor may do this. A buyer’s identity is '
    + 'pseudonymous by rule, and that rule is the reason a buyer is willing to '
    + 'appear on a public record at all — so the platform does not print the '
    + 'labels and the names side by side. You ask for one label at a time, and '
    + 'each lookup is written to the access log with your organisation, the '
    + 'label you asked for and the time.',
  ),
  resolveField: mk('adminArea.orgs.resolveField', 'Pseudonym'),
  resolveHint: mk(
    'adminArea.orgs.resolveHint',
    'As it appears on the record, for example “Buyer 003”. Case does not matter.',
  ),
  resolveClear: mk('adminArea.orgs.resolveClear', 'Clear the lookup'),
  resolveSubmit: mk('adminArea.orgs.resolveSubmit', 'Resolve'),
  resolveNone: mk(
    'adminArea.orgs.resolveNone',
    'No pseudonym with that label has been allocated. Nothing was looked up.',
  ),
  resolveTooShort: mk(
    'adminArea.orgs.resolveTooShort',
    'Enter the label as it appears on the record, for example “Buyer 003”.',
  ),
  resolveResult: mk('adminArea.orgs.resolveResult', 'What that label stands for'),
  resolveScopeDeal: mk(
    'adminArea.orgs.resolveScopeDeal',
    'Allocated for one deal',
  ),
  resolveScopeProject: mk(
    'adminArea.orgs.resolveScopeProject',
    'Allocated for one project',
  ),
  resolveColLabel: mk('adminArea.orgs.resolveColLabel', 'Label'),
  resolveColScope: mk('adminArea.orgs.resolveColScope', 'Scope'),
  resolveColProject: mk('adminArea.orgs.resolveColProject', 'Project'),
  resolveColOrg: mk('adminArea.orgs.resolveColOrg', 'Organisation behind it'),
  resolveColDisclosed: mk('adminArea.orgs.resolveColDisclosed', 'Named publicly'),
  resolveColAllocated: mk('adminArea.orgs.resolveColAllocated', 'Allocated'),
  resolveCaption: mk(
    'adminArea.orgs.resolveCaption',
    'The organisation behind the pseudonym asked for',
  ),
  resolveDisclosedYes: mk(
    'adminArea.orgs.resolveDisclosedYes',
    'Yes — this deal is flagged for disclosure, so the public record names it',
  ),
  resolveDisclosedNo: mk(
    'adminArea.orgs.resolveDisclosedNo',
    'No — the public record shows only the label',
  ),
  resolveLogged: mk(
    'adminArea.orgs.resolveLogged',
    'This lookup was written to the access log.',
  ),
} as const;

/* ===================================================== errors, as sentences */

/**
 * Failures the four new pages can produce, in words.
 *
 * Kept beside the labels rather than in errors.ts because each one is a
 * sentence about the record, and because AdminErrorCode is a closed union that
 * the vetting and project screens share. The codes below travel in a query
 * string, so `isCorrectionError()` validates them on the way back in.
 */
export const CORRECTION_ERROR = {
  invalid_input: mk(
    'adminArea.record.error.invalidInput',
    'That correction could not be read. Choose an entry from the list and write '
    + 'a reason, then send it again.',
  ),
  reason_required: mk(
    'adminArea.record.error.reasonRequired',
    'A correction needs a reason of at least ten characters. The record is '
    + 'append-only, so an entry recorded without one can never be edited to '
    + 'explain itself.',
  ),
  unknown_entry: mk(
    'adminArea.record.error.unknownEntry',
    'That entry is not one this record holds. It may have been filtered out of '
    + 'the view the form was sent from.',
  ),
  already_corrected: mk(
    'adminArea.record.error.alreadyCorrected',
    'That entry has already been corrected, and an entry may be corrected once. '
    + 'The correction that points at it can itself be corrected.',
  ),
  too_deep: mk(
    'adminArea.record.error.tooDeep',
    'That entry is at the end of a chain of ten corrections, which is as far as '
    + 'the record allows. A chain that long is a sign the entry should be '
    + 'settled off the platform first.',
  ),
  refused: mk(
    'adminArea.record.error.refused',
    'The database refused this correction. Nothing was written, and nothing in '
    + 'the record has changed.',
  ),
  no_access: mk(
    'adminArea.record.error.noAccess',
    'You don’t have access to this information.',
  ),
} as const;

export type CorrectionErrorCode = keyof typeof CORRECTION_ERROR;

export function isCorrectionError(value: unknown): value is CorrectionErrorCode {
  return typeof value === 'string' && Object.hasOwn(CORRECTION_ERROR, value);
}

/** Every key this module can render, for the i18n hand-over. */
export const ADMIN_AREA_KEYS: Readonly<Record<string, string>> = Object.fromEntries(
  [AREA, OVERVIEW, RECORD, QUESTIONS, ORGS, CORRECTION_ERROR]
    .flatMap((group) => Object.values(group))
    .map((l) => [l.key, l.fallbackEn]),
);
