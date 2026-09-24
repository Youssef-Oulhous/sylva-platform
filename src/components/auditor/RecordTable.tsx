import { useFormatter, useTranslations } from 'next-intl';
import { label, RECORD } from '@/lib/auditor/labels';
import type { AuditRecordEntry } from '@/lib/auditor/types';
import ActorCell from './ActorCell';
import styles from './Auditor.module.css';

/**
 * The full record, as stored.
 *
 * Two things this table does that the public one cannot:
 *
 *   - it marks every row as public or not public. The public record is a view
 *     over a subset of this table; showing a superset without saying which
 *     rows differ would be a quiet misrepresentation of both.
 *   - it names both deal parties. Everywhere else a counterparty appears as a
 *     per-deal label; here the legal name is shown, because the pseudonym
 *     protects a commercial position from other buyers rather than from
 *     assurance.
 *
 * Nothing is filtered and nothing is sorted away. A superseded entry is still
 * here, marked, next to the entry that corrected it - that is R4, and a table
 * that dropped it would be describing a different record.
 */
export default function RecordTable({ entries }: { entries: AuditRecordEntry[] }) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <div className="table-scroll">
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{label(t, RECORD.colRef)}</th>
            <th scope="col">{label(t, RECORD.colWhen)}</th>
            <th scope="col">{label(t, RECORD.colType)}</th>
            <th scope="col">{label(t, RECORD.colProject)}</th>
            <th scope="col">{label(t, RECORD.colActor)}</th>
            <th scope="col">{label(t, RECORD.colCounterparty)}</th>
            <th scope="col">{label(t, RECORD.colPublic)}</th>
            <th scope="col">{label(t, RECORD.colProvenance)}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.publicId} id={`entry-${e.publicId}`}>
              <td className={styles.mono}>
                {/* The short form is what can be read across a row; the full
                    reference is always in the DOM beside it, so nothing is
                    lost to a copy-paste into a report. */}
                <span title={e.publicId}>{e.shortRef}</span>
                <span className={styles.sub}>#{e.entryNo}</span>
              </td>

              <td className={styles.nowrap}>
                <time dateTime={e.occurredAt}>
                  {format.dateTime(new Date(e.occurredAt), 'short')}
                </time>
                <span className={styles.sub}>
                  {format.dateTime(new Date(e.recordedAt), 'short')}
                </span>
              </td>

              <td>
                {e.entryLabelEn}
                {!e.typeIsPublic && (
                  <span className={styles.sub}>{e.entryType}</span>
                )}
                {e.correctsShortRef && (
                  <span className={styles.sub}>
                    {label(t, RECORD.corrects)} {e.correctsShortRef}
                    {e.correctionReason ? ` — ${e.correctionReason}` : ''}
                  </span>
                )}
                {e.supersededByShortRef && (
                  <span className={styles.sub}>
                    {label(t, RECORD.supersededBy)} {e.supersededByShortRef}
                  </span>
                )}
                {e.subject && <span className={styles.sub}>{e.subject}</span>}
                <pre className={styles.detailJson}>{e.detail}</pre>
              </td>

              <td>
                {e.projectTitle}
                <span className={styles.sub}>{e.projectStatus}</span>
              </td>

              <td><ActorCell actor={e.actor} /></td>

              <td>
                {e.dealId ? (
                  <>
                    <span>{e.dealBuyerOrgName}</span>
                    <span className={styles.sub}>{e.dealOwnerOrgName}</span>
                  </>
                ) : (
                  <span className={styles.muted}>—</span>
                )}
              </td>

              <td>
                <span
                  className={
                    e.onPublicRecord
                      ? `${styles.tag} ${styles.tagPublic}`
                      : `${styles.tag} ${styles.tagPrivate}`
                  }
                  title={
                    e.onPublicRecord ? undefined : label(t, RECORD.notOnPublicNote)
                  }
                >
                  {label(t, e.onPublicRecord ? RECORD.onPublic : RECORD.notOnPublic)}
                </span>
              </td>

              <td className={styles.small}>
                {e.source ? (
                  <>
                    {e.source.label}
                    {e.source.locator ? `, ${e.source.locator}` : ''}
                    <span className={styles.sub}>
                      {e.source.kind} · {e.source.asOfDate}
                    </span>
                  </>
                ) : (
                  /* record.entry.source_ref_id is nullable: an event that
                     records itself - interest expressed, a stage change - IS
                     its own evidence. Saying so is better than a blank cell. */
                  <span className={styles.muted}>{label(t, RECORD.noSource)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

</div>
  );
}
