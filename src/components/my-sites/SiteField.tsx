import styles from './SiteField.module.css';

/**
 * One labelled control: a text box, a number box, a country list or a note.
 *
 * The field owns the wiring that is easy to omit and invisible once omitted -
 * the label's `htmlFor`, the id of the hint, and the `aria-describedby` that
 * ties them together. Nothing renders a placeholder in place of a label.
 *
 * There is a sibling of this component under components/sign-in. This one is
 * separate rather than shared because that one is a sign-in field: its `type` is
 * limited to text, email and password and it requires an autocomplete token,
 * neither of which fits a latitude or a country list. Merging the two into one
 * general-purpose Input belongs in the design-system pass, not in a page.
 */

interface FieldCommon {
  /** Unique within the document. The hint id is derived from it. */
  id: string;
  name: string;
  label: string;
  hint?: string;
  /** The word shown beside the label on an optional field, e.g. "Optional". */
  optionalNote?: string;
  required?: boolean;
  autoComplete?: string;
  /**
   * Fills the control when the form edits something that already exists.
   * `defaultValue`, never `value`: these are uncontrolled inputs in a server
   * component, and a `value` without an onChange makes the box read-only.
   */
  defaultValue?: string;
}

type FieldControl =
  | { kind: 'text' }
  | {
      kind: 'number';
      min: number;
      max: number;
      /** Decimal degrees to four places: 0.0001 deg is about 11 m. */
      step: string;
      placeholder?: string;
    }
  | {
      kind: 'select';
      options: readonly { readonly value: string; readonly label: string }[];
      /** The first, unselected option, e.g. "Select a country". */
      placeholderOption: string;
    }
  | { kind: 'textarea'; rows: number };

export type SiteFieldProps = FieldCommon & FieldControl;

export default function SiteField(props: SiteFieldProps) {
  const {
    id, name, label, hint, optionalNote, required = false, autoComplete, defaultValue,
  } = props;
  const hintId = `${id}-hint`;
  const describedBy = hint ? hintId : undefined;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {optionalNote ? (
          <span className={styles.optional}>{optionalNote}</span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {props.kind === 'select' ? (
        <select
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue ?? ''}
          aria-describedby={describedBy}
          className={styles.select}
        >
          <option value="" disabled>
            {props.placeholderOption}
          </option>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : props.kind === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          rows={props.rows}
          required={required}
          defaultValue={defaultValue}
          aria-describedby={describedBy}
          className={`${styles.input} ${styles.textarea}`}
        />
      ) : props.kind === 'number' ? (
        <input
          id={id}
          name={name}
          type="number"
          /* A decimal keyboard on a phone, and a field that accepts a decimal
             point rather than fighting it. */
          inputMode="decimal"
          min={props.min}
          max={props.max}
          step={props.step}
          placeholder={props.placeholder}
          required={required}
          defaultValue={defaultValue}
          autoComplete={autoComplete ?? 'off'}
          aria-describedby={describedBy}
          className={`${styles.input} ${styles.number}`}
        />
      ) : (
        <input
          id={id}
          name={name}
          type="text"
          required={required}
          defaultValue={defaultValue}
          autoComplete={autoComplete ?? 'off'}
          spellCheck={false}
          aria-describedby={describedBy}
          className={styles.input}
        />
      )}
    </div>
  );
}
