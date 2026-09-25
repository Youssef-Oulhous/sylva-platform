import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import styles from './page.module.css';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  const steps = [
    'project', 'evidence', 'interest', 'deal', 'restoration', 'verified', 'units',
  ] as const;

  const evaluables = [
    { key: 'location', tone: '' },
    { key: 'water', tone: styles.itemWater },
    { key: 'biodiversity', tone: styles.itemBio },
    { key: 'claims', tone: '' },
    { key: 'durability', tone: '' },
    { key: 'verification', tone: '' },
    { key: 'documents', tone: '' },
    { key: 'availability', tone: '' },
  ] as const;

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>{t('title')}</h1>
        <p className={styles.heroLead}>{t('lead')}</p>
        <div className={styles.ctas}>
          <Link href="/projects" className={`${styles.btn} ${styles.btnPrimary}`}>
            {t('ctaExplore')}
          </Link>
          <Link href="/how-it-works" className={`${styles.btn} ${styles.btnSecondary}`}>
            {t('ctaHowItWorks')}
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>{t('processTitle')}</h2>
          <p className={styles.sectionIntro}>{t('processIntro')}</p>
        </div>
        <ol className={styles.steps}>
          {steps.map((key, i) => (
            <li key={key} className={styles.step}>
              <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
              <p className={styles.stepName}>{t(`step.${key}`)}</p>
              <p className={styles.stepNote}>{t(`step.${key}Note`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>{t('evaluateTitle')}</h2>
        </div>
        <ul className={styles.grid}>
          {evaluables.map(({ key, tone }) => (
            <li key={key} className={`${styles.item} ${tone}`}>
              <p className={styles.itemName}>{t(`evaluate.${key}`)}</p>
              <p className={styles.itemNote}>{t(`evaluate.${key}Note`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.twoUp}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('buyersTitle')}</h2>
            <p>{t('buyersBody')}</p>
            <Link href="/projects" className={`${styles.btn} ${styles.btnSecondary}`}>
              {t('ctaExplore')}
            </Link>
          </div>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('investorsTitle')}</h2>
            <p>{t('investorsBody')}</p>
            <Link href="/for-investors" className={`${styles.btn} ${styles.btnSecondary}`}>
              {t('investorsTitle')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
