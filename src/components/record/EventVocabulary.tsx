import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import {
  EVENT_CODES_WITHOUT_A_DEFINITION,
  NOTED_EVENT_CODES,
  PROPOSED_EVENT_CODES,
  type RecordEventCode,
} from './demo-record';
import styles from './EventVocabulary.module.css';

/**
 * The event vocabulary, in two groups.
 *
 * The first group is the list the concept note gives, in the note's own order.
 * The second is the event types we added because the record needs them - rule 4
 * cannot be satisfied without a way to point at a wrong entry - and they are
 * marked as ours, not presented as settled.
 *
 * Where the note names an event but does not say what it covers, the row says
 * so instead of offering a definition we wrote ourselves.
 */
export default async function EventVocabulary() {
  const t = await getTranslations();

  const meaning = (code: RecordEventCode) =>
    EVENT_CODES_WITHOUT_A_DEFINITION.includes(code)
      ? t('record.vocabulary.notDefined')
      : t(`record.event.${code}Note`);

  const group = (codes: readonly RecordEventCode[], captionKey: string) => (
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
                {t(`record.event.${code}`)}
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
      {group(NOTED_EVENT_CODES, 'record.vocabulary.notedCaption')}

      <h3 className={styles.groupTitle}>
        {t('record.vocabulary.proposed')}{' '}
        <Badge tone="warning">{t('record.vocabulary.proposedBadge')}</Badge>
      </h3>
      <p className={styles.proposedNote}>{t('record.vocabulary.proposedNote')}</p>
      {group(PROPOSED_EVENT_CODES, 'record.vocabulary.proposedCaption')}
    </section>
  );
}
