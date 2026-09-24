import { label, labelFor, type Label } from '@/lib/projects/labels';

/**
 * Every sentence the auditor's view needs, as a KEY plus the English wording to
 * show until that key lands in src/messages/*.json.
 *
 * src/messages/en.json and de.json are owned by another agent, so this module
 * follows the pattern src/lib/projects/labels.ts and src/lib/record/labels.ts
 * established. The keys are passed to t() as VALUES rather than literals, so
 * `npm run check:i18n` counts them as runtime keys instead of failing on keys
 * the catalogue does not have yet. When they land, nothing here changes.
 *
 * The keys are returned with this change in i18nKeys, in English and in German.
 */

export { label, labelFor };
export type { Label };

const mk = (key: string, fallbackEn: string): Label => ({ key, fallbackEn });

/* ------------------------------------------------------------------ chrome */

export const AUDIT = {
  title: mk('auditor.title', 'Auditor view'),
  lead: mk(
    'auditor.lead',
    'Everything this platform holds about projects, documents, deals and the '
    + 'transaction record, read as it is stored. This view adds nothing and '
    + 'changes nothing.',
  ),

  readOnlyTitle: mk('auditor.readOnly.title', 'This role cannot change anything'),
  readOnlyBody: mk(
    'auditor.readOnly.body',
    'The auditor role is read-only in the database itself, not in this '
    + 'interface. The PostgreSQL role sylva_auditor holds SELECT and no other '
    + 'privilege on any table or column, so an insert, an update or a delete '
    + 'is refused by the database before any application code sees it. There '
    + 'is therefore no edit control anywhere in this view, and adding one '
    + 'would not make a change possible.',
  ),
  readOnlyChecked: mk(
    'auditor.readOnly.checked',
    'Checked against this database when the page was loaded:',
  ),
  guardPassed: mk('auditor.guard.passed', 'passed'),
  guardFailed: mk('auditor.guard.failed', 'FAILED'),
  guardNames: mk('auditor.guard.names', 'Database guarantee'),

  erasureTitle: mk('auditor.erasure.title', 'When a person’s name is missing'),
  erasureBody: mk(
    'auditor.erasure.body',
    'Personal data lives in one table. A person can be erased on request, and '
    + 'the transaction record deliberately holds no foreign key to that table, '
    + 'so erasing a person removes the name and leaves every entry they made '
    + 'exactly as it was. An entry that shows “Former member” has not been '
    + 'altered: the organisation, the role at the time and the entry itself '
    + 'are unchanged, and only the lookup from the entry to the person now '
    + 'fails. Auditor visibility of named individuals therefore narrows over '
    + 'time, by design. Read this as erasure, never as tampering.',
  ),
  formerMember: mk('auditor.person.formerMember', 'Former member'),
  unknownOrg: mk('auditor.person.unknownOrg', 'Organisation not resolved'),
  noPerson: mk('auditor.person.none', 'No individual recorded'),

  namesTitle: mk('auditor.names.title', 'Organisation names are shown in full'),
  namesBody: mk(
    'auditor.names.body',
    'Every other role sees a per-deal label such as “Buyer 004” where a '
    + 'counterparty has not agreed to be named. An auditor sees the legal name '
    + 'instead, because the pseudonym exists to protect a commercial position '
    + 'from other buyers, not to withhold it from assurance. The label each '
    + 'deal shows publicly is printed beside the name so the two can be '
    + 'reconciled.',
  ),

  scopeTitle: mk('auditor.scope.title', 'What this view covers'),
  scopeBody: mk(
    'auditor.scope.body',
    'Projects including drafts, the documents behind them and their hashes, '
    + 'the full transaction record including entries that do not reach the '
    + 'public record, registry references, deal records, and the verification '
    + 'information attached to each outcome indicator.',
  ),
  scopeGap: mk(
    'auditor.scope.gap',
    'Not covered, because the role holds no privilege on them: agreed deal '
    + 'terms, commitments and interest volumes. Those tables are part of the '
    + 'deal room, which is not built. See the note returned with this change.',
  ),
} as const;

/* ---------------------------------------------------------------- sections */

