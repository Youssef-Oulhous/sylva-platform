import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { label, labelWith, RECORD } from '@/lib/admin/labels';
import type { OperatorRecordEntry } from '@/lib/admin/record';
import styles from './AdminArea.module.css';

/**
 * The transaction record as an operator reads it.
 *
 * The difference from the public table at /record is not a longer list: it is
 * two columns. Every counterparty is NAMED here, and every row says whether the
 * public page reaches it and why not. An operator confirming a record, or
 * answering an auditor, is asked precisely those two questions.
 *
 * `onPublicRecord` is joined from record.v_public_entry rather than recomputed,
 * so this column and the public page cannot disagree about what a visitor can
 * read. The REASON it is not public is inferred from two facts the row already
 * carries - the project is not published, or the event type is not a public one
 * - and nothing else is asserted.
 *
 * WHY THE NAMES ARE HERE AT ALL. Rule 5 makes a buyer pseudonymous on the
 * PUBLIC record; org.organisation.legal_name is granted to sylva_operator and
 * sylva_auditor and to no other role. So this is one of the two screens where a
 * name is legitimately visible, the page says so above the table, and the read
 * is written to the access log.
 *
 * RULE 7. Not one cell holds a unit volume. The record's quantities live in
 * deal and availability tables; an entry carries what happened, to whom, and
 * when. So there is nothing here that could be added across projects.
 */
export default async function RecordTable({
  entries,
}: {
  entries: readonly OperatorRecordEntry[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.mono}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );

  return (
    <div className="table-scroll">
      <table className={styles.wideRecord}>
        <caption>{label(t, RECORD.caption)}</caption>
        <thead>
          <tr>
            <th scope="col">{label(t, RECORD.colRef)}</th>
            <th scope="col">{label(t, RECORD.colOccurred)}</th>
            <th scope="col">{label(t, RECORD.colEvent)}</th>
            <th scope="col">{label(t, RECORD.colProject)}</th>
            <th scope="col">{label(t, RECORD.colCounterparty)}</th>
            <th scope="col">{label(t, RECORD.colRecordedBy)}</th>
            <th scope="col">{label(t, RECORD.colPublic)}</th>
            <th scope="col">{label(t, RECORD.colCorrection)}</th>
            <th scope="col">{label(t, RECORD.colSource)}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const notPublicBecause = e.onPublicRecord
              ? null
              : !e.typeIsPublic
                ? label(t, RECORD.notPublicBecauseType)
                : e.projectStatus !== 'published'
                  ? label(t, RECORD.notPublicBecauseProject)
                  : null;

            return (
              <tr key={e.publicId}>
                <th scope="row" className={`${styles.rowHead} ${styles.mono}`}>
                  {e.shortRef}
                  <span className={styles.sub}>
                    {labelWith(t, RECORD.refFull, { ref: e.publicId })}
                  </span>
                </th>

                <td>
                  {day(e.occurredOn)}
                  {e.recordedOn !== e.occurredOn && (
                    <span className={styles.sub}>{day(e.recordedOn)}</span>
                  )}
                </td>

                <td>
                  {e.entryLabelEn}
                  <span className={styles.sub}>
                    <span
                      className={`${styles.tag} ${e.typeIsPublic ? styles.tagPublic : styles.tagPrivate}`}
                    >
                      {e.typeIsPublic ? label(t, RECORD.publicYes) : label(t, RECORD.publicNo)}
                    </span>
                  </span>
                </td>

                <td>
                  {e.projectTitle}
                  <span className={styles.sub}>
                    {t.has(`status.${e.projectStatus}`)
                      ? t(`status.${e.projectStatus}`)
                      : e.projectStatus}
                  </span>
                </td>

                {/* The real identities. Granted to this role and to the auditor,
                    to nothing else, and never printed on a public page. */}
                <td>
                  {e.buyerOrgName !== null && (
                    <>
                      <span className={styles.strong}>{e.buyerOrgName}</span>
                      <span className={styles.sub}>
                        {label(t, RECORD.counterpartyBuyer)}
                      </span>
                    </>
                  )}
                  {e.ownerOrgName !== null && (
                    <span className={styles.sub}>
                      {label(t, RECORD.counterpartyOwner)}: {e.ownerOrgName}
                    </span>
                  )}
                  <span className={styles.sub}>
                    {e.publicCounterpartyIsNamed
                      ? label(t, RECORD.publicNames)
                      : e.publicCounterpartyLabel !== null
                        ? labelWith(t, RECORD.publicPseudonym, {
                            label: e.publicCounterpartyLabel,
                          })
                        : label(t, RECORD.publicNoLabel)}
                  </span>
                </td>

                <td>
                  {e.actorOrgName}
                  <span className={styles.sub}>{e.actorRoleSnapshot}</span>
                  <span className={styles.sub}>
                    {label(t, RECORD.recordedByPerson)}: {e.actorPersonLabel}
                  </span>
                </td>

                <td>
                  <span
                    className={`${styles.tag} ${e.onPublicRecord ? styles.tagPublic : styles.tagPrivate}`}
                  >
                    {e.onPublicRecord ? label(t, RECORD.publicYes) : label(t, RECORD.publicNo)}
                  </span>
                  {notPublicBecause !== null && (
                    <span className={styles.sub}>{notPublicBecause}</span>
                  )}
                </td>

                <td>
                  {e.correctsShortRef === null && e.supersededByShortRef === null && (
                    <span className={styles.muted}>{label(t, RECORD.correctionNone)}</span>
                  )}
                  {e.correctsShortRef !== null && (
                    <span className={styles.sub}>
                      {labelWith(t, RECORD.corrects, { ref: e.correctsShortRef })}
                    </span>
                  )}
                  {e.supersededByShortRef !== null && (
                    <span className={`${styles.tag} ${styles.tagCorrected}`}>
                      {labelWith(t, RECORD.supersededBy, { ref: e.supersededByShortRef })}
                    </span>
                  )}
                  {e.correctionReason !== null && (
                    <span className={styles.sub}>
                      {label(t, RECORD.correctionReason)} {e.correctionReason}
                    </span>
                  )}
                </td>

                {/* Rule G: a figure with no source is an assertion with the
                    evidence taken off, and the record says which it is. */}
                <td>
                  {e.source === null ? (
                    <span className={styles.small}>{label(t, RECORD.sourceMissing)}</span>
                  ) : (
                    <SourceStamp
                      source={{
                        label: e.source.label,
                        locator: e.source.locator,
                        asOfDate: e.source.asOfDate,
                      }}
                    />
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
