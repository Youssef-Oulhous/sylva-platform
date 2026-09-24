import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  CORRECTION_EXAMPLE,
  LOG_SOURCE,
  STATE_TONE,
  deriveState,
  type QueueRow,
} from './demo-queue';
import styles from './EntryLog.module.css';

/**
 * The application's entries, oldest first, exactly as recorded.
 *
 * Oldest first rather than newest first, because this is the derivation the
 * state above was read from and a derivation reads forwards. The state is
 * printed again underneath the table, so the reader sees the input and the
 * output in one view.
 *
 * The record is append-only (concept note section 8, rule 4). Nothing on this
 * screen edits or deletes an entry; a corrected entry keeps its row, keeps its
 * reason, and gains the word "Corrected" - so the log below the table always
 * has at least as many rows as it had yesterday. The worked example in the
 * disclosure shows what that looks like on an application where an approval was
 * later corrected, which is the only case where a reader might otherwise expect
 * a row to have disappeared.
 */
export default async function EntryLog({
  row,
  headingId,
}: {
  row: QueueRow;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const state = deriveState(row.log);

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminVetting.log.title')}</h3>
        <p className={styles.lead}>{t('adminVetting.log.lead')}</p>
      </div>

      <div className="table-scroll">
        <table>
          <caption>
            {t('adminVetting.log.caption', { reference: row.reference })}
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
            {row.log.map((entry) => (
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
                  {t(`adminVetting.entry.${entry.kind}`)}
                  {entry.pointsAt && (
                    <span className={styles.pointsAt}>
                      {t('adminVetting.log.pointsAt', { reference: entry.pointsAt })}
                    </span>
                  )}
                  {entry.corrected && (
                    <span className={styles.corrected}>
                      {t('adminVetting.log.corrected')}
                    </span>
                  )}
                </td>
                <td>{t(entry.byKey)}</td>
                <td className={styles.reasonCell}>
                  {entry.reasonKey ? (
                    t(entry.reasonKey)
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
        <Badge tone={STATE_TONE[state]}>{t(`adminVetting.state.${state}`)}</Badge>
        <span className={styles.readsAsNote}>{t('adminVetting.log.readsAsNote')}</span>
      </p>

      {/* Every date in the table above is read from the same record, so one
          stamp covers the table rather than one per row. */}
      <SourceStamp
        source={{
          label: t(LOG_SOURCE.labelKey),
          locator: LOG_SOURCE.locator,
          asOfDate: row.lastEntryOn,
        }}
      />

      {/* Native disclosure. No client component is needed for this. */}
      <details className={styles.details}>
        <summary className={styles.summary}>{t('adminVetting.log.example.title')}</summary>
        <div className={styles.detailsBody}>
          <p>{t('adminVetting.log.example.body')}</p>
          <ol className={styles.steps}>
            <li>
              {t('adminVetting.log.example.step1', { wrong: CORRECTION_EXAMPLE.wrongRef })}
            </li>
            <li>
              {t('adminVetting.log.example.step2', {
                correction: CORRECTION_EXAMPLE.correctionRef,
                wrong: CORRECTION_EXAMPLE.wrongRef,
              })}
            </li>
            <li>
              {t('adminVetting.log.example.step3', {
                application: CORRECTION_EXAMPLE.application,
              })}
            </li>
          </ol>
          <p className={styles.detailsClose}>{t('adminVetting.log.example.close')}</p>
        </div>
      </details>
    </section>
  );
}