export const NAV = {
  overview: mk('auditor.nav.overview', 'Overview'),
  record: mk('auditor.nav.record', 'Transaction record'),
  projects: mk('auditor.nav.projects', 'Projects'),
  deals: mk('auditor.nav.deals', 'Deals'),
  organisations: mk('auditor.nav.organisations', 'Organisations'),
  accessLog: mk('auditor.nav.accessLog', 'Access log'),
  label: mk('auditor.nav.label', 'Auditor sections'),
} as const;

export const OVERVIEW = {
  countsTitle: mk('auditor.overview.countsTitle', 'What is held'),
  projects: mk('auditor.overview.projects', 'Projects'),
  projectsPublished: mk('auditor.overview.projectsPublished', 'of which published'),
  organisations: mk('auditor.overview.organisations', 'Organisations'),
  approvals: mk('auditor.overview.approvals', 'Approved organisation roles'),
  entries: mk('auditor.overview.entries', 'Record entries'),
  publicEntries: mk('auditor.overview.publicEntries', 'of which on the public record'),
  deals: mk('auditor.overview.deals', 'Deals'),
  dealsDisclosed: mk('auditor.overview.dealsDisclosed', 'of which disclosed'),
  documents: mk('auditor.overview.documents', 'Documents'),
  documentVersions: mk('auditor.overview.documentVersions', 'Document versions'),
  registry: mk('auditor.overview.registry', 'Registry references'),
  registryConfirmed: mk('auditor.overview.registryConfirmed', 'of which confirmed'),
  people: mk('auditor.overview.people', 'People with an account'),
  erasures: mk('auditor.overview.erasures', 'Recorded erasures'),
  unresolvedPeople: mk(
    'auditor.overview.unresolvedPeople',
    'People named in the record who no longer have an account',
  ),
  accessLog: mk('auditor.overview.accessLog', 'Access-log entries'),
  countsNote: mk(
    'auditor.overview.countsNote',
    'These are counts of rows, not volumes. No number on this page is a unit '
    + 'quantity and none of them is added across projects.',
  ),
} as const;

export const RECORD = {
  title: mk('auditor.record.title', 'The full transaction record'),
  lead: mk(
    'auditor.record.lead',
    'Every entry, in the order it occurred, as stored. The public record is a '
    + 'view over part of this table; an entry marked as not public is one that '
    + 'view does not reach, most often because its project is not published. '
    + 'Nothing is ever removed or edited — a mistake is corrected by a later '
    + 'entry that points at it, and both stay visible.',
  ),
  colRef: mk('auditor.record.col.ref', 'Reference'),
  colWhen: mk('auditor.record.col.when', 'Occurred'),
  colType: mk('auditor.record.col.type', 'Event'),
  colProject: mk('auditor.record.col.project', 'Project'),
  colActor: mk('auditor.record.col.actor', 'Recorded by'),
  colCounterparty: mk('auditor.record.col.counterparty', 'Deal parties'),
  colPublic: mk('auditor.record.col.public', 'Public record'),
  colProvenance: mk('auditor.record.col.provenance', 'Source'),
  onPublic: mk('auditor.record.onPublic', 'Public'),
  notOnPublic: mk('auditor.record.notOnPublic', 'Not public'),
  notOnPublicNote: mk(
    'auditor.record.notOnPublicNote',
    'Held in the record and readable here; not reached by the public view.',
  ),
  corrects: mk('auditor.record.corrects', 'Corrects'),
  supersededBy: mk('auditor.record.supersededBy', 'Corrected by'),
  noSource: mk('auditor.record.noSource', 'No source reference on this entry'),
  detail: mk('auditor.record.detail', 'Stored detail'),
  empty: mk(
    'auditor.record.empty',
    'No entry matches that filter. Nothing has been hidden; there is nothing there.',
  ),
  filterProject: mk('auditor.record.filter.project', 'Project'),
  filterEvent: mk('auditor.record.filter.event', 'Event type'),
  filterAllProjects: mk('auditor.record.filter.allProjects', 'All projects'),
  filterAllEvents: mk('auditor.record.filter.allEvents', 'All event types'),
  filterApply: mk('auditor.record.filter.apply', 'Apply filter'),
  filterClear: mk('auditor.record.filter.clear', 'Clear filter'),
  filterIgnored: mk(
    'auditor.record.filter.ignored',
    'The address asked for something this record does not contain, so that part '
    + 'of the filter was not applied.',
  ),
  count: mk('auditor.record.count', '{count} entries match'),
  showing: mk('auditor.record.showing', 'Showing {from} to {to} of {count}'),
  previous: mk('auditor.record.previous', 'Previous'),
  next: mk('auditor.record.next', 'Next'),
  pager: mk('auditor.record.pager', 'Record pages'),
} as const;

