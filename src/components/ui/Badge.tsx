import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'water' | 'bio' | 'warning' | 'error' | 'demo';

/**
 * Status is never communicated by colour alone: the badge always contains the
 * word as well as the tint.
 */
export default function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
