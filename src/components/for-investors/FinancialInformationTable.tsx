import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import styles from './FinancialInformationTable.module.css';

export type Visibility = 'public' | 'vetted';

export interface FinancialInfoRow {
  id: string;
  /** Key for the name of the item, e.g. "Financing need". */
  nameKey: string;
  /** Key for a plain description of what the item contains. */
  containsKey: string;
  /** Key naming who supplies it. */
  providedByKey: string;
  visibility: Visibility;
}

/**
 * What a project holds, and who can read each part of it.
 *
 * There are no values in this table, only the names of things. The three
 * financial items named in the concept note (financing need, revenue streams,
 * financial model) are listed beside the public material so the line between
 * the two is visible in one read, rather than being discovered by clicking.
 */
export default async function FinancialInformationTable({
  rows,
}: {
  rows: readonly FinancialInfoRow[];
}) {
  const t = await getTranslations('forInvestors');

  return (
    <div className="table-scroll">
      <table className={styles.table}>
        <caption>{t('information.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('information.col.item')}</th>
            <th scope="col">{t('information.col.contains')}</th>
            <th scope="col">{t('information.col.providedBy')}</th>
            <th scope="col">{t('information.col.visibility')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.visibility === 'vetted' ? styles.restrictedRow : ''}>
              <th scope="row" className={styles.rowHead}>
                {t(row.nameKey)}
              </th>
              <td className={styles.contains}>{t(row.containsKey)}</td>
              <td className={styles.providedBy}>{t(row.providedByKey)}</td>
              <td>
                {/* Never colour alone: the badge carries the word. */}
                <Badge tone={row.visibility === 'vetted' ? 'warning' : 'neutral'}>
                  {t(`visibility.${row.visibility}`)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
