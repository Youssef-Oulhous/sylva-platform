import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import AddSiteForm from '@/components/my-sites/AddSiteForm';
import SiteDistanceTable from '@/components/my-sites/SiteDistanceTable';
import SitePrivacyNotice from '@/components/my-sites/SitePrivacyNotice';
import SiteRegisterTable from '@/components/my-sites/SiteRegisterTable';
import {
  DEMO_BUYER_ORG,
  DEMO_DISTANCES,
  DEMO_DISTANCES_AS_OF,
  DEMO_DISTANCE_SITE_ID,
  DEMO_NO_SITES,
  DEMO_REGISTER_AS_OF,
  DEMO_SITES,
} from '@/components/my-sites/demo-sites';
import styles from './page.module.css';

/**
 * Buyer site registration - "My sites".
 *
 * A buyer registers the places it cares about, and the platform answers one
 * question with them: how far is this site from that project. The water-dependent
 * companies interviewed for the concept note (§3) wanted a project in the same
 * catchment as their own sites, which makes this page the door to the thing they
 * came for.
 *
 * It is also the page where a company types the location of its own plants into
 * somebody else's website, so the terms on which that is held are stated above
 * the register and above the form, not underneath them.
 *
 * FRONTEND PASS. No database, no fetch, no server actions, no auth. The register
 * and the distances come from a demo module whose shapes mirror what the data
 * layer will return. The form renders and does not submit.
 *
 * Rule 7 (no unit volumes added across projects): this page prints kilometres,
 * coordinates, dates and a count of rows. It has no unit volume on it at all, so
 * there is nothing here that could be added across projects - and the distance
 * table says why it shows distances and not volumes.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('mySites.title'),
    description: t('mySites.metaDescription'),
    // A buyer's own site register is not a page for a search engine to hold.
    robots: { index: false, follow: false },
  };
}

export default async function BuyerSitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  /* The one site whose distances are shown as an example. */
  const exampleSite = DEMO_SITES.find((site) => site.id === DEMO_DISTANCE_SITE_ID);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('mySites.title')}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{t('mySites.lead')}</p>
        <p className={styles.org}>
          <span className={styles.orgLabel}>{t('mySites.orgLabel')}</span>
          <span className={styles.orgName}>{DEMO_BUYER_ORG}</span>
        </p>
      </header>

      {/* Stated before anything is entered or displayed. */}
      <SitePrivacyNotice headingId="sites-privacy" />

      <section className={styles.section} aria-labelledby="sites-register">
        <h2 id="sites-register">{t('mySites.register.title')}</h2>
        <p className={styles.sectionLead}>{t('mySites.register.lead')}</p>
        <SiteRegisterTable sites={DEMO_SITES} asOfDate={DEMO_REGISTER_AS_OF} />
      </section>

      <section className={styles.section} aria-labelledby="sites-add">
        <h2 id="sites-add">{t('mySites.form.title')}</h2>
        <p className={styles.sectionLead}>{t('mySites.form.lead')}</p>
        <div className={styles.formCard}>
          <AddSiteForm idPrefix="add-site" formLabel={t('mySites.form.title')} />
        </div>
        <p className={styles.frontendNote}>{t('mySites.form.frontendNote')}</p>
      </section>

      <section className={styles.section} aria-labelledby="sites-distances">
        <h2 id="sites-distances">{t('mySites.distances.title')}</h2>
        <p className={styles.sectionLead}>{t('mySites.distances.lead')}</p>
        {exampleSite ? (
          <SiteDistanceTable
            site={exampleSite}
            distances={DEMO_DISTANCES}
            asOfDate={DEMO_DISTANCES_AS_OF}
          />
        ) : null}
      </section>

      {/* The empty state has to exist in the design, and on this page it is what
          every organisation sees first. It is shown here as a specimen, closed by
          default - native <details>, no client component - because the register
          above it has rows and both cannot be the live state at once. */}
      <details className={styles.states}>
        <summary className={styles.statesSummary}>
          {t('mySites.register.emptySummary')}
        </summary>
        <div className={styles.statesBody}>
          <p className={styles.statesNote}>{t('mySites.register.emptyNote')}</p>
          <SiteRegisterTable sites={DEMO_NO_SITES} asOfDate={DEMO_REGISTER_AS_OF} />
        </div>
      </details>
    </div>
  );
}
