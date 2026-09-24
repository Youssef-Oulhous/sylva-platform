import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DEMO_PROJECT } from '@/components/project-detail/demo-data';
import ProjectHeader from '@/components/project-detail/ProjectHeader';
import SectionNav from '@/components/project-detail/SectionNav';
import CatchmentMapPanel from '@/components/project-detail/CatchmentMapPanel';
import ProjectSummarySection from '@/components/project-detail/ProjectSummarySection';
import OutcomesSection from '@/components/project-detail/OutcomesSection';
import ClaimRightsSection from '@/components/project-detail/ClaimRightsSection';
import DurabilitySection from '@/components/project-detail/DurabilitySection';
import AvailabilitySection from '@/components/project-detail/AvailabilitySection';
import DocumentsSection from '@/components/project-detail/DocumentsSection';
import PartnersSection from '@/components/project-detail/PartnersSection';
import EvidencePackSection from '@/components/project-detail/EvidencePackSection';
import PrivateQuestionsSection from '@/components/project-detail/PrivateQuestionsSection';
import InvestorBlock from '@/components/project-detail/InvestorBlock';
import styles from './page.module.css';

/**
 * The project detail page.
 *
 * The test this page is built against: a finance analyst reads it in ten minutes
 * and knows what is being sold, where, on what evidence, with what claim rights
 * and on what terms. So it is ordered as a document, not as a dashboard - the
 * header answers "what and where", and each numbered section answers one
 * question, in the order a reader asks them.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. The page
 * renders DEMO_PROJECT, a typed fictional project, and every download and form
 * points at the route it will use later without calling anything now. The slug
 * in the URL is not yet used to select a project; that arrives with the data
 * layer, together with notFound() for an unknown or unpublished slug.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: DEMO_PROJECT.name,
    description: t('projectPage.meta.description', {
      catchment: t('projectPage.demo.catchment'),
      scheme: DEMO_PROJECT.schemeName,
    }),
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // DEMO data. Nothing on this page is read from the database in this pass.
  const project = DEMO_PROJECT;

  return (
    <article className={styles.page}>
      <ProjectHeader project={project} />

      <div className={styles.body}>
        <div className={styles.navColumn}>
          <SectionNav />
        </div>

        <div className={styles.sections}>
          <section id="map" className={styles.section}>
            <SectionMarker n={1} label={t('project.map')} />
            <CatchmentMapPanel project={project} />
          </section>

          <section id="summary" className={styles.section}>
            <SectionMarker n={2} label={t('project.summary')} />
            <ProjectSummarySection project={project} />
          </section>

          <section id="outcomes" className={styles.section}>
            <SectionMarker n={3} label={t('project.outcomes')} />
            <OutcomesSection project={project} />
          </section>

          <section id="claim-rights" className={styles.section}>
            <SectionMarker n={4} label={t('project.claimRights')} />
            <ClaimRightsSection project={project} />
          </section>

          <section id="durability" className={styles.section}>
            <SectionMarker n={5} label={t('project.durability')} />
            <DurabilitySection project={project} />
          </section>

          <section id="availability" className={styles.section}>
            <SectionMarker n={6} label={t('project.availability')} />
            <AvailabilitySection project={project} />
          </section>

          <section id="documents" className={styles.section}>
            <SectionMarker n={7} label={t('project.documents')} />
            <DocumentsSection project={project} />
          </section>

          <section id="partners" className={styles.section}>
            <SectionMarker n={8} label={t('project.partners')} />
            <PartnersSection project={project} />
          </section>

          <section id="evidence" className={styles.section}>
            <SectionMarker n={9} label={t('projectPage.evidence.title')} />
            <EvidencePackSection project={project} />
          </section>

          <section id="questions" className={styles.section}>
            <SectionMarker n={10} label={t('projectPage.questions.title')} />
            <PrivateQuestionsSection project={project} />
          </section>

          {/* Set apart from the buyer's document, as the brief requires: an
              investor's view of this project is a different conversation. */}
          <section id="financing" className={styles.sectionApart}>
            <SectionMarker n={11} label={t('project.investorInfo')} />
            <InvestorBlock project={project} />
          </section>
        </div>
      </div>
    </article>
  );
}

/**
 * The small numbered kicker above each section heading. Decorative for a sighted
 * reader who is scanning, and hidden from assistive technology, which already
 * has the heading and the landmark.
 */
function SectionMarker({ n, label }: { n: number; label: string }) {
  return (
    <p className={styles.marker} aria-hidden="true">
      <span className={styles.markerNum}>{String(n).padStart(2, '0')}</span>
      <span className={styles.markerLabel}>{label}</span>
    </p>
  );
}
