import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { Link } from '@/lib/i18n/routing';
import { investorText } from '@/lib/investor/messages';
import type { InvestorStanding } from '@/lib/investor/types';
import styles from './Investor.module.css';

/**
 * Where this organisation stands with Sylva, and what that decides.
 *
 * FOUR STATES, and they are four different sentences rather than one sentence
 * with a word swapped: approved, with Sylva undecided, decided against, and
 * never applied. A reader who has been declined must not be shown the waiting
 * copy - SIMULATION item 7 is exactly that defect on another screen, where a
 * declined organisation was told the opposite of its decision twice.
 *
 * `vettedInvestor` comes from sylva.is_vetted_investor(), the SAME function the
 * row-level policy on proj.project_financials calls. It is what the badge says,
 * so the badge and the gate cannot disagree. The submission rows are used only
 * to distinguish "no decision yet" from "a decision was recorded and it was not
 * an approval" - never to re-derive approval, which R6 settles in the database.
 *
 * NO ESTIMATE OF WHEN. No target time for a decision is published anywhere, so
 * this panel does not invent one.
 */
export default async function StandingPanel({
  standing,
  showGateNote = true,
}: {
  standing: InvestorStanding;
  showGateNote?: boolean;
}) {
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');

  const investorRows = standing.submissions.filter((s) => s.roleCode === 'investor');
  const newest = investorRows[0] ?? null;

  const state: 'approved' | 'waiting' | 'declined' | 'none' = standing.vettedInvestor
    ? 'approved'
    : newest === null
      ? 'none'
      : newest.decision === null
        ? 'waiting'
        : 'declined';

  const body = investorText(
    t,
    state === 'approved'
      ? 'standingApproved'
      : state === 'waiting'
        ? 'standingWaiting'
        : state === 'declined'
          ? 'standingDeclined'
          : 'standingNone',
  );

  const badgeWord = tb(
    state === 'approved'
      ? 'vetting.state.approved'
      : state === 'waiting'
        ? 'vetting.state.submitted'
        : state === 'declined'
          ? 'vetting.state.declined'
          : 'vetting.state.none',
  );

  return (
    <section
      className={state === 'approved' ? styles.panel : `${styles.panel} ${styles.gate}`}
      aria-labelledby="investor-standing"
    >
      <div className={styles.panelHead}>
        <h2 id="investor-standing" className={styles.panelTitle}>
          {investorText(t, 'standingTitle')}
        </h2>
        {/* The word is the status. The tint repeats it; it never carries it. */}
        <Badge tone={state === 'approved' ? 'bio' : 'warning'}>{badgeWord}</Badge>
      </div>

      <p className={styles.panelBody}>{body}</p>

      {/* Why it is not a switch in this interface. Said on the approved state
          too: a reader who is approved should still know what released it. */}
      {showGateNote && <p className={styles.panelBody}>{investorText(t, 'standingGate')}</p>}

      {state !== 'approved' && (
        <p className={styles.panelBody}>
          <Link href="/vetting/status" className={styles.inlineLink}>
            {investorText(t, 'gateStatusLink')}
          </Link>
        </p>
      )}

      {/* The decision's own date, not today's. A figure with no source and no
          date is the defect SIMULATION item 11 records; a status is a figure. */}
      {newest !== null && (
        <div className={styles.stampRow}>
          <SourceStamp
            source={{
              label: investorText(t, 'standingSource'),
              locator: null,
              asOfDate: newest.decidedOn ?? newest.submittedOn,
            }}
          />
        </div>
      )}
    </section>
  );
}
