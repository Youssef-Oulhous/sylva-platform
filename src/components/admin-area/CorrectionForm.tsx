import { getTranslations } from 'next-intl/server';
import { recordCorrectionAction } from '@/lib/admin/actions';
import {
  CORRECTION_ERROR, label, labelWith, RECORD, type CorrectionErrorCode,
} from '@/lib/admin/labels';
import type { OperatorRecordEntry, RecordScope } from '@/lib/admin/record';
import styles from './AdminArea.module.css';

/**
 * Writing a correcting entry - the one write on this page.
 *
 * R4: the record is append-only. Three ALWAYS triggers on record.entry refuse
 * UPDATE, DELETE and TRUNCATE for every role including the owner, so a mistake
 * cannot be edited away. What an operator CAN do is add an entry that points
 * backwards at the wrong one, with a reason, and that is what this form does.
 * The warning above the button is not a caution about a risky action: it is a
 * description of the only action available.
 *
 * WHAT THE FORM SENDS. Two values - which entry, and why - plus the filter it
 * was sent from so the redirect lands back on the same view. Which project,
 * which deal, which counterparties, the operator's organisation and the
 * non-personal label the entry is signed with are all copied from the row being
 * corrected or read from the session inside one statement, so a crafted post
 * cannot attach a correction to an unrelated project.
 *
 * WHAT IS NOT OFFERED. There is no control here that records an issuance, a
 * retirement or a transfer. Concept note §8 lists nine entry types and §10
 * defers issuance and retirement out of the pilot; the platform has exactly one
 * write path into the record today (express interest) and this second one. An
 * operator screen that offered the other seven would be inventing the flows
 * behind them.
 *
 * The entry list offers the entries in the view above, and says so. Loading
 * every correctable entry in the record into a select would be a different
 * screen - and the filter is right there.
 */
export default async function CorrectionForm({
  entries,
  projectSlug,
  entryType,
  scope,
  page,
  error,
  corrected,
}: {
  entries: readonly OperatorRecordEntry[];
  projectSlug: string | null;
  entryType: string | null;
  scope: RecordScope;
  page: number;
  error: CorrectionErrorCode | null;
  corrected: string | null;
}) {
  const t = await getTranslations();
  const eligible = entries.filter((e) => e.correctable);

  return (
    <section className={styles.section} aria-labelledby="record-correct">
      <h2 id="record-correct">{label(t, RECORD.correctTitle)}</h2>
      <p className={styles.sectionLead}>{label(t, RECORD.correctLead)}</p>

      {corrected !== null && (
        <p className={styles.done} role="status">{label(t, RECORD.correctDone)}</p>
      )}

      {error !== null && (
        <p className={styles.failure} role="alert">
          {label(t, CORRECTION_ERROR[error])}
        </p>
      )}

      {/* Said before the form, not after it: the reader is about to write
          something that cannot be withdrawn. */}
      <p className={styles.warning}>{label(t, RECORD.correctWarning)}</p>

      {eligible.length === 0 ? (
        <p className={styles.empty}>{label(t, RECORD.correctNoneEligible)}</p>
      ) : (
        <form className={styles.form} action={recordCorrectionAction} noValidate>
          {/* The view, so the redirect returns where it was sent from. Each one
              is re-validated in the action before it goes back into a URL. */}
          {projectSlug !== null && (
            <input type="hidden" name="project" value={projectSlug} />
          )}
          {entryType !== null && <input type="hidden" name="event" value={entryType} />}
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="page" value={String(page)} />

          <p className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="correct-entry">
              {label(t, RECORD.correctEntry)}
              <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.select}
              id="correct-entry"
              name="entry"
              required
              defaultValue=""
              aria-describedby="correct-entry-help"
            >
              <option value="" disabled>{label(t, RECORD.correctChoose)}</option>
              {eligible.map((e) => (
                <option key={e.publicId} value={e.publicId}>
                  {e.shortRef} · {e.occurredOn} · {e.entryLabelEn} · {e.projectTitle}
                </option>
              ))}
            </select>
          </p>
          <p id="correct-entry-help" className={styles.help}>
            {label(t, RECORD.correctOnlyThisPage)}
          </p>

          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="correct-reason">
              {label(t, RECORD.correctReason)}
              <span className={styles.required}>*</span>
            </label>
            <p id="correct-reason-help" className={styles.help}>
              {label(t, RECORD.correctReasonHint)}
            </p>
            <textarea
              className={styles.textarea}
              id="correct-reason"
              name="reason"
              rows={5}
              required
              minLength={10}
              maxLength={4000}
              aria-describedby="correct-reason-help"
            />
          </div>

          <button type="submit" className={styles.record}>
            {label(t, RECORD.correctSubmit)}
          </button>
        </form>
      )}

      {eligible.length > 0 && eligible.length < entries.length && (
        <p className={styles.small}>
          {labelWith(t, RECORD.correctEligible, { count: eligible.length })}
        </p>
      )}
    </section>
  );
}
