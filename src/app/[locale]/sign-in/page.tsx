import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/lib/i18n/routing';
import SignInForm from '@/components/sign-in/SignInForm';
import { getViewer } from '@/lib/auth/session';
import { homePathFor } from '@/lib/auth/roles';
import { isAuthErrorCode } from '@/lib/auth/errors';
import styles from './page.module.css';

/**
 * Sign in.
 *
 * A calm, narrow page: one column, one card, one primary action. Everyone who
 * uses the platform signs in here - project owners, buyers, investors, auditors
 * and administrators (concept note §4) - and what a person sees afterwards
 * depends on their role, so this page makes no promises about what is behind it.
 *
 * Wired to the database. The form posts to a Server Action
 * (src/lib/auth/actions.ts), which verifies the password against
 * identity.authenticate and opens a session. There is no third-party or social
 * sign-in.
 *
 * `?error=` carries a CODE, never a message and never the email address. The
 * code is rendered into a sentence here; see src/lib/auth/errors.ts for why the
 * sentence is the same one for a wrong password and for an unknown address.
 *
 * `?next=` is where to go afterwards. It is re-validated server-side in the
 * action - a path on this site and nothing else - so it cannot be used to
 * bounce someone off the platform after they have signed in.
 *
 * Rule 7 (no unit volumes added across projects): this page shows no figures at
 * all, and for that reason carries no source stamps either - a source stamp
 * belongs to a figure, and inventing one here would be decoration.
 */

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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const query = await searchParams;

  // Already signed in: send them where signing in would have sent them, rather
  // than showing a form that would create a second session for the same person.
  const viewer = await getViewer();
  if (viewer) {
    redirect({ href: homePathFor(viewer.roles), locale });
  }

  const rawError = typeof query.error === 'string' ? query.error : undefined;
  const errorCode = rawError && isAuthErrorCode(rawError) ? rawError : null;
  const nextPath = typeof query.next === 'string' && query.next.startsWith('/')
    ? query.next
    : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('nav.signIn')}</h1>
        <p className={styles.lead}>{t('signIn.lead')}</p>
      </header>

      <div className={styles.card}>
        <SignInForm
          idPrefix="signin"
          formLabel={t('signIn.formLabel')}
          errorCode={errorCode}
          nextPath={nextPath}
        />
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

      <footer className={styles.foot}>
        <p className={styles.footNote}>{t('signIn.hosting')}</p>
      </footer>
    </div>
  );
}
