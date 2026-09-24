import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import BuyerParty from './BuyerParty';
import {
  DEAL_SHAPE_KEY,
  ownerProject,
  type DemoOwnerInterest,
} from './demo-owner';
import styles from './InterestQueue.module.css';

/**
 * Expressed interest awaiting the owner's response, longest wait first.
 *
 * A buyer that expresses interest opens a private room between that buyer and
 * the project (concept note section 7). Nothing is reserved and no volume is
 * agreed at that point, so this table has no volume column and no price column
 * - which is also what the database holds at stage 'interest_expressed'. The
 * note under the table says so, because an empty column would otherwise read as
 * missing data.
 *
 * RULE 7. There is no unit figure in this table at all, so there is nothing here
 * that could be added across the two projects it lists. Volumes stay inside each
 * project's availability table, beside their own unit type.
 *
 * FRONTEND PASS. The control in the last column is an inert type="button".
 */
export default async function InterestQueue({
  interest,
  locale,
}: {
  interest: readonly DemoOwnerInterest[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const rows = [...interest].sort((a, b) => b.daysWaiting - a.daysWaiting);

  if (rows.length === 0) {
    return <p className={styles.empty}>{t('owner.interest.empty')}</p>;
  }

  return (
    <div className={styles.queue}>
      <div className="table-scroll">
        <table>
          <caption>{t('owner.interest.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('owner.interest.project')}</th>
              <th scope="col">{t('owner.interest.buyer')}</th>
              <th scope="col">{t('owner.interest.shape')}</th>
              <th scope="col">{t('owner.interest.received')}</th>
              <th scope="col" className="num">
                {t('owner.interest.waiting')}
              </th>
              <th scope="col">{t('owner.interest.stage')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('owner.interest.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.rowHead}>
                  {ownerProject(row.projectId)?.name ??
                    t('owner.questions.unknownProject')}
                </th>
                <td>
                  <BuyerParty party={row.buyer} locale={locale} />
                </td>
                <td>{t(DEAL_SHAPE_KEY[row.shapeCode])}</td>
                <td>
                  <time dateTime={row.receivedOn}>
                    {format.dateTime(new Date(row.receivedOn), 'short')}
                  </time>
                </td>
                <td className={`num ${styles.waiting}`}>
                  {t('owner.interest.days', { days: row.daysWaiting })}
                </td>
                <td>
                  <Badge tone="neutral">{t(row.stageKey)}</Badge>
                </td>
                <td className={styles.actionCell}>
                  <button type="button" className={styles.action}>
                    {t('owner.interest.respond')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>{t('owner.interest.noVolumeNote')}</p>
      <p className={styles.note}>{t('owner.buyer.pseudonymNote')}</p>
    </div>
  );
}
