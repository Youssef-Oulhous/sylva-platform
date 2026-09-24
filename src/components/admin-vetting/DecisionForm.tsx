import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { DECISION_OPTIONS, STATE_TONE, type QueueRow } from './demo-queue';
import styles from './DecisionForm.module.css';

/**
 * The decision.
 *
 * Three entries an operator can record - approve, decline, suspend - and one
 * required reason. There is no fourth control that sets a state, because there
 * is no state to set: each option says, on its own label, which state would
 * then be READ from the entries, and the sentence under the button says that
 * again in words.
 *
 * No option is preselected. A decision arrived at by leaving a default alone is
 * not a decision, and this form is the operator's main safeguard against
 * greenwashing (concept note section 7).
 *
 * The reason is a required field rather than an optional note because the
 * record is append-only (section 8, rule 4): the entry cannot later be edited
 * to explain itself, so an entry recorded without a reason is permanently
 * unexplained. The organisation's own status page renders a recorded reason, so
 * what is typed here is written for the applicant to read, not only for the
 * file.
 *
 * FRONTEND PASS. The form has no action, no method and no handler. The one
 * control in the footer is type="button", marked aria-disabled and described by
 * the note that says why: removing it would hide from a keyboard reader that the
 * action exists at all. There is no client component on this page.
 */
export default async function DecisionForm({
  row,
  headingId,
}: {
  row: QueueRow;
  headingId: string;
}) {
  const t = await getTranslations();

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminVetting.decide.title')}</h3>
        <p className={styles.lead}>
          {t('adminVetting.decide.lead', { organisation: row.organisationName })}
        </p>
      </div>

      {/* No action, no method, no handler. */}
      <form className={styles.form} noValidate>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            {t('adminVetting.decide.legend')}
            <span className={styles.required}>{t('adminVetting.decide.required')}</span>
          </legend>

          <div className={styles.options}>
            {DECISION_OPTIONS.map((option) => (
              <div key={option.value} className={styles.option}>
                <input
                  type="radio"
                  id={`decision-${option.value}`}
                  name="decision"
                  value={option.value}
                  className={styles.radio}
                  aria-describedby={`decision-${option.value}-note`}
                />
                <label htmlFor={`decision-${option.value}`} className={styles.optionLabel}>
                  {t(`adminVetting.decision.${option.key}`)}
                </label>
                <p id={`decision-${option.value}-note`} className={styles.optionNote}>
                  {t(`adminVetting.decision.${option.key}Note`)}
                </p>
                <p className={styles.optionDerived}>
                  <span className={styles.optionDerivedLabel}>
                    {t('adminVetting.decide.wouldRead')}
                  </span>
                  <Badge tone={STATE_TONE[option.derived]}>
                    {t(`adminVetting.state.${option.derived}`)}
                  </Badge>
                  {!option.settled && (
                    <span className={styles.unsettled}>
                      {t('adminVetting.decide.unsettled')}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
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
            className={styles.textarea}
            aria-describedby="decision-reason-help decision-reason-part"
          />
          <p id="decision-reason-part" className={styles.help}>
            {t('adminVetting.decide.reasonPart')}
          </p>
        </div>

        <div className={styles.foot}>
          <p id="decision-inert-note" className={styles.inertNote}>
            {t('adminVetting.decide.inertNote')}
          </p>

          <button
            type="button"
            className={styles.record}
            aria-disabled="true"
            aria-describedby="decision-inert-note"
          >
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
