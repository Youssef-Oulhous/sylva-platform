import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import styles from './Fields.module.css';

/**
 * The form primitives, in one module so the sections of the record cannot drift
 * apart: one label weight, one field border, one hint style, one way of saying
 * "required".
 *
 * Every control here is uncontrolled - a defaultValue and no handler - so all
 * of it stays a Server Component. The forms these build are plain
 * <form action={serverAction}> elements, so the record can be filled in with
 * scripting turned off.
 *
 * `id` and `name` are separate. The record page carries several forms at once
 * and each posts its own section, so two forms legitimately hold a field called
 * `source_label` while the two <label for=…> targets must still be unique on
 * the page. `name` defaults to `id` for the single-form case.
 */

/* -------------------------------------------------------------------------- */

/** A row of fields. Two columns on a wide screen, one at 375px. */
export function FieldRow({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: ReactNode;
}) {
  const width = cols === 3 ? styles.row3 : cols === 1 ? styles.row1 : styles.row2;
  return <div className={`${styles.row} ${width}`}>{children}</div>;
}

/** An explanatory line. `tone="rule"` is the bordered note used for the rules a
 *  reader must not miss; it carries no colour that a word does not repeat. */
export function Note({
  children,
  id,
  tone = 'plain',
}: {
  children: ReactNode;
  id?: string;
  tone?: 'plain' | 'rule';
}) {
  return (
    <p id={id} className={tone === 'rule' ? `${styles.note} ${styles.noteRule}` : styles.note}>
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */

interface BaseFieldProps {
  id: string;
  /** The submitted field name. Defaults to `id`. */
  name?: string;
  label: string;
  hint?: string;
  note?: ReactNode;
  required?: boolean;
  optional?: boolean;
}

function describedBy(...ids: (string | undefined)[]): string | undefined {
  const used = ids.filter((value): value is string => typeof value === 'string');
  return used.length > 0 ? used.join(' ') : undefined;
}

export async function TextField({
  id,
  name,
  label,
  hint,
  note,
  required,
  optional,
  defaultValue = '',
  type = 'text',
  rows,
  placeholder,
  unit,
  mono,
}: BaseFieldProps & {
  defaultValue?: string;
  type?: 'text' | 'date' | 'url' | 'email';
  /** Set for a textarea. Omitted for a single-line input. */
  rows?: number;
  placeholder?: string;
  /** The unit printed beside the field, already translated. */
  unit?: string;
  /** Mono for a reference, an identifier or a figure - never for prose. */
  mono?: boolean;
}) {
  const t = await getTranslations('ownerProjectForm');
  const hintId = hint ? `${id}-hint` : undefined;
  const noteId = note ? `${id}-note` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span className={styles.marker}>{t('labels.required')}</span>}
        {optional && <span className={styles.marker}>{t('labels.optional')}</span>}
        {/* The unit is beside the box for a sighted reader and inside the label
            for a screen reader, so the number is never heard without it. */}
        {unit && <span className="visually-hidden"> ({unit})</span>}
      </label>

      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}

      {rows ? (
        <textarea
          id={id}
          name={name ?? id}
          rows={rows}
          required={required}
          className={styles.textarea}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-describedby={describedBy(hintId, noteId)}
        />
      ) : (
        <span className={styles.inputWrap}>
          <input
            id={id}
            name={name ?? id}
            type={type}
            required={required}
            className={mono ? `${styles.input} ${styles.inputMono}` : styles.input}
            defaultValue={defaultValue}
            placeholder={placeholder}
            aria-describedby={describedBy(hintId, noteId)}
          />
          {unit && (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          )}
        </span>
      )}

      {note && (
        <div className={styles.noteWrap} id={noteId}>
          {note}
        </div>
      )}
    </div>
  );
}

export async function SelectField({
  id,
  name,
  label,
  hint,
  note,
  required,
  optional,
  defaultValue = '',
  options,
  placeholderOption,
}: BaseFieldProps & {
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  /** The first option, for "not stated". Omitted where a value is always set. */
  placeholderOption?: string;
}) {
  const t = await getTranslations('ownerProjectForm');
  const hintId = hint ? `${id}-hint` : undefined;
  const noteId = note ? `${id}-note` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span className={styles.marker}>{t('labels.required')}</span>}
        {optional && <span className={styles.marker}>{t('labels.optional')}</span>}
      </label>

      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}

      <select
        id={id}
        name={name ?? id}
        required={required}
        className={styles.select}
        defaultValue={defaultValue}
        aria-describedby={describedBy(hintId, noteId)}
      >
        {placeholderOption !== undefined && <option value="">{placeholderOption}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {note && (
        <div className={styles.noteWrap} id={noteId}>
          {note}
        </div>
      )}
    </div>
  );
}

/**
 * A radio or checkbox group. A real fieldset with a real legend, because this is
 * the one case where the group needs a name of its own.
 */
export async function ChoiceGroup({
  name,
  legend,
  hint,
  kind,
  options,
  required,
}: {
  name: string;
  legend: string;
  hint?: string;
  kind: 'radio' | 'checkbox';
  options: readonly { value: string; label: string; hint?: string; checked?: boolean }[];
  required?: boolean;
}) {
  const t = await getTranslations('ownerProjectForm');
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>
        {legend}
        {required && <span className={styles.marker}>{t('labels.required')}</span>}
      </legend>

      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}

      <div className={styles.choices}>
        {options.map((option) => (
          // The whole box is the label, so the target is the size of the answer
          // rather than the size of the control.
          <label key={option.value} className={styles.choice}>
            <input
              type={kind}
              /* A checkbox group is a set of independent answers, so each one
                 carries its own name; a radio group is one answer. */
              name={kind === 'radio' ? name : `${name}-${option.value}`}
              value={option.value}
              defaultChecked={option.checked}
              aria-describedby={hintId}
            />
            <span className={styles.choiceText}>
              <span className={styles.choiceLabel}>{option.label}</span>
              {option.hint && <span className={styles.choiceHint}>{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * A value this form shows but does not set. It is not a disabled input: a
 * disabled input invites a reader to try to type into it and tells them nothing
 * about why they cannot.
 */
export function StaticValue({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  /** Already formatted. A dash where the value cannot be stated. */
  value: string;
  unit?: string;
  note?: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <p className={styles.label}>
        {label}
        {unit && <span className="visually-hidden"> ({unit})</span>}
      </p>
      <p className={styles.static}>
        <span className={styles.staticValue}>{value}</span>
        {unit && (
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        )}
      </p>
      {note && <div className={styles.noteWrap}>{note}</div>}
    </div>
  );
}
