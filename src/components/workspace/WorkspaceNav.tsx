'use client';

import { usePathname } from '@/lib/i18n/routing';
import { Link } from '@/lib/i18n/routing';
import { isCurrent, type NavItem } from '@/lib/workspace/nav';
import styles from './Workspace.module.css';

/**
 * The section navigation for one role's area.
 *
 * A client component only because it needs the current path to mark where the
 * reader is. aria-current is what actually communicates that to a screen
 * reader; the underline is for everyone else.
 */
export default function WorkspaceNav({
  sections,
  ariaLabel,
  labels,
}: {
  sections: readonly NavItem[];
  ariaLabel: string;
  /** Resolved server-side: a client component cannot read the catalogue. */
  labels: Record<string, string>;
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      <ul className={styles.navList}>
        {sections.map((s) => {
          const here = isCurrent(s, pathname);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                className={here ? `${styles.navLink} ${styles.navLinkHere}` : styles.navLink}
                aria-current={here ? 'page' : undefined}
              >
                {labels[s.key] ?? s.key}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
