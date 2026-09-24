import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SignInForm from '@/components/sign-in/SignInForm';
import styles from './page.module.css';

/**
 * Sign in.
 *
 * A calm, narrow page: one column, one card, one primary action. Everyone who
 * uses the platform signs in here - project owners, buyers, investors, auditors
 * and administrators (concept note §4) - and what a person sees afterwards
 * depends on their role, so this page makes no promises about what is behind it.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. The form
 * renders and does not submit. There is no third-party or social sign-in.
 *
 * Rule 7 (no unit volumes added across projects): this page shows no figures at
 * all, and for that reason carries no source stamps either - a source stamp
 * belongs to a figure, and inventing one here would be decoration.
 */

/* ---------------------------------------------------------------------------
   DEMO DATA. Fictional, and the only data on this page. It exists so that the
   error state below renders with something in the field: an address a person
   might plausibly mistype, belonging to an obviously fictional organisation.
   --------------------------------------------------------------------------- */
interface DemoRejectedEntry {
  readonly email: string;
}

const DEMO_REJECTED_ENTRY: DemoRejectedEntry = {
  // Missing its top-level domain - which is what the example error reports.
  email: 'procurement@demo-nordwasser',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('nav.signIn'),
    description: t('signIn.metaDescription'),
    // A sign-in page has nothing to index.
    robots: { index: false, follow: true },
  };
}

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('nav.signIn')}</h1>
        <p className={styles.lead}>{t('signIn.lead')}</p>
      </header>

      <div className={styles.card}>
        <SignInForm idPrefix="signin" formLabel={t('signIn.formLabel')} />
      </div>

      <section className={styles.alt} aria-labelledby="no-account">
        <h2 id="no-account" className={styles.altTitle}>
          {t('signIn.noAccount')}
        </h2>
        <p className={styles.altBody}>{t('signIn.registerBody')}</p>
        <Link href="/register" className={styles.altCta}>
          {t('signIn.registerCta')}
        </Link>
      </section>

      {/* The error state has to exist in the design, but a sign-in page that
          greets everyone with a red banner is a worse page. Native
          <details> - no client component, no JavaScript - keeps the specimen
          one click away and the default page calm. */}
      <details className={styles.states}>
        <summary className={styles.statesSummary}>
          {t('signIn.errorState.summary')}
        </summary>
        <div className={styles.statesBody}>
          <p className={styles.statesNote}>{t('signIn.errorState.note')}</p>
          <div className={styles.cardSpecimen}>
            <SignInForm
              idPrefix="signin-error-specimen"
              formLabel={t('signIn.errorState.formLabel')}
              errorState={{ rejectedEmail: DEMO_REJECTED_ENTRY.email }}
            />
          </div>
        </div>
      </details>

      <footer className={styles.foot}>
        <p className={styles.footNote}>{t('signIn.hosting')}</p>
        <p className={styles.footNote}>{t('signIn.frontendNote')}</p>
      </footer>
    </div>
  );
}
