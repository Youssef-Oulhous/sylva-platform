import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import DealShapes from '@/components/how-it-works/DealShapes';
import FlowSteps from '@/components/how-it-works/FlowSteps';
import PlatformBoundaries from '@/components/how-it-works/PlatformBoundaries';
import TermsList from '@/components/how-it-works/TermsList';
import UnitScopeBlocks, {
  type DemoUnitScope,
} from '@/components/how-it-works/UnitScopeBlocks';
import styles from './page.module.css';

/**
 * How it works - the explainer.
 *
 * The page answers four questions in order: what happens at each of the seven
 * steps and who does it, what can actually be transacted, why two projects'
 * unit figures are never added, and what this platform is not. The last of
 * those is not a footnote: the concept note says plainly that Sylva is not the
 * registry, does not verify and handles no money, and a reader who leaves this
 * page without knowing that has been misled by omission.
 *
 * Frontend only. There is no data layer on this page: the two demo unit blocks
 * below are the only figures, and they are declared here, in full, as demo.
 */

/**
 * DEMO DATA. Two fictional projects under two different schemes, which is the
 * entire point of the section that renders them: one sells hectare-years, the
 * other sells points on an index, and no arithmetic relates the two.
 *
 * Figures are held as given and printed as given. The Untere Havel row matches
 * the 2029 period on the demo project page so the two pages cannot be caught
 * disagreeing. Nothing here describes a real wetland or a real verification.
 */
const DEMO_UNIT_SCOPES: readonly DemoUnitScope[] = [
  {
    id: 'demo-havel',
    projectName: 'DEMO Untere Havel Wetland Restoration',
    schemeName: 'DEMO Wetland Biodiversity Standard',
    unitMetricKey: 'howItWorks.units.metricHectareYears',
    periodLabel: '2029',
    figures: [
      { labelKey: 'project.expectedIssuance', value: 10000 },
      { labelKey: 'project.buffer', value: 800 },
      { labelKey: 'project.committed', value: 2000 },
      { labelKey: 'project.remaining', value: 7200 },
    ],
    source: {
      labelKey: 'howItWorks.units.sourceDesignDocument',
      locator: 'v1.2, table 7',
      asOfDate: '2026-09-12',
    },
  },
  {
    id: 'demo-vistula',
    projectName: 'DEMO Vistula Oxbow Reconnection',
    schemeName: 'DEMO River Condition Index',
    unitMetricKey: 'howItWorks.units.metricIndexPoints',
    periodLabel: '2029',
    figures: [
      { labelKey: 'project.expectedIssuance', value: 540 },
      { labelKey: 'project.buffer', value: 40 },
      { labelKey: 'project.committed', value: 120 },
      { labelKey: 'project.remaining', value: 380 },
    ],
    source: {
      labelKey: 'howItWorks.units.sourceDesignDocument',
      locator: 'v0.9, table 4',
      asOfDate: '2026-08-28',
    },
  },
];

/** Section ids double as the in-page navigation and as link targets. */
const SECTIONS = [
  { id: 'flow', titleKey: 'howItWorks.flow.title' },
  { id: 'vetting', titleKey: 'howItWorks.vetting.title' },
  { id: 'deal-shapes', titleKey: 'howItWorks.dealShapes.title' },
  { id: 'units', titleKey: 'howItWorks.units.title' },
  { id: 'boundaries', titleKey: 'howItWorks.boundaries.title' },
  { id: 'terms', titleKey: 'howItWorks.terms.title' },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'howItWorks' });
  return { title: t('title'), description: t('metaDescription') };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <header className={styles.head}>
        <h1>{t('howItWorks.title')}</h1>
        <p className={styles.lead}>{t('howItWorks.lead')}</p>
        {/* Reused from the landing page: the single fact that shapes every
            other answer on this page is that units are issued late. */}
        <p className={styles.issuanceNote}>{t('home.processIntro')}</p>
      </header>

      <nav className={styles.toc} aria-label={t('howItWorks.onThisPage')}>
        <p className={styles.tocTitle}>{t('howItWorks.onThisPage')}</p>
        <ol className={styles.tocList}>
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{t(section.titleKey)}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="flow" className={styles.section} aria-labelledby="flow-title">
        <div className={styles.sectionHead}>
          <h2 id="flow-title">{t('howItWorks.flow.title')}</h2>
          <p className={styles.sectionLead}>{t('howItWorks.flow.lead')}</p>
        </div>
        <FlowSteps />
      </section>

      <section id="vetting" className={styles.section} aria-labelledby="vetting-title">
        <div className={styles.sectionHead}>
          <h2 id="vetting-title">{t('howItWorks.vetting.title')}</h2>
        </div>
        <p className={styles.body}>{t('howItWorks.vetting.body')}</p>
        <p className={styles.body}>{t('howItWorks.vetting.approval')}</p>
        <p className={styles.body}>{t('howItWorks.vetting.pseudonym')}</p>
      </section>

      <section id="deal-shapes" className={styles.section} aria-labelledby="deal-shapes-title">
        <div className={styles.sectionHead}>
          <h2 id="deal-shapes-title">{t('howItWorks.dealShapes.title')}</h2>
          <p className={styles.sectionLead}>{t('howItWorks.dealShapes.lead')}</p>
        </div>
        <DealShapes />
      </section>

      <section id="units" className={styles.section} aria-labelledby="units-title">
        <div className={styles.sectionHead}>
          <h2 id="units-title">{t('howItWorks.units.title')}</h2>
          <p className={styles.sectionLead}>{t('howItWorks.units.lead')}</p>
          <p className={styles.body}>{t('howItWorks.units.rule')}</p>
        </div>
        <UnitScopeBlocks scopes={DEMO_UNIT_SCOPES} />
      </section>

      <section id="boundaries" className={styles.section} aria-labelledby="boundaries-title">
        <div className={styles.sectionHead}>
          <h2 id="boundaries-title">{t('howItWorks.boundaries.title')}</h2>
          <p className={styles.sectionLead}>{t('howItWorks.boundaries.lead')}</p>
        </div>
        <PlatformBoundaries />
      </section>

      <section id="terms" className={styles.section} aria-labelledby="terms-title">
        <div className={styles.sectionHead}>
          <h2 id="terms-title">{t('howItWorks.terms.title')}</h2>
          <p className={styles.sectionLead}>{t('howItWorks.terms.lead')}</p>
        </div>
        <TermsList />
      </section>

      <section className={styles.next} aria-labelledby="next-title">
        <h2 id="next-title">{t('howItWorks.next.title')}</h2>
        <p className={styles.body}>{t('howItWorks.next.body')}</p>
        <div className={styles.ctas}>
          <Link href="/projects" className={`${styles.btn} ${styles.btnPrimary}`}>
            {t('home.ctaExplore')}
          </Link>
          <Link href="/for-buyers" className={`${styles.btn} ${styles.btnSecondary}`}>
            {t('nav.forBuyers')}
          </Link>
          <Link href="/for-investors" className={`${styles.btn} ${styles.btnSecondary}`}>
            {t('nav.forInvestors')}
          </Link>
        </div>
      </section>
    </>
  );
}
