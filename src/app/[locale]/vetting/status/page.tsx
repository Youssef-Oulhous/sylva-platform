import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import ApplicationPanel from '@/components/vetting-status/ApplicationPanel';
import PermissionMatrix from '@/components/vetting-status/PermissionMatrix';
import StateReference from '@/components/vetting-status/StateReference';
import {
  DEMO_DECLINED_APPLICATION,
  DEMO_PENDING_APPLICATION,
  VETTING_CONTACT,
} from '@/components/vetting-status/demo-vetting';
import styles from './page.module.css';

/**
 * Vetting status.
 *
 * An organisation waiting on a decision has three questions, and this page is
 * ordered by them: where does my application stand, what can I do in the
 * meantime, and what happens if the answer is no.
 *
 * Sylva vets every organisation that wants to transact before any deal can be
 * created (concept note sections 7 and 8, rule 6). That is the whole reason
 * this screen exists, so the page says it once at the top and then shows
 * exactly where the line falls: browsing and site registration are on one side
 * of it, expressing interest is on the other.
 *
 * The declined variant is a second full panel rather than a sentence. A reader
 * who has just been declined should be able to see the shape of that page
 * before it happens to them, and every panel on this page ends with something
 * the reader can still do.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. Nothing on
 * this page submits. The state shown is demo state.
 *
 * RULE 7. There are no unit volumes on this page at all - a vetting decision
 * concerns an organisation, not a project - so there is nothing here that could
 * be added across projects. The dates are the only figures and they carry a
 * source stamp inside each panel.
 *
 * RULE J. The page states twice, in its own section, what it does not decide:
 * how long a review takes, and whether a declined organisation may apply
 * again. Neither is set out in the material this page can cite, and inventing
 * either would be a business rule the client has not written.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('vettingStatus.title'),
    description: t('vettingStatus.metaDescription'),
    // One organisation's application state. Nothing here should be indexed.
    robots: { index: false, follow: true },
  };
}

export default async function VettingStatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const pending = DEMO_PENDING_APPLICATION;
  const declined = DEMO_DECLINED_APPLICATION;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('vettingStatus.title')}</h1>
        <p className={styles.lead}>{t('vettingStatus.lead')}</p>
        <p className={styles.gate}>{t('vettingStatus.gate')}</p>
      </header>

      <section className={styles.section} aria-labelledby="this-application">
        <h2 id="this-application">{t('vettingStatus.section.thisApplication')}</h2>
        <p className={styles.sectionLead}>
          {t('vettingStatus.section.thisApplicationLead')}
        </p>
        <ApplicationPanel application={pending} headingId="pending-application" />
      </section>

      <section className={styles.section} aria-labelledby="states">
        <h2 id="states">{t('vettingStatus.section.states')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.section.statesLead')}</p>
        <StateReference currentState={pending.state} />
      </section>

      <section className={styles.section} aria-labelledby="matrix">
        <h2 id="matrix">{t('vettingStatus.section.matrix')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.section.matrixLead')}</p>
        <PermissionMatrix currentState={pending.state} />
        <p className={styles.legend}>{t('vettingStatus.cellLegend')}</p>
      </section>

      <section className={styles.section} aria-labelledby="declined">
        <h2 id="declined">{t('vettingStatus.section.declinedExample')}</h2>
        <p className={styles.sectionLead}>
          {t('vettingStatus.section.declinedExampleLead')}
        </p>
        <ApplicationPanel application={declined} headingId="declined-application" />
      </section>

      <section className={styles.section} aria-labelledby="limits">
        <h2 id="limits">{t('vettingStatus.section.limits')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.limitsLead')}</p>
        <ul className={styles.limits}>
          <li>{t('vettingStatus.limit.timing')}</li>
          <li>{t('vettingStatus.limit.again')}</li>
        </ul>
        <p className={styles.contact}>
          <a href={`mailto:${VETTING_CONTACT}`} className={styles.contactCta}>
            {t('vettingStatus.next.contactCta')}
          </a>
          <span className={styles.contactAddress}>{VETTING_CONTACT}</span>
        </p>
      </section>

      <section className={styles.section} aria-labelledby="visibility">
        <h2 id="visibility">{t('vettingStatus.section.visibility')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.visibility.lead')}</p>
        <ul className={styles.who}>
          <li>{t('vettingStatus.visibility.sylva')}</li>
          <li>{t('vettingStatus.visibility.auditors')}</li>
        </ul>
        <p className={styles.notRecord}>{t('vettingStatus.visibility.notRecord')}</p>
      </section>

      <footer className={styles.foot}>
        <p className={styles.footNote}>{t('vettingStatus.footFrontend')}</p>
        <p className={styles.footLinks}>
          <Link href="/vetting">{t('vettingStatus.next.questionnaireCta')}</Link>
          <Link href="/how-it-works#vetting">{t('vettingStatus.next.howCta')}</Link>
          <Link href="/projects">{t('home.ctaExplore')}</Link>
        </p>
      </footer>
    </div>
  );
}
