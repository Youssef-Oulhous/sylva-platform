import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import BuyerSituations from '@/components/for-buyers/BuyerSituations';
import BuyerActions from '@/components/for-buyers/BuyerActions';
import SiteDistancePanel from '@/components/for-buyers/SiteDistancePanel';
import DisclosurePanel from '@/components/for-buyers/DisclosurePanel';
import DealShapesTable from '@/components/for-buyers/DealShapesTable';
import VettingPreview from '@/components/for-buyers/VettingPreview';
import styles from './page.module.css';

/**
 * For buyers.
 *
 * The client interviewed two kinds of corporate buyer and they want different
 * things from the same project page: the water-dependent buyer reads the
 * catchment first, the reporting-driven buyer reads the documentation first.
 * This page states both situations side by side rather than averaging them into
 * one "buyer", then walks through what a buyer can actually do here, on what
 * terms its identity appears in public, and what we ask before a deal exists.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. Every
 * figure on the page belongs to a typed DEMO constant declared at the top of
 * the component that renders it, and the vetting questionnaire renders but does
 * not submit.
 *
 * Rule 7: this page shows no unit volumes at all. Volumes belong to one project
 * and one period, and they are stated on that project's own page, where the
 * unit label travels with the number. Nothing here could be read as a
 * platform-wide quantity.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'forBuyers' });
  return { title: t('title'), description: t('metaDescription') };
}

export default async function ForBuyersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('forBuyers.title')}</h1>
        <p className={styles.lead}>{t('forBuyers.lead')}</p>
        {/* Stated once, at the top: the platform never adds volumes across
            projects, so nothing on a buyer page can be read as a market total. */}
        <p className={styles.incomparable}>{t('projects.lead')}</p>
      </header>

      <div className={styles.sections}>
        <section id="situations" className={styles.section}>
          <SectionMarker n={1} label={t('forBuyers.situations.title')} />
          <BuyerSituations />
        </section>

        <section id="what-you-can-do" className={styles.section}>
          <SectionMarker n={2} label={t('forBuyers.actions.title')} />
          <BuyerActions />
        </section>

        <section id="your-sites" className={styles.section}>
          <SectionMarker n={3} label={t('project.yourSites')} />
          <SiteDistancePanel />
        </section>

        <section id="identity" className={styles.section}>
          <SectionMarker n={4} label={t('forBuyers.disclosure.title')} />
          <DisclosurePanel />
        </section>

        <section id="deal-shapes" className={styles.section}>
          <SectionMarker n={5} label={t('forBuyers.dealShapes.title')} />
          <DealShapesTable />
        </section>

        <section id="vetting" className={styles.section}>
          <SectionMarker n={6} label={t('forBuyers.vetting.title')} />
          <VettingPreview />
        </section>
      </div>

      <aside className={styles.next} aria-labelledby="next-step">
        <h2 id="next-step" className={styles.nextTitle}>
          {t('forBuyers.next.title')}
        </h2>
        <p className={styles.nextBody}>{t('forBuyers.next.body')}</p>
        <Link href="/projects" className={styles.nextCta}>
          {t('home.ctaExplore')}
        </Link>
      </aside>
    </div>
  );
}

/**
 * The numbered kicker above each section. It helps a reader scanning the page
 * and is hidden from assistive technology, which already has the heading.
 */
function SectionMarker({ n, label }: { n: number; label: string }) {
  return (
    <p className={styles.marker} aria-hidden="true">
      <span className={styles.markerNum}>{String(n).padStart(2, '0')}</span>
      <span className={styles.markerLabel}>{label}</span>
    </p>
  );
}
