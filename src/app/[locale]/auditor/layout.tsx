import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import AuditorNav, { type AuditorSection } from '@/components/auditor/AuditorNav';
import { requireRole } from '@/lib/auth/guards';
import { AUDIT, label, NAV } from '@/lib/auditor/labels';
import styles from '@/components/auditor/Auditor.module.css';

/**
 * The auditor's area.
 *
 * requireRole('auditor') decides what this area SHOWS. It is not the security
 * boundary and must not be mistaken for one: the boundary is that a session
 * holding the auditor platform role is served by sylva_login_auditor, whose
 * only membership is sylva_auditor, which holds SELECT and nothing else. If
 * this guard were removed tomorrow, a buyer reaching /auditor would be served
 * as sylva_buyer and would see their own rows and no others - the pages would
 * be wrong, not leaky. See docs/FINDING-001 for why that separation exists.
 *
 * The read-only statement is repeated in the header of every page in this area
 * rather than only on the overview, because a reader who arrives at a deep
 * link should not have to go looking for it.
 */
export default async function AuditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole('auditor', '/auditor');

  const t = await getTranslations();

  const sections: AuditorSection[] = [
    { href: '/auditor', label: label(t, NAV.overview) },
    { href: '/auditor/record', label: label(t, NAV.record) },
    { href: '/auditor/projects', label: label(t, NAV.projects) },
    { href: '/auditor/deals', label: label(t, NAV.deals) },
    { href: '/auditor/organisations', label: label(t, NAV.organisations) },
    { href: '/auditor/access-log', label: label(t, NAV.accessLog) },
  ];

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{label(t, AUDIT.title)}</h1>
          <Badge tone="neutral">{label(t, AUDIT.readOnlyTitle)}</Badge>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{label(t, AUDIT.lead)}</p>
      </header>

      <AuditorNav sections={sections} ariaLabel={label(t, NAV.label)} />

      {children}
    </>
  );
}
