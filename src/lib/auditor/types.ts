/**
 * What the auditor's view is made of.
 *
 * An auditor reads and never writes. Nothing in this module has a shape for a
 * change: there is no input type, no draft, no patch. That is not an oversight
 * and it is not enforced here either - `sylva_auditor` holds exactly {SELECT}
 * and nothing else, asserted by ci.assert_auditor_is_read_only(). These types
 * are the shape of what comes back.
 *
 * Two things are deliberately named rather than hidden:
 *
 *   onPublicRecord  false where an entry exists in record.entry but not in
 *                   record.v_public_entry. The public record is a view over a
 *                   subset; the auditor sees the whole table and needs to know
 *                   which is which.
 *   person          null where a record entry's actor_person_ref no longer
 *                   resolves to an account. That is ERASURE, not tampering,
 *                   and the page says so - see docs/DECISIONS.md D3.
 */

/** Provenance, as sylva.source_ref holds it. */
export interface AuditSource {
  label: string;
  locator: string | null;
  kind: string;
  asOfDate: string;
}

/**
 * Who acted, resolved as far as the database still can.
 *
 * `orgName` is a real legal name: the auditor is the one role with SELECT on
 * org.organisation as a whole, and the concept note grants it real names where
 * permitted. `personName` is null once the account row is gone.
 */
export interface AuditActor {
  orgId: string | null;
  orgName: string | null;
  roleAtTime: string;
  personRef: string | null;
  /** identity.user_account.full_name, or null - see resolvePerson(). */
  personName: string | null;
  /** identity.person_label.label, kept on the entry itself and never erased. */
  personLabel: string;
}

export interface AuditRecordEntry {
  entryNo: string;
  publicId: string;
  shortRef: string;
  entryType: string;
  entryLabelEn: string;
  /** record.entry_type.is_public - whether this KIND of entry is public. */
  typeIsPublic: boolean;
  /** Whether THIS entry reaches record.v_public_entry. */
  onPublicRecord: boolean;
  occurredAt: string;
  recordedAt: string;
  projectSlug: string;
  projectTitle: string;
  projectStatus: string;
  dealId: string | null;
  dealBuyerOrgName: string | null;
  dealOwnerOrgName: string | null;
  actor: AuditActor;
  subject: string | null;
  detail: string;
  source: AuditSource | null;
  correctsPublicId: string | null;
  correctsShortRef: string | null;
  correctionReason: string | null;
  correctionDepth: number;
  supersededByPublicId: string | null;
  supersededByShortRef: string | null;
}

export interface AuditRecordPage {
  entries: AuditRecordEntry[];
  entryCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  from: number;
  to: number;
}

export interface AuditFilterOptions {
  projects: { slug: string; title: string; status: string }[];
  entryTypes: { code: string; labelEn: string; isPublic: boolean }[];
}

export interface AuditProjectSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  countryCode: string;
  ownerOrgName: string;
  publishedAt: string | null;
  createdAt: string;
  documentCount: number;
  partyCount: number;
  entryCount: number;
  dealCount: number;
  registryCount: number;
  /** proj.publication_gaps(): what the database would refuse publication for. */
  gaps: string[];
}

export interface AuditParty {
  orgName: string;
  role: string;
  descriptionEn: string | null;
  source: AuditSource;
}

