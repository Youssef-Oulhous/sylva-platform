import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import { CLAIM_RIGHTS_SOURCE, VETTING_SOURCE, VETTING_STEPS } from './about-data';
import shared from './AboutSection.module.css';
import styles from './VettingSection.module.css';

/**
 * Vetting: the operator's main safeguard against greenwashing, and the second
 * safeguard that sits beside it.
 *
 * Two things had to be avoided here. The first is overclaiming - vetting is a
 * judgement on what an organisation tells us, and saying so is more useful to a
 * reader than a promise would be, so "What vetting is not" gets equal weight to
 * the steps. The second is turning the step list into a marketing sequence: it
 * is a numbered ordered list with no artwork, and the numbers come from CSS
 * counters on the list itself, so it degrades to 1-2-3 without the stylesheet.
 */
export default async function VettingSection() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('about.vetting.title')}</h2>
      <p className={shared.lead}>{t('about.vetting.lead')}</p>

      <h3 className={shared.subhead}>{t('about.vetting.stepsTitle')}</h3>
      <ol className={styles.steps}>
        {VETTING_STEPS.map((step) => (
          <li key={step.id} className={styles.step}>
            <p className={styles.stepTitle}>{t(step.titleKey)}</p>
            <p className={styles.stepBody}>{t(step.bodyKey)}</p>
          </li>
        ))}
      </ol>
      <SourceStamp
        source={{
          label: t(VETTING_SOURCE.labelKey),
          locator: VETTING_SOURCE.locator,
          asOfDate: VETTING_SOURCE.asOfDate,
        }}
      />

      <h3 className={shared.subhead}>{t('about.vetting.limitTitle')}</h3>
      <p className={shared.body}>{t('about.vetting.limitBody')}</p>

      <h3 className={shared.subhead}>{t('about.vetting.claimsTitle')}</h3>
      <p className={shared.body}>{t('about.vetting.claimsBody')}</p>
      <SourceStamp
        source={{
          label: t(CLAIM_RIGHTS_SOURCE.labelKey),
          locator: CLAIM_RIGHTS_SOURCE.locator,
          asOfDate: CLAIM_RIGHTS_SOURCE.asOfDate,
        }}
      />
      <div>
        <Link href="/projects" className={shared.cta}>
          {t('about.vetting.claimsCta')} &rarr;
        </Link>
      </div>
    </>
  );
}
