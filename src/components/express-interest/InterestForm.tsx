import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { DEMO_DEAL_SHAPES, type DemoInterestProject } from './demo-interest';
import styles from './InterestForm.module.css';

/**
 * The enquiry form: which periods and roughly what volume, which deal shape, a
 * message, and how the buyer appears on the public record.
 *
 * FRONTEND PASS. There is no function behind this. The form has no action, the
 * button is a `type="button"` so nothing is ever submitted, and no field is
 * read. Nothing here touches a database, a server action or a session.
 *
 * Short on purpose. The buyers interviewed for the concept note (§3) differ on
 * what they want; the form's job is to get the conversation to the right project
 * owner with enough in it to be useful, not to specify a deal. Everything that
 * matters is settled privately afterwards.
 *
 * Rule 7. Each volume field belongs to one period of THIS project, and its label
 * names the project's unit type, so a figure typed here cannot be read against a
 * figure from any other project. The form prints no total across periods and has
 * no field that could hold one.
 */
export default async function InterestForm({
  project,
}: {
  project: DemoInterestProject;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const unit = t(project.unitLabelKey);

  return (
    <form className={styles.form} aria-label={t('expressInterest.form.label')} noValidate>
      {/* ---------------------------------------------------------------- 1 */}
      <fieldset className={styles.block}>
        <legend className={styles.legend}>{t('expressInterest.form.periodsLegend')}</legend>
        <p className={styles.hint}>{t('expressInterest.form.periodsHint')}</p>
        <p className={styles.unitNote}>{t('expressInterest.form.unitNote', { unit })}</p>

        <div className="table-scroll">
          <table className={styles.table}>
            <caption>{t('expressInterest.form.periodsCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('project.period')}</th>
                <th scope="col" className="num">
                  {t('project.remaining')}
                </th>
                <th scope="col">{t('expressInterest.form.volumeHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {project.periods.map((period) => {
                const inputId = `ei-volume-${period.id}`;
                return (
                  <tr key={period.id}>
                    <th scope="row" className={styles.periodCell}>
                      {period.label}
                    </th>
                    {/* The unit sits beside the number, on every row: two
                        figures cannot be mistaken for comparable quantities if
                        each one says what it counts. */}
                    <td className="num">
                      {format.number(period.remaining, 'volume')}{' '}
                      <span className={styles.unitInline}>{unit}</span>
                    </td>
                    <td className={styles.inputCell}>
                      {/* The visible column heading is not enough of a label
                          here: read on its own, out of the table, the field has
                          to say which period and which unit it is asking for. */}
                      <label htmlFor={inputId} className="visually-hidden">
                        {t('expressInterest.form.volumeLabel', {
                          period: period.label,
                          unit,
                        })}
                      </label>
                      <span className={styles.inputRow}>
                        {/* type="text" with a numeric keyboard rather than
                            type="number": a spinner on a volume invites a click
                            that changes a figure by one, and a number input
                            silently drops what it cannot parse. */}
                        <input
                          id={inputId}
                          name={`volume-${period.label}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          className={styles.input}
                        />
                        <span className={styles.inputUnit} aria-hidden="true">
                          {unit}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* One stamp for the remaining column: every period above is read from
            the same table of the same document. */}
        <SourceStamp
          source={{
            label: t('expressInterest.source.designDocument'),
            locator: '§ 7.1',
            asOfDate: '2026-09-12',
          }}
        />
        <p className={styles.footnote}>{t('expressInterest.form.remainingNote')}</p>
      </fieldset>

      {/* ---------------------------------------------------------------- 2 */}
      <fieldset className={styles.block}>
        <legend className={styles.legend}>{t('expressInterest.form.dealLegend')}</legend>
        <p className={styles.hint}>{t('expressInterest.form.dealHint')}</p>

        <ul className={styles.choices}>
          {DEMO_DEAL_SHAPES.map((shape) => {
            const id = `ei-deal-${shape.id}`;
            const noteId = `${id}-note`;
            return (
              <li key={shape.id} className={styles.choice}>
                {/* Nothing is pre-selected: the platform should not nudge a
                    buyer towards a deal shape. */}
                <input
                  type="radio"
                  id={id}
                  name="dealShape"
                  value={shape.id}
                  aria-describedby={noteId}
                  className={styles.control}
                />
                <span className={styles.choiceText}>
                  <label htmlFor={id} className={styles.choiceLabel}>
                    {t(shape.labelKey)}
                  </label>
                  <span id={noteId} className={styles.choiceNote}>
                    {t(shape.noteKey)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {/* ---------------------------------------------------------------- 3 */}
      <div className={styles.block}>
        <label htmlFor="ei-message" className={styles.label}>
          {t('expressInterest.form.messageLabel')}
        </label>
        <p id="ei-message-hint" className={styles.hint}>
          {t('expressInterest.form.messageHint')}
        </p>
        <textarea
          id="ei-message"
          name="message"
          rows={6}
          aria-describedby="ei-message-hint"
          className={styles.textarea}
        />
        <p className={styles.footnote}>{t('expressInterest.form.messagePrivacy')}</p>
      </div>

      {/* ---------------------------------------------------------------- 4 */}
      <fieldset className={styles.block}>
        <legend className={styles.legend}>
          {t('expressInterest.form.disclosureLegend')}
        </legend>
        <p className={styles.hint}>{t('expressInterest.form.disclosureHint')}</p>

        <div className={styles.checkRow}>
          <input
            type="checkbox"
            id="ei-disclose"
            name="disclose"
            aria-describedby="ei-disclose-note"
            className={styles.control}
          />
          <span className={styles.choiceText}>
            <label htmlFor="ei-disclose" className={styles.choiceLabel}>
              {t('expressInterest.form.disclosureOptIn')}
            </label>
            <span id="ei-disclose-note" className={styles.choiceNote}>
              {t('expressInterest.form.disclosureDefault')}
            </span>
          </span>
        </div>
      </fieldset>

      {/* ---------------------------------------------------------------- 5 */}
      <div className={styles.actions}>
        {/* A real button, and deliberately not a submit: the client asked for
            the pages first and the functions later. */}
        <button type="button" className={styles.submit}>
          {t('project.expressInterest')}
        </button>
        <p className={styles.submitNote}>{t('expressInterest.form.submitNote')}</p>
      </div>
    </form>
  );
}
