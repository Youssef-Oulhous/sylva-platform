import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { statusKey, type OwnerProjectRecord } from '@/lib/owner/types';
import { ownerText } from '@/lib/owner/messages';
import styles from './DraftIdentityStrip.module.css';

/**
 * What this record is, before the form itself: its address, its status, the
 * organisation it belongs to and when it last changed.
 *
 * The status word comes from the shared `status.*` namespace, which is the same
 * vocabulary the project page and the operator's queue use, so an owner sees
 * the state of their record in the words everyone else uses for it.
 *
 * The slug is shown in the mono face and is not editable. It is the project's
 * public address once the project is published, and a published address that
 * changes is a link that breaks - proj.project grants the owner UPDATE on
 * `status` and on nothing else, so the database would refuse the change in any
 * case.
 */
export default async function DraftIdentityStrip({
  record,
  orgName,
}: {
  record: OwnerProjectRecord;
  orgName: string | null;
}) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const format = await getFormatter();

  return (
    <section className={styles.strip} aria-labelledby="record-heading">
      <h2 id="record-heading" className="visually-hidden">
        {tf('record.heading')}
      </h2>

      <dl className={styles.list}>
        <div className={styles.cell}>
          <dt className={styles.key}>{tf('record.ref')}</dt>
          <dd className={styles.valueMono}>{record.slug}</dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.key}>{t('project.status')}</dt>
          <dd className={styles.value}>
            <Badge tone={record.status === 'published' ? 'bio' : 'neutral'}>
              {t(statusKey(record.status))}
            </Badge>
          </dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.key}>{t('project.owner')}</dt>
          <dd className={styles.value}>{orgName ?? ownerText(t, 'notStated')}</dd>
        </div>

        <div className={styles.cell}>
          <dt className={styles.key}>{tf('record.lastSaved')}</dt>
          <dd className={styles.valueMono}>
            <time dateTime={record.lastChangeOn}>
              {format.dateTime(new Date(record.lastChangeOn), 'short')}
            </time>
          </dd>
        </div>
      </dl>

      <p className={styles.note}>{tf('record.draftNote')}</p>
    </section>
  );
}
