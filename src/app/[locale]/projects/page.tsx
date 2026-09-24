import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listProjects } from '@/lib/projects/queries';
import { ANONYMOUS } from '@/lib/db/actor';
import ProjectCard from '@/components/projects/ProjectCard';
import styles from './page.module.css';

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'projects' });
  return { title: t('title'), description: t('lead') };
}

export default async function ProjectsPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // Read as an anonymous visitor. Row-level security decides what comes back;
  // this page contains no publication filter of its own, deliberately.
  const projects = await listProjects(ANONYMOUS, locale);

  return (
    <>
      <header className={styles.head}>
        <h1>{t('projects.title')}</h1>
        <p className={styles.lead}>{t('projects.lead')}</p>
        <p className={styles.incomparable}>{t('project.availabilityNote')}</p>
        <p className={styles.count}>{t('projects.count', { count: projects.length })}</p>
      </header>

      {projects.length === 0 ? (
        <div className={styles.empty}>{t('projects.empty')}</div>
      ) : (
        <div className={styles.list}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </>
  );
}
