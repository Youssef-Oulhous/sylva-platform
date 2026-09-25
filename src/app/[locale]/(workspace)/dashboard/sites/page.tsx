import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AddSiteForm from '@/components/my-sites/AddSiteForm';
import SiteDistanceTable from '@/components/my-sites/SiteDistanceTable';
import SitePrivacyNotice from '@/components/my-sites/SitePrivacyNotice';
import SiteRegisterTable from '@/components/my-sites/SiteRegisterTable';
import { requireRole } from '@/lib/auth/guards';
import { isAuthErrorCode, resolveAuthMessage } from '@/lib/auth/errors';
import { addSiteAction } from '@/lib/sites/actions';
import { listSitesWithDistances } from '@/lib/sites/queries';
import { countryOptions } from '@/lib/sites/reference';
import { buyerOrganisation } from '@/lib/dashboard/queries';
import styles from './page.module.css';

/**
 * Buyer site registration - "My sites".
 *
 * A buyer registers the places it cares about, and the platform answers one
 * question with them: how far is this site from that project. The
 * water-dependent companies interviewed for the concept note (§3) wanted a
 * project in the same catchment as their own sites, which makes this page the
 * door to the thing they came for.
 *
 * It is also the page where a company types the location of its own plants into
 * somebody else's website, so the terms on which that is held are stated above
 * the register and above the form, not underneath them.
 *
 * PRIVACY. Every row on this page is private to one organisation, so:
 *
 *   - it is read with the viewer's own actor, inside one transaction, as
 *     sylva_buyer with the signed organisation context. geo.buyer_site's policy
 *     is what returns this organisation's rows and no others.
 *   - it is never cached. The page calls cookies() through getViewer(), which
 *     makes it dynamic, and `robots: noindex` keeps it out of a search index
 *     even if a URL escapes.
 *   - nothing here is passed to a client component, so no coordinate is
 *     serialised into an RSC payload for a page that did not need it.
 *
 * Rule 7: this page prints kilometres, coordinates, dates and a count of rows.
 * There is no unit volume on it at all, and the distance table says why.
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  /** `error` and `done` are set by the Server Actions. Never a value, never
   *  an email address, and never a coordinate: a URL ends up in every access
   *  log between here and the browser. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // Signed in, and holding the buyer role. Not the security boundary - the
  // database role is - but it decides what this page shows, and a visitor who
  // is not signed in belongs on the sign-in form rather than on an empty page.
  const viewer = await requireRole('buyer', '/dashboard/sites');

  const query = await searchParams;
  const rawError = Array.isArray(query.error) ? query.error[0] : query.error;
  const rawDone = Array.isArray(query.done) ? query.done[0] : query.done;
  const errorCode = isAuthErrorCode(rawError) ? rawError : null;
  const done =
    rawDone === 'added' || rawDone === 'updated' || rawDone === 'removed'
      ? rawDone
      : null;

  // buyerOrganisation() rather than buyerDashboard(): this page needs the
  // organisation's own name for the line under the heading, and nothing else
  // from the record. The whole-dashboard read it used to do here was six
  // statements - the interests, the documents, the vetting chain and the site
  // register a second time - for one string.
  const [entries, org, countries] = await Promise.all([
    listSitesWithDistances(viewer.actor, locale),
    buyerOrganisation(viewer.actor, locale),
    countryOptions(locale),
  ]);

  const sites = entries.map((e) => e.site);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('mySites.title')}</h1>
        </div>
        <p className={styles.lead}>{t('mySites.lead')}</p>
        <p className={styles.org}>
          <span className={styles.orgLabel}>{t('mySites.orgLabel')}</span>
          <span className={styles.orgName}>
            {org.organisation?.legalName ?? ''}
          </span>
        </p>
      </header>

      {/* The outcome of the last write, if there was one. A sentence, not a
          toast: nothing on this page needs JavaScript to appear. */}
      {errorCode ? (
        <p className={styles.notice} role="alert">
          {resolveAuthMessage(t, errorCode)}
        </p>
      ) : null}
      {done ? (
        <p className={styles.noticeOk} role="status">
          {t(`mySites.status.${done}`)}
        </p>
      ) : null}

      {/* Stated before anything is entered or displayed. */}
      <SitePrivacyNotice headingId="sites-privacy" />

      <section className={styles.section} aria-labelledby="sites-register">
        <h2 id="sites-register">{t('mySites.register.title')}</h2>
        <p className={styles.sectionLead}>{t('mySites.register.lead')}</p>
        <SiteRegisterTable sites={sites} countries={countries} />
      </section>

      <section className={styles.section} aria-labelledby="sites-add">
        <h2 id="sites-add">{t('mySites.form.title')}</h2>
        <p className={styles.sectionLead}>{t('mySites.form.lead')}</p>
        <div className={styles.formCard}>
          <AddSiteForm
            idPrefix="add-site"
            formLabel={t('mySites.form.title')}
            action={addSiteAction}
            countries={countries}
            submitLabel={t('mySites.form.submit')}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sites-distances">
        <h2 id="sites-distances">{t('mySites.distances.title')}</h2>
        <p className={styles.sectionLead}>{t('mySites.distances.lead')}</p>

        {entries.length === 0 ? (
          <p className={styles.sectionLead}>{t('mySites.distances.noSites')}</p>
        ) : (
          // One table per site. Every registered site gets its own, because a
          // buyer with four sites is asking about four places, not about one
          // example.
          entries.map((entry) => (
            <SiteDistanceTable key={entry.site.id} entry={entry} countries={countries} />
          ))
        )}
      </section>
    </div>
  );
}
