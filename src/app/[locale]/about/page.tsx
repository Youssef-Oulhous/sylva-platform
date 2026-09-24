import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OperatorSection from '@/components/about/OperatorSection';
import PilotSection from '@/components/about/PilotSection';
import RolesSection from '@/components/about/RolesSection';
import LimitsSection from '@/components/about/LimitsSection';
import VettingSection from '@/components/about/VettingSection';
import DataProtectionSection from '@/components/about/DataProtectionSection';
import ContactSection from '@/components/about/ContactSection';
import styles from './page.module.css';

/**
 * About Sylva.
 *
 * The page a reader opens when they have decided the projects look serious and
 * now want to know who is behind the platform and what happens to what they
 * type into it. It is written to answer, in order: who operates this, what the
 * pilot is trying to find out, who else is here and what they can see, what this
 * platform does NOT do, what we check before anyone can transact, what happens
 * to personal data, and how to reach us.
 *
 * Built to the same discipline as the project page rather than as a marketing
 * "about us": every statement names the document it came from and that document's
 * date, and where the platform has not yet decided something - the hosting
 * region, the real contact addresses - the page says so instead of inventing an
 * answer. The one thing a reader of an EU-funded pilot's About page should not
 * find is a confident claim nobody can check.
 *
 * The EU co-funding statement is deliberately absent: the site footer carries it
 * on every page, and section 02 points at it rather than keeping a second copy of
 * compliance wording in step with the first.
 *
 * FRONTEND ONLY. No database, no fetch, no auth, no server actions. The contact
 * fields render and do nothing, and the page says so where a reader will see it
 * before typing.
 */

const SECTIONS = [
  { id: 'operator', labelKey: 'about.operator.title' },
  { id: 'pilot', labelKey: 'about.pilot.title' },
  { id: 'roles', labelKey: 'about.roles.title' },
  { id: 'limits', labelKey: 'about.limits.title' },
  { id: 'vetting', labelKey: 'about.vetting.title' },
  { id: 'data', labelKey: 'about.data.title' },
  { id: 'contact', labelKey: 'about.contact.title' },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1>{t('about.title')}</h1>
        <p className={styles.lead}>{t('about.lead')}</p>
      </header>

      <div className={styles.body}>
        {/* An index rather than a table of contents widget: seven anchors, no
            script, no scroll observer, and it is a nav landmark so a screen
            reader can skip straight to the section it wants. */}
        <nav className={styles.index} aria-label={t('about.contents')}>
          <p className={styles.indexTitle}>{t('about.contents')}</p>
          <ol className={styles.indexList}>
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={styles.indexLink}>
                  <span className={styles.indexNum} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{t(s.labelKey)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.sections}>
          <section id="operator" className={styles.section}>
            <SectionMarker n={1} label={t('about.operator.title')} />
            <OperatorSection />
          </section>

          <section id="pilot" className={styles.section}>
            <SectionMarker n={2} label={t('about.pilot.title')} />
            <PilotSection />
          </section>

          <section id="roles" className={styles.section}>
            <SectionMarker n={3} label={t('about.roles.title')} />
            <RolesSection />
          </section>

          <section id="limits" className={styles.section}>
            <SectionMarker n={4} label={t('about.limits.title')} />
            <LimitsSection />
          </section>

          <section id="vetting" className={styles.section}>
            <SectionMarker n={5} label={t('about.vetting.title')} />
            <VettingSection />
          </section>

          <section id="data" className={styles.section}>
            <SectionMarker n={6} label={t('about.data.title')} />
            <DataProtectionSection />
          </section>

          <section id="contact" className={styles.section}>
            <SectionMarker n={7} label={t('about.contact.title')} />
            <ContactSection />
          </section>
        </div>
      </div>
    </article>
  );
}

/**
 * The numbered kicker above each section heading. Hidden from assistive
 * technology, which already has the heading and the landmark. Same component as
 * the project detail page uses, and for the same reason.
 */
function SectionMarker({ n, label }: { n: number; label: string }) {
  return (
    <p className={styles.marker} aria-hidden="true">
      <span className={styles.markerNum}>{String(n).padStart(2, '0')}</span>
      <span className={styles.markerLabel}>{label}</span>
    </p>
  );
}
