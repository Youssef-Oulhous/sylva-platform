import { getTranslations } from 'next-intl/server';
import FactList from './FactList';
import { DATA_FACTS } from './about-data';
import shared from './AboutSection.module.css';
import styles from './DataProtectionSection.module.css';

/**
 * Personal data, hosting and analytics.
 *
 * The posture the concept note sets out has four parts, and each is stated as a
 * checkable fact rather than as a reassurance: the region is a named member
 * state and not a continent, personal data sits in exactly one table, a person
 * can be deleted without breaking the permanent record, and a page load calls no
 * third-party service.
 *
 * The hosting region is the one fact this page cannot state. The concept note
 * names Frankfurt, Paris or Dublin as candidates and does not choose, so the row
 * carries a badge saying it is not yet fixed instead of a region we invented.
 * The same discipline the EU funding notice applies to the grant disclaimer.
 *
 * What is deleted and what survives is not summarised: both lists are printed,
 * because "we delete your data" and "the record is permanent" are only
 * compatible if a reader can see exactly where the line falls.
 */
export default async function DataProtectionSection() {
  const t = await getTranslations();

  const deleted = ['name', 'email', 'phone', 'jobTitle', 'sessions'] as const;
  const retained = ['organisation', 'roleAtTime', 'event', 'timestamp', 'registry'] as const;

  return (
    <>
      <h2>{t('about.data.title')}</h2>
      <p className={shared.lead}>{t('about.data.lead')}</p>

      <FactList facts={DATA_FACTS} />

      <h3 className={shared.subhead}>{t('about.data.erasureTitle')}</h3>
      <p className={shared.body}>{t('about.data.erasureLead')}</p>

      <div className={styles.ledger}>
        <div className={styles.column}>
          <h4 className={styles.columnHead}>{t('about.data.erasure.deletedTitle')}</h4>
          <ul className={styles.items}>
            {deleted.map((k) => (
              <li key={k}>{t(`about.data.erasure.deleted.${k}`)}</li>
            ))}
          </ul>
        </div>
        <div className={styles.column}>
          <h4 className={styles.columnHead}>{t('about.data.erasure.retainedTitle')}</h4>
          <ul className={styles.items}>
            {retained.map((k) => (
              <li key={k}>{t(`about.data.erasure.retained.${k}`)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className={shared.footNote}>{t('about.data.erasure.afterwards')}</p>

      <h3 className={shared.subhead}>{t('about.data.requestsTitle')}</h3>
      <p className={shared.body}>{t('about.data.requestsBody')}</p>
    </>
  );
}
