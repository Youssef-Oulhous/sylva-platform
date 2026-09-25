import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth/session';
import { primaryRole } from '@/lib/auth/roles';
import { readAs } from '@/lib/db/session';
import { AREAS, type WorkspaceRole } from '@/lib/workspace/nav';
import WorkspaceNav from '@/components/workspace/WorkspaceNav';
import SignOutForm from '@/components/auth/SignOutForm';
import { Link } from '@/lib/i18n/routing';
import styles from '@/components/workspace/Workspace.module.css';

/**
 * The signed-in shell.
 *
 * A visitor and a signed-in person were getting the same header, with "My
 * area" appended, so every role's work looked like a page hanging off a
 * brochure. They are different audiences doing different things, so they get
 * different shells: this one drops the marketing links, states which
 * organisation you are acting for, and shows only that role's sections.
 *
 * The area is chosen by ROLE, not by path. A layout cannot read the pathname
 * on the server, and choosing by role is the more honest rule anyway: a buyer
 * who lands on a shared page such as /vetting is still a buyer and should
 * still see the buyer's sections.
 *
 * This is presentation, not security. Each page keeps its own guard, and the
 * real boundary is the database role the session is served by.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);

  const role = primaryRole(viewer.roles) as WorkspaceRole | null;
  const area = role && AREAS[role] ? AREAS[role] : null;
  const t = await getTranslations();

  // Its own name is the one organisation name every role may read: the
  // function is SECURITY DEFINER and scoped to sylva.actor_org_id(), so it can
  // only ever answer for the caller.
  let orgName = '';
  try {
    const row = await readAs(viewer.actor, (tx) =>
      tx.maybe<{ name: string }>('SELECT org.actor_organisation_name() AS name'),
    );
    orgName = row?.name ?? '';
  } catch {
    orgName = '';
  }

  const labels: Record<string, string> = {};
  for (const s of area?.sections ?? []) labels[s.key] = t.has(s.key) ? t(s.key) : s.key;

  const signOut = t.has('nav.signOut') ? t('nav.signOut') : 'Sign out';
  const backToSite = t.has('workspace.backToSite') ? t('workspace.backToSite') : 'Public site';
  const actingFor = t.has('workspace.actingFor') ? t('workspace.actingFor') : 'Acting for';

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.barInner}>
          <Link href={area?.home ?? '/'} className={styles.home}>
            <span className={styles.areaName}>
              {area && t.has(area.titleKey) ? t(area.titleKey) : t('site.name')}
            </span>
          </Link>
          <div className={styles.actingAs}>
            {orgName && (
              <span>
                {actingFor} <span className={styles.org}>{orgName}</span>
              </span>
            )}
            {role && t.has(`workspace.role.${role}`) && (
              <span className={styles.roleTag}>{t(`workspace.role.${role}`)}</span>
            )}
            <Link href="/projects" className={styles.publicLink}>{backToSite}</Link>
            <SignOutForm label={signOut} />
          </div>
        </div>
      </div>

      {area && (
        <WorkspaceNav
          sections={area.sections}
          ariaLabel={t.has(area.titleKey) ? t(area.titleKey) : 'Workspace'}
          labels={labels}
        />
      )}

      {children}
    </>
  );
}
