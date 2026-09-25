import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { Link } from '@/lib/i18n/routing';
import { investorText } from '@/lib/investor/messages';
import { shortRef } from '@/lib/record/queries';
import type { InvestorInterest } from '@/lib/investor/types';
import styles from './Investor.module.css';

/**
 * The interest entries in the transaction record that name this organisation.
 *
 * WHY THIS IS USUALLY EMPTY, AND WHY IT IS STILL A SECTION. Expressing interest
 * is a buyer's action in this release - it is what opens a private room about
 * taking a volume of units - and sylva_investor holds no INSERT on deal.deal at
 * all. So an investor account has nothing to add to this list. Hiding the
 * section would leave a reader to guess whether they had missed a control; the
 * empty state explains the refusal instead, which is what ROLES.md and
 * SIMULATION item 14 asked for on the page that used to offer an investor an
 * "Express interest" button leading only to "NOT A BUYER ACCOUNT".
 *
 * AN ENTRY THAT LED NOWHERE STAYS. record.entry is append-only (§8, rule 4), so
 * this is R4 on screen rather than in a comment.
 *
 * RULE 7: no volume column. This list spans projects, and a column of
 * quantities read one under another is exactly the comparison the rule forbids.
 * The unit each project issues is carried instead, as a name.
 *
 * NO DEAL COLUMN. deal.deal is not granted to sylva_investor, so a column read
 * from it would abort the transaction; an always-empty one would say "no deal"
 * when the truth is "not visible to you".
 */
export default async function InterestList({
  interests,
}: {
  interests: readonly InvestorInterest[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  if (interests.length === 0) {
    return (
      <section className={styles.panel} aria-labelledby="interests-empty">
        <div className={styles.panelHead}>
          <h2 id="interests-empty" className={styles.panelTitle}>
            {investorText(t, 'interestsWhoCanTitle')}
          </h2>
        </div>
        <p className={styles.panelBody}>{investorText(t, 'interestsEmpty')}</p>
        <p className={styles.panelBody}>{investorText(t, 'interestsWhoCan')}</p>
        <p className={styles.panelBody}>
          <Link href="/projects" className={styles.inlineLink}>
            {t('home.ctaExplore')}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption className={styles.caption}>
            {investorText(t, 'interestsCaption')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{investorText(t, 'interestsColExpressed')}</th>
              <th scope="col">{investorText(t, 'interestsColProject')}</th>
              <th scope="col">{investorText(t, 'interestsColUnit')}</th>
              <th scope="col">{investorText(t, 'interestsColEntry')}</th>
            </tr>
          </thead>
          <tbody>
            {interests.map((i) => (
              <tr key={i.publicId}>
                <td>
                  <time dateTime={i.expressedOn}>
                    {format.dateTime(new Date(i.expressedOn), 'short')}
                  </time>
                </td>
                <th scope="row">
                  <Link href={`/projects/${i.slug}`}>{i.projectTitle}</Link>
                </th>
                <td>
                  {i.schemeName ?? '—'}
                  {i.unitLabel === null ? null : <> · {i.unitLabel}</>}
                </td>
                <td>
                  {/* Shortened by the same function the public record uses, at
                      BOTH ends: the first block alone is identical across the
                      whole demo record and is not a reference at all. */}
                  <span className={styles.mono} title={i.publicId}>
                    {shortRef(i.publicId)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>{investorText(t, 'interestsNoVolume')}</p>
      <div className={styles.stampRow}>
        <SourceStamp
          source={{
            label: investorText(t, 'interestsSource'),
            locator: null,
            asOfDate: interests[0]!.expressedOn,
          }}
        />
      </div>
    </>
  );
}
