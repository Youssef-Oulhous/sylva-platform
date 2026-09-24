import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { DERIVATION_ROWS, STATE_TONE, type PermitValue } from './demo-queue';
import styles from './DecisionModel.module.css';

/**
 * What this screen is actually for.
 *
 * An operator does not set an organisation's approval state. It records a
 * decision - approve, decline or suspend - with a reason, and the state is read
 * back from the entries recorded against the application. There is no approval
 * field on this screen, in the demo data, or in the shape the data layer will
 * fill: `QueueRow` carries a log and no status, and `deriveState()` is the only
 * way a state is produced.
 *
 * The reason that matters here rather than only in a schema: the record is
 * append-only (concept note section 8, rule 4), so a decision that could be
 * edited in place would be a hole in the record, and an approval flag that
 * could be flipped without an entry would be a deal permitted with nothing to
 * show for it (rule 6).
 *
 * The table is the argument, stated as data so it can be read in ten seconds
 * rather than inferred from three paragraphs.
 *
 * RULE J. The concept note settles approval and decline. It does not say what a
 * suspension does to deals already agreed, so that cell reads "not settled"
 * and the open question is printed under the table instead of being answered.
 */
export default async function DecisionModel() {
  const t = await getTranslations();

  const permit = (value: PermitValue) => {
    if (value === 'yes') return <span className={styles.yes}>{t('adminVetting.permit.yes')}</span>;
    if (value === 'no') return <span className={styles.no}>{t('adminVetting.permit.no')}</span>;
    return <span className={styles.notSet}>{t('adminVetting.permit.notSet')}</span>;
  };

  return (
    <section className={styles.wrap} aria-labelledby="model-title">
      <h2 id="model-title">{t('adminVetting.model.title')}</h2>

      <div className={styles.statements}>
        <p className={styles.statement}>{t('adminVetting.model.recorded')}</p>
        <p className={styles.statement}>{t('adminVetting.model.derived')}</p>
        <p className={styles.statement}>{t('adminVetting.model.corrected')}</p>
      </div>

      <div className="table-scroll">
        <table>
          <caption>{t('adminVetting.model.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('adminVetting.col.recordedEntry')}</th>
              <th scope="col">{t('adminVetting.col.derivedState')}</th>
              <th scope="col">{t('adminVetting.col.mayDeal')}</th>
              <th scope="col">{t('adminVetting.col.effect')}</th>
            </tr>
          </thead>
          <tbody>
            {DERIVATION_ROWS.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.entryCell}>
                  {t(`adminVetting.entry.${row.entryKey}`)}
                </th>
                <td>
                  {row.state === 'recomputed' ? (
                    <span className={styles.recomputed}>
                      {t('adminVetting.model.recomputedState')}
                    </span>
                  ) : (
                    <Badge tone={STATE_TONE[row.state]}>
                      {t(`adminVetting.state.${row.state}`)}
                    </Badge>
                  )}
                </td>
                <td>{permit(row.mayDeal)}</td>
                <td className={styles.effectCell}>
                  {t(`adminVetting.derivation.${row.noteKey}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.gate}>{t('adminVetting.model.gate')}</p>

      {/* Two things the pilot material does not settle, left unsettled. */}
      <div className={styles.open}>
        <h3 className={styles.openTitle}>{t('adminVetting.model.openTitle')}</h3>
        <ul className={styles.openList}>
          <li>{t('adminVetting.model.openSuspension')}</li>
          <li>{t('adminVetting.model.openReason')}</li>
        </ul>
      </div>

      <SourceStamp
        source={{
          label: t('adminVetting.model.sourceLabel'),
          locator: t('adminVetting.model.sourceLocator'),
          asOfDate: '2026-09-22',
        }}
      />
    </section>
  );
}
