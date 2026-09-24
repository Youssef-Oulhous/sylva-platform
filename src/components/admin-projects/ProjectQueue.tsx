import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  RECORD_SOURCE,
  STATUS_ORDER,
  STATUS_TONE,
  countByStatus,
  gapsOf,
  recordedCount,
  type ReviewRow,
} from './demo-projects';
import styles from './ProjectQueue.module.css';

/**
 * The queue.
 *
 * A table, because the operator's first question is "what is waiting", and the
 * answer is a list of rows scanned by status and by date. Columns are in
 * reading order: which project, where, under whose scheme and in which unit,
 * what status it holds, how much of the publication gate it has met, and when
 * it last changed.
 *
 * WHY THERE IS NO VOLUME COLUMN. This is the only table in the platform that
 * puts projects from different schemes side by side, so it is the place a
 * cross-project volume column would most easily appear. It would be
 * meaningless: a hectare-year and an index point measure different things, and
 * a shared column invites a comparison that does not exist (rule 7). The gate
 * column counts CHECKLIST ITEMS and the counts above the table count PROJECTS;
 * both say so in words beside the figure. The unit type travels with every row
 * so that no two rows can be read as measuring the same thing.
 *
 * The status cell prints the value recorded on the project. It is a reading,
 * not a control: nothing on this screen writes a status.
 */
export default async function ProjectQueue({ rows }: { rows: readonly ReviewRow[] }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const counts = countByStatus(rows);

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.date}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  return (
    <section className={styles.wrap} aria-labelledby="queue-title">
      <div className={styles.head}>
        <h2 id="queue-title">{t('adminProjects.queue.title')}</h2>
        <p className={styles.lead}>{t('adminProjects.queue.lead')}</p>
      </div>

      <div className={styles.countRow}>
        <p className={styles.count}>
          {t('adminProjects.queue.count', { count: rows.length })}
        </p>
        <SourceStamp
          source={{
            label: t(RECORD_SOURCE.labelKey),
            locator: RECORD_SOURCE.locator,
            asOfDate: RECORD_SOURCE.asOfDate,
          }}
        />
        <p className={styles.countNote}>{t('adminProjects.queue.countNote')}</p>
      </div>

      {/* A breakdown by status. Not tiles: a labelled row of figures, so that
          nothing here reads as a dashboard KPI. */}
      <ul className={styles.summary}>
        {STATUS_ORDER.map((status) => (
          <li key={status} className={styles.summaryItem}>
            <span className={styles.summaryFigure}>{counts[status]}</span>
            <span className={styles.summaryLabel}>{t(`status.${status}`)}</span>
          </li>
        ))}
      </ul>

      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('adminProjects.queue.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('adminProjects.col.project')}</th>
              <th scope="col">{t('adminProjects.col.country')}</th>
              <th scope="col">{t('adminProjects.col.scheme')}</th>
              <th scope="col">{t('adminProjects.col.status')}</th>
              <th scope="col">{t('adminProjects.col.gate')}</th>
              <th scope="col">{t('adminProjects.col.lastChange')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('adminProjects.col.review')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const gaps = gapsOf(row);
              const recorded = recordedCount(row);
              return (
                <tr
                  key={row.reference}
                  className={row.openInPanel ? styles.openRow : undefined}
                  aria-current={row.openInPanel ? 'true' : undefined}
                >
                  <th scope="row" className={styles.projectCell}>
                    <Link href={`/projects/${row.slug}`} className={styles.projectLink}>
                      {row.title}
                    </Link>
                    <span className={styles.projectMeta}>{row.ownerOrgName}</span>
                    <span className={styles.ref}>{row.reference}</span>
                  </th>
                  <td>{t(`adminProjects.country.${row.countryCode}`)}</td>
                  <td>
                    <span className={styles.scheme}>
                      {row.schemeName ?? t('adminProjects.notRecorded')}
                    </span>
                    {/* The unit label is printed on every row precisely so that
                        two rows cannot be read as comparable. */}
                    <span className={styles.unit}>
                      {row.unitKey
                        ? t(`adminProjects.unit.${row.unitKey}`)
                        : t('adminProjects.unit.notRecorded')}
                    </span>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>
                  </td>
                  <td className={styles.gateCell}>
                    <span className={styles.gateFigure}>
                      {t('adminProjects.gate.summary', { recorded, total: row.gate.length })}
                    </span>
                    {gaps.length > 0 ? (
                      <Badge tone="warning">
                        {t('adminProjects.gate.missingSummary', { count: gaps.length })}
                      </Badge>
                    ) : (
                      <Badge tone="bio">{t('adminProjects.gate.complete')}</Badge>
                    )}
                  </td>
                  <td>{day(row.lastChangeOn)}</td>
                  <td className={styles.reviewCell}>
                    {row.openInPanel ? (
                      <span className={styles.openMark}>
                        {t('adminProjects.queue.openInPanel')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.openButton}
                        aria-disabled="true"
                        aria-describedby="queue-inert-note"
                      >
                        {t('adminProjects.queue.open')}
                        <span className="visually-hidden"> {row.title}</span>
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
        {t('adminProjects.queue.inertNote')}
      </p>
    </section>
  );
}
