import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import PublicationGateList from '@/components/owner-dashboard/PublicationGateList';
import DraftIdentityStrip from '@/components/owner-project-edit/DraftIdentityStrip';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import {
  BoundarySection, ClaimRightsSection, DocumentsSection, DurabilitySection,
  OutcomesSection, PartnersSection, PeriodsSection, SubmitSection, TextSection,
  UnitTypeSection,
} from '@/components/owner-project-edit/RecordSections';
import { requireRole } from '@/lib/auth/guards';
import { getOwnerOrganisationName, getOwnerProjectRecord, getOwnerReference } from '@/lib/owner/queries';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * The project record, as its owner edits it.
 *
 * The sections are the project page's sections, in the same order and under the
 * same headings, so an owner filling in section 05 knows which part of the page
 * the answer lands on. That ordering is the point of the form: it is the reason
 * an owner can predict what a buyer will read, which is the fourth of the
 * client's UX tests.
 *
 * Two things shape every field on it.
 *
 * PROVENANCE. "Every figure on screen carries its source and date" is a rule
 * about the published page, so it is really a rule about this form: a figure
 * can only reach the project page with its source if the source is asked for in
 * the same breath as the figure. So every section carries its own provenance
 * block and writes its own sylva.source_ref row, and source_ref_id is NOT NULL
 * on every table these sections write - a figure without provenance is not
 * representable, not merely discouraged.
 *
 * APPEND-ONLY. Nothing on this page edits anything. Each save inserts
 * version_no + 1 and the previous version stays visible. That is R4, and it is
 * why the record of what is already there is shown above each form: recording
 * the same reference again appends a version rather than creating a second
 * entry, and that is only predictable if the existing references are on screen.
 *
 * RULE 7. The only volumes here are in section 08. They belong to one project
 * and one unit type by composite foreign key, the unit label is printed beside
 * each of them, and there is no total - not across projects, and not across
 * this project's own periods.
 *
 * A slug that names another organisation's project is answered exactly as one
 * that names nothing: telling the two apart would turn this route into a way to
 * find out which slugs exist as other organisations' drafts.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ownerProjectForm' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    robots: { index: false, follow: false },
  };
}

function one(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function OwnerProjectRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', `/owner/projects/${slug}`);
  const t = await getTranslations();
  const sp = await searchParams;

  const [record, reference, orgName] = await Promise.all([
    getOwnerProjectRecord(viewer.actor, slug, locale),
    getOwnerReference(viewer.actor, locale),
    getOwnerOrganisationName(viewer.actor),
  ]);

  if (record === null) notFound();

  const sectionProps = { record, reference, locale };
  const savedSection = one(sp.saved);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('ownerProjectForm.title')}</h1>
        <p className={styles.lead}>{t('ownerProjectForm.lead')}</p>

        <p className={styles.away}>
          <Link href="/owner">&larr; {ownerText(t, 'backToDashboard')}</Link>
          {record.status === 'published' && (
            <>
              {' '}
              <Link href={`/projects/${record.slug}`}>
                {t('owner.projects.viewPublicPage')}
              </Link>
            </>
          )}
        </p>
      </header>

      <OutcomeNote
        error={one(sp.error)}
        saved={savedSection}
        savedText={savedSection === 'created' ? 'savedCreated'
          : savedSection === 'submit' ? 'submitDone' : 'saved'}
      />

      <DraftIdentityStrip record={record} orgName={orgName} />

      <div className={styles.layout}>
        {/* Not an <aside>: it is the index to the document beside it, and an
            unlabelled complementary landmark would add noise rather than
            structure. The list inside is the database's own answer - the array
            proj.publication_gaps() returned a moment ago, in its own order. */}
        <div className={styles.side}>
          <h2 className={styles.lead}>{t('owner.projects.gateTitle')}</h2>
          <PublicationGateList
            gaps={record.gaps}
            checkedOn={new Date().toISOString().slice(0, 10)}
            isPublished={record.status === 'published'}
          />
        </div>

        <div className={styles.body}>
          <TextSection {...sectionProps} />
          <UnitTypeSection {...sectionProps} />
          <BoundarySection {...sectionProps} />
          <ClaimRightsSection {...sectionProps} />
          <OutcomesSection {...sectionProps} />
          <DurabilitySection {...sectionProps} />
          <PartnersSection {...sectionProps} />
          <PeriodsSection {...sectionProps} />
          <DocumentsSection {...sectionProps} />
          <SubmitSection {...sectionProps} />
        </div>
      </div>
    </div>
  );
}
