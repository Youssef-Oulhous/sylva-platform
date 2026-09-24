import styles from './WhyWeAsk.module.css';

/**
 * Why a question is asked, printed under the question rather than hidden behind
 * a disclosure control.
 *
 * The client asked for the reason to be visible: vetting is the platform's
 * protection against greenwashing, and a buyer who cannot see why a question
 * matters answers it defensively. It is a plain block with a left rule - no
 * tint, because a reason is not a warning.
 */
export default function WhyWeAsk({
  label,
  id,
  children,
}: {
  /** e.g. "Why we ask". */
  label: string;
  /** Referenced by the field's aria-describedby, so the reason is announced. */
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.why} id={id}>
      <p className={styles.label}>{label}</p>
      <p className={styles.body}>{children}</p>
    </div>
  );
}