export const PROJECTS = {
  title: mk('auditor.projects.title', 'Projects'),
  lead: mk(
    'auditor.projects.lead',
    'Every project, whatever its status. A project that is not published is '
    + 'visible here and nowhere public. The gate column lists what the database '
    + 'would refuse publication for; it is read from the same function the gate '
    + 'itself calls, not restated here.',
  ),
  colProject: mk('auditor.projects.col.project', 'Project'),
  colStatus: mk('auditor.projects.col.status', 'Status'),
  colOwner: mk('auditor.projects.col.owner', 'Owner'),
  colPublished: mk('auditor.projects.col.published', 'Published'),
  colHolds: mk('auditor.projects.col.holds', 'Holds'),
  colGate: mk('auditor.projects.col.gate', 'Publication gate'),
  gateComplete: mk('auditor.projects.gateComplete', 'Complete'),
  gateMissing: mk('auditor.projects.gateMissing', 'Missing: {items}'),
  notPublished: mk('auditor.projects.notPublished', 'Not published'),
  holds: mk(
    'auditor.projects.holds',
    '{documents} documents · {parties} parties · {entries} entries · {deals} deals',
  ),
  open: mk('auditor.projects.open', 'Open'),

  detailDocuments: mk('auditor.project.documents', 'Documents'),
  detailParties: mk('auditor.project.parties', 'Parties'),
  detailVerification: mk('auditor.project.verification', 'Verification'),
  detailRegistry: mk('auditor.project.registry', 'Registry references'),
  detailAvailability: mk('auditor.project.availability', 'Availability'),
  detailText: mk('auditor.project.text', 'Page text versions'),
  detailGeometry: mk('auditor.project.geometry', 'Geometry'),
  detailGate: mk('auditor.project.gate', 'Publication gate'),

  docVersion: mk('auditor.project.docVersion', 'Version {n}'),
  docHash: mk('auditor.project.docHash', 'SHA-256'),
  docStoredIn: mk('auditor.project.docStoredIn', 'Stored in'),
  docWithdrawn: mk('auditor.project.docWithdrawn', 'Withdrawn'),
  docBytes: mk('auditor.project.docBytes', '{bytes} bytes'),
  noDocuments: mk('auditor.project.noDocuments', 'No document is attached to this project.'),
  noRegistry: mk(
    'auditor.project.noRegistry',
    'No registry reference is recorded for this project. This platform is not a '
    + 'registry; a reference appears here once a scheme has issued and the '
    + 'reference has been recorded with its evidence.',
  ),
  noVerification: mk(
    'auditor.project.noVerification',
    'No outcome indicator on this project names a verifier.',
  ),
  noAvailability: mk('auditor.project.noAvailability', 'No period forecast is recorded.'),
  verifier: mk('auditor.project.verifier', 'Verifier'),
  noVerifier: mk('auditor.project.noVerifier', 'None named'),
  unitNote: mk(
    'auditor.project.unitNote',
    'Every figure below is in this project’s own unit. Units of different '
    + 'projects measure different things and are never added together.',
  ),
  notFound: mk('auditor.project.notFound', 'No project has that address.'),
} as const;

