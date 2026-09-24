import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import EntryPointSequence from '@/components/for-investors/EntryPointSequence';
import FinancialInformationTable, {
  type FinancialInfoRow,
} from '@/components/for-investors/FinancialInformationTable';
import FinancingPipelineTable, {
  type FinancingProject,
} from '@/components/for-investors/FinancingPipelineTable';
import InvestorAccessPanel, {
  type InvestorPanelProject,
} from '@/components/for-investors/InvestorAccessPanel';
import RestrictedDocumentList, {
  type InvestorDocument,
} from '@/components/for-investors/RestrictedDocumentList';
import AccessRequestForm from '@/components/for-investors/AccessRequestForm';
import styles from './page.module.css';

/**
 * For investors - the public page for banks and funds.
 *
 * What this page is for: to say what financial information a project holds, who
 * can read it, and how an organisation asks for access. Three things it is
 * careful about:
 *
 *   1. No return figure, no yield, no projection, anywhere. The concept note
 *      does not publish any, so neither does this page, and the last section
 *      says that in words rather than leaving it to be noticed.
 *   2. The restricted values are not previewed. Names, versions and dates are
 *      public; the figures are absent, not blurred.
 *   3. RULE 7. The cross-project table carries no unit volumes at all, because
 *      three projects in three schemes side by side is where a column of
 *      volumes gets read as a ranking. Volumes appear once, for one period of
 *      one project, each printed against its unit label.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. Everything
 * below is DEMO data and every control is inert.
 */

/* ------------------------------------------------------------------------- *
 * DEMO DATA. Fictional. Every organisation and project name begins with
 * "DEMO". None of these figures describes a real wetland, a real verification
 * or a real environmental result.
 * ------------------------------------------------------------------------- */

const DEMO_INFORMATION: readonly FinancialInfoRow[] = [
  {
    id: 'financing-need',
    nameKey: 'info.financingNeed.name',
    containsKey: 'info.financingNeed.contains',
    providedByKey: 'providedBy.owner',
    visibility: 'vetted',
  },
  {
    id: 'revenue-streams',
    nameKey: 'info.revenueStreams.name',
    containsKey: 'info.revenueStreams.contains',
    providedByKey: 'providedBy.owner',
    visibility: 'vetted',
  },
  {
    id: 'financial-model',
    nameKey: 'info.model.name',
    containsKey: 'info.model.contains',
    providedByKey: 'providedBy.owner',
    visibility: 'vetted',
  },
  {
    id: 'availability',
    nameKey: 'info.availability.name',
    containsKey: 'info.availability.contains',
    providedByKey: 'providedBy.owner',
    visibility: 'public',
  },
  {
    id: 'outcomes',
    nameKey: 'info.outcomes.name',
    containsKey: 'info.outcomes.contains',
    providedByKey: 'providedBy.ownerVerifier',
    visibility: 'public',
  },
  {
    id: 'claim-rights',
    nameKey: 'info.claimRights.name',
    containsKey: 'info.claimRights.contains',
    providedByKey: 'providedBy.owner',
    visibility: 'public',
  },
  {
    id: 'durability',
    nameKey: 'info.durability.name',
    containsKey: 'info.durability.contains',
    providedByKey: 'providedBy.owner',
    visibility: 'public',
  },
  {
    id: 'documents',
    nameKey: 'info.documents.name',
    containsKey: 'info.documents.contains',
    providedByKey: 'providedBy.ownerVerifier',
    visibility: 'public',
  },
];