export interface AuditDocumentVersion {
  versionId: string;
  versionNo: number;
  contentSha256: string;
  byteSize: string;
  mediaType: string;
  locale: string | null;
  storageRegion: string;
  storageMemberState: string | null;
  storageBucket: string;
  storageKey: string;
  uploadedByOrgName: string | null;
  uploadedAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

export interface AuditDocument {
  id: string;
  kind: string;
  kindLabelEn: string;
  scope: string;
  visibility: string;
  createdAt: string;
  versions: AuditDocumentVersion[];
}

export interface AuditRegistryRecord {
  id: string;
  schemeName: string;
  recordType: string;
  externalRecordId: string;
  recordUrl: string | null;
  /** Always printed with its unit label. Never added to anything. */
  quantity: { projectId: string; unitTypeId: string; amount: number } | null;
  unitLabel: string | null;
  confirmationStatus: string;
  confirmedAt: string | null;
  confirmedByOrgName: string | null;
  periodLabel: string;
  evidenceDocumentVersionId: string;
  source: AuditSource;
  asOfDate: string;
}

export interface AuditVerification {
  indicatorCode: string;
  domain: string;
  measureUnit: string;
  versionNo: number;
  verifierOrgName: string | null;
  uncertaintyNote: string | null;
  source: AuditSource;
}

export interface AuditAvailabilityRow {
  periodLabel: string;
  startsOn: string;
  endsOn: string;
  unitLabel: string;
  unitOfMeasure: string;
  vintageSemantics: string;
  expected: { projectId: string; unitTypeId: string; amount: number };
  buffer: { projectId: string; unitTypeId: string; amount: number };
  reserved: { projectId: string; unitTypeId: string; amount: number };
  committed: { projectId: string; unitTypeId: string; amount: number };
  remaining: { projectId: string; unitTypeId: string; amount: number };
  source: AuditSource;
}

export interface AuditProjectDetail {
  summary: AuditProjectSummary;
  parties: AuditParty[];
  documents: AuditDocument[];
  registry: AuditRegistryRecord[];
  verification: AuditVerification[];
  availability: AuditAvailabilityRow[];
  texts: {
    fieldCode: string;
    locale: string;
    versionNo: number;
    status: string;
    isCurrent: boolean;
  }[];
  geometry: { kind: string; versionNo: number; source: AuditSource }[];
}

export interface AuditDeal {
  id: string;
  shortRef: string;
  projectSlug: string;
  projectTitle: string;
  stage: string;
  stageIsTerminal: boolean;
  disclosed: boolean;
  intendedShape: string | null;
  openedAt: string;
  buyerOrgName: string;
  ownerOrgName: string;
  /** deal.deal_pseudonym - the label the public record shows instead of a name. */
  pseudonym: string | null;
  stageEventCount: number;
  entryCount: number;
}

export interface AuditDealEvent {
  dealId: string;
  dealShortRef: string;
  kind: 'stage' | 'disclosure';
  occurredAt: string;
  /** "interest_expressed → terms_proposed", or "disclosed" / "withdrawn". */
  description: string;
  actor: AuditActor;
}

export interface AuditOrganisation {
  id: string;
  legalName: string;
  registrationNumber: string | null;
  countryCode: string;
  sectorCode: string;
  sizeBandCode: string;
  createdAt: string;
  approvals: { roleCode: string; status: string; updatedAt: string }[];
  submissionCount: number;
  decisions: {
    roleCode: string;
    decision: string;
    decidedAt: string;
    reason: string | null;
    decidedByOrgName: string | null;
  }[];
  peopleCount: number;
  erasureCount: number;
}

export interface AuditAccessLogRow {
  entryNo: string;
  at: string;
  /**
   * record.access_log.actor_db_role. See FINDING-005: this is the logging
   * function's owner, not the caller, on every row the platform has written.
   */
  dbRole: string;
  /** The real caller, where the writer recorded it in the detail. */
  callerRole: string | null;
  action: string;
  objectKind: string | null;
  objectId: string | null;
  actor: AuditActor;
}

export interface AuditOverview {
  projects: number;
  projectsPublished: number;
  projectsUnpublished: number;
  organisations: number;
  approvals: number;
  entries: number;
  publicEntries: number;
  /** entries - publicEntries. Named so the page cannot imply anything is hidden. */
  entriesNotOnPublicRecord: number;
  deals: number;
  dealsDisclosed: number;
  documents: number;
  documentVersions: number;
  documentWithdrawals: number;
  registryRecords: number;
  registryConfirmed: number;
  people: number;
  erasures: number;
  /** Distinct actor_person_ref values in the record with no account behind them. */
  unresolvedPeople: number;
  accessLogRows: number;
}

/** One database guarantee, checked live rather than asserted in prose. */
export interface AuditGuard {
  /** The ci function's name, e.g. assert_auditor_is_read_only. */
  name: string;
  ok: boolean;
  /** What the guard reported when it failed. Null when it passed. */
  detail: string | null;
}
