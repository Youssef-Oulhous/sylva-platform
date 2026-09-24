import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { adminText, entryLabel, stateLabel } from '@/lib/admin/messages';
import { STATE_TONE, type AdminVettingApplication } from '@/lib/admin/types';
import styles from './EntryLog.module.css';

/**
 * The entries recorded for this organisation and this role, oldest first,
 * exactly as recorded.
 *
 * Oldest first rather than newest first, because this is the chain the state
 * above was read from and a chain reads forwards. The state is printed again
 * underneath the table, so the reader sees the input and the output in one
 * view.
 *
 * WHY THE LOG IS PER ORGANISATION AND ROLE, NOT PER APPLICATION. A decision
 * cites the submission it was made on, but `org.org_role_approval` - the table
 * R6 reads - is keyed by (org_id, role_code). A log showing only the decisions
 * citing this submission could therefore show one row and a state that did not
 * follow from it. So the whole chain is here, including decisions made on an
 * application this one replaced.
 *
 * The record is append-only (concept note section 8, rule 4). Nothing on this
 * screen edits or deletes an entry: a decision recorded in error is corrected
 * by recording a later one, the earlier entry keeps its row and its reason and
 * is marked superseded, and the state is read again from the whole chain.
 */
export default async function EntryLog({
  application,
  headingId,
}: {
  application: AdminVettingApplication;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminVetting.log.title')}</h3>
        <p className={styles.lead}>{t('adminVetting.log.lead')}</p>
      </div>

      <div className="table-scroll">
        <table>
          <caption>
            {t('adminVetting.log.caption', { reference: application.submissionId })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('adminVetting.col.entry')}</th>
              <th scope="col">{t('adminVetting.col.date')}</th>
              <th scope="col">{t('adminVetting.col.recorded')}</th>
              <th scope="col">{t('adminVetting.col.recordedBy')}</th>
              <th scope="col">{t('adminVetting.col.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {application.entries.map((entry) => (
              <tr key={entry.reference}>
                <th scope="row" className={styles.refCell}>
                  {entry.reference}
                </th>
                <td>
                  <time dateTime={entry.on} className={styles.date}>
                    {format.dateTime(new Date(entry.on), 'short')}
                  </time>
                </td>
                <td className={styles.kindCell}>
                  {entryLabel(t, entry.kind)}
                  {entry.superseded && (
                    <span className={styles.corrected}>
                      {adminText(t, 'superseded')}
                    </span>
                  )}
                </td>
                <td>{t(entry.byKey)}</td>
                <td className={styles.reasonCell}>
                  {entry.reason ? (
                    entry.reason
                  ) : (
                    <span className={styles.noReason}>{t('adminVetting.log.noReason')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Input above, output here. */}
      <p className={styles.readsAs}>
        <span className={styles.readsAsLabel}>{t('adminVetting.log.readsAs')}</span>
        <Badge tone={STATE_TONE[application.state]}>
          {stateLabel(t, application.state)}
        </Badge>
        <span className={styles.readsAsNote}>{t('adminVetting.log.readsAsNote')}</span>
      </p>

      {/* Every date in the table above is read from the same record, so one
          stamp covers the table rather than one per row. */}
      <SourceStamp
        source={{
          label: t('adminVetting.logSource'),
          locator: null,
          asOfDate: application.lastEntryOn,
        }}
      />

      <p className={styles.detailsClose}>{adminText(t, 'correctionNote')}</p>
    </section>
  );
}
