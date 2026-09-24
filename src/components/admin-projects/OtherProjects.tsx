import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import GateChecklist from './GateChecklist';
import { STATUS_TONE, recordedCount, type AdminProject } from '@/lib/admin/types';
import styles from './OtherProjects.module.css';

/**
 * The gate list for every other project, without leaving the page.
 *
 * Native <details>: an operator comparing two projects' gaps should not have to
 * load a page to see the second one, and a disclosure gives that without a line
 * of client-side JavaScript. Each disclosure is closed by default, so the page
 * still reads as a queue rather than as ten checklists.
 *
 * Each project's items are its own. Nothing here is aggregated across projects -
 * not the items, and certainly not any volume (rule 7). The only figures are the
 * count of items recorded out of ten and the count of items missing, both
 * labelled.
 */
export default async function OtherProjects({ rows }: { rows: readonly AdminProject[] }) {
  const t = await getTranslations();

  if (rows.length === 0) return null;

  return (
    <section className={styles.wrap} aria-labelledby="others-title">
      <div className={styles.head}>
        <h2 id="others-title">{t('adminProjects.others.title')}</h2>
        <p className={styles.lead}>{t('adminProjects.others.lead')}</p>
      </div>

      <div className={styles.list}>
        {rows.map((row) => {
          const recorded = recordedCount(row);
          return (
            <details key={row.id} className={styles.item}>
              <summary className={styles.summary}>
                <span className={styles.summaryTitle}>{row.title}</span>
                <span className={styles.summaryBadges}>
                  <Badge tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>
                  {row.gaps.length > 0 ? (
                    <Badge tone="warning">
                      {t('adminProjects.gate.missingSummary', { count: row.gaps.length })}
                    </Badge>
                  ) : (
                    <Badge tone="bio">{t('adminProjects.gate.complete')}</Badge>
                  )}
                </span>
                <span className={styles.summaryMeta}>
                  {t('adminProjects.gate.summary', { recorded, total: row.gate.length })}
                  {' · '}
                  {row.unitLabel ?? t('adminProjects.unit.notRecorded')}
                </span>
              </summary>

              <div className={styles.body}>
                <p className={styles.statement}>
                  {row.gaps.length > 0
                    ? t('adminProjects.others.blocked', { count: row.gaps.length })
                    : t('adminProjects.others.complete')}
                </p>
                <GateChecklist project={row} variant="compact" />
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
