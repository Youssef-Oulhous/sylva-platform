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
  children,
}: {
  id: string;
  /** Position in the record, shown as 01, 02, … */
  n: number;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        <span className={styles.num} aria-hidden="true">
          {String(n).padStart(2, '0')}
        </span>
        {title}
      </h2>

      {lead && <p className={styles.lead}>{lead}</p>}

      {children}
    </section>
  );
}
