import type { ActorRole } from '@/lib/db/actor';

/**
 * What each role's area contains.
 *
 * The platform has two shells, not one. A visitor gets the marketing header -
 * Projects, How it works, For buyers, For investors, About - because those are
 * the pages that exist to explain the platform to someone who has not decided
 * anything yet. Somebody who has signed in is past that, and wants the small
 * number of things their own job is made of.
 *
 * Previously both audiences shared one header and a signed-in person got "My
 * area" bolted onto the end of the marketing nav. That made every role's work
 * look like a single long page hanging off a brochure, and an investor landed
 * on a page headed "Buyer dashboard".
 *
 * One list, here, so a role's sections cannot drift between the navigation and
 * the pages that implement them.
 */

export type WorkspaceRole = ActorRole | 'operator' | 'auditor';

export interface NavItem {
  href: string;
  /** i18n key for the label. */
  key: string;
  /** Matched as a prefix, so a deep page still highlights its section. */
  match?: string;
  /**
   * Extra path prefixes this section owns.
   *
   * /vetting and /vetting/status sit outside every area root, because an
   * organisation is vetted once and the pages are shared by the three roles
   * that can be waiting for it. Without this, somebody whose organisation is
   * not vetted yet - which is exactly the person most likely to be on those
   * pages - saw their whole navigation with nothing marked as current, and no
   * way to tell where in their own area they were. Vetting state is shown under
   * Organisation, so Organisation is the section that claims those paths.
   */
  covers?: readonly string[];
}

export interface RoleArea {
  role: WorkspaceRole;
  /** Where this role lands after signing in. */
  home: string;
  /** i18n key naming the area, shown in the workspace header. */
  titleKey: string;
  sections: NavItem[];
}

export const AREAS: Record<WorkspaceRole, RoleArea> = {
  buyer: {
    role: 'buyer',
    home: '/dashboard',
    titleKey: 'workspace.buyer.title',
    sections: [
      { href: '/dashboard', key: 'workspace.buyer.overview' },
      { href: '/projects', key: 'workspace.common.browse', covers: ['/projects'] },
      { href: '/dashboard/interests', key: 'workspace.buyer.interests' },
      { href: '/dashboard/sites', key: 'workspace.buyer.sites' },
      { href: '/dashboard/documents', key: 'workspace.buyer.documents' },
      { href: '/dashboard/organisation', key: 'workspace.buyer.organisation', covers: ['/vetting'] },
    ],
  },
  project_owner: {
    role: 'project_owner',
    home: '/owner',
    titleKey: 'workspace.owner.title',
    sections: [
      { href: '/owner', key: 'workspace.owner.overview' },
      { href: '/owner/projects', key: 'workspace.owner.projects', match: '/owner/projects' },
      { href: '/owner/questions', key: 'workspace.owner.questions' },
      { href: '/owner/interest', key: 'workspace.owner.interest' },
      { href: '/owner/organisation', key: 'workspace.owner.organisation', covers: ['/vetting'] },
      { href: '/projects', key: 'workspace.common.browse', covers: ['/projects'] },
    ],
  },
  investor: {
    role: 'investor',
    home: '/investor',
    titleKey: 'workspace.investor.title',
    sections: [
      { href: '/investor', key: 'workspace.investor.overview' },
      { href: '/investor/projects', key: 'workspace.investor.projects', match: '/investor/projects' },
      { href: '/investor/interests', key: 'workspace.investor.interests' },
      { href: '/investor/organisation', key: 'workspace.investor.organisation', covers: ['/vetting'] },
      { href: '/projects', key: 'workspace.common.browse', covers: ['/projects'] },
    ],
  },
  operator: {
    role: 'operator',
    home: '/admin',
    titleKey: 'workspace.operator.title',
    sections: [
      { href: '/admin', key: 'workspace.operator.overview' },
      { href: '/admin/vetting', key: 'workspace.operator.vetting' },
      { href: '/admin/projects', key: 'workspace.operator.projects' },
      { href: '/admin/record', key: 'workspace.operator.record' },
      { href: '/admin/questions', key: 'workspace.operator.questions' },
      { href: '/admin/organisations', key: 'workspace.operator.organisations' },
      { href: '/projects', key: 'workspace.common.browse', covers: ['/projects'] },
    ],
  },
  auditor: {
    role: 'auditor',
    home: '/auditor',
    titleKey: 'workspace.auditor.title',
    sections: [
      { href: '/auditor', key: 'workspace.auditor.overview' },
      { href: '/auditor/record', key: 'workspace.auditor.record' },
      { href: '/auditor/projects', key: 'workspace.auditor.projects', match: '/auditor/projects' },
      { href: '/auditor/deals', key: 'workspace.auditor.deals' },
      { href: '/auditor/organisations', key: 'workspace.auditor.organisations' },
      { href: '/auditor/access-log', key: 'workspace.auditor.accessLog' },
      { href: '/projects', key: 'workspace.common.browse', covers: ['/projects'] },
    ],
  },
};

/** The role whose area we are in, from the first path segment. */
export function areaForPath(pathname: string): RoleArea | null {
  const p = pathname.replace(/^\/(en|de)(?=\/|$)/, '') || '/';
  for (const area of Object.values(AREAS)) {
    const root = area.home;
    if (p === root || p.startsWith(root + '/')) return area;
  }
  return null;
}

/** Is this section the one being viewed? Prefix match, so deep pages count. */
export function isCurrent(item: NavItem, pathname: string): boolean {
  const p = pathname.replace(/^\/(en|de)(?=\/|$)/, '') || '/';
  if (item.covers?.some((c) => p === c || p.startsWith(c + '/'))) return true;
  const target = item.match ?? item.href;
  return item.match ? p === target || p.startsWith(target + '/') : p === target;
}
