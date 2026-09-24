import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { label, labelWith, TABLE } from '@/lib/record/labels';
import type { RecordEntry } from '@/lib/record/types';
import styles from './RecordTable.module.css';

/**
 * The record as a dense table, newest first.
 *
 * Every row carries its OWN source and as-of date, in the last column, read
 * from the sylva.source_ref row that record.entry.source_ref_id points at.
 * source_ref_id is NOT NULL, so there is no entry without one. A single stamp
 * at the top of the page saying where the extract came from is not the same
 * claim, and on a page of evidence the difference is the whole point.
 *
 * Four things this table deliberately does NOT have:
 *
 *  - a volume column and a price column. The record carries neither, so rule 7
 *    has no surface to defend here: there is no column to total, per project or
 *    across projects.
 *  - a footer row. Nothing is summed, not even the number of entries per
 *    project, because a count column beside a project column invites reading
 *    the projects as comparable.
 *  - a filter that hides a superseded entry. A corrected entry stays in place,
 *    in date order, marked in words, and names the entry that superseded it.
 *  - any decision of its own about who may be named. counterpartyKind comes
 *    from record.v_public_entry, which resolved disclosure as at this entry's
 *    own timestamp. This component renders that answer and never computes one.
 *
 * Status is never colour alone: a superseded row carries the word "Superseded"
 * and the reference of the entry that superseded it, and a correction row
 * carries the word "Correction" and the reference it corrects.
 */
export default async function RecordTable({
  entries,
  locale,
}: {
  entries: readonly RecordEntry[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  // Country names come from the platform's own locale data rather than a key
  // per country, so a new country in the data never arrives untranslated.
  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryName = (code: string | null) => {
    if (!code) return '—';
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const partyKindLabel = (kind: RecordEntry['counterpartyKind']) => {
    switch (kind) {
      case 'label':
        return t('record.party.label');
      case 'owner':
        return t('record.party.owner');
      case 'named':
        return t('record.party.named');
      case 'withheld':
        return label(t, TABLE.withheld);
    }
  };

  // The event name in the reader's language, falling back to the English label
  // the database holds rather than printing a key.
  const eventLabel = (e: RecordEntry) => {
    const key = `record.event.${e.entryType}`;
    try {
      if (typeof t.has === 'function' && t.has(key)) return t(key);
    } catch {
      /* fall through */
    }
    return e.entryLabelEn;
  };

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
            <th scope="col">{label(t, TABLE.sourceCol)}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const rowClass = e.isSuperseded
              ? styles.supersededRow
              : e.correctsPublicId
                ? styles.correctionRow
                : undefined;

            return (
              // The full public_id is the row's id, so a correction's reference
              // is a working link on the page and a shared URL can point at one
              // entry. The visible reference is shortened to keep the row
              // readable; nothing is lost, because the whole value is here.
              <tr key={e.publicId} id={e.publicId} className={rowClass}>
                <td className={styles.dateCell}>
                  <time dateTime={e.occurredAt}>
                    {format.dateTime(new Date(e.occurredAt), 'short')}
                  </time>
                </td>

                <th scope="row" className={styles.refCell}>
                  <span
                    title={labelWith(t, TABLE.refTitleFor, { ref: e.publicId })}
                  >
                    {e.shortRef}
                  </span>
                </th>

                <td className={styles.projectCell}>
                  <Link href={`/projects/${e.projectSlug}`}>{e.projectTitle}</Link>
                </td>

                <td className={styles.eventCell}>{eventLabel(e)}</td>

                <td className={styles.partyCell}>
                  {e.counterpartyLabel === null ? (
                    <>
                      <span className={styles.partyLabel}>
                        {label(t, TABLE.withheld)}
                      </span>
                      <span className={styles.partyKind}>
                        {label(t, TABLE.withheldNote)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className={
                          e.counterpartyKind === 'label'
                            ? styles.partyLabel
                            : styles.partyName
                        }
                      >
                        {e.counterpartyLabel}
                      </span>
                      <span className={styles.partyKind}>
                        {partyKindLabel(e.counterpartyKind)}
                      </span>
                    </>
                  )}
                </td>

                {/* Sector and size band are shown as the organisation's own
                    record holds them, under the classification named at the
                    foot of the page. */}
                <td>{e.sectorLabel ?? e.sectorCode ?? '—'}</td>

                <td className={styles.countryCell}>{countryName(e.countryCode)}</td>

                <td>{e.sizeBandLabel ?? e.sizeBandCode ?? '—'}</td>

                <td className={styles.statusCell}>
                  {e.isSuperseded && (
                    <>
                      <Badge tone="warning">{t('record.entryStatus.superseded')}</Badge>
                      <span className={styles.statusNote}>
                        {e.supersededByPublicId ? (
                          <a href={`#${e.supersededByPublicId}`}>
                            {t('record.entryStatus.supersededBy', {
                              ref: e.supersededByShortRef ?? '',
                            })}
                          </a>
                        ) : (
                          t('record.entryStatus.superseded')
                        )}
                      </span>
                    </>
                  )}

                  {e.correctsPublicId && (
                    <>
                      <Badge tone="neutral">{t('record.entryStatus.correction')}</Badge>
                      <span className={styles.statusNote}>
                        <a href={`#${e.correctsPublicId}`}>
                          {t('record.entryStatus.corrects', {
                            ref: e.correctsShortRef ?? '',
                          })}
                        </a>
                      </span>
                      {e.correctionReason && (
                        <span className={styles.statusReason}>
                          <span className={styles.reasonLabel}>
                            {label(t, TABLE.reasonLabel)}
                          </span>{' '}
                          {e.correctionReason}
                        </span>
                      )}
                    </>
                  )}

                  {!e.isSuperseded && !e.correctsPublicId && (
                    <span className={styles.statusCurrent}>
                      {t('record.entryStatus.current')}
                    </span>
                  )}
                </td>

                {/* Provenance for THIS entry: where the line came from and the
                    date it is as of. Not the date the page was rendered. */}
                <td className={styles.sourceCell}>
                  {e.source ? (
                    <SourceStamp
                      inline
                      source={{
                        label: e.source.label,
                        locator: e.source.locator,
                        asOfDate: e.source.asOfDate,
                      }}
                    />
                  ) : (
                    <span className={styles.sourceMissing}>
                      {label(t, TABLE.sourceUnavailable)}
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
