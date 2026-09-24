/**
 * Reference data for the About page.
 *
 * Nothing here is read from the database: this is the frontend pass, and the
 * About page is the one page whose content is editorial rather than queried.
 *
 * Two conventions are carried over from the project page's demo data:
 *
 *   1. Prose a reader sees is held as an i18n KEY, never as an English string,
 *      so the German site is not silently served English.
 *   2. Every stated fact carries the document it came from and that document's
 *      date, as a `AboutSource` rendered by the shared SourceStamp component.
 *
 * Every statement below is traceable to one of two documents already in this
 * repository. Nothing on this page asserts a business or legal rule that those
 * documents do not state:
 *
 *   - docs/reference/concept-note-2026-09-22.txt  (the client, 22 Sep 2026)
 *   - docs/DECISIONS.md                           (this build, 23 Sep 2026)
 *
 * The section reference in `locator` is written as a section sign plus a
 * number, which reads the same in English and in German and so is not
 * translated - the same rule the project page applies to document locators.
 *
 * Rule 7 does not bite on this page, and that is deliberate: the About page
 * carries no unit volume of any kind. The only quantities on it count
 * organisations interviewed, from a single source.
 */

export interface AboutSource {
  /** Full i18n key naming the source document. */
  labelKey: string;
  /** Section reference inside that document. Language-neutral, not translated. */
  locator: string | null;
  /** ISO date of that document. */
  asOfDate: string;
}

/** The client's concept note, 22 September 2026. */
const note = (locator: string): AboutSource => ({
  labelKey: 'about.source.conceptNote',
  locator,
  asOfDate: '2026-09-22',
});

/** This build's recorded design decisions, 23 September 2026. */
const decision = (locator: string): AboutSource => ({
  labelKey: 'about.source.designDecisions',
  locator,
  asOfDate: '2026-09-23',
});

/** A labelled statement with its source. Rendered by <FactList>. */
export interface AboutFact {
  id: string;
  labelKey: string;
  bodyKey: string;
  source: AboutSource;
  /**
   * Set where the platform has NOT yet fixed the value. Rendered as a word in
   * a badge, never as a colour on its own.
   */
  pendingKey?: string;
}

/* -------------------------------------------------------------------------- */
/* 01 · Who operates the platform                                             */
/* -------------------------------------------------------------------------- */

export const OPERATOR_DUTIES: readonly AboutFact[] = [
  {
    id: 'publish',
    labelKey: 'about.operator.duty.publish',
    bodyKey: 'about.operator.duty.publishBody',
    source: note('§4'),
  },
  {
    id: 'vet',
    labelKey: 'about.operator.duty.vet',
    bodyKey: 'about.operator.duty.vetBody',
    source: note('§7'),
  },
  {
    id: 'confirm',
    labelKey: 'about.operator.duty.confirm',
    bodyKey: 'about.operator.duty.confirmBody',
    source: note('§4'),
  },
  {
    id: 'evidence',
    labelKey: 'about.operator.duty.evidence',
    bodyKey: 'about.operator.duty.evidenceBody',
    source: note('§7'),
  },
  {
    id: 'questions',
    labelKey: 'about.operator.duty.questions',
    bodyKey: 'about.operator.duty.questionsBody',
    source: note('§6'),
  },
] as const;

/* -------------------------------------------------------------------------- */
/* 02 · What the pilot is for                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Who was interviewed, June to September 2026 (concept note §3).
 *
 * These count ORGANISATIONS, all from one source, so the total is meaningful
 * and is printed. A unit volume would not be, and there is none on this page.
 */
export interface AboutResearchRow {
  id: string;
  groupKey: string;
  count: number;
}

export const RESEARCH_ROWS: readonly AboutResearchRow[] = [
  { id: 'water', groupKey: 'about.pilot.research.water', count: 2 },
  { id: 'reporting', groupKey: 'about.pilot.research.reporting', count: 2 },
  { id: 'finance', groupKey: 'about.pilot.research.finance', count: 3 },
  { id: 'foundation', groupKey: 'about.pilot.research.foundation', count: 1 },
] as const;

