import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import DraftIdentityStrip from '@/components/owner-project-edit/DraftIdentityStrip';
import ReadinessPanel from '@/components/owner-project-edit/ReadinessPanel';
import ProjectForm from '@/components/owner-project-edit/ProjectForm';
import styles from './page.module.css';

/**
 * The project record, as its owner sees it: create or edit.
 *
 * The form is the project page turned around. Its nine sections are that page's
 * nine sections, in the same order and under the same headings, so an owner can
 * tell what a buyer will read - which is the fourth of the client's UX tests,
 * "can a project owner understand how to present a project?".
 *
 * Two things shape every field on it.
 *
 * Provenance. "Every figure on screen carries its source and date" (concept note,
 * section 9) is a rule about the published page, so it is really a rule about
 * this form: a figure can only reach the project page with its source if the
 * source is asked for in the same breath as the figure. So a figure here is not a
 * box - it is a value, a unit, a source document, a reference inside that
 * document and an as-of date, drawn as one field, and a figure missing any of it
 * is marked in words where it is missing and again in the readiness panel.
 *
 * Rule 7. Units from different projects measure different things, so no screen
 * adds them. This page holds one project, states its unit label beside every
 * volume, and contains no total of any kind - not across projects, and not even
 * across this project's own periods.
 *
 * FRONTEND PASS. No database, no fetch, no server action, no auth. The record is
 * a typed DEMO constant in src/components/owner-project-edit/project-draft-data.ts.
 * The form has no action, every control is uncontrolled, the buttons are inert
 * and described by one note that says so, and nothing on the page is a client
 * component.
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
    // An unpublished record an organisation is drafting about itself has nothing
    // to index, and must not turn up in a search for the project's name.
    robots: { index: false, follow: false },
  };
}

export default async function NewProjectPage({
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
        <h1>{t('ownerProjectForm.title')}</h1>
        <p className={styles.lead}>{t('ownerProjectForm.lead')}</p>

        <div className={styles.demoNote}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <p className={styles.demoNoteText}>{t('ownerProjectForm.demoNote')}</p>
        </div>

        <p className={styles.away}>
          <Link href="/projects">{t('ownerProjectForm.seePublished')}</Link>
        </p>
      </header>

      <DraftIdentityStrip />

      <div className={styles.layout}>
        {/* Not an <aside>: it is the index to the document beside it, and an
            unlabelled complementary landmark would add noise rather than
            structure. The panel inside carries its own heading. */}
        <div className={styles.side}>
          <ReadinessPanel />
        </div>

        <div className={styles.body}>
          <ProjectForm />
        </div>
      </div>
    </div>
  );
}
