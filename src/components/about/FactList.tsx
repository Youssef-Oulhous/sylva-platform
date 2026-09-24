import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import type { AboutFact } from './about-data';
import styles from './FactList.module.css';

/**
 * A register of labelled statements, each carrying the document it came from
 * and that document's date.
 *
 * Shared by the two sections of this page that make commitments - what the
 * operator does, and how personal data is handled - rather than written twice.
 * A description list, not a table: each entry is one label and one statement,
 * which is what <dl> is for, and it collapses to a readable stack at 375px
 * without losing the pairing.
 *
 * A fact the platform has not yet fixed carries a word in a badge. The badge is
 * never the only signal: the statement itself says what is outstanding.
 */
export default async function FactList({ facts }: { facts: readonly AboutFact[] }) {
  const t = await getTranslations();

  return (
    <dl className={styles.list}>
      {facts.map((f) => (
        <div key={f.id} className={styles.row}>
          <dt className={styles.label}>{t(f.labelKey)}</dt>
          <dd className={styles.value}>
            <p className={styles.body}>{t(f.bodyKey)}</p>
            {f.pendingKey && (
              <p className={styles.flag}>
                <Badge tone="warning">{t(f.pendingKey)}</Badge>
              </p>
            )}
            <SourceStamp
              source={{
                label: t(f.source.labelKey),
                locator: f.source.locator,
                asOfDate: f.source.asOfDate,
              }}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
