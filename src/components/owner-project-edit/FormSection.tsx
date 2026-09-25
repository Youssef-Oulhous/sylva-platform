import type { ReactNode } from 'react';
import styles from './FormSection.module.css';

/**
 * One section of the record, numbered in the order a reader meets it on the
 * project page. The sections of this form are the sections of that page, so an
 * owner filling it in knows what each answer will look like when it is read.
 */
export default function FormSection({
  id,
  n,
  title,
  lead,
  bare = false,
  children,
}: {
  id: string;
  /** Position in the record, shown as 01, 02, … Omitted on a step page. */
  n?: number;
  title: string;
  lead?: string;
  /**
   * True on a page whose h1 is already this section's name.
   *
   * The record used to be one page carrying nine of these, so each one needed
   * its own numbered h2. Now each section is its own page and the page's h1
   * names it, so repeating the name as an h2 underneath would give a screen
   * reader the same answer twice and put a heading where a heading says nothing.
   */
  bare?: boolean;
  children: ReactNode;
}) {
  if (bare) {
    return (
      <div id={id} className={styles.section}>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children}
      </div>
    );
  }

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        {n !== undefined && (
          <span className={styles.num} aria-hidden="true">
            {String(n).padStart(2, '0')}
          </span>
        )}
        {title}
      </h2>

      {lead && <p className={styles.lead}>{lead}</p>}

      {children}
    </section>
  );
}
