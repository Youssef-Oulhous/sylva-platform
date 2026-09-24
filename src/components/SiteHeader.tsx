import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { getViewer } from '@/lib/auth/session';
import { homePathFor } from '@/lib/auth/roles';
import SignOutForm from './auth/SignOutForm';
import styles from './SiteChrome.module.css';

/**
 * The site header, now aware of whether anybody is signed in.
 *
 * getViewer() is cached per request, so asking here costs nothing on a page
 * that already asked. It returns null rather than throwing when the session has
 * expired or the database is unreachable, which is why a public page stays
 * readable in both cases.
 *
 * Nothing personal appears here. Not the person's name, not their email, not
 * their organisation's legal name - the header is rendered on public pages and
 * is the easiest place in the whole application to leak an identity over
 * someone's shoulder. Where signed in, it shows a route and a way out.
 */
export default async function SiteHeader() {
  const t = await getTranslations();
  const viewer = await getViewer();

  // Two keys this header needs that the catalogue may not have yet; English
  // until it does, rather than "nav.signOut" on screen.
  const myArea = t.has('nav.myArea') ? t('nav.myArea') : 'My area';
  const signOut = t.has('nav.signOut') ? t('nav.signOut') : 'Sign out';

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>{t('site.name')}</span>
          <span className={styles.brandNote}>{t('site.tagline')}</span>
        </Link>
        <nav className={styles.nav} aria-label={t('nav.projects')}>
          <Link href="/projects">{t('nav.projects')}</Link>
          <Link href="/how-it-works">{t('nav.howItWorks')}</Link>
          <Link href="/for-buyers">{t('nav.forBuyers')}</Link>
          <Link href="/for-investors">{t('nav.forInvestors')}</Link>
          <Link href="/about">{t('nav.about')}</Link>
        </nav>
        <div className={styles.actions}>
          {viewer ? (
            <>
              <Link href={homePathFor(viewer.roles)}>{myArea}</Link>
              <SignOutForm label={signOut} />
            </>
          ) : (
            <>
              <Link href="/sign-in">{t('nav.signIn')}</Link>
              <Link href="/register">{t('nav.register')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
