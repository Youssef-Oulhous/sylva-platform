import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getActor } from '@/lib/auth/session';
import { getBuyerSiteProximity, getProjectDetail } from '@/lib/projects/queries';
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
 * WIRED TO THE DATABASE. Two reads, both through readAs():
 *
 *   getProjectDetail()        everything the page shows, as the viewer's own
 *                             database role. What comes back differs by role
 *                             because the row-level policies differ, not
 *                             because this file branches on one.
 *   getBuyerSiteProximity()   a signed-in buyer's OWN sites, measured against
 *                             this project. Null for everybody else.
 *
 * `dynamic = 'force-dynamic'` is load-bearing, not a precaution. This page
 * embeds the viewer's own site names and distances, their own question threads,
 * and documents that only a vetted buyer or investor may see. A cached render
 * would serve one organisation's private data to the next visitor, and no
 * database policy can undo that once the cache has it. Reading the session
 * cookie already opts the route out of static rendering; saying so explicitly
 * means a later refactor that stops reading the cookie in some branch cannot
 * silently make the page cacheable again.
 *
 * notFound() is the database's answer, not this file's opinion: an unpublished
 * project is invisible to proj.is_publicly_visible() inside the policy, so
 * getProjectDetail() returns null for it exactly as it does for a slug that
 * names nothing. A stranger cannot tell the two apart, which is the point.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  // Metadata is read as the CURRENT viewer too. A draft project must not leak a
  // title into a <title> tag for a visitor who cannot open the page.
  const project = await getProjectDetail(await getActor(), slug, locale);
  if (!project) return { title: t('errors.notFound') };

  return {
    title: project.title.body,
    description: t('projectPage.meta.description', {
      catchment: project.catchment?.datasetName ?? project.countryNameEn,
      scheme: project.scheme.name,
    }),
  };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const query = await searchParams;

  const actor = await getActor();
  const project = await getProjectDetail(actor, slug, locale);
  if (!project) notFound();

  // Private to the signed-in buyer. Null for anyone else, including an operator
  // - the operator has no sites of its own to measure.
  const proximity = await getBuyerSiteProximity(actor, project.id);

  const questionError = typeof query.qerror === 'string' ? query.qerror : null;
  const questionSent = query.qsent === '1';

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
            <CatchmentMapPanel project={project} proximity={proximity} />
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
            <PrivateQuestionsSection
              project={project}
              sent={questionSent}
              error={questionError}
            />
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
