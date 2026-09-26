import { getTranslations } from 'next-intl/server';
import { getViewer } from '@/lib/auth/session';
import { primaryRole } from '@/lib/auth/roles';
import { readAs } from '@/lib/db/session';
import { AREAS, type WorkspaceRole } from '@/lib/workspace/nav';
import WorkspaceNav from '@/components/workspace/WorkspaceNav';
import SignOutForm from '@/components/auth/SignOutForm';
import { Link } from '@/lib/i18n/routing';
import styles from '@/components/workspace/Workspace.module.css';

/**
 * The header a signed-in person sees, on EVERY page.
 *
 * It used to wrap only the pages under an area root, which meant that signing
 * in changed the page you were on and nothing else: step onto /projects or
 * /how-it-works and the marketing header came back, with the same five links a
 * stranger sees and "My area" added to the end. Somebody who has signed in is
 * not shopping for the platform any more, and the header should stop selling it
 * to them.
 *
 * So the shell follows the PERSON, not the route group. A visitor gets
 * SiteHeader. Anybody signed in gets this, whatever they are reading - their
 * own sections, the organisation they are acting for, and a way out. The
 * marketing pages stay reachable from the footer, where they belong for
 * somebody who has already decided.
 *
 * Returns null when nobody is signed in, so a caller can fall back to the
 * public header without asking twice: getViewer() is cached per request.
 *
 * This is presentation, not security. Each page keeps its own guard, and the
 * real boundary is the database role the session is served by.
 */
export default async function WorkspaceChrome() {
  const viewer = await getViewer();
  if (!viewer) return null;

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
    </>
  );
}
