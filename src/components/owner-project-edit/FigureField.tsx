import { getTranslations } from 'next-intl/server';
import ProvenanceStrip from './ProvenanceStrip';
import type { DemoFigure } from './project-draft-data';
import styles from './FigureField.module.css';

/**
 * One figure: the value, its unit, and the provenance that has to travel with
 * it. A fieldset, because a figure on this platform is not one control - it is a
 * value plus the document it came from plus the date it is stated as of, and a
 * reader filling this form should not be able to treat those as separable.
 *
 * Rule 7. The unit label is printed beside the box for a sighted reader and
 * carried inside the field's label for a screen reader, so a volume is never
 * read without the thing it counts. Nothing in this component, and nothing on
 * this page, adds one figure to another.
 *
 * FRONTEND PASS. Uncontrolled input, no handler, no submit.
 */
export default async function FigureField({
  figure,
  label,
  hint,
  required,
}: {
  figure: DemoFigure;
  /** What this figure is, already translated. */
  label: string;
  hint?: string;
  required?: boolean;
}) {
  const t = await getTranslations('ownerProjectForm');
  const unit = t(figure.unitKey);

  const valueId = `${figure.id}-value`;
  const hintId = hint ? `${figure.id}-hint` : undefined;

  return (
    <fieldset className={styles.figure}>
      <legend className={styles.legend}>
        {label}
        {required && <span className={styles.marker}>{t('labels.required')}</span>}
      </legend>

      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}

      <div className={styles.valueRow}>
        <label className={styles.valueLabel} htmlFor={valueId}>
          {t('provenance.value')}
          <span className="visually-hidden"> ({unit})</span>
        </label>
        <span className={styles.inputWrap}>
          <input
            id={valueId}
            name={valueId}
            type="text"
            inputMode="decimal"
            className={styles.input}
            defaultValue={figure.value}
            aria-describedby={hintId}
          />
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        </span>
      </div>

      <ProvenanceStrip
        idBase={figure.id}
        sourceDocId={figure.sourceDocId}
        locator={figure.locator}
        asOfDate={figure.asOfDate}
      />
    </fieldset>
  );
}
