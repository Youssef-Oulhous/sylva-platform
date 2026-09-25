import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import OwnerProjectRow from '@/components/owner-dashboard/OwnerProjectRow';
import { requireRole } from '@/lib/auth/guards';
import { listOwnerProjects } from '@/lib/owner/queries';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * Every project this organisation owns, and what is blocking each one.
 *
 * "My projects" in the workspace navigation used to land on the overview, which
 * also carried the question queue and the interest queue, and each project's
 * record was one enormous page below. This is the list on its own: one row per
 * project, its status as a word, its nearest period's availability in its own
 * unit, and the publication list the database itself applies.
 *
 * WHAT IS BLOCKING IS THE DATABASE'S ANSWER. Each row's `gaps` is the array
 * proj.publication_gaps() returned a moment ago, and the trigger on proj.project
 * refuses the change to 'published' while that array is not empty. Nothing here
 * reimplements the gate.
 *
 * RULE 7. Every unit figure sits inside ONE project's availability table, for one
 * period, printed with that project's own unit label beside it. Nothing on this
 * page adds across projects: the counts at the top count projects, and say so.
 *
 * Row-level security has already narrowed proj.project to this organisation.
 * requireRole() decides what is SHOWN; it is not the boundary. See
 * docs/FINDING-001.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'owner' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // A private workspace. An unpublished draft belongs in no search index.
    robots: { index: false, follow: false },
  };
}

export default async function OwnerProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', '/owner/projects');
  const t = await getTranslations();

  const projects = await listOwnerProjects(viewer.actor, locale);
  const published = projects.filter((p) => p.isPublished);
  const blocked = projects.filter((p) => p.gaps.length > 0);

  // The date the page was rendered. Every figure below was read then, so that is
  // what the source stamp states.
  const asOf = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('owner.title')}</h1>

        <p className={styles.counts}>
          {t('owner.projects.count', { count: projects.length })}{' '}
          {t('source.separator')}{' '}
          {t('owner.projects.published', { count: published.length })}{' '}
          {t('source.separator')}{' '}
          {t('owner.projects.blocked', { count: blocked.length })}
        </p>

        <SourceStamp
          source={{ label: t('owner.source.dashboard'), locator: null, asOfDate: asOf }}
        />

        {/* Said once, near the first figures, so the absence of a
            platform-wide volume reads as a decision. */}
        <p className={styles.countNote}>{t('owner.countNote')}</p>

        <p className={styles.sectionFoot}>
          <Link href="/owner/projects/new">{ownerText(t, 'addProject')} &rarr;</Link>
        </p>
      </header>

      {projects.length === 0 ? (
        <p className={styles.empty}>{t('owner.projects.empty')}</p>
      ) : (
        <div className={styles.projects}>
          {projects.map((project) => (
            <OwnerProjectRow key={project.id} project={project} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
