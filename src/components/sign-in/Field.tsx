import styles from './Field.module.css';

/**
 * One labelled text field, with an optional hint and an optional error.
 *
 * The field owns the wiring that is easy to get wrong by hand and impossible to
 * see once it is missing: the label's `htmlFor`, the ids of the hint and the
 * error, and the `aria-describedby` that ties them to the input. A field with an
 * error also carries `aria-invalid`, and the error message itself opens with a
 * word ("Error"), so the state is never carried by the red border alone.
 *
 * It takes its ids from the caller because this page renders the form twice -
 * once live, once as an error-state specimen - and two inputs must never share
 * an id.
 */
export interface FieldProps {
  /** Unique within the document. The hint and error ids are derived from it. */
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'password';
  /** Required: a sign-in field with no autocomplete token is a defect. */
  autoComplete: string;
  inputMode?: 'text' | 'email';
  hint?: string;
  /** Present means the field is in its error state. */
  error?: string;
  /** The word that opens the error message, e.g. "Error". */
  errorPrefix?: string;
  defaultValue?: string;
  required?: boolean;
  readOnly?: boolean;
  /** Sits on the label row, right-aligned - e.g. a forgotten-password link. */
  action?: React.ReactNode;
}

export default function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  inputMode,
  hint,
  error,
  errorPrefix,
  defaultValue,
  required = false,
  readOnly = false,
  action,
}: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((x): x is string => x !== null)
    .join(' ');

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {action ? <span className={styles.action}>{action}</span> : null}
      </div>

      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        required={required}
        readOnly={readOnly}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
        className={error ? `${styles.input} ${styles.inputError}` : styles.input}
      />

      {error ? (
        <p id={errorId} className={styles.error}>
          <strong className={styles.errorWord}>{errorPrefix}</strong> {error}
        </p>
      ) : null}
    </div>
  );
}