const DEMO_PIPELINE: readonly FinancingProject[] = [
  {
    slug: 'demo-untere-havel-wetland-restoration',
    name: 'DEMO Untere Havel Wetland Restoration',
    locationKey: 'demo.havel.location',
    stageKey: 'stage.buyersCommitted',
    dealTypeKeys: ['dealType.forward', 'dealType.coInvestment'],
    packState: 'prepared',
    packSourceKey: 'source.financingSummary',
    packUpdatedOn: '2026-09-12',
  },
  {
    slug: 'demo-marais-de-sevre-floodplain',
    name: 'DEMO Marais de Sèvre Floodplain',
    locationKey: 'demo.sevre.location',
    stageKey: 'stage.financingOpen',
    dealTypeKeys: ['dealType.forward', 'dealType.spot'],
    packState: 'prepared',
    packSourceKey: 'source.financingSummary',
    packUpdatedOn: '2026-08-28',
  },
  {
    slug: 'demo-shannon-callows-peat-rewetting',
    name: 'DEMO Shannon Callows Peat Rewetting',
    locationKey: 'demo.shannon.location',
    stageKey: 'stage.documented',
    dealTypeKeys: ['dealType.forward'],
    packState: 'inPreparation',
    packSourceKey: 'source.financingSummary',
    packUpdatedOn: '2026-09-05',
  },
];

/**
 * One demo project, in detail. The four figures are written out as given in the
 * project's design document; nothing on this page adds, subtracts or otherwise
 * derives a unit volume.
 */
const DEMO_PANEL_PROJECT: InvestorPanelProject = {
  slug: 'demo-untere-havel-wetland-restoration',
  name: 'DEMO Untere Havel Wetland Restoration',
  locationKey: 'demo.havel.location',
  schemeName: 'DEMO Wetland Biodiversity Standard',
  unitLabelKey: 'unit.hectareYears',
  periodLabel: '2028',
  expected: 12400,
  buffer: 1000,
  committed: 4800,
  remaining: 6600,
  figureSourceKey: 'source.projectDesignDocument',
  figureLocator: 'v2.0, §7',
  figureAsOf: '2026-09-12',
  restricted: [
    {
      id: 'financing-need',
      nameKey: 'info.financingNeed.name',
      version: 'v1.3',
      updatedOn: '2026-09-12',
      sourceKey: 'source.ownerSubmission',
    },
    {
      id: 'revenue-streams',
      nameKey: 'info.revenueStreams.name',
      version: 'v1.1',
      updatedOn: '2026-09-04',
      sourceKey: 'source.ownerSubmission',
    },
    {
      id: 'financial-model',
      nameKey: 'info.model.name',
      version: 'v2.1',
      updatedOn: '2026-09-12',
      sourceKey: 'source.ownerSubmission',
    },
  ],
};

const DEMO_DOCUMENTS: readonly InvestorDocument[] = [
  {
    id: 'pin',
    nameKey: 'doc.pin',
    typeKey: 'docType.project',
    version: 'v1.0',
    dateIso: '2026-03-12',
    access: 'public',
  },
  {
    id: 'pdd',
    nameKey: 'doc.pdd',
    typeKey: 'docType.project',
    version: 'v2.0',
    dateIso: '2026-09-12',
    access: 'public',
  },
  {
    id: 'monitoring',
    nameKey: 'doc.monitoring',
    typeKey: 'docType.project',
    version: 'v1.2',
    dateIso: '2026-08-30',
    access: 'public',
  },
  {
    id: 'financing-need',
    nameKey: 'doc.financingNeed',
    typeKey: 'docType.financial',
    version: 'v1.3',
    dateIso: '2026-09-12',
    access: 'restricted',
  },
  {
    id: 'revenue-streams',
    nameKey: 'doc.revenue',
    typeKey: 'docType.financial',
    version: 'v1.1',
    dateIso: '2026-09-04',
    access: 'restricted',
  },
  {
    id: 'financial-model',
    nameKey: 'doc.model',
    typeKey: 'docType.financial',
    version: 'v2.1',
    dateIso: '2026-09-12',
    access: 'restricted',
  },
];

