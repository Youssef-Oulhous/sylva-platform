import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { ownerText } from '@/lib/owner/messages';
import type { OwnerInterest } from '@/lib/owner/types';
import BuyerParty from './BuyerParty';
import styles from './InterestQueue.module.css';

/**
 * Live deals on this organisation's projects, longest wait first.
 *
 * A buyer that expresses interest opens a private room between that buyer and
 * the project (concept note section 7). Nothing is reserved and no volume is
 * agreed at that point, so this table has no volume column and no price column
 * - which is also what the database holds at stage 'interest_expressed'. The
 * note under the table says so, because an empty column would otherwise read as
 * missing data.
 *
 * RULE 7. There is no unit figure in this table at all, so there is nothing
 * here that could be added across the projects it lists. Volumes stay inside
 * each project's availability table, beside their own unit type.
 *
 * The stage and the deal shape are printed with the labels the database holds
 * for them, so a stage added to deal.deal_stage later appears here without a
 * new translation key and without a code leaking onto the screen.
 */
export default async function InterestQueue({
  interest,
  locale,
}: {
  interest: readonly OwnerInterest[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const rows = interest.slice().sort((a, b) => b.daysWaiting - a.daysWaiting);

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
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.rowHead}>{row.projectTitle}</th>
                <td>
                  <BuyerParty party={row.buyer} locale={locale} />
                </td>
                <td>{row.shapeLabel ?? ownerText(t, 'notStated')}</td>
                <td>
                  <time dateTime={row.receivedOn}>
                    {format.dateTime(new Date(row.receivedOn), 'short')}
                  </time>
                </td>
                <td className={`num ${styles.waiting}`}>
                  {t('owner.interest.days', { days: row.daysWaiting })}
                </td>
                <td>
                  <Badge tone="neutral">{row.stageLabel}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>{t('owner.interest.noVolumeNote')}</p>
      <p className={styles.note}>{ownerText(t, 'partyLabelNote')}</p>
    </div>
  );
}
