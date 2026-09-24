import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import {
  DEMO_RECORD_PROJECTS,
  type DemoCounterparty,
  type DemoRecordEntry,
} from './demo-record';
import styles from './RecordTable.module.css';

/**
 * The record as a dense table, newest first.
 *
 * Three things this table deliberately does NOT have:
 *
 *  - a volume column and a price column. The record carries neither, so rule 7
 *    has no surface to defend here: there is no column to total, per project or
 *    across projects.
 *  - a footer row. Nothing is summed, not even the number of entries per
 *    project, because a count column beside a project column invites reading
 *    the projects as comparable.
 *  - a filter that hides a superseded entry. A corrected entry stays in place,
 *    in date order, marked in words.
 *
 * Status is never colour alone: a superseded row carries the word "Superseded"
 * and the reference of the entry that superseded it, and a correction row
 * carries the word "Correction" and the reference it corrects.
 */
export default async function RecordTable({
  entries,
  locale,
}: {
  entries: readonly DemoRecordEntry[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const projectsBySlug = new Map(DEMO_RECORD_PROJECTS.map((p) => [p.slug, p]));

  // Country names come from the platform's own locale data rather than a key
  // per country, so a new country in the data never arrives untranslated.
  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryName = (code: string) => {
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const partyKindLabel = (kind: DemoCounterparty['kind']) =>
    kind === 'label'
      ? t('record.party.label')
      : kind === 'named_owner'
        ? t('record.party.owner')
        : t('record.party.named');

  return (
    <div className="table-scroll">
      <table className={styles.table}>
        <caption className={styles.caption}>{t('record.table.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('record.col.date')}</th>
            <th scope="col">{t('record.col.entry')}</th>
            <th scope="col">{t('record.col.project')}</th>
            <th scope="col">{t('record.col.event')}</th>
            <th scope="col">{t('record.col.counterparty')}</th>
            <th scope="col">{t('record.col.sector')}</th>
            <th scope="col">{t('record.col.country')}</th>
            <th scope="col">{t('record.col.sizeBand')}</th>
            <th scope="col">{t('record.col.entryStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const project = projectsBySlug.get(e.projectSlug);
            const isSuperseded = e.supersededByRef !== null;
            const isCorrection = e.correctsRef !== null;
            const rowClass = isSuperseded
              ? styles.supersededRow
              : isCorrection
                ? styles.correctionRow
                : undefined;

            return (
              <tr key={e.ref} className={rowClass}>
                <td className={styles.dateCell}>
                  <time dateTime={e.occurredOn}>
                    {format.dateTime(new Date(e.occurredOn), 'short')}
                  </time>
                </td>

                <th scope="row" className={styles.refCell}>
                  {e.ref}
                </th>

                <td className={styles.projectCell}>
                  {project ? (
                    <Link href={`/projects/${project.slug}`}>{project.name}</Link>
                  ) : (
                    e.projectSlug
                  )}
                </td>

                <td className={styles.eventCell}>{t(`record.event.${e.eventCode}`)}</td>

                <td className={styles.partyCell}>
                  <span
                    className={
                      e.counterparty.kind === 'label' ? styles.partyLabel : styles.partyName
                    }
                  >
                    {e.counterparty.display}
                  </span>
                  <span className={styles.partyKind}>
                    {partyKindLabel(e.counterparty.kind)}
                  </span>
                </td>

                <td>{t(`record.sector.${e.counterparty.sectorCode}`)}</td>

                <td className={styles.countryCell}>
                  {countryName(e.counterparty.countryCode)}
                </td>

                <td>{t(`record.sizeBand.${e.counterparty.sizeBandCode}`)}</td>

                <td className={styles.statusCell}>
                  {isSuperseded && (
                    <>
                      <Badge tone="warning">{t('record.entryStatus.superseded')}</Badge>
                      <span className={styles.statusNote}>
                        {t('record.entryStatus.supersededBy', {
                          ref: e.supersededByRef ?? '',
                        })}
                      </span>
                    </>
                  )}

                  {isCorrection && (
                    <>
                      <Badge tone="neutral">{t('record.entryStatus.correction')}</Badge>
                      <span className={styles.statusNote}>
                        {t('record.entryStatus.corrects', { ref: e.correctsRef ?? '' })}
                      </span>
                      {e.correctionReasonKey && (
                        <span className={styles.statusReason}>
                          <span className={styles.reasonLabel}>
                            {t('record.entryStatus.reason')}:
                          </span>{' '}
                          {t(e.correctionReasonKey)}
                        </span>
                      )}
                    </>
                  )}

                  {!isSuperseded && !isCorrection && (
                    <span className={styles.statusCurrent}>
                      {t('record.entryStatus.current')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
