import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { ownerText } from '@/lib/owner/messages';
import { reachesTheBuyer } from '@/lib/owner/steps';
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
 *
 * AND WHETHER A BUYER CAN ACTUALLY READ IT. The public project page admits text
 * at 'published' or 'reviewed' and nothing else. Everything recorded through
 * these forms used to go in at 'human_draft', so a complete-looking claim-rights
 * section reached the published page as a raw benefit key and three dashes -
 * directly under the heading that tells a buyer to read the exclusions column
 * first. The state is now stated as a WORD on every entry, so "recorded" and
 * "readable" cannot be confused again, and the sentence under a draft entry says
 * what to do about it.
 */
export default async function RecordedEntries({
  entries,
}: {
  entries: readonly RecordEntryView[];
}) {
  const t = await getTranslations();

  const hidden = entries.filter((e) => e.publicStatus !== null && !reachesTheBuyer(e.publicStatus));

  return (
    <div className={styles.recorded}>
      <p className={styles.recordedTitle}>{ownerText(t, 'alreadyRecorded')}</p>

      {entries.length === 0 ? (
        <p className={styles.empty}>{ownerText(t, 'nothingRecorded')}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => {
            const shown = reachesTheBuyer(e.publicStatus);
            return (
              <li key={e.key} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemLabel}>{e.label}</span>
                  <span className={styles.itemVersion}>
                    {ownerText(t, 'entryVersion')} {e.versionNo} {t('source.separator')}{' '}
                    {e.key}
                  </span>
                </div>
                {e.detail && <p className={styles.itemDetail}>{e.detail}</p>}

                {/* Never colour alone: the badge carries the sentence. */}
                {e.publicStatus !== null && (
                  <p className={styles.itemDetail}>
                    <Badge tone={shown ? 'bio' : 'warning'}>
                      {shown
                        ? ownerText(t, 'publicStateOn')
                        : ownerText(t, 'publicStateOff')}
                    </Badge>
                  </p>
                )}

                <SourceStamp
                  source={{
                    label: e.source.label,
                    locator: e.source.locator,
                    asOfDate: e.source.asOfDate,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {hidden.length > 0 && (
        <p className={styles.notReadable}>
          {ownerText(t, 'publicStateCount')}: {hidden.length}.{' '}
          {ownerText(t, 'publicStateOffNote')}
        </p>
      )}
    </div>
  );
}
