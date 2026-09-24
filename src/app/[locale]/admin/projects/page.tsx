import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirectTo } from '@/lib/i18n/navigate';
import { getViewer } from '@/lib/auth/session';
import { primaryRole } from '@/lib/auth/roles';
import { loadAdminProjects } from '@/lib/admin/queries';
import { isAdminErrorCode, type AdminErrorCode } from '@/lib/admin/errors';
import { adminText } from '@/lib/admin/messages';
import { isGateCode, type PublicationGateCode } from '@/lib/admin/types';
import GateChecklist from '@/components/admin-projects/GateChecklist';
import OtherProjects from '@/components/admin-projects/OtherProjects';
import ProjectFacts from '@/components/admin-projects/ProjectFacts';
import ProjectQueue from '@/components/admin-projects/ProjectQueue';
import PublishAction from '@/components/admin-projects/PublishAction';
import styles from './page.module.css';

/**
 * OPERATOR · project review and publication, wired to the database.
 *
 * Sylva vets everyone who transacts and publishes the projects (concept note
 * section 4). This is the screen where the second half of that happens: the
 * projects waiting, and the one control that moves a project into `published`.
 *
 * The screen is built around one idea. The publication gate is a list of ten
 * items, and that list lives in the database, in `proj.publication_gaps()`,
 * with a trigger on `proj.project` that refuses any change into `published`
 * while the function returns anything. The screen shows the operator that same
 * list, item by item, with the missing ones named - so publication is never a
 * surprise, and the disabled control is honest rather than decorative.
 *
 * AND WHEN THE DATABASE REFUSES ANYWAY, ITS ANSWER IS SHOWN. The action does
 * not pre-check the gate; it sends the UPDATE. A refusal comes back as SY008
 * with the missing items named, and they are rendered above the control with
 * the same labels the checklist uses. What an operator must never see is a
 * stack trace or "Something went wrong".
 *
 * WHO MAY REACH THIS ROUTE. Sylva operators. The guard below decides what is
 * SHOWN; the boundary is that `UPDATE (status, published_at)` on `proj.project`
 * is granted to `sylva_operator` and to no other application role, so a request
 * from any other account is refused by PostgreSQL rather than by this file.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT SHOW. No unit volumes. It is the one
 * table in the platform that puts projects from different schemes side by side,
 * and a shared volume column there would be the clearest possible breach of
 * rule 7: a hectare-year and an index point measure different things. Volumes
 * belong on each project's own page, per period, under their own unit label.
 * Every row here still carries its unit type, so no two rows read as comparable.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminProjects' });
  return {
    title: t('title'),
    description: t('lead'),
    robots: { index: false, follow: false },
  };
}

interface Search {
  project?: string;
  error?: string;
  missing?: string;
  published?: string;
}

export default async function AdminProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const query = await searchParams;

  const viewer = await getViewer();
  if (!viewer) {
    redirectTo({
      href: { pathname: '/sign-in', query: { next: '/admin/projects' } },
      locale,
    });
  }
  if (primaryRole(viewer.roles) !== 'operator') {
    redirectTo({ href: { pathname: '/sign-in', query: { error: 'wrong_role' } }, locale });
  }

  const rows = await loadAdminProjects(viewer.actor, locale);

  /**
   * Which project the panel shows. The query string names one by slug;
   * otherwise the first project that is not yet published, because that is
   * what this screen is for. A project id also matches, which is what the
   * failure redirect carries.
   */
  const asked = typeof query.project === 'string' ? query.project : null;
  const open =
    (asked ? rows.find((r) => r.slug === asked || r.id === asked) : undefined)
    ?? rows.find((r) => r.status !== 'published')
    ?? rows[0]
    ?? null;

  const others = rows.filter((r) => r.id !== open?.id);

  const error: AdminErrorCode | null = isAdminErrorCode(query.error) ? query.error : null;
  // Only the codes this release can name; anything else is dropped rather than
  // printed raw. See missingFromGateError().
  const refusedItems: PublicationGateCode[] =
    typeof query.missing === 'string'
      ? query.missing.split(',').map((c) => c.trim()).filter(isGateCode)
      : [];
  const published = query.published === '1';

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('adminProjects.area')}</p>
        <h1>{t('adminProjects.title')}</h1>
        <p className={styles.lead}>{t('adminProjects.lead')}</p>
        {/* Stated once, visibly, rather than implied by the absence of a
            volume column. */}
        <p className={styles.incomparable}>{t('adminProjects.rule7Note')}</p>
        <p className={styles.incomparable}>{adminText(t, 'accessNote')}</p>
      </header>

      <ProjectQueue rows={rows} openId={open?.id ?? null} />

      {open && (
        <section className={styles.panel} aria-labelledby="panel-title">
          <ProjectFacts project={open} headingId="panel-title" />
          <GateChecklist project={open} headingId="panel-gate-title" />
          <PublishAction
            project={open}
            headingId="panel-publish-title"
            // The refusal belongs to the project the action was sent for. It is
            // shown on the panel only when that is the project now open.
            error={error}
            refusedItems={refusedItems}
            published={published}
          />
        </section>
      )}

      <OtherProjects rows={others} />
    </>
  );
}
