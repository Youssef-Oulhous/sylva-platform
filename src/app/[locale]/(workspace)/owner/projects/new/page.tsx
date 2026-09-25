import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import CreateProjectForm from '@/components/owner-project-edit/CreateProjectForm';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import { requireRole } from '@/lib/auth/guards';
import { getOwnerReference } from '@/lib/owner/queries';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * Add a project.
 *
 * The concept note (section 2) says project owners put projects on the
 * platform. Until migration 0050 they could not: every project content table
 * was granted INSERT to sylva_operator alone. This page is the other half of
 * that migration.
 *
 * It creates a DRAFT. Publication is Sylva's act, and it is refused to an owner
 * twice over - by the row policy that admits one target status, and by the
 * column privilege that withholds published_at, which the CHECK on proj.project
 * makes indispensable. So a project created here appears on nobody's screen but
 * its owner's until Sylva publishes it.
 *
 * Everything beyond the name, the country and the summary is recorded on the
 * draft afterwards, section by section, each with its own source and its own
 * as-of date. That is not a staging trick: project content is append-only and
 * versioned, and one entry with one provenance is the unit the database stores.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ownerProjectForm' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // An unpublished record an organisation is drafting about itself has
    // nothing to index, and must not turn up in a search for its name.
    robots: { index: false, follow: false },
  };
}

function one(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function NewProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', '/owner/projects/new');
  const t = await getTranslations();
  const sp = await searchParams;

  const reference = await getOwnerReference(viewer.actor, locale);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{ownerText(t, 'createTitle')}</h1>
        <p className={styles.lead}>{ownerText(t, 'createLead')}</p>

        <p className={styles.away}>
          <Link href="/owner">&larr; {ownerText(t, 'backToDashboard')}</Link>
        </p>
      </header>

      <OutcomeNote error={one(sp.error)} />

      <div className={styles.body}>
        <CreateProjectForm reference={reference} locale={locale} />
      </div>
    </div>
  );
}
