'use client';

import { usePathname, Link } from '@/lib/i18n/routing';
import styles from './Auditor.module.css';

/**
 * The sections of the auditor's area.
 *
 * A client component only because it reads the current path to mark where the
 * reader is. It renders links and nothing else - there is no control in this
 * navigation that submits anything, which is true of the whole area.
 *
 * The labels arrive already translated from the server component that renders
 * this, so no message lookup happens on the client and no key can leak into
 * the markup untranslated.
 */
export interface AuditorSection {
  href: '/auditor' | '/auditor/record' | '/auditor/projects' | '/auditor/deals'
      | '/auditor/organisations' | '/auditor/access-log';
  label: string;
}

export default function AuditorNav({
  sections,
  ariaLabel,
}: {
  sections: readonly AuditorSection[];
  ariaLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      {sections.map((s) => {
        // /auditor matches only itself; every other section also owns its
        // children, so /auditor/projects/<slug> keeps Projects marked.
        const current =
          s.href === '/auditor'
            ? pathname === '/auditor'
            : pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={current ? `${styles.navLink} ${styles.navCurrent}` : styles.navLink}
            aria-current={current ? 'page' : undefined}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