export const RESEARCH_SOURCE: AboutSource = note('§3');

/** What the first release contains, and what follows it (concept note §10). */
export const RELEASE_FIRST: readonly string[] = [
  'about.pilot.release.item.index',
  'about.pilot.release.item.detail',
  'about.pilot.release.item.sites',
  'about.pilot.release.item.vetting',
  'about.pilot.release.item.interest',
  'about.pilot.release.item.record',
] as const;

export const RELEASE_LATER: readonly string[] = [
  'about.pilot.release.item.dealRoom',
  'about.pilot.release.item.dealShapes',
  'about.pilot.release.item.issuance',
  'about.pilot.release.item.investor',
  'about.pilot.release.item.exports',
] as const;

export const RELEASE_SOURCE: AboutSource = note('§10');

/* -------------------------------------------------------------------------- */
/* 03 · Who uses the platform                                                 */
/* -------------------------------------------------------------------------- */

export interface AboutRoleRow {
  id: string;
  roleKey: string;
  doesKey: string;
  seesKey: string;
}

export const ROLE_ROWS: readonly AboutRoleRow[] = [
  {
    id: 'owner',
    roleKey: 'about.roles.owner',
    doesKey: 'about.roles.ownerDoes',
    seesKey: 'about.roles.ownerSees',
  },
  {
    id: 'buyer',
    roleKey: 'about.roles.buyer',
    doesKey: 'about.roles.buyerDoes',
    seesKey: 'about.roles.buyerSees',
  },
  {
    id: 'investor',
    roleKey: 'about.roles.investor',
    doesKey: 'about.roles.investorDoes',
    seesKey: 'about.roles.investorSees',
  },
  {
    id: 'operator',
    roleKey: 'about.roles.operator',
    doesKey: 'about.roles.operatorDoes',
    seesKey: 'about.roles.operatorSees',
  },
  {
    id: 'auditor',
    roleKey: 'about.roles.auditor',
    doesKey: 'about.roles.auditorDoes',
    seesKey: 'about.roles.auditorSees',
  },
] as const;

export const ROLES_SOURCE: AboutSource = note('§4');

/* -------------------------------------------------------------------------- */
/* 04 · What this platform does not do                                        */
/* -------------------------------------------------------------------------- */

export interface AboutLimitRow {
  id: string;
  headKey: string;
  bodyKey: string;
  source: AboutSource;
}

export const LIMIT_ROWS: readonly AboutLimitRow[] = [
  {
    id: 'registry',
    headKey: 'about.limits.registry',
    bodyKey: 'about.limits.registryBody',
    source: note('§2'),
  },
  {
    id: 'issue',
    headKey: 'about.limits.issue',
    bodyKey: 'about.limits.issueBody',
    source: note('§2'),
  },
  {
    id: 'money',
    headKey: 'about.limits.money',
    bodyKey: 'about.limits.moneyBody',
    source: note('§7'),
  },
  {
    id: 'sign',
    headKey: 'about.limits.sign',
    bodyKey: 'about.limits.signBody',
    source: note('§7'),
  },
  {
    id: 'land',
    headKey: 'about.limits.land',
    bodyKey: 'about.limits.landBody',
    source: note('§6'),
  },
  {
    id: 'totals',
    headKey: 'about.limits.totals',
    bodyKey: 'about.limits.totalsBody',
    source: note('§2, §8'),
  },
  {
    id: 'auditor',
    headKey: 'about.limits.auditor',
    bodyKey: 'about.limits.auditorBody',
    source: note('§6'),
  },
] as const;

/* -------------------------------------------------------------------------- */
/* 05 · Vetting                                                               */
/* -------------------------------------------------------------------------- */

export interface AboutStep {
  id: string;
  titleKey: string;
  bodyKey: string;
}

