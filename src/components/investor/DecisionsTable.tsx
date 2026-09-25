import { getFormatter, getTranslations } from 'next-intl/server';
import { investorText } from '@/lib/investor/messages';
import type { InvestorSubmission } from '@/lib/investor/types';
import styles from './Investor.module.css';

/**
 * Every questionnaire this organisation has submitted and every decision
 * recorded against it.
 *
 * APPEND-ONLY, AND SHOWN THAT WAY. org.vetting_decision is append-only (R4): a
 * suspension after an approval does not erase the approval, and this table does
 * not either. So there are two columns where a simpler screen would have one -
 * the decision that was RECORDED, and whether it is the one in force now - and
 * where they differ the reader can see both instead of being handed a single
 * word that quietly picks one.
 *
 * "In force now" is sylva.is_vetted() for that submission's role and
 * organisation - the trigger-maintained approval cache that R6 itself consults.
 * It is not re-derived from the decision text here, because a second
 * implementation in TypeScript is a second thing that can disagree with the
 * database.
 *
 * THE REASON IS THE OPERATOR'S OWN WORDS. Free text from org.vetting_decision,
 * never a translatable string, and printed as recorded: a decision an
 * organisation cannot read the reasons for is not a decision it can answer.
 *
 * ALL ROLES, not only the investor one. An organisation may have applied as more
 * than one thing and the answers can differ; showing the investor row alone
 * would be picking the one that suits the area the reader happens to be in.
 *
 * Status is a word in a cell. No colour carries it.
 */
export default async function DecisionsTable({
  submissions,
}: {
  submissions: readonly InvestorSubmission[];
}) {
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');
  const format = await getFormatter();

  if (submissions.length === 0) {
    return (
      <>
        <p className={styles.sectionIntro}>{investorText(t, 'decisionsEmpty')}</p>
        <p className={styles.note}>{investorText(t, 'decisionsNoEta')}</p>
      </>
    );
  }

  const roleWord = (code: string) =>
    t.has(`workspace.role.${code}`) ? t(`workspace.role.${code}`) : code;

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption className={styles.caption}>
            {investorText(t, 'decisionsCaption')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{investorText(t, 'decisionsColRole')}</th>
              <th scope="col">{investorText(t, 'decisionsColSubmitted')}</th>
              <th scope="col">{investorText(t, 'decisionsColDecided')}</th>
              <th scope="col">{investorText(t, 'decisionsColDecision')}</th>
              <th scope="col">{investorText(t, 'decisionsColEffective')}</th>
              <th scope="col">{investorText(t, 'decisionsColReason')}</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, index) => (
              <tr key={`${s.roleCode}-${s.submittedOn}-${index}`}>
                <th scope="row">{roleWord(s.roleCode)}</th>
                <td>
                  <time dateTime={s.submittedOn}>
                    {format.dateTime(new Date(s.submittedOn), 'short')}
                  </time>
                </td>
                <td>
                  {s.decidedOn === null ? (
                    <span className={styles.quiet}>{tb('vetting.notDecided')}</span>
                  ) : (
                    <time dateTime={s.decidedOn}>
                      {format.dateTime(new Date(s.decidedOn), 'short')}
                    </time>
                  )}
                </td>
                {/* The recorded decision, as the database spells it. Not mapped
                    onto a three-word vocabulary: 'suspended' and 'revoked' are
                    distinct facts and flattening either into "Declined" would
                    misreport the chain. */}
                <td>
                  {s.decision === null ? (
                    <span className={styles.quiet}>
                      {investorText(t, 'decisionsNotDecided')}
                    </span>
                  ) : (
                    <span className={styles.mono}>{s.decision}</span>
                  )}
                </td>
                <td>
                  {s.approvedNow
                    ? investorText(t, 'decisionsInForce')
                    : investorText(t, 'decisionsNotInForce')}
                </td>
                <td>
                  {s.reason ?? (
                    <span className={styles.quiet}>
                      {investorText(t, 'decisionsNoReason')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>{investorText(t, 'decisionsRawNote')}</p>
      <p className={styles.note}>{investorText(t, 'decisionsBy')}</p>
      <p className={styles.note}>{investorText(t, 'decisionsNoEta')}</p>
    </>
  );
}
