import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { recordVettingDecisionAction } from '@/lib/admin/actions';
import { adminText, stateLabel } from '@/lib/admin/messages';
import { resolveAdminMessage, type AdminErrorCode } from '@/lib/admin/errors';
import {
  ADMIN_DECISION_CHOICES,
  DECISION_IS_SETTLED,
  DECISION_KEY,
  DECISION_LEADS_TO,
  STATE_TONE,
  type AdminVettingApplication,
} from '@/lib/admin/types';
import styles from './DecisionForm.module.css';

/**
 * The decision.
 *
 * Three entries an operator can record - approve, decline, suspend - and one
 * required reason. There is no fourth control that sets a state, because there
 * is no state to set: each option says, on its own label, which state would
 * then be READ from the chain, and the sentence under the button says that
 * again in words.
 *
 * WHAT THE FORM ACTUALLY SENDS. A submission id, a choice from a closed set,
 * and the reason. Nothing else. The organisation, the role, the operator's own
 * organisation and the person recorded against the entry are all taken from the
 * session or read back out of the submission inside the action - so a crafted
 * post cannot approve a different organisation and cannot sign an entry as
 * somebody else. See src/lib/admin/actions.ts.
 *
 * No option is preselected. A decision arrived at by leaving a default alone is
 * not a decision, and this form is the operator's main safeguard against
 * greenwashing (concept note section 7).
 *
 * The reason is required rather than optional because the record is append-only
 * (section 8, rule 4): the entry cannot later be edited to explain itself, so
 * an entry recorded without a reason is permanently unexplained. The
 * organisation's own status page renders a recorded reason, so what is typed
 * here is written for the applicant to read, not only for the file. The
 * database requires a reason for `declined` and `revoked`; this form requires
 * one for all three, which makes it stricter than the schema and never the
 * other way round.
 *
 * It is a plain <form> posting to a Server Action: no client component, no
 * bundle, and it works with JavaScript off.
 */
export default async function DecisionForm({
  application,
  headingId,
  error,
  recorded,
}: {
  application: AdminVettingApplication;
  headingId: string;
  /** Set when the last attempt was refused. Rendered as a sentence. */
  error: AdminErrorCode | null;
  /** The enum member the database stored on the last successful attempt. */
  recorded: string | null;
}) {
  const t = await getTranslations();
  const suspended = application.state === 'suspended';

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminVetting.decide.title')}</h3>
        <p className={styles.lead}>
          {t('adminVetting.decide.lead', { organisation: application.organisationName })}
        </p>
      </div>

      {recorded !== null && (
        <p className={styles.statement} role="status">
          {adminText(t, 'decisionRecorded')}
        </p>
      )}

      {error !== null && (
        <p className={styles.statement} role="alert">
          {resolveAdminMessage(t, error)}
        </p>
      )}

      <form className={styles.form} action={recordVettingDecisionAction} noValidate>
        {/* The only identifier the form carries. Everything the entry is signed
            with comes from the session, not from here. */}
        <input type="hidden" name="submissionId" value={application.submissionId} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            {t('adminVetting.decide.legend')}
            <span className={styles.required}>{t('adminVetting.decide.required')}</span>
          </legend>

          <div className={styles.options}>
            {ADMIN_DECISION_CHOICES.map((choice) => {
              const key = DECISION_KEY[choice];
              const leadsTo = DECISION_LEADS_TO[choice];
              return (
                <div key={choice} className={styles.option}>
                  <input
                    type="radio"
                    id={`decision-${choice}`}
                    name="decision"
                    value={choice}
                    required
                    className={styles.radio}
                    aria-describedby={`decision-${choice}-note`}
                  />
                  <label htmlFor={`decision-${choice}`} className={styles.optionLabel}>
                    {t(`adminVetting.decision.${key}`)}
                  </label>
                  <p id={`decision-${choice}-note`} className={styles.optionNote}>
                    {t(`adminVetting.decision.${key}Note`)}
                  </p>
                  <p className={styles.optionDerived}>
                    <span className={styles.optionDerivedLabel}>
                      {t('adminVetting.decide.wouldRead')}
                    </span>
                    <Badge tone={STATE_TONE[leadsTo]}>{stateLabel(t, leadsTo)}</Badge>
                    {!DECISION_IS_SETTLED[choice] && (
                      <span className={styles.unsettled}>
                        {t('adminVetting.decide.unsettled')}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Approving a suspended organisation records a reinstatement, which
              is a different fact from a first approval. Said here rather than
              discovered afterwards in the log. */}
          {suspended && (
            <p className={styles.statement}>{adminText(t, 'reinstatementNote')}</p>
          )}
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="decision-reason" className={styles.label}>
            {t('adminVetting.decide.reasonLabel')}
            <span className={styles.required}>{t('adminVetting.decide.required')}</span>
          </label>
          <p id="decision-reason-help" className={styles.help}>
            {t('adminVetting.decide.reasonHelp')}
          </p>
          <textarea
            id="decision-reason"
            name="reason"
            rows={6}
            required
            minLength={10}
            maxLength={4000}
            className={styles.textarea}
            aria-describedby="decision-reason-help decision-reason-part"
          />
          <p id="decision-reason-part" className={styles.help}>
            {t('adminVetting.decide.reasonPart')}
          </p>
        </div>

        <div className={styles.foot}>
          <button type="submit" className={styles.record}>
            {t('adminVetting.decide.record')}
          </button>

          <div className={styles.statements}>
            <p className={styles.statement}>{t('adminVetting.decide.notAFlag')}</p>
            <p className={styles.statement}>{t('adminVetting.decide.appendOnly')}</p>
            <p className={styles.statement}>{t('adminVetting.decide.noReasonNoEntry')}</p>
          </div>
        </div>
      </form>
    </section>
  );
}
