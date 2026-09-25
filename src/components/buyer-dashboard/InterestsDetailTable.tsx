import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import EmptyState from './EmptyState';
import { buyerText, dealShapeLabel, dealStageLabel } from '@/lib/dashboard/messages';
import { shortRef } from '@/lib/record/queries';
import type { BuyerInterest } from '@/lib/dashboard/types';
import styles from './InterestsDetailTable.module.css';

/**
 * Every interest this organisation has expressed, with what became of it.
 *
 * The buyer area used to carry a shorter version of this table halfway down one
 * long page. It now has a page of its own, and it says the things a buyer
 * actually came to find out: which project, when, what shape of deal was
 * intended, how far it has got, and - the question nobody could answer before -
 * what name the public record is carrying for them on it.
 *
 * RULE 7. No volume column, and that is a decision twice over. First, this is
 * the one list on the platform that spans several projects, and a column of
 * figures listed one under another is read as a ranking of things that are not
 * comparable: one project issues hectare-years, another issues points on an
 * index. What the table shows instead is the unit each project issues, which is
 * the fact that makes the comparison improper. Second, a deal DOES carry
 * volumes, in deal.interest_volume, and joining them in here would have been the
 * obvious thing to do. They are deliberately left on the project's own page,
 * where the unit label can stand beside the figure.
 *
 * A CLOSED INTEREST STAYS. record.entry is append-only (concept note §8, rule
 * 4), so an interest that led nowhere is history rather than clutter, and the
 * stage column says how it ended.
 *
 * THE PSEUDONYM IS ALLOCATED TWICE, and the table distinguishes them, because a
 * buyer who cannot tell the two apart cannot check R5 against their own record.
 * A label is allocated per PROJECT for the interest entry, and a second one per
 * DEAL, so that neither two of an organisation's projects nor two of its deals
 * can be linked to each other through it. Where the organisation has chosen to
 * be named on a deal, the cell says so instead - that choice is per deal too.
 *
 * NOTHING HERE IS A CONTROL. The deal room is not open to buyers in this
 * release, so the stage is stated rather than offered as a link into a room that
 * does not exist. Status is a word, never a colour on its own.
 */
export default async function InterestsDetailTable({
  interests,
}: {
  interests: readonly BuyerInterest[];
}) {
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');
  const format = await getFormatter();

  if (interests.length === 0) {
    return (
      <EmptyState
        title={tb('interests.empty.title')}
        body={tb('interests.empty.body')}
        action={
          <Link href="/projects" className={styles.emptyLink}>
            {t('home.ctaExplore')}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption className={styles.caption}>
            {buyerText(t, 'interestsCaption')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{tb('interests.col.expressedOn')}</th>
              <th scope="col">{tb('interests.col.project')}</th>
              <th scope="col">{tb('interests.col.units')}</th>
              <th scope="col">{buyerText(t, 'colShape')}</th>
              <th scope="col">{buyerText(t, 'colStage')}</th>
              <th scope="col">{buyerText(t, 'colPseudonym')}</th>
              <th scope="col">{tb('interests.col.recordRef')}</th>
            </tr>
          </thead>
          <tbody>
            {interests.map((interest) => {
              const deal = interest.deal;
              const shape =
                deal === null
                  ? null
                  : dealShapeLabel(t, deal.shapeCode, deal.shapeLabelEn)
                    ?? buyerText(t, 'shapeNotSet');

              return (
                <tr key={interest.publicId}>
                  <td className={styles.dateCell}>
                    <time dateTime={interest.expressedOn}>
                      {format.dateTime(new Date(interest.expressedOn), 'short')}
                    </time>
                  </td>

                  <th scope="row" className={styles.rowHead}>
                    <Link href={`/projects/${interest.slug}`}>
                      {interest.projectTitle}
                    </Link>
                  </th>

                  {/* The unit travels with the project, everywhere in the buyer
                      area. A NAME, never a quantity. */}
                  <td className={styles.unitsCell}>
                    <span className={styles.scheme}>{interest.schemeName ?? '—'}</span>
                    <span className={styles.unit}>{interest.unitLabel ?? ''}</span>
                  </td>

                  <td className={styles.shapeCell}>
                    {shape ?? <span className={styles.quiet}>—</span>}
                  </td>

                  {/* A word, and the word is the whole status. */}
                  <td className={styles.stageCell}>
                    {deal === null ? (
                      <span className={styles.quiet}>{buyerText(t, 'noDealYet')}</span>
                    ) : (
                      <>
                        <span className={styles.stage}>
                          {dealStageLabel(t, deal.stageCode, deal.stageLabelEn)}
                        </span>
                        <span className={styles.since}>
                          {tb('deals.openedOn')}{' '}
                          <time dateTime={deal.openedOn}>
                            {format.dateTime(new Date(deal.openedOn), 'short')}
                          </time>
                        </span>
                      </>
                    )}
                  </td>

                  {/* Which of the two allocations this is, said in words. */}
                  <td className={styles.pseudonymCell}>
                    {deal?.disclosed === true ? (
                      <span className={styles.named}>{buyerText(t, 'namedOnDeal')}</span>
                    ) : deal?.pseudonym ? (
                      <>
                        <span className={styles.label}>{deal.pseudonym}</span>
                        <span className={styles.scopeNote}>
                          {buyerText(t, 'pseudonymPerDeal')}
                        </span>
                      </>
                    ) : interest.projectLabel !== null ? (
                      <>
                        <span className={styles.label}>{interest.projectLabel}</span>
                        <span className={styles.scopeNote}>
                          {buyerText(t, 'pseudonymPerProject')}
                        </span>
                      </>
                    ) : (
                      <span className={styles.quiet}>
                        {buyerText(t, 'pseudonymNone')}
                      </span>
                    )}
                  </td>

                  <td className={styles.refCell}>
                    {/* The reference the public record shows, shortened by the
                        SAME function the public record uses - BOTH ends, not the
                        first block. The first block alone printed "ec000000" for
                        every row of the demo record, which is not a reference at
                        all. The whole value is on the title for copying. */}
                    <span className={styles.mono} title={interest.publicId}>
                      {shortRef(interest.publicId)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Not buyerDashboard.interests.noVolumes: that sentence ended "volumes
          appear further down the page", which was true when this table was one
          section of a long page and is not true now that it is the page. */}
      <p className={styles.note}>{buyerText(t, 'noVolumesNote')}</p>
      <p className={styles.note}>{buyerText(t, 'pseudonymNote')}</p>
      <p className={styles.note}>{buyerText(t, 'interestsDealNote')}</p>
    </>
  );
}
