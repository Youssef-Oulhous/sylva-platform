import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import styles from './SiteChrome.module.css';

export default async function SiteHeader() {
  const t = await getTranslations();
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
          <Link href="/sign-in">{t('nav.signIn')}</Link>
        </div>
      </div>
    </header>
  );
}
