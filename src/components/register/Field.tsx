import styles from './Field.module.css';

/**
 * One labelled field: a text input, an email, a password, a select or a
 * multi-line address.
 *
 * The field owns the wiring that is easy to omit and invisible once omitted:
 * the label's `htmlFor`, the id of the hint, and the `aria-describedby` that
 * ties the hint to the control. Nothing here is a floating placeholder - a
 * placeholder disappears the moment a reader starts typing, and on a
 * registration form the reader most needs the explanation while typing.
 *
 * Every field on this form is required, which is stated once above the form
 * rather than repeated as an asterisk on every row - an asterisk is a legend the
 * reader has to look up.
 *
 * FRONTEND PASS. Every control is uncontrolled, so this stays a Server
 * Component: there is no state, no handler and no validation.
 */

export type FieldKind = 'text' | 'email' | 'password' | 'select' | 'textarea';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldProps {
  /** Unique within the document. The hint id is derived from it. */
  id: string;
  name: string;
  label: string;
  kind: FieldKind;
  /** Required: a registration field with no autocomplete token is a defect. */
  autoComplete: string;
  hint?: string;
  inputMode?: 'text' | 'email';
  /** Select only. */
  options?: readonly FieldOption[];
  /** Select only: the inert first entry, e.g. "Select…". */
  placeholderOption?: string;
  /** Textarea only. */
  rows?: number;
}

export default function Field({
  id,
  name,
  label,
  kind,
  autoComplete,
  hint,
  inputMode,
  options,
  placeholderOption,
  rows = 3,
}: FieldProps) {
  const hintId = `${id}-hint`;
  const shared = {
    id,
    name,
    required: true,
    autoComplete,
    className: styles.control,
    'aria-describedby': hint ? hintId : undefined,
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {kind === 'select' ? (
        <select {...shared} defaultValue="">
          <option value="" disabled>
            {placeholderOption}
          </option>
          {(options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : kind === 'textarea' ? (
        <textarea {...shared} rows={rows} />
      ) : (
        <input {...shared} type={kind} inputMode={inputMode} spellCheck={false} />
      )}
    </div>
  );
}
