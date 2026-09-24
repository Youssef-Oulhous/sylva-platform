import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import DealCard from '@/components/buyer-dashboard/DealCard';
import DocumentsSection from '@/components/buyer-dashboard/DocumentsSection';
import EmptyState from '@/components/buyer-dashboard/EmptyState';
import InterestsTable from '@/components/buyer-dashboard/InterestsTable';
import OrganisationPanel from '@/components/buyer-dashboard/OrganisationPanel';
import PublicLabelPanel from '@/components/buyer-dashboard/PublicLabelPanel';
import SitesTable from '@/components/buyer-dashboard/SitesTable';
import VettingPanel from '@/components/buyer-dashboard/VettingPanel';
import type {
  BuyerDeal,
  BuyerOrganisation,
  DocumentGroup,
  ExpressedInterest,
  RegisteredSite,
  VettingRecord,
} from '@/components/buyer-dashboard/types';
import styles from './page.module.css';

/**
 * The buyer dashboard.
 *
 * What it is: a standing record of what one organisation has done on this
 * platform - its status with the operator, the interests it has expressed, the
 * sites it has registered, its documents and its deals. Five lists and two
 * panels, in the order a buyer needs them.
 *
 * What it deliberately is not: an analytics dashboard. There is no KPI tile, no
 * chart, no sparkline, no month-on-month figure and no score. A buyer with two
 * deals and four interests has nothing to plot, and a graph drawn over numbers
 * this small would be decoration standing where evidence belongs.
 *
 * RULE 7. Unit volumes appear in exactly one place on this page - inside a deal
 * card, which is one project, one period and one unit type - and each figure is
 * printed against its unit label. The interests table, which is the only list
 * spanning several projects, carries no volume column at all; it shows the unit
 * each project issues instead, which is the fact that makes those projects
 * incomparable. Nothing here adds a volume to anything, and no type in
 * components/buyer-dashboard/types.ts can hold a figure spanning two projects.
 *
 * FRONTEND PASS. No database, no fetch, no server action, no auth and no
 * session: which organisation this page belongs to is decided by the demo data
 * below, not by a logged-in user. Every control renders and does nothing.
 */

/* ========================================================================== *
 * DEMO DATA
 *
 * Fictional throughout. The organisations, projects, sites, references and
 * figures below describe no real wetland, no real verification, no real
 * environmental result and no real company. Names are aligned with the demo
 * seed data used elsewhere on the platform so that the pages tell one
 * consistent story.
 *
 * Prose is held as an i18n key. Proper nouns are literals, which is how they
 * will arrive from the database.
 * ========================================================================== */

const DEMO_ORGANISATION: BuyerOrganisation = {
  legalName: 'DEMO Nordbräu AG',
  registrationNumber: 'HRB 111111 (DEMO)',
  registeredAddress: 'Brauereiweg 4, 28195 Bremen',
  countryCode: 'DE',
  sectorKey: 'org.sectorName.foodBev',
  sizeBandKey: 'org.sizeBandName.large',
  orgRef: 'ORG-0C14',
  publicLabel: 'Buyer 014',
  recordedOn: '2026-09-01',
  source: {
    labelKey: 'source.organisationRecord',
    locator: null,
    asOfDate: '2026-09-01',
  },
};

const DEMO_VETTING: VettingRecord = {
  state: 'approved',
  submittedOn: '2026-09-05',
  decidedOn: '2026-09-09',
  decidedByOrgName: 'DEMO Sylva Operations',
  questionnaireVersion: 'v1.2',
  reasonKey: 'vetting.reasonRecorded',
  source: {
    labelKey: 'source.vettingDecision',
    locator: null,
    asOfDate: '2026-09-09',
  },
};

