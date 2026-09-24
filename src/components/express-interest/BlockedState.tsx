import Badge from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import styles from './BlockedState.module.css';

/**
 * One reason the enquiry cannot be sent, and what to do about it.
 *
 * Two of these appear on the page: not signed in, and organisation not yet
 * approved. They are one component rather than two because they have the same
 * job - name the obstacle, say plainly what the reader does next, and never
 * leave them at a closed door with no route out of it.
 *
 * The state is carried by a word in a badge and by the heading, never by the
 * tint alone.
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
  exampleLabel: string;
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
      <p className={styles.exampleLabel}>{exampleLabel}</p>

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
