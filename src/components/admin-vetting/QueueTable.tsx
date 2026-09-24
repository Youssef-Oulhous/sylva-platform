import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  QUEUE_SOURCE,
  STATE_TONE,
  countByState,
  deriveState,
  type DerivedState,
  type QueueRow,
} from './demo-queue';
import styles from './QueueTable.module.css';

/**
 * The queue.
 *
 * A table, because the operator's first question is "what is waiting", and the
 * answer is a list of rows to be scanned by date. Columns are in reading order:
 * who applied, what they asked to be, when it arrived, when it last moved, and
 * the state that follows from its entries.
 *
 * The state cell is not a control. It prints a word and a tint, and it is read
 * from the application's entry log by deriveState() - there is nothing on this
 * screen that writes it. The one application open in the review panel below is
 * marked with aria-current, so a keyboard reader can tell which row the panel
 * is showing without inferring it from a tint.
 *
 * The count above the table counts APPLICATIONS and says so. It is not a unit
 * volume, and this screen renders no unit volumes at all (rule 7).
 */
export default async function QueueTable({ rows }: { rows: readonly QueueRow[] }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const counts = countByState(rows);

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  const stateBadge = (state: DerivedState) => (
    <Badge tone={STATE_TONE[state]}>{t(`adminVetting.state.${state}`)}</Badge>
  );

  /* The order the operator reads them in: what needs a decision first. */
  const summaryStates: readonly DerivedState[] = [
    'submitted',
    'under_review',
    'approved',
    'declined',
    'suspended',
  ];

  return (
    <section className={styles.wrap} aria-labelledby="queue-title">
      <div className={styles.head}>
        <h2 id="queue-title">{t('adminVetting.queue.title')}</h2>
        <p className={styles.lead}>{t('adminVetting.queue.lead')}</p>
      </div>

      <div className={styles.countRow}>
        <p className={styles.count}>
          {t('adminVetting.queue.count', { count: rows.length })}
        </p>
        <SourceStamp
          source={{
            label: t(QUEUE_SOURCE.labelKey),
            locator: QUEUE_SOURCE.locator,
            asOfDate: QUEUE_SOURCE.asOfDate,
          }}
        />
        <p className={styles.countNote}>{t('adminVetting.queue.countNote')}</p>
      </div>

      {/* A breakdown, not a total of anything measurable: each figure counts
          applications in one state, and the word is beside the number. */}
      <ul className={styles.summary}>
        {summaryStates.map((state) => (
          <li key={state} className={styles.summaryItem}>
            <span className={styles.summaryFigure}>{counts[state]}</span>
            <span className={styles.summaryLabel}>{t(`adminVetting.state.${state}`)}</span>
          </li>
        ))}
      </ul>

      <div className="table-scroll">
        <table>
          <caption>{t('adminVetting.queue.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('adminVetting.col.organisation')}</th>
              <th scope="col">{t('adminVetting.col.role')}</th>
              <th scope="col">{t('adminVetting.col.submitted')}</th>
              <th scope="col">{t('adminVetting.col.lastEntry')}</th>
              <th scope="col">{t('adminVetting.col.state')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('adminVetting.col.review')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = deriveState(row.log);
              return (
                <tr
                  key={row.reference}
                  className={row.openInPanel ? styles.openRow : undefined}
                  aria-current={row.openInPanel ? 'true' : undefined}
                >
                  <th scope="row" className={styles.orgCell}>
                    <span className={styles.orgName}>{row.organisationName}</span>
                    <span className={styles.orgMeta}>
                      {t(row.sectorKey)} · {t(row.countryKey)}
                    </span>
                    <span className={styles.ref}>{row.reference}</span>
                  </th>
                  <td>{t(`adminVetting.role.${row.role}`)}</td>
                  <td>{day(row.submittedOn)}</td>
                  <td>{day(row.lastEntryOn)}</td>
                  <td>{stateBadge(state)}</td>
                  <td className={styles.reviewCell}>
                    {row.openInPanel ? (
                      <span className={styles.openMark}>
                        {t('adminVetting.queue.openInPanel')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.openButton}
                        aria-disabled="true"
                        aria-describedby="queue-inert-note"
                      >
                        {t('adminVetting.queue.open')}
                        <span className="visually-hidden"> {row.organisationName}</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p id="queue-inert-note" className={styles.inertNote}>
        {t('adminVetting.queue.inertNote')}
      </p>
    </section>
  );
}