/** Newest first. A closed interest stays in the list; the record is append-only. */
const DEMO_INTERESTS: readonly ExpressedInterest[] = [
  {
    id: 'interest-oder',
    projectSlug: 'demo-oder-floodplain-reconnection',
    projectName: 'DEMO Oder Floodplain Reconnection',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitLabelKey: 'unit.hectareYears',
    expressedOn: '2026-09-21',
    state: 'recorded',
    recordRef: 'REC-2026-000377',
    dealRef: null,
  },
  {
    id: 'interest-briere',
    projectSlug: 'demo-marais-de-briere-restoration',
    projectName: 'DEMO Marais de Brière Restoration',
    schemeName: 'DEMO Freshwater Index Scheme',
    unitLabelKey: 'unit.indexPoints',
    expressedOn: '2026-09-15',
    state: 'dealOpen',
    recordRef: 'REC-2026-000341',
    dealRef: 'DEAL-2026-0042',
  },
  {
    id: 'interest-havel',
    projectSlug: 'demo-untere-havel-wetland-restoration',
    projectName: 'DEMO Untere Havel Wetland Restoration',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitLabelKey: 'unit.hectareYears',
    expressedOn: '2026-09-11',
    state: 'dealOpen',
    recordRef: 'REC-2026-000318',
    dealRef: 'DEAL-2026-0038',
  },
  {
    id: 'interest-briere-earlier',
    projectSlug: 'demo-marais-de-briere-restoration',
    projectName: 'DEMO Marais de Brière Restoration',
    schemeName: 'DEMO Freshwater Index Scheme',
    unitLabelKey: 'unit.indexPoints',
    expressedOn: '2026-08-12',
    state: 'closed',
    recordRef: 'REC-2026-000204',
    dealRef: null,
  },
];

/** Private to this organisation. No project owner and no other buyer sees these. */
const DEMO_SITES: readonly RegisteredSite[] = [
  {
    id: 'site-bremen',
    name: 'DEMO Bremen brewery',
    locationLabel: 'Bremen',
    catchmentLabel: 'Untere Weser',
    countryCode: 'DE',
    latitude: 53.0793,
    longitude: 8.8017,
    registeredOn: '2026-09-15',
  },
  {
    id: 'site-brandenburg',
    name: 'DEMO Brandenburg brewery',
    locationLabel: 'Brandenburg an der Havel',
    catchmentLabel: 'Untere Havel',
    countryCode: 'DE',
    latitude: 52.4125,
    longitude: 12.5551,
    registeredOn: '2026-09-15',
  },
];

const DEMO_DOCUMENT_GROUPS: readonly DocumentGroup[] = [
  {
    id: 'organisation',
    titleKey: 'documents.group.organisation.title',
    introKey: 'documents.group.organisation.intro',
    emptyTitleKey: 'documents.group.organisation.emptyTitle',
    emptyBodyKey: 'documents.group.organisation.emptyBody',
    documents: [
      {
        id: 'doc-vetting-response',
        nameKey: 'documents.name.vettingResponse',
        scopeKey: 'documents.scope.organisation',
        scopeName: null,
        version: 'v1.2',
        dateIso: '2026-09-05',
        lodgedByKey: 'documents.lodgedBy.you',
        lodgedByOrgName: null,
        statusKey: 'documents.status.submitted',
        replacedByVersion: null,
      },
      {
        id: 'doc-vetting-decision',
        nameKey: 'documents.name.vettingDecision',
        scopeKey: 'documents.scope.organisation',
        scopeName: null,
        version: 'v1.0',
        dateIso: '2026-09-09',
        lodgedByKey: null,
        lodgedByOrgName: 'DEMO Sylva Operations',
        statusKey: 'documents.status.recorded',
        replacedByVersion: null,
      },
      {
        id: 'doc-site-register',
        nameKey: 'documents.name.siteRegisterExtract',
        scopeKey: 'documents.scope.organisation',
        scopeName: null,
        version: 'v1.0',
        dateIso: '2026-09-15',
        lodgedByKey: 'documents.lodgedBy.you',
        lodgedByOrgName: null,
        statusKey: 'documents.status.current',
        replacedByVersion: null,
      },
    ],
  },
  {
    id: 'deal',
    titleKey: 'documents.group.deal.title',
    introKey: 'documents.group.deal.intro',
    emptyTitleKey: 'documents.group.deal.emptyTitle',
    emptyBodyKey: 'documents.group.deal.emptyBody',
    documents: [
      {
        id: 'doc-term-sheet-v2',
        nameKey: 'documents.name.termSheet',
        scopeKey: 'documents.scope.deal',
        scopeName: 'DEMO Untere Havel Wetland Restoration',
        version: 'v2.0',
        dateIso: '2026-09-19',
        lodgedByKey: null,
        lodgedByOrgName: 'DEMO Moorland Trust gGmbH',
        statusKey: 'documents.status.draftWithYou',
        replacedByVersion: null,
      },
      {
        id: 'doc-term-sheet-v1',
        nameKey: 'documents.name.termSheet',
        scopeKey: 'documents.scope.deal',
        scopeName: 'DEMO Untere Havel Wetland Restoration',
        version: 'v1.0',
        dateIso: '2026-09-12',
        lodgedByKey: null,
        lodgedByOrgName: 'DEMO Moorland Trust gGmbH',
        statusKey: 'documents.status.superseded',
        replacedByVersion: 'v2.0',
      },
      {
        id: 'doc-loi',
        nameKey: 'documents.name.letterOfIntent',
        scopeKey: 'documents.scope.deal',
        scopeName: 'DEMO Marais de Brière Restoration',
        version: 'v1.1',
        dateIso: '2026-09-17',
        lodgedByKey: 'documents.lodgedBy.you',
        lodgedByOrgName: null,
        statusKey: 'documents.status.agreed',
        replacedByVersion: null,
      },
      {
        id: 'doc-pdd-reference',
        nameKey: 'documents.name.projectDesignDocument',
        scopeKey: 'documents.scope.project',
        scopeName: 'DEMO Untere Havel Wetland Restoration',
        version: 'v2.0',
        dateIso: '2026-09-12',
        lodgedByKey: null,
        lodgedByOrgName: 'DEMO Moorland Trust gGmbH',
        statusKey: 'documents.status.referenceCopy',
        replacedByVersion: null,
      },
    ],
  },
  {
    /**
     * Empty on purpose, and the most consequential fact in the section: neither
     * deal has reached signature. "Agreements are signed outside the platform,
     * and the signed document is uploaded as evidence." (Concept note, §7.)
     */
    id: 'signed',
    titleKey: 'documents.group.signed.title',
    introKey: 'documents.group.signed.intro',
    emptyTitleKey: 'documents.group.signed.emptyTitle',
    emptyBodyKey: 'documents.group.signed.emptyBody',
    documents: [],
  },
];

