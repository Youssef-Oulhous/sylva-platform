import { getTranslations } from 'next-intl/server';
import styles from './SitePrivacyNotice.module.css';

/**
 * What happens to a site once it is registered - stated before the register and
 * before the form, not in a footnote underneath them.
 *
 * The client's brief is one sentence on this point ("This information must
 * remain private") and the master prompt adds one more ("Never show another
 * organization's private sites"). Both are about disclosure, so each line below
 * names a party and says whether that party can see the site. Nothing here
 * describes retention, deletion or lawful basis: the brief does not say, so this
 * component does not either.
 *
 * Prominence comes from position, size and a rule - not from a colour. In this
 * system water blue means water and forest green means biodiversity or a primary
 * action; privacy is neither, so the panel is neutral.
 */
export default async function SitePrivacyNotice({
  headingId,
}: {
  headingId: string;
}) {
  const t = await getTranslations();

  return (
    <section className={styles.notice} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        {t('mySites.privacy.title')}
      </h2>
      <p className={styles.lead}>{t('mySites.privacy.lead')}</p>

      <ul className={styles.list}>
        <li>
          <span className={styles.who}>{t('mySites.privacy.publicWho')}</span>
          {t('mySites.privacy.publicWhat')}
        </li>
        <li>
          <span className={styles.who}>{t('mySites.privacy.ownersWho')}</span>
          {t('mySites.privacy.ownersWhat')}
        </li>
        <li>
          <span className={styles.who}>{t('mySites.privacy.othersWho')}</span>
          {t('mySites.privacy.othersWhat')}
        </li>
        <li>
          <span className={styles.who}>{t('mySites.privacy.youWho')}</span>
          {t('mySites.privacy.youWhat')}
        </li>
      </ul>
    </section>
  );
}
