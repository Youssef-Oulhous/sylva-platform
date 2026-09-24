import Badge from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import styles from './BlockedState.module.css';

/**
 * One reason the enquiry cannot be sent, and what to do about it.
 *
 * Four states use this: not signed in, not a buyer account, organisation not
 * yet approved, and an interest already open on this project. They are one
 * component rather than four because they have the same job - name the
 * obstacle, say plainly what the reader does next, and never leave anybody at
 * a closed door with no route out of it.
 *
 * The state is carried by a word in a badge and by the heading, never by the
 * tint alone.
 *
 * `exampleLabel` is optional and is now used by nothing: it labelled the
 * rendered specimens of these states while the page was a frontend pass. The
 * page shows the ONE state the reader is actually in, so the label would be a
 * lie. Kept because removing a prop is a change to a component two other areas
 * may reuse, and it costs nothing.
 */
export interface BlockedFact {
  label: string;
  value: string;
  /** Identifiers, references and dates are set in mono. */
  mono?: boolean;
}

export default function BlockedState({
  exampleLabel,
  statusWord,
  statusTone,
  title,
  body,
  facts,
  listTitle,
  items,
  actionsTitle,
  actions,
  note,
}: {
  exampleLabel?: string;
  statusWord: string;
  statusTone: BadgeTone;
  title: string;
  body: string;
  facts?: readonly BlockedFact[];
  listTitle?: string;
  items?: readonly string[];
  actionsTitle: string;
  actions: React.ReactNode;
  note?: string;
}) {
  return (
    <div className={styles.block}>
      {exampleLabel ? <p className={styles.exampleLabel}>{exampleLabel}</p> : null}

      <div className={styles.card}>
        <div className={styles.head}>
          <h3 className={styles.title}>{title}</h3>
          <Badge tone={statusTone}>{statusWord}</Badge>
        </div>

        <p className={styles.body}>{body}</p>

        {facts && facts.length > 0 ? (
          <dl className={styles.facts}>
            {facts.map((fact) => (
              <div key={fact.label} className={styles.fact}>
                <dt className={styles.factLabel}>{fact.label}</dt>
                <dd className={fact.mono ? `${styles.factValue} ${styles.mono}` : styles.factValue}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {listTitle && items && items.length > 0 ? (
          <div className={styles.list}>
            <h4 className={styles.subTitle}>{listTitle}</h4>
            <ul className={styles.items}>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.actionsWrap}>
          <h4 className={styles.subTitle}>{actionsTitle}</h4>
          <div className={styles.actions}>{actions}</div>
        </div>

        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </div>
  );
}