/**
 * Two deals, in two schemes, with two unit types. That is the point of the demo
 * data: 2,400 hectare-years and 120 index points sit on the same screen, each
 * inside its own card, each printed against its own unit label, and the page
 * never puts them in one column or adds them.
 */
const DEMO_DEALS: readonly BuyerDeal[] = [
  {
    id: 'deal-havel',
    dealRef: 'DEAL-2026-0038',
    projectSlug: 'demo-untere-havel-wetland-restoration',
    projectName: 'DEMO Untere Havel Wetland Restoration',
    locationLabel: 'Brandenburg, Untere Havel',
    ownerOrgName: 'DEMO Moorland Trust gGmbH',
    dealTypeKey: 'deals.dealType.forward',
    stage: 'termSheet',
    openedOn: '2026-09-11',
    lastActivityOn: '2026-09-19',
    lastActivityKey: 'deals.activity.termSheetReceived',
    disclosure: 'pseudonymous',
    disclosureDisplay: 'Buyer 014',
    documentCount: 3,
    volume: {
      periodLabel: '2028',
      schemeName: 'DEMO Wetland Biodiversity Standard',
      unitLabelKey: 'unit.hectareYears',
      underDiscussion: 2400,
      remainingInPeriod: 6600,
      source: {
        labelKey: 'source.termSheetDraft',
        locator: 'v2.0',
        asOfDate: '2026-09-19',
      },
    },
  },
  {
    id: 'deal-briere',
    dealRef: 'DEAL-2026-0042',
    projectSlug: 'demo-marais-de-briere-restoration',
    projectName: 'DEMO Marais de Brière Restoration',
    locationLabel: 'Pays de la Loire, Brière',
    ownerOrgName: 'DEMO Rivières Vivantes SAS',
    dealTypeKey: 'deals.dealType.coInvestment',
    stage: 'loi',
    openedOn: '2026-09-15',
    lastActivityOn: '2026-09-17',
    lastActivityKey: 'deals.activity.loiAgreed',
    disclosure: 'named',
    disclosureDisplay: 'DEMO Nordbräu AG',
    documentCount: 2,
    volume: {
      periodLabel: '2029',
      schemeName: 'DEMO Freshwater Index Scheme',
      unitLabelKey: 'unit.indexPoints',
      underDiscussion: 120,
      remainingInPeriod: 486,
      source: {
        labelKey: 'source.letterOfIntent',
        locator: 'v1.1',
        asOfDate: '2026-09-17',
      },
    },
  },
];

