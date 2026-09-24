import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { ownerText } from '@/lib/owner/messages';
import type { RecordEntryView } from '@/lib/owner/types';
import styles from './RecordForm.module.css';

/**
 * What is already on the record for one section.
 *
 * Shown above the form that adds to it, because an owner about to record an
 * outcome needs to see which outcomes are already there - recording the same
 * reference again appends a new version rather than a second entry, and that is
 * only predictable if the existing references are visible.
 *
 * Each entry carries its source stamp. These are the rows a buyer will read, so
 * the provenance is shown here exactly as it will be shown there.
 */
export default async function RecordedEntries({
  entries,
}: {
  entries: readonly RecordEntryView[];
}) {
  const t = await getTranslations();

  return (
    <div className={styles.recorded}>
      <p className={styles.recordedTitle}>{ownerText(t, 'alreadyRecorded')}</p>

      {entries.length === 0 ? (
        <p className={styles.empty}>{ownerText(t, 'nothingRecorded')}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => (
            <li key={e.key} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemLabel}>{e.label}</span>
                <span className={styles.itemVersion}>
                  {ownerText(t, 'entryVersion')} {e.versionNo} {t('source.separator')}{' '}
                  {e.key}
                </span>
              </div>
              {e.detail && <p className={styles.itemDetail}>{e.detail}</p>}
              <SourceStamp
                source={{
                  label: e.source.label,
                  locator: e.source.locator,
                  asOfDate: e.source.asOfDate,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
