import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  GATE_KEY,
  GATE_SOURCE,
  gapsOf,
  recordedCount,
  type GateDetail,
  type ReviewRow,
} from './demo-projects';
import styles from './GateChecklist.module.css';

/**
 * The publication gate, item by item.
 *
 * A table, because the operator's question is "what is still missing", and the
 * answer is a list read down a column. The ten rows are the ten codes
 * `proj.publication_gaps()` returns, in that function's own order, and each row
 * prints that code beneath its label: an operator reading a refusal from the
 * database sees the same words there as here.
 *
 * The state cell is not a control. Nothing on this screen records or clears a
 * gate item - an item becomes recorded when the underlying information is
 * entered against the project, which happens on the project's own screens.
 *
 * State is never a tint alone: each cell carries the word "Recorded" or
 * "Missing", and the missing rows are also marked with a rule on the left for a
 * reader scanning the table rather than reading it.
 *
 * The last column says WHAT is recorded, in counts of rows - text fields,
 * geometries, claim rights, indicators, baselines, commitments, periods - or a
 * verifier's name, or a document version. There is no unit volume in this table
 * and there is none anywhere on this screen: the table above it lists projects
 * from different schemes, whose units measure different things and cannot share
 * a column (rule 7).
 */
export default async function GateChecklist({
  row,
  variant = 'panel',
  headingId,
}: {
  row: ReviewRow;
  variant?: 'panel' | 'compact';
  headingId?: string;
}) {
  const t = await getTranslations();
  const gaps = gapsOf(row);
  const recorded = recordedCount(row);
  const total = row.gate.length;
  const compact = variant === 'compact';

  const detailCell = (d: GateDetail) => {
    switch (d.kind) {
      case 'missing':
        return <span className={styles.nothing}>{t('adminProjects.gate.detail.nothing')}</span>;
      case 'count':
        return t(`adminProjects.gate.count.${d.countKey}`, { count: d.count });
      case 'name':
        return d.value;
      case 'version':
        return <span className={styles.mono}>{d.value}</span>;
    }
  };

  return (
    <section
      className={compact ? `${styles.wrap} ${styles.compact}` : styles.wrap}
      aria-labelledby={headingId}
    >
      {!compact && (
        <div className={styles.head}>
          <h3 id={headingId}>{t('adminProjects.gate.title')}</h3>
          <p className={styles.lead}>{t('adminProjects.gate.lead')}</p>
        </div>
      )}

      <div className={styles.summaryRow}>
        <p className={styles.summary}>
          {t('adminProjects.gate.summary', { recorded, total })}
        </p>
        {gaps.length > 0 ? (
          <Badge tone="warning">
            {t('adminProjects.gate.missingSummary', { count: gaps.length })}
          </Badge>
        ) : (
          <Badge tone="bio">{t('adminProjects.gate.complete')}</Badge>
        )}
      </div>

      <div className="table-scroll">
        <table>
          <caption>{t('adminProjects.gate.caption', { project: row.title })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('adminProjects.gate.colItem')}</th>
              {!compact && <th scope="col">{t('adminProjects.gate.colRequires')}</th>}
              <th scope="col">{t('adminProjects.gate.colState')}</th>
              <th scope="col">{t('adminProjects.gate.colDetail')}</th>
            </tr>
          </thead>
          <tbody>
            {row.gate.map((item) => {
              const key = GATE_KEY[item.code];
              return (
                <tr
                  key={item.code}
                  className={item.recorded ? undefined : styles.missingRow}
                >
                  <th scope="row" className={styles.itemCell}>
                    <span className={styles.itemLabel}>
                      {t(`adminProjects.gate.item.${key}.label`)}
                    </span>
                    <span className={styles.code}>
                      <span className="visually-hidden">
                        {t('adminProjects.gate.codeLabel')}:{' '}
                      </span>
                      {item.code}
                    </span>
                  </th>
                  {!compact && (
                    <td className={styles.requires}>
                      {t(`adminProjects.gate.item.${key}.requires`)}
                    </td>
                  )}
                  <td>
                    <Badge tone={item.recorded ? 'bio' : 'error'}>
                      {item.recorded
                        ? t('adminProjects.gate.state.recorded')
                        : t('adminProjects.gate.state.missing')}
                    </Badge>
                  </td>
                  <td className={styles.detail}>{detailCell(item.detail)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SourceStamp
        source={{
          label: t(GATE_SOURCE.labelKey),
          locator: GATE_SOURCE.locator,
          asOfDate: GATE_SOURCE.asOfDate,
        }}
      />

      {!compact && (
        <p className={styles.openDecision}>{t('adminProjects.openDecisionNote')}</p>
      )}
    </section>
  );
}
