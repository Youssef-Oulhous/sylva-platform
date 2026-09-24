import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import NextSteps from '@/components/register/NextSteps';
import RegisterForm from '@/components/register/RegisterForm';
import PublicIdentityNote from '@/components/register/PublicIdentityNote';
import DataScope from '@/components/register/DataScope';
import styles from './page.module.css';

/**
 * Register.
 *
 * Two things are being created, and the page keeps them apart because the data
 * model keeps them apart: an organisation, which is what transacts here, and one
 * person, who is only a way to sign in on its behalf. Personal data sits in the
 * user account and nowhere else; everything else references the organisation by
 * ID (concept note §9). That is stated on the page, not just implemented.
 *
 * The reading order answers the question a registrant actually has - "what does
 * this get me, and when?" - before it asks for anything: what happens after
 * registering, then the form, then where the data sits. Registering is not being
 * approved, and rule 6 of the concept note (§8) is blunt about it: no deal can
 * be created for an organisation Sylva has not approved. The three steps say so
 * twice, once as what you can do and once as what is still closed.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. The form
 * renders and does nothing. No client component: the role choice is native
 * radios and every field is uncontrolled, so nothing here needs "use client".
 *
 * Rule 7: this page shows no unit volumes of any kind. Volumes belong to one
 * project and one period and are stated on that project's page, where the unit
 * label travels with the number, so nothing here can be read as a total across
 * projects.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('nav.register'),
    description: t('register.metaDescription'),
  };
}

export default async function RegisterPage({
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
        <h1>{t('nav.register')}</h1>
        <p className={styles.lead}>{t('register.lead')}</p>
        <p className={styles.buildNote}>{t('register.buildNote')}</p>
      </header>

      <section className={styles.section} aria-labelledby="next-steps-title">
        <h2 id="next-steps-title" className={styles.sectionTitle}>
          {t('register.next.title')}
        </h2>
        <NextSteps />
      </section>

      <div className={styles.columns}>
        <section className={styles.formCol} aria-labelledby="form-title">
          <h2 id="form-title" className={styles.sectionTitle}>
            {t('register.form.title')}
          </h2>
          <RegisterForm idPrefix="reg" />
        </section>

        <div className={styles.aside}>
          <PublicIdentityNote />
          <p className={styles.haveAccount}>
            {t('register.haveAccount')} <Link href="/sign-in">{t('nav.signIn')}</Link>
          </p>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="data-title">
        <h2 id="data-title" className={styles.sectionTitle}>
          {t('register.data.title')}
        </h2>
        <DataScope />
      </section>
    </div>
  );
}
