import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import LongAnswerQuestion from './LongAnswerQuestion';
import YesNoQuestion from './YesNoQuestion';
import { QUESTIONNAIRE_SOURCE, VETTING_PARTS } from './vetting-data';
import styles from './VettingForm.module.css';

/**
 * The questionnaire.
 *
 * Three parts in the order a buyer can answer them: what you would claim, who
 * you are, and the three conditions that decide the shape of a deal. The parts
 * are sections with headings rather than fieldsets, so the only fieldsets on the
 * page are the radio groups that actually need a legend, and so a screen-reader
 * user can move through the questionnaire by heading.
 *
 * FRONTEND PASS. The form has no action and no method. Both controls in the
 * footer are type="button", so nothing is ever submitted, and both are marked
 * aria-disabled and described by the note that says why - removing them would
 * hide from a keyboard reader that the actions exist at all.
 */
export default async function VettingForm() {
  const t = await getTranslations('vettingForm');

  return (
    <section aria-labelledby="vetting-questions-title">
      <div className={styles.head}>
        <h2 id="vetting-questions-title">{t('questionsTitle')}</h2>
        <p className={styles.lead}>{t('questionsLead')}</p>
        <SourceStamp
          source={{
            label: t(QUESTIONNAIRE_SOURCE.labelKey),
            locator: QUESTIONNAIRE_SOURCE.locator,
            asOfDate: QUESTIONNAIRE_SOURCE.asOfDate,
          }}
        />
      </div>

      {/* No action, no method, no handler. */}
      <form className={styles.form} noValidate>
        {VETTING_PARTS.map((part, index) => (
          <section key={part.id} className={styles.part} aria-labelledby={`${part.id}-title`}>
            <h3 id={`${part.id}-title`} className={styles.partTitle}>
              <span className={styles.partNum} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {t(part.titleKey)}
            </h3>

            <div className={styles.questions}>
              {part.questions.map((question) =>
                question.kind === 'yesno' ? (
                  <YesNoQuestion key={question.id} question={question} />
                ) : (
                  <LongAnswerQuestion key={question.id} question={question} />
                ),
              )}
            </div>
          </section>
        ))}

        <div className={styles.foot}>
          <p id="vetting-inert-note" className={styles.inertNote}>
            {t('actions.inertNote')}
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.submit}
              aria-disabled="true"
              aria-describedby="vetting-inert-note"
            >
              {t('actions.submit')}
            </button>
            <button
              type="button"
              className={styles.secondary}
              aria-disabled="true"
              aria-describedby="vetting-inert-note"
            >
              {t('actions.saveDraft')}
            </button>
          </div>

          <p className={styles.footNote}>{t('actions.footNote')}</p>
        </div>
      </form>
    </section>
  );
}
