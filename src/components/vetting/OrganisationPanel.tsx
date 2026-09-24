import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { DEMO_ORGANISATION } from './vetting-data';
import styles from './OrganisationPanel.module.css';

/**
 * Who is answering, and where that organisation stands.
 *
 * A questionnaire with no visible subject is easy to fill in for the wrong
 * entity, so the organisation on the form is stated before the first question.
 * The status is a word as well as a tint, and it says what is and is not
 * available today rather than implying a queue position we cannot know.
 *
 * FRONTEND PASS. The organisation is a DEMO constant. Nothing here is read from
 * a session or a database, and the panel has no controls.
 */
export default async function OrganisationPanel() {
  const t = await getTranslations('vettingForm');

  return (
    <section className={styles.panel} aria-labelledby="vetting-org-title">
      <div className={styles.head}>
        <h2 id="vetting-org-title" className={styles.title}>
          {t('org.title')}
        </h2>
        {/* Amber, and the word. Neither is doing the job on its own. */}
        <Badge tone="warning">{t('org.status')}</Badge>
      </div>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.nameLabel')}</dt>
          <dd className={styles.value}>{DEMO_ORGANISATION.name}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.sectorLabel')}</dt>
          <dd className={styles.value}>{t(DEMO_ORGANISATION.sectorKey)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.countryLabel')}</dt>
          <dd className={styles.value}>{t(DEMO_ORGANISATION.countryKey)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.referenceLabel')}</dt>
          {/* An identifier, so it is set in mono - the one other use of the
              mono face besides figures and source stamps. */}
          <dd className={`${styles.value} ${styles.reference}`}>
            {DEMO_ORGANISATION.reference}
          </dd>
        </div>
      </dl>

      <p className={styles.note}>{t('org.statusNote')}</p>

      <SourceStamp
        source={{
          label: t(DEMO_ORGANISATION.source.labelKey),
          locator: DEMO_ORGANISATION.source.locator,
          asOfDate: DEMO_ORGANISATION.source.asOfDate,
        }}
      />
    </section>
  );
}