export const DEALS = {
  title: mk('auditor.deals.title', 'Deals'),
  lead: mk(
    'auditor.deals.lead',
    'Every deal, with both parties named. Where a deal is not disclosed, the '
    + 'label the public record shows in place of the buyer’s name is printed '
    + 'beside it, so a public row and a named row can be reconciled here and '
    + 'nowhere else.',
  ),
  colRef: mk('auditor.deals.col.ref', 'Deal'),
  colProject: mk('auditor.deals.col.project', 'Project'),
  colBuyer: mk('auditor.deals.col.buyer', 'Buyer'),
  colOwner: mk('auditor.deals.col.owner', 'Project owner'),
  colStage: mk('auditor.deals.col.stage', 'Stage'),
  colDisclosed: mk('auditor.deals.col.disclosed', 'Disclosure'),
  colOpened: mk('auditor.deals.col.opened', 'Opened'),
  disclosed: mk('auditor.deals.disclosed', 'Named publicly'),
  notDisclosed: mk('auditor.deals.notDisclosed', 'Pseudonymous'),
  publicLabel: mk('auditor.deals.publicLabel', 'Public label'),
  noPseudonym: mk('auditor.deals.noPseudonym', 'No label allocated'),
  terminal: mk('auditor.deals.terminal', 'Terminal stage'),
  events: mk('auditor.deals.events', 'Stage and disclosure events'),
  noDeals: mk('auditor.deals.none', 'No deal has been opened.'),
  noEvents: mk('auditor.deals.noEvents', 'No stage or disclosure event is recorded.'),
  termsGap: mk(
    'auditor.deals.termsGap',
    'Agreed terms, commitments and interest volumes are not shown. The auditor '
    + 'role holds no privilege on those tables, so this view does not have '
    + 'them and does not pretend to.',
  ),
} as const;

export const ORGS = {
  title: mk('auditor.orgs.title', 'Organisations'),
  lead: mk(
    'auditor.orgs.lead',
    'Every organisation on the platform, with its legal name, its approval for '
    + 'each role and the vetting decisions those approvals derive from. An '
    + 'approval is never written directly: it is derived from a recorded '
    + 'decision by a database trigger, which is why the two can be read side '
    + 'by side and must always agree.',
  ),
  colOrg: mk('auditor.orgs.col.org', 'Organisation'),
  colCountry: mk('auditor.orgs.col.country', 'Country'),
  colSector: mk('auditor.orgs.col.sector', 'Sector'),
  colSize: mk('auditor.orgs.col.size', 'Size band'),
  colApprovals: mk('auditor.orgs.col.approvals', 'Approvals'),
  colDecisions: mk('auditor.orgs.col.decisions', 'Vetting decisions'),
  colPeople: mk('auditor.orgs.col.people', 'People'),
  noApproval: mk('auditor.orgs.noApproval', 'No approved role'),
  noDecision: mk('auditor.orgs.noDecision', 'No decision recorded'),
  submissions: mk('auditor.orgs.submissions', '{count} questionnaire submissions'),
  peopleCount: mk('auditor.orgs.peopleCount', '{count} with an account'),
  erasedCount: mk('auditor.orgs.erasedCount', '{count} erased'),
  r6: mk(
    'auditor.orgs.r6',
    'An organisation with no approval cannot be given a deal: the database '
    + 'refuses one. That refusal is a trigger, not a screen.',
  ),
} as const;

export const ACCESS = {
  title: mk('auditor.access.title', 'Access log'),
  lead: mk(
    'auditor.access.lead',
    'What has been read, by which database role and on whose behalf. This view '
    + 'writes one line to this log each time it is opened, through a function '
    + 'the auditor may call but whose table the auditor cannot write. Reading '
    + 'material that is not public is itself an event worth recording.',
  ),
  colWhen: mk('auditor.access.col.when', 'When'),
  colWho: mk('auditor.access.col.who', 'Who'),
  colRole: mk('auditor.access.col.role', 'Database role'),
  colAction: mk('auditor.access.col.action', 'Action'),
  colObject: mk('auditor.access.col.object', 'Object'),
  empty: mk(
    'auditor.access.empty',
    'The access log is empty. It records reads made through pages that log '
    + 'them; most of the platform does not log a read yet.',
  ),
} as const;

/* ------------------------------------------------------------ when it fails */

export const ERROR = {
  denied: mk('auditor.error.denied', 'You don’t have access to this information.'),
  unavailable: mk(
    'auditor.error.unavailable',
    'This information cannot be read at the moment. Nothing has been changed or '
    + 'removed; this page could not reach the database. Please try again shortly.',
  ),
} as const;

type Translator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has?: (key: string) => boolean;
};

/** label(), for a message that takes arguments. Simple {name} only. */
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
  return l.fallbackEn.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * Which sentence a failed read gets. 42501 is PostgreSQL's "insufficient
 * privilege": saying so is more useful than "something went wrong", and on
 * this page in particular a reader must never be left wondering whether the
 * record was empty or simply unreadable.
 */
export function auditorErrorLabel(err: unknown): Label {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  if (code === '42501') return ERROR.denied;
  return ERROR.unavailable;
}