const LIMITS = ['returns', 'noRanking', 'registry', 'settlement', 'demo'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'forInvestors' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function ForInvestorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('forInvestors');
  const tHome = await getTranslations('home');
  const tNav = await getTranslations('nav');

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('audience')}</p>
        <h1>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
        <div className={styles.ctas}>
          <Link href="/projects" className={`${styles.btn} ${styles.btnPrimary}`}>
            {tHome('ctaExplore')}
          </Link>
          <Link href="/how-it-works" className={`${styles.btn} ${styles.btnSecondary}`}>
            {tNav('howItWorks')}
          </Link>
        </div>
      </header>

      {/* The two facts an investor needs before reading anything else: the
          financial information is gated, and buyers commit first. */}
      <div className={styles.gate}>
        <p className={styles.gateTitle}>{t('gate.title')}</p>
        <p className={styles.gateBody}>{t('gate.body')}</p>
        <p className={styles.gateBody}>
          <a href="#request-access" className={styles.gateLink}>
            {t('gate.link')}
          </a>
        </p>
      </div>

      <section className={styles.section} aria-labelledby="sequence-heading">
        <div className={styles.sectionHead}>
          <h2 id="sequence-heading">{t('sequence.title')}</h2>
          <p className={styles.sectionIntro}>{t('sequence.intro')}</p>
        </div>
        <div className={styles.entryCallout}>
          <p className={styles.entryCalloutTitle}>{t('entryCallout.title')}</p>
          <p className={styles.entryCalloutBody}>{t('entryCallout.body')}</p>
        </div>
        <EntryPointSequence />
      </section>

      <section className={styles.section} aria-labelledby="information-heading">
        <div className={styles.sectionHead}>
          <h2 id="information-heading">{t('information.title')}</h2>
          <p className={styles.sectionIntro}>{t('information.intro')}</p>
        </div>
        <FinancialInformationTable rows={DEMO_INFORMATION} />
      </section>

      <section className={styles.section} aria-labelledby="pipeline-heading">
        <div className={styles.sectionHead}>
          <h2 id="pipeline-heading">{t('pipeline.title')}</h2>
          <p className={styles.sectionIntro}>{t('pipeline.intro')}</p>
        </div>
        <FinancingPipelineTable projects={DEMO_PIPELINE} />
      </section>

      <section className={styles.section} aria-labelledby="panel-heading">
        <div className={styles.sectionHead}>
          <h2 id="panel-heading">{t('panel.title')}</h2>
          <p className={styles.sectionIntro}>{t('panel.intro')}</p>
        </div>
        <InvestorAccessPanel project={DEMO_PANEL_PROJECT} />
      </section>

      <section className={styles.section} aria-labelledby="documents-heading">
        <div className={styles.sectionHead}>
          <h2 id="documents-heading">{t('documents.title')}</h2>
          <p className={styles.sectionIntro}>{t('documents.intro')}</p>
        </div>
        <RestrictedDocumentList documents={DEMO_DOCUMENTS} />
      </section>

      <section className={styles.section} aria-labelledby="vetting-heading">
        <div className={styles.sectionHead}>
          <h2 id="vetting-heading">{t('vetting.title')}</h2>
        </div>
        <div className={styles.prose}>
          <p>{t('vetting.body1')}</p>
          <p>{t('vetting.body2')}</p>
          <p>{t('vetting.body3')}</p>
          <p>{t('vetting.body4')}</p>
        </div>
      </section>

      <section className={styles.section} id="request-access" aria-labelledby="request-heading">
        <div className={styles.sectionHead}>
          <h2 id="request-heading">{t('form.title')}</h2>
          <p className={styles.sectionIntro}>{t('form.intro')}</p>
        </div>
        <AccessRequestForm />
      </section>

      <section className={styles.sectionLast} aria-labelledby="limits-heading">
        <div className={styles.sectionHead}>
          <h2 id="limits-heading">{t('limits.title')}</h2>
        </div>
        <ul className={styles.limits}>
          {LIMITS.map((key) => (
            <li key={key} className={styles.limit}>
              {t(`limits.${key}`)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
