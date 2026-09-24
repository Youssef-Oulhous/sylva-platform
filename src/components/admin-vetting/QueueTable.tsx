import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { adminText, stateLabel } from '@/lib/admin/messages';
import {
  QUEUE_STATES,
  ROLE_KEY,
  STATE_TONE,
  countByState,
  type AdminVettingRow,
} from '@/lib/admin/types';
import styles from './QueueTable.module.css';

/**
 * The queue.
 *
 * A table, because the operator's first question is "what is waiting", and the
 * answer is a list of rows to be scanned by date. Columns are in reading order:
 * who applied, what they asked to be, when it arrived, when it last moved, and
 * the state that follows from its entries.
 *
 * The state cell is not a control. It prints a word and a tint, and the word is
 * `org.org_role_approval.status` - a cache only the trigger on
 * `org.vetting_decision` writes. There is nothing on this screen that sets it,
 * and no query in src/lib/admin that could.
 *
 * Each row links to itself. The panel below the table shows whichever
 * application the query string names, so a reviewer can open one, decide it,
 * and land back on the same row - and the link is a plain href, which means the
 * screen works with no client JavaScript at all.
 *
 * The count above the table counts APPLICATIONS and says so. It is not a unit
 * volume, and this screen renders no unit volumes at all (rule 7).
 */
export default async function QueueTable({
  rows,
  openId,
}: {
  rows: readonly AdminVettingRow[];
  openId: string | null;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const counts = countByState(rows);

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  /* The newest entry on record across the whole queue: what this extract is
     true as of. Empty queue falls back to today, which is when it was read. */
  const asOf =
    rows.map((r) => r.lastEntryOn).sort().at(-1) ?? new Date().toISOString().slice(0, 10);

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
          source={{ label: t('adminVetting.logSource'), locator: null, asOfDate: asOf }}
        />
        <p className={styles.countNote}>{t('adminVetting.queue.countNote')}</p>
      </div>

      {rows.length === 0 ? (
        <p className={styles.inertNote}>{adminText(t, 'queueEmpty')}</p>
      ) : (
        <>
          {/* A breakdown, not a total of anything measurable: each figure counts
              applications in one state, and the word is beside the number. */}
          <ul className={styles.summary}>
            {QUEUE_STATES.map((state) => (
              <li key={state} className={styles.summaryItem}>
                <span className={styles.summaryFigure}>{counts[state]}</span>
                <span className={styles.summaryLabel}>{stateLabel(t, state)}</span>
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
                  const open = row.submissionId === openId;
                  return (
                    <tr
                      key={row.submissionId}
                      className={open ? styles.openRow : undefined}
                      aria-current={open ? 'true' : undefined}
                    >
                      <th scope="row" className={styles.orgCell}>
                        <span className={styles.orgName}>{row.organisationName}</span>
                        <span className={styles.orgMeta}>
                          {row.sectorLabel} · {row.countryName}
                        </span>
                        <span className={styles.ref}>{row.submissionId}</span>
                      </th>
                      <td>
                        {ROLE_KEY[row.roleCode]
                          ? t(`adminVetting.role.${ROLE_KEY[row.roleCode]}`)
                          : row.roleCode}
                      </td>
                      <td>{day(row.submittedOn)}</td>
                      <td>{day(row.lastEntryOn)}</td>
                      <td>
                        <Badge tone={STATE_TONE[row.state]}>
                          {stateLabel(t, row.state)}
                        </Badge>
                      </td>
                      <td className={styles.reviewCell}>
                        {open ? (
                          <span className={styles.openMark}>
                            {t('adminVetting.queue.openInPanel')}
                          </span>
                        ) : (
                          <Link
                            href={{
                              pathname: '/admin/vetting',
                              query: { application: row.submissionId },
                            }}
                            className={styles.openButton}
                          >
                            {t('adminVetting.queue.open')}
                            <span className="visually-hidden">
                              {' '}
                              {row.organisationName}
                            </span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
