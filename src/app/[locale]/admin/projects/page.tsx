import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import GateChecklist from '@/components/admin-projects/GateChecklist';
import OtherProjects from '@/components/admin-projects/OtherProjects';
import ProjectFacts from '@/components/admin-projects/ProjectFacts';
import ProjectQueue from '@/components/admin-projects/ProjectQueue';
import PublishAction from '@/components/admin-projects/PublishAction';
import { REVIEW_ROWS, openRow } from '@/components/admin-projects/demo-projects';
import styles from './page.module.css';

/**
 * OPERATOR · project review and publication.
 *
 * Sylva vets everyone who transacts and publishes the projects (concept note
 * section 4). This is the screen where the second half of that happens: the
 * projects waiting, and the one control that moves a project into `published`.
 *
 * The screen is built around one idea. The publication gate is a list of ten
 * items, and that list lives in the database, in `proj.publication_gaps()`, with
 * a trigger on `proj.project` that refuses any change into `published` while the
 * function returns anything. The screen shows the operator that same list, item
 * by item, with the missing ones named - so publication is never a surprise, and
 * the disabled control is honest rather than decorative: a request that reached
 * the database anyway would be refused with SY008.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT SHOW. No unit volumes. It is the one
 * table in the platform that puts projects from different schemes side by side,
 * and a shared volume column there would be the clearest possible breach of
 * rule 7: a hectare-year and an index point measure different things. Volumes
 * belong on each project's own page, per period, under their own unit label.
 * Every row here still carries its unit type, so no two rows read as comparable.
 *
 * FRONTEND PASS. No database, no fetch, no server action, no auth. The demo data
 * is a typed const in `components/admin-projects/demo-projects.ts`, marked as
 * demo. The controls render and do nothing; each says so beside itself. Which
 * role may reach this route, and how a project moves between statuses, are for
 * the data and permission layers - this file asserts neither.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminProjects' });
  return { title: t('title'), description: t('lead') };
}

export default async function AdminProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const rows = REVIEW_ROWS;
  const open = openRow(rows);
  const others = rows.filter((row) => !row.openInPanel);

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('adminProjects.area')}</p>
        <h1>{t('adminProjects.title')}</h1>
        <p className={styles.lead}>{t('adminProjects.lead')}</p>
        {/* Stated once, visibly, rather than implied by the absence of a
            volume column. */}
        <p className={styles.incomparable}>{t('adminProjects.rule7Note')}</p>
      </header>

      <ProjectQueue rows={rows} />

      {open && (
        <section className={styles.panel} aria-labelledby="panel-title">
          <ProjectFacts row={open} headingId="panel-title" />
          <GateChecklist row={open} headingId="panel-gate-title" />
          <PublishAction row={open} headingId="panel-publish-title" />
        </section>
      )}

      <OtherProjects rows={others} />
    </>
  );
}
