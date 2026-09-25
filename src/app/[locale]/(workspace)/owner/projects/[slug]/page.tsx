import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import PublicationGateList from '@/components/owner-dashboard/PublicationGateList';
import DraftIdentityStrip from '@/components/owner-project-edit/DraftIdentityStrip';
import ProjectStepIndex from '@/components/owner-project-edit/ProjectStepIndex';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import { SubmitSection } from '@/components/owner-project-edit/RecordSections';
import { getOwnerOrganisationName } from '@/lib/owner/queries';
import { ownerText } from '@/lib/owner/messages';
import { openStep, queryValue } from '@/lib/owner/step-page';
import { bodyOf } from '@/lib/owner/types';
import styles from './page.module.css';

/**
 * One project, as its owner sees the whole of it.
 *
 * WHAT THIS PAGE USED TO BE. Thirteen forms and around 120 inputs, stacked, with
 * the publication list pinned beside them. It held everything and showed nothing:
 * an owner coming back to correct one sentence scrolled past eight sections to
 * find it, a save bounced to the top of all of it, and a link into "the record"
 * could only ever mean the whole record.
 *
 * WHAT IT IS NOW. The summary of one project: what it is, where publication
 * stands, an index to the eight pages the record is made of, and the one act that
 * belongs to the whole record rather than to a section - handing it to Sylva. The
 * forms moved to their own pages unchanged; every Server Action is the same
 * action, and what changed is only which URL it comes back to.
 *
 * The publication list is the database's own answer. `record.gaps` is the array
 * proj.publication_gaps() returned a moment ago, not a reimplementation of it,
 * and the trigger on proj.project refuses the change to 'published' while that
 * array is not empty. So this page cannot tell an owner a project is ready while
 * the database would decline to publish it.
 *
 * RULE 7. No volume on this page at all. Availability belongs to one project and
 * one period and is shown on the periods step, beside its own unit label.
 *
 * A slug that names another organisation's project is answered exactly as one
 * that names nothing - see openStep().
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'ownerProjectForm' });
  return {
    title: `${slug} — ${t('title')}`,
    description: t('metaDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function OwnerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // openStep() holds this page's guard and answers notFound() for a slug this
  // organisation does not own. '' is the project overview rather than a step.
  const { viewer, record, reference } = await openStep(slug, '', locale);
  const orgName = await getOwnerOrganisationName(viewer.actor);

  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const sp = await searchParams;

  const savedSection = queryValue(sp.saved);
  const title = bodyOf(record.text, 'title', locale)
    || bodyOf(record.text, 'title', 'en')
    || record.slug;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.away}>
          <Link href="/owner/projects">&larr; {ownerText(t, 'backToProjects')}</Link>
        </p>

        <h1>{title}</h1>
        <p className={styles.lead}>{tf('lead')}</p>

        {record.status === 'published' && (
          <p className={styles.away}>
            <Link href={`/projects/${record.slug}`}>
              {t('owner.projects.viewPublicPage')} &rarr;
            </Link>
          </p>
        )}
      </header>

      <OutcomeNote
        error={queryValue(sp.error)}
        saved={savedSection}
        savedText={savedSection === 'created' ? 'savedCreated'
          : savedSection === 'submit' ? 'submitDone' : 'saved'}
      />

      <DraftIdentityStrip record={record} orgName={orgName} />

      <section className={styles.section} aria-labelledby="record-index">
        <h2 id="record-index">{ownerText(t, 'recordSectionsTitle')}</h2>
        <p className={styles.sectionLead}>{ownerText(t, 'recordSectionsLead')}</p>
        <ProjectStepIndex slug={record.slug} gaps={record.gaps} />
      </section>

      <section className={styles.section} aria-labelledby="record-gate">
        <h2 id="record-gate">{t('owner.projects.gateTitle')}</h2>
        {/* The list the database itself checks, in its own order. */}
        <PublicationGateList
          gaps={record.gaps}
          checkedOn={new Date().toISOString().slice(0, 10)}
          isPublished={record.status === 'published'}
        />
      </section>

      <SubmitSection record={record} reference={reference} locale={locale} />
    </div>
  );
}
