import styles from './EmptyState.module.css';

/**
 * What a list says when it holds nothing yet.
 *
 * An empty list on this dashboard is a normal state, not a failure, so the
 * wording says what the list will hold and what puts something in it. It is
 * never a bare "Nothing here".
 *
 * The component takes finished strings rather than keys: the section that owns
 * the list also owns its wording, and a shared component that reached into the
 * message catalogue itself would have to guess the namespace.
 */
export default function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  /** An inert control, where the empty list is something the reader can fill. */
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