/** One line of the public record, reproduced exactly as the record renders it. */
const DEMO_RECORD_SPECIMEN = {
  projectName: 'DEMO Untere Havel Wetland Restoration',
  eventKey: 'disclosure.event.interestExpressed',
  dateIso: '2026-09-11',
} as const;

/* ========================================================================== */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'buyerDashboard' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function BuyerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('buyerDashboard');
  const tRoot = await getTranslations();

  return (
    <>
      <header className={styles.head}>
        <h1>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>

        <div className={styles.identity}>
          <span className={styles.orgName}>{DEMO_ORGANISATION.legalName}</span>
          <span className={styles.identityItem}>
            <span className={styles.identityLabel}>{t('header.publicLabel')}</span>
            <span className={styles.identityValue}>{DEMO_ORGANISATION.publicLabel}</span>
          </span>
          <span className={styles.identityItem}>
            <span className={styles.identityLabel}>{t('org.orgRef')}</span>
            <span className={styles.identityValue}>{DEMO_ORGANISATION.orgRef}</span>
          </span>
          <Badge tone="demo">{tRoot('demo.badge')}</Badge>
        </div>

        <p className={styles.inert}>{t('inertNote')}</p>
      </header>

      {/* 1. Status first. Nothing further down this page is available to an
             organisation the operator has not approved. */}
      <section className={styles.section} aria-labelledby="status-heading">
        <div className={styles.sectionHead}>
          <h2 id="status-heading">{t('section.status')}</h2>
          <p className={styles.sectionIntro}>{t('section.statusIntro')}</p>
        </div>

        <div className={styles.panels}>
          <OrganisationPanel organisation={DEMO_ORGANISATION} locale={locale} />
          <VettingPanel vetting={DEMO_VETTING} />
        </div>

        <PublicLabelPanel
          organisation={DEMO_ORGANISATION}
          specimen={DEMO_RECORD_SPECIMEN}
          locale={locale}
        />
      </section>

      {/* 2. Interests. The only list on this page spanning several projects,
             and therefore the one with no volume column. */}
      <section className={styles.section} aria-labelledby="interests-heading">
        <div className={styles.sectionHead}>
          <h2 id="interests-heading">{t('section.interests')}</h2>
          <p className={styles.sectionIntro}>{t('section.interestsIntro')}</p>
        </div>
        <InterestsTable interests={DEMO_INTERESTS} />
      </section>

      {/* 3. Sites. Private to this organisation, and the panel says so. */}
      <section className={styles.section} aria-labelledby="sites-heading">
        <div className={styles.sectionHead}>
          <h2 id="sites-heading">{t('section.sites')}</h2>
          <p className={styles.sectionIntro}>{t('section.sitesIntro')}</p>
        </div>
        <SitesTable sites={DEMO_SITES} locale={locale} />
      </section>

      {/* 4. Documents, in three groups, one of them empty on purpose. */}
      <section className={styles.section} aria-labelledby="documents-heading">
        <div className={styles.sectionHead}>
          <h2 id="documents-heading">{t('section.documents')}</h2>
          <p className={styles.sectionIntro}>{t('section.documentsIntro')}</p>
        </div>
        <DocumentsSection groups={DEMO_DOCUMENT_GROUPS} />
      </section>

      {/* 5. Deals. The only place on this page where a unit volume appears. */}
      <section className={styles.sectionLast} aria-labelledby="deals-heading">
        <div className={styles.sectionHead}>
          <h2 id="deals-heading">{t('section.deals')}</h2>
          <p className={styles.sectionIntro}>{t('section.dealsIntro')}</p>
        </div>

        {DEMO_DEALS.length === 0 ? (
          <EmptyState
            title={t('deals.empty.title')}
            body={t('deals.empty.body')}
            action={
              <Link href="/projects" className={styles.emptyLink}>
                {tRoot('home.ctaExplore')}
              </Link>
            }
          />
        ) : (
          <div className={styles.deals}>
            {DEMO_DEALS.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
