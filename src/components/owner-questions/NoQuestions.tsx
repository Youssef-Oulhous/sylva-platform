import styles from './NoQuestions.module.css';

/**
 * The empty state, used both for a project that has had no questions and for an
 * inbox with none at all.
 *
 * A project with no questions is shown rather than omitted: an owner needs to
 * see that nobody has asked about a project, which is information, and an absent
 * section would instead read as a page that failed to load.
 *
 * It says what will appear here and where a buyer asks from. It does not offer
 * the owner an action, because there is nothing an owner can do to produce a
 * question.
 */
export default function NoQuestions({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
    </div>
  );
}
