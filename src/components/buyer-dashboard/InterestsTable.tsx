import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import EmptyState from './EmptyState';
import type { ExpressedInterest } from './types';
import styles from './InterestsTable.module.css';

/**
 * Every interest this organisation has expressed, newest first.
 *
 * RULE 7. This table carries no volume column, and that is a design decision
 * rather than an omission. Three projects in three schemes listed one under
 * another is precisely where a column of figures gets read as a ranking, and
 * the figures would not be comparable: one project issues hectare-years,
 * another issues points on an index. What the table shows instead is the unit
 * each project issues, which is the fact that makes the comparison improper.
 * Volumes appear further down the page, one project at a time.
 *
 * A closed interest stays in the table. The record is append-only (concept
 * note, §8, rule 4), so an interest that led nowhere is history, not clutter,
 * and hiding it here would misrepresent what the public record holds.
 */
export default async function InterestsTable({
  interests,
}: {
  interests: readonly ExpressedInterest[];
}) {
  const t = await getTranslations('buyerDashboard');
  const tRoot = await getTranslations();
  const format = await getFormatter();

  if (interests.length === 0) {
    return (
      <EmptyState
        title={t('interests.empty.title')}
        body={t('interests.empty.body')}
        action={
          <Link href="/projects" className={styles.emptyLink}>
            {tRoot('home.ctaExplore')}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption className={styles.caption}>{t('interests.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('interests.col.expressedOn')}</th>
              <th scope="col">{t('interests.col.project')}</th>
              <th scope="col">{t('interests.col.units')}</th>
              <th scope="col">{t('interests.col.state')}</th>
              <th scope="col">{t('interests.col.recordRef')}</th>
              <th scope="col">{t('interests.col.nextStep')}</th>
            </tr>
          </thead>
          <tbody>
            {interests.map((interest) => (
              <tr key={interest.id} className={interest.state === 'closed' ? styles.closedRow : undefined}>
                <td className={styles.dateCell}>
                  <time dateTime={interest.expressedOn}>
                    {format.dateTime(new Date(interest.expressedOn), 'short')}
                  </time>
                </td>

                <th scope="row" className={styles.rowHead}>
                  <Link href={`/projects/${interest.projectSlug}`}>{interest.projectName}</Link>
                </th>

                {/* The unit travels with the project, everywhere on this page. */}
                <td className={styles.unitsCell}>
                  <span className={styles.scheme}>{interest.schemeName}</span>
                  <span className={styles.unit}>{t(interest.unitLabelKey)}</span>
                </td>

                {/* Status is a word. There is no colour here carrying meaning
                    on its own, and no icon standing in for one. */}
                <td className={styles.stateCell}>{t(`interests.state.${interest.state}`)}</td>

                <td className={styles.refCell}>
                  <span className={styles.mono}>{interest.recordRef}</span>
                </td>

                <td className={styles.actionCell}>
                  {interest.state === 'dealOpen' && interest.dealRef !== null ? (
                    <button
                      type="button"
                      className={styles.action}
                      aria-label={t('interests.openDealRoomFor', {
                        project: interest.projectName,
                      })}
                    >
                      {t('interests.openDealRoom')}
                    </button>
                  ) : interest.state === 'recorded' ? (
                    <span className={styles.waiting}>{t('interests.awaitingOwner')}</span>
                  ) : (
                    <span className={styles.waiting}>{t('interests.closedNote')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.noVolumes}>{t('interests.noVolumes')}</p>
    </>
  );
}
