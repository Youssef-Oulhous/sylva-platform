import { getTranslations } from 'next-intl/server';
import styles from './RecordScope.module.css';

/**
 * What this record is, and what it is not.
 *
 * The concept note is explicit that the platform is not the registry, and the
 * master prompt lists "can the UI prevent users from thinking that the platform
 * itself is the official credit registry?" as a test the page has to pass. A
 * footnote does not pass it, so the distinction is stated at the top of the
 * page, before the first entry, in two panels of equal weight.
 */
export default async function RecordScope() {
  const t = await getTranslations();

  return (
    <section className={styles.section} aria-labelledby="record-scope">
      <h2 id="record-scope">{t('record.scope.title')}</h2>

      <div className={styles.panels}>
        <div className={styles.isPanel}>
          <h3 className={styles.panelTitle}>{t('record.scope.isTitle')}</h3>
          <p className={styles.panelBody}>{t('record.scope.isBody')}</p>
          <p className={styles.panelBody}>{t('record.scope.isSecond')}</p>
        </div>

        <div className={styles.isNotPanel}>
          <h3 className={styles.panelTitle}>{t('record.scope.isNotTitle')}</h3>
          <p className={styles.panelBody}>{t('record.scope.isNotBody')}</p>
          <p className={styles.panelBody}>{t('record.scope.isNotSecond')}</p>
        </div>
      </div>

      <h3 className={styles.howTitle}>{t('record.how.title')}</h3>
      <dl className={styles.how}>
        <div>
          <dt>{t('record.how.appendOnlyTitle')}</dt>
          <dd>{t('record.how.appendOnlyBody')}</dd>
        </div>
        <div>
          <dt>{t('record.how.labelTitle')}</dt>
          <dd>{t('record.how.labelBody')}</dd>
        </div>
        <div>
          <dt>{t('record.how.disclosureTitle')}</dt>
          <dd>{t('record.how.disclosureBody')}</dd>
        </div>
        <div>
          <dt>{t('record.how.ownerTitle')}</dt>
          <dd>{t('record.how.ownerBody')}</dd>
        </div>
        <div>
          <dt>{t('record.how.registryTitle')}</dt>
          <dd>{t('record.how.registryBody')}</dd>
        </div>
      </dl>
    </section>
  );
}
