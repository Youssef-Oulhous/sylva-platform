import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { expressInterestAction } from '@/lib/interest/actions';
import { DEAL_SHAPE_CHOICES } from '@/lib/interest/types';
import type { InterestProject } from '@/lib/interest/types';
import { c } from './copy';
import styles from './InterestForm.module.css';

/**
 * The enquiry form: which periods and roughly what volume, which deal shape, a
 * message, and how the buyer appears on the public record.
 *
 * WIRED. It posts to a Server Action (src/lib/interest/actions.ts), which
 * validates every field with zod on the server and then writes the deal, the
 * disclosure choice, the volumes, the message and the record entry in ONE
 * transaction. There is no client JavaScript: a plain form POST, so the page
 * works before - and without - any bundle.
 *
 * Nothing that decides WHAT is written travels in this form except the slug.
 * project_id, owner_org_id and unit_type_id are re-read server-side from that
 * slug, so a hand-made POST cannot attach a volume to another project's unit
 * type. The period ids are in the form because they name the fields, and the
 * action ignores any it did not itself put there.
 *
 * Short on purpose. The buyers interviewed for the concept note (§3) differ on
 * what they want; the form's job is to get the conversation to the right
 * project owner with enough in it to be useful, not to specify a deal.
 *
 * Rule 7. Each volume field belongs to one period of THIS project, and its
 * label names the project's unit type, so a figure typed here cannot be read
 * against a figure from any other project. The form prints no total across
 * periods and has no field that could hold one.
 */
export default async function InterestForm({
  project,
}: {
  project: InterestProject;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const unit = project.unitMetricLabel;

  // One stamp per distinct source. Usually that is one row of small print for
  // the whole table; where two periods come from different documents it is two,
  // because a stamp that covered both would name a source for a figure that
  // does not have it.
  const sources = project.periods
    .map((p) => p.source)
    .filter((s, i, all) =>
      all.findIndex((o) =>
        o.label === s.label && o.locator === s.locator && o.asOfDate === s.asOfDate) === i);

  return (
    <form action={expressInterestAction} className={styles.form} aria-label={t('expressInterest.form.label')}>
      {/* The only identifier the client sends. Everything else is re-read from
          the database on the server, from this. */}
      <input type="hidden" name="slug" value={project.slug} />

      {/* ---------------------------------------------------------------- 1 */}
      <fieldset className={styles.block}>
        <legend className={styles.legend}>{t('expressInterest.form.periodsLegend')}</legend>
        <p className={styles.hint}>{t('expressInterest.form.periodsHint')}</p>
        <p className={styles.unitNote}>{t('expressInterest.form.unitNote', { unit })}</p>
        <p className={styles.hint}>{c(t, 'volumeHint')}</p>

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
                const inputId = `ei-volume-${period.periodId}`;
                return (
                  <tr key={period.periodId}>
                    <th scope="row" className={styles.periodCell}>
                      {period.label}
                    </th>
                    {/* The unit sits beside the number, on every row: two
                        figures cannot be mistaken for comparable quantities if
                        each one says what it counts. `.amount` is read here and
                        only here, by a formatter - see src/lib/units/qty.ts. */}
                    <td className="num">
                      {format.number(period.remaining.amount, 'volume')}{' '}
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
                            silently drops what it cannot parse. The field NAME
                            carries the period id, so the server never has to
                            match a row by position. */}
                        <input
                          id={inputId}
                          name={`volume-${period.periodId}`}
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

        {sources.map((s) => (
          <SourceStamp key={`${s.label}|${s.locator}|${s.asOfDate}`} source={s} />
        ))}
        <p className={styles.footnote}>{t('expressInterest.form.remainingNote')}</p>
      </fieldset>

      {/* ---------------------------------------------------------------- 2 */}
      <fieldset className={styles.block}>
        <legend className={styles.legend}>{t('expressInterest.form.dealLegend')}</legend>
        <p className={styles.hint}>{t('expressInterest.form.dealHint')}</p>

        <ul className={styles.choices}>
          {DEAL_SHAPE_CHOICES.map((shape) => {
            const id = `ei-deal-${shape.code}`;
            const noteId = `${id}-note`;
            return (
              <li key={shape.code} className={styles.choice}>
                {/* Nothing is pre-selected: the platform should not nudge a
                    buyer towards a deal shape. The action defaults to
                    'undecided' if nothing comes back, which is the honest
                    reading of an untouched group. */}
                <input
                  type="radio"
                  id={id}
                  name="dealShape"
                  value={shape.code}
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
          maxLength={4000}
          aria-describedby="ei-message-hint"
          className={styles.textarea}
        />
        {/* It goes to deal.project_question - the private question box. There
            is no public comment feed and there is no table for one. */}
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
        <button type="submit" className={styles.submit}>
          {t('project.expressInterest')}
        </button>
        <p className={styles.submitNote}>{c(t, 'sendNote')}</p>
      </div>
    </form>
  );
}
