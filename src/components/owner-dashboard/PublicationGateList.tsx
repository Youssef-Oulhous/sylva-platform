import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  GATE_ITEM_KEY,
  PUBLICATION_GATE_CODES,
  type PublicationGateCode,
} from '@/lib/owner/types';
import styles from './PublicationGateList.module.css';

/**
 * What is still blocking publication, for one project.
 *
 * The list is the list the database checks. `gaps` is the array
 * proj.publication_gaps() returned for this project a moment ago - not a copy
 * of its logic - and the trigger on proj.project refuses the change to
 * 'published' while that array is not empty. Rendering the same ten codes in
 * the same order is the point: an owner is never told a project is ready while
 * the database would decline to publish it.
 *
 * What is missing is expanded, because it is the thing the owner came to read.
 * What is already recorded is folded into a native <details> - present, but not
 * competing for attention, and no client component to open it.
 *
 * State is never carried by colour alone: every row states "Missing" or
 * "Recorded" as a word.
 */
export default async function PublicationGateList({
  gaps,
  checkedOn,
  isPublished,
}: {
  gaps: readonly PublicationGateCode[];
  /** ISO date the gate was last evaluated. */
  checkedOn: string;
  isPublished: boolean;
}) {
  const t = await getTranslations();

  const missing = PUBLICATION_GATE_CODES.filter((code) => gaps.includes(code));
  const recorded = PUBLICATION_GATE_CODES.filter((code) => !gaps.includes(code));

  const row = (code: PublicationGateCode, state: 'missing' | 'recorded') => (
    <li key={code} className={styles.item}>
      <span className={styles.state}>
        <Badge tone={state === 'missing' ? 'warning' : 'neutral'}>
          {state === 'missing' ? t('owner.gate.missing') : t('owner.gate.recorded')}
        </Badge>
      </span>
      <span className={styles.body}>
        <span className={styles.itemLabel}>
          {t(`owner.gate.item.${GATE_ITEM_KEY[code]}.label`)}
        </span>
        <span className={styles.itemNote}>
          {t(`owner.gate.item.${GATE_ITEM_KEY[code]}.note`)}
        </span>
      </span>
    </li>
  );

  return (
    <div className={styles.gate}>
      <p className={styles.headline}>
        {missing.length === 0
          ? t('owner.gate.complete')
          : t('owner.gate.blocking', { count: missing.length })}
      </p>

      {missing.length > 0 && (
        <ul className={styles.list}>{missing.map((code) => row(code, 'missing'))}</ul>
      )}

      <details className={styles.recorded}>
        <summary className={styles.recordedSummary}>
          {t('owner.gate.recordedSummary', {
            count: recorded.length,
            total: PUBLICATION_GATE_CODES.length,
          })}
        </summary>
        <ul className={styles.list}>{recorded.map((code) => row(code, 'recorded'))}</ul>
      </details>

      <p className={styles.rule}>
        {isPublished ? t('owner.gate.publishedNote') : t('owner.gate.openDecision')}
      </p>

      <SourceStamp
        source={{ label: t('owner.gate.source'), locator: null, asOfDate: checkedOn }}
      />
    </div>
  );
}