export const VETTING_STEPS: readonly AboutStep[] = [
  {
    id: 'apply',
    titleKey: 'about.vetting.step.apply',
    bodyKey: 'about.vetting.step.applyBody',
  },
  {
    id: 'decide',
    titleKey: 'about.vetting.step.decide',
    bodyKey: 'about.vetting.step.decideBody',
  },
  {
    id: 'effect',
    titleKey: 'about.vetting.step.effect',
    bodyKey: 'about.vetting.step.effectBody',
  },
] as const;

export const VETTING_SOURCE: AboutSource = note('§7');
export const CLAIM_RIGHTS_SOURCE: AboutSource = note('§3, §6');

/* -------------------------------------------------------------------------- */
/* 06 · Personal data, hosting and analytics                                  */
/* -------------------------------------------------------------------------- */

export const DATA_FACTS: readonly AboutFact[] = [
  {
    id: 'region',
    labelKey: 'about.data.fact.region',
    bodyKey: 'about.data.fact.regionBody',
    source: note('§9'),
    // The concept note names three candidate regions and does not choose one.
    // Naming one here would be an invention, so the page says so instead.
    pendingKey: 'about.data.fact.regionPending',
  },
  {
    id: 'personal',
    labelKey: 'about.data.fact.personal',
    bodyKey: 'about.data.fact.personalBody',
    source: note('§9'),
  },
  {
    id: 'erasure',
    labelKey: 'about.data.fact.erasure',
    bodyKey: 'about.data.fact.erasureBody',
    source: decision('D3'),
  },
  {
    id: 'analytics',
    labelKey: 'about.data.fact.analytics',
    bodyKey: 'about.data.fact.analyticsBody',
    source: note('§9'),
  },
  {
    id: 'fonts',
    labelKey: 'about.data.fact.fonts',
    bodyKey: 'about.data.fact.fontsBody',
    // No locator: a public page cites the decision, not a path in the repo.
    source: { labelKey: 'about.source.designDecisions', locator: null, asOfDate: '2026-09-23' },
  },
  {
    id: 'identity',
    labelKey: 'about.data.fact.identity',
    bodyKey: 'about.data.fact.identityBody',
    source: note('§8'),
  },
  {
    id: 'sites',
    labelKey: 'about.data.fact.sites',
    bodyKey: 'about.data.fact.sitesBody',
    source: note('§6'),
  },
  {
    id: 'questions',
    labelKey: 'about.data.fact.questions',
    bodyKey: 'about.data.fact.questionsBody',
    source: note('§6'),
  },
] as const;

/* -------------------------------------------------------------------------- */
/* 07 · Contact                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Contact routes.
 *
 * The addresses are PLACEHOLDERS on the reserved `.example` domain (RFC 2606),
 * which can never resolve. Sylva's real addresses replace them before launch,
 * and until then the page says so rather than printing an address that looks
 * real and silently fails.
 */
export interface AboutChannel {
  id: string;
  purposeKey: string;
  address: string;
}

export const CONTACT_CHANNELS: readonly AboutChannel[] = [
  {
    id: 'general',
    purposeKey: 'about.contact.channel.general',
    address: 'enquiries@sylva-pilot.example',
  },
  {
    id: 'owners',
    purposeKey: 'about.contact.channel.owners',
    address: 'projects@sylva-pilot.example',
  },
  {
    id: 'vetting',
    purposeKey: 'about.contact.channel.vetting',
    address: 'vetting@sylva-pilot.example',
  },
  {
    id: 'data',
    purposeKey: 'about.contact.channel.data',
    address: 'dataprotection@sylva-pilot.example',
  },
  {
    id: 'audit',
    purposeKey: 'about.contact.channel.audit',
    address: 'audit@sylva-pilot.example',
  },
] as const;

/** The options in the contact form's role field. Values are never submitted. */
export const CONTACT_ROLES: readonly string[] = [
  'about.contact.form.roleOwner',
  'about.contact.form.roleBuyer',
  'about.contact.form.roleInvestor',
  'about.contact.form.roleAuditor',
  'about.contact.form.roleOther',
] as const;
