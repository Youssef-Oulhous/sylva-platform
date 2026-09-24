import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import styles from './BuyerActions.module.css';

/**
 * What a buyer can do here, in the order it happens.
 *
 * An ordered list, because the order is the information: a deal cannot exist
 * before vetting, and the private room only opens once interest is expressed.
 * The numbers are the list's own markers, so the sequence survives even if the
 * stylesheet never arrives.
 */

interface BuyerStep {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Internal route this step can be started from, where one exists today. */
  href: string | null;
  ctaKey: string | null;
}

const STEPS: readonly BuyerStep[] = [
  {
    id: 'review',
    titleKey: 'forBuyers.actions.review.title',
    bodyKey: 'forBuyers.actions.review.body',
    href: '/projects',
    ctaKey: 'home.ctaExplore',
  },
  {
    id: 'sites',
    titleKey: 'forBuyers.actions.sites.title',
    bodyKey: 'forBuyers.actions.sites.body',
    href: null,
    ctaKey: null,
  },
  {
    id: 'interest',
    titleKey: 'forBuyers.actions.interest.title',
    bodyKey: 'forBuyers.actions.interest.body',
    href: null,
    ctaKey: null,
  },
  {
    id: 'vetting',
    titleKey: 'forBuyers.actions.vetting.title',
    bodyKey: 'forBuyers.actions.vetting.body',
    href: null,
    ctaKey: null,
  },
  {
    id: 'negotiate',
    titleKey: 'forBuyers.actions.negotiate.title',
    bodyKey: 'forBuyers.actions.negotiate.body',
    href: null,
    ctaKey: null,
  },
];

export default async function BuyerActions() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('forBuyers.actions.title')}</h2>
      <p className={styles.lead}>{t('forBuyers.actions.lead')}</p>

      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.id} className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className={styles.stepBody}>
              <h3 className={styles.stepTitle}>{t(step.titleKey)}</h3>
              <p className={styles.stepText}>{t(step.bodyKey)}</p>
              {step.href && step.ctaKey && (
                <Link href={step.href} className={styles.stepCta}>
                  {t(step.ctaKey)}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className={styles.outside}>{t('forBuyers.actions.outside')}</p>
    </>
  );
}
