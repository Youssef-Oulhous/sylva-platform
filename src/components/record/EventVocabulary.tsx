import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import type { RecordEventTypeOption } from '@/lib/record/types';
import { EVENT_CODES_WITHOUT_A_DEFINITION, inNoteOrder } from './vocabulary';
import styles from './EventVocabulary.module.css';

/**
 * The event vocabulary, in two groups.
 *
 * The types come from record.entry_type - the same table the record's own
 * entry_type column references - so the vocabulary on the page cannot drift
 * from the vocabulary the database will accept. Which group a type belongs to
 * is the database's is_proposed_addition flag, not a list held here.
 *
 * The first group is the list the concept note gives, in the note's own order.
 * The second is the event types we added because the record needs them - rule 4
 * cannot be satisfied without a way to point at a wrong entry - and they are
 * marked as ours, not presented as settled.
 *
 * Where the note names an event but does not say what it covers, the row says
 * so instead of offering a definition we wrote ourselves.
 */
export default async function EventVocabulary({
  eventTypes,
}: {
  eventTypes: readonly RecordEventTypeOption[];
}) {
  const t = await getTranslations();

  const byCode = new Map(eventTypes.map((e) => [e.code, e]));
  const noted = inNoteOrder(
    eventTypes.filter((e) => !e.isProposedAddition).map((e) => e.code),
  );
  const proposed = inNoteOrder(
    eventTypes.filter((e) => e.isProposedAddition).map((e) => e.code),
  );

  // A type the message catalogue does not know yet falls back to the English
  // label the database holds, rather than rendering a raw key at a reader.
  //
  // ASKED with t.has(), not by calling t() and comparing the answer to the key.
  // Comparing is how the rest of this page used to do it and it is fragile in
  // two ways: it depends on next-intl's undocumented choice to return the key
  // on a miss, and it reports every deliberately-absent key - "allocated" has
  // no definition ON PURPOSE - to the error handler on every render. t.has()
  // asks the question directly. It is what RecordTable and RecordFilters use,
  // so the three now behave the same way.
  const has = (key: string) => {
    try {
      return typeof t.has === 'function' ? t.has(key) : false;
    } catch {
      return false;
    }
  };
  const label = (code: string) => {
    const key = `record.event.${code}`;
    return has(key) ? t(key) : (byCode.get(code)?.labelEn ?? code);
  };
  const meaning = (code: string) => {
    if (EVENT_CODES_WITHOUT_A_DEFINITION.includes(code)) {
      return t('record.vocabulary.notDefined');
    }
    const key = `record.event.${code}Note`;
    return has(key) ? t(key) : t('record.vocabulary.notDefined');
  };

  const group = (codes: readonly string[], captionKey: string) => (
    <div className="table-scroll">
      <table className={styles.table}>
        <caption className={styles.caption}>{t(captionKey)}</caption>
        <thead>
          <tr>
            <th scope="col">{t('record.vocabulary.colEvent')}</th>
            <th scope="col">{t('record.vocabulary.colMeaning')}</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code}>
              <th scope="row" className={styles.eventName}>
                {label(code)}
              </th>
              <td className={styles.meaning}>{meaning(code)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className={styles.section} aria-labelledby="record-vocabulary">
      <h2 id="record-vocabulary">{t('record.vocabulary.title')}</h2>
      <p className={styles.intro}>{t('record.vocabulary.intro')}</p>

      <h3 className={styles.groupTitle}>{t('record.vocabulary.noted')}</h3>
      {group(noted, 'record.vocabulary.notedCaption')}

      <h3 className={styles.groupTitle}>
        {t('record.vocabulary.proposed')}{' '}
        <Badge tone="warning">{t('record.vocabulary.proposedBadge')}</Badge>
      </h3>
      <p className={styles.proposedNote}>{t('record.vocabulary.proposedNote')}</p>
      {group(proposed, 'record.vocabulary.proposedCaption')}
    </section>
  );
}
