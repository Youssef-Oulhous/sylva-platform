import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import EuFundingNotice from './eu/EuFundingNotice';
import styles from './SiteChrome.module.css';

export default async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <nav className={styles.footerNav} aria-label={t('nav.about')}>
          <Link href="/projects">{t('nav.projects')}</Link>
          <Link href="/how-it-works">{t('nav.howItWorks')}</Link>
          <Link href="/for-buyers">{t('nav.forBuyers')}</Link>
          <Link href="/for-investors">{t('nav.forInvestors')}</Link>
          <Link href="/about">{t('nav.about')}</Link>
        </nav>
        {/* Stated on every page, because mistaking this platform for the
            scheme's registry is the single most consequential misreading. */}
        <p className={styles.notRegistry}>{t('home.trustBody')}</p>
        <EuFundingNotice locale={locale} />
      </div>
    </footer>
  );
}
