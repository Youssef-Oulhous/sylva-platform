import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { isLocale } from '@/lib/i18n/config';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import styles from '@/components/SiteChrome.module.css';
import '@/styles/globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title: { default: `${t('name')} — ${t('tagline')}`, template: `%s — ${t('name')}` },
    description: t('tagline'),
    // Project pages must be shareable and indexable (concept note §6).
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <a href="#main" className="skip-link">{t('site.skipToContent')}</a>

          {/* Demo data is stated at the top of every page. The brief requires
              realistic demo data that can never be mistaken for real
              environmental claims; a footnote is not enough for that. */}
          <div className={styles.demoBar}>
            <div className={styles.demoBarInner}>
              <strong>{t('demo.badge')}</strong>
              <p className={styles.demoBarText}>{t('home.demoBanner')}</p>
            </div>
          </div>

          <SiteHeader />
          <main id="main" className={styles.main}>{children}</main>
          <SiteFooter locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
