import type { ReactNode } from 'react';
import { INERT_NOTE_ID } from './project-draft-data';
import styles from './RepeatGroup.module.css';

/**
 * A repeated entry - one outcome, one claim, one partner, one period, one
 * document - and the control that adds another.
 *
 * FRONTEND PASS. Adding and removing an entry is behaviour, and behaviour comes
 * later. Both controls are real buttons of type="button" marked aria-disabled
 * and described by the one note that says why: removing them would hide from a
 * keyboard reader that the actions exist at all.
 */
export function RepeatEntry({
  legend,
  meta,
  removeLabel,
  children,
}: {
  legend: string;
  /** A reference or a state, shown in mono beside the legend. */
  meta?: string;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.entry}>
      <legend className={styles.legend}>{legend}</legend>

      <div className={styles.entryHead}>
        {meta && <span className={styles.meta}>{meta}</span>}
        <button
          type="button"
          className={styles.remove}
          aria-disabled="true"
          aria-describedby={INERT_NOTE_ID}
        >
          {removeLabel}
        </button>
      </div>

      {children}
    </fieldset>
  );
}

export function AddEntry({ label, note }: { label: string; note?: string }) {
  return (
    <div className={styles.add}>
      <button
        type="button"
        className={styles.addButton}
        aria-disabled="true"
        aria-describedby={INERT_NOTE_ID}
      >
        {label}
      </button>
      {note && <p className={styles.addNote}>{note}</p>}
    </div>
  );
}
