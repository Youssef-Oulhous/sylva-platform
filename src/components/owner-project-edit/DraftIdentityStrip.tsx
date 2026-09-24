import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { OWNER_ORGS, RECORD } from './project-draft-data';
import styles from './DraftIdentityStrip.module.css';

/**
 * What this record is, before the form itself: its reference, its status, the
 * organisation it belongs to and when it was last saved.
 *
 * The status word comes from the existing `status.*` namespace, which is the
 * same vocabulary the project page and the operator's queue use, so an owner
 * sees the state of their record in the words everyone else uses for it.
 */
export default async function DraftIdentityStrip() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();
  const format = await getFormatter();

  const owner = OWNER_ORGS.find((org) => org.id === RECORD.ownerOrgId);

  return (
    <section className={styles.strip} aria-labelledby="record-heading">
      <h2 id="record-heading" className="visually-hidden">
        {t('record.heading')}
      </h2>

      <dl className={styles.list}>
        <div className={styles.cell}>
          <dt className={styles.key}>{t('record.ref')}</dt>
          <dd className={styles.valueMono}>{RECORD.ref}</dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.key}>{tRoot('project.status')}</dt>
          <dd className={styles.value}>
            <Badge tone="neutral">{tRoot(RECORD.statusKey)}</Badge>
          </dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.key}>{tRoot('project.owner')}</dt>
          <dd className={styles.value}>{owner ? owner.name : RECORD.ownerOrgId}</dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.key}>{t('record.lastSaved')}</dt>
          <dd className={styles.valueMono}>
            <time dateTime={RECORD.savedOn}>
              {format.dateTime(new Date(RECORD.savedOn), 'short')}
            </time>
          </dd>
        </div>
      </dl>

      <p className={styles.note}>{t('record.draftNote')}</p>
    </section>
  );
}
