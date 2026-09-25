import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import { label, labelWith, ORGS } from '@/lib/admin/labels';
import type { OperatorOrganisation } from '@/lib/admin/organisations';
import { ROLE_KEY, STATE_TONE } from '@/lib/admin/types';
import type { VettingState } from '@/lib/vetting/types';
import styles from './AdminArea.module.css';

/**
 * Every organisation, the approval it holds, and where that approval came from.
 *
 * The two middle columns are side by side deliberately. An approval is NEVER
 * set: org.org_role_approval is a cache written only by the SECURITY DEFINER
 * trigger on org.vetting_decision, and ci.assert_approval_is_derived() fails the
 * build if any application role gains a privilege on it. So an approval with no
 * decision behind it, or a decision that has not produced the approval it
 * should have, is a fault - and putting the two next to each other is the only
 * way anybody would ever notice.
 *
 * R6 hangs off the left-hand one: no deal can be created for an organisation
 * with no approval, and the refusal is a trigger rather than a screen. An empty
 * approval cell is an organisation the database will refuse a deal to today.
 *
 * PEOPLE ARE COUNTED, NOT LISTED, and the count does not come from the table
 * holding personal data - identity.person_label carries a non-personal label per
 * person, which is all a count needs. Nothing on this page needs a person's
 * name, so no name is read.
 */
export default async function OrganisationTable({
  organisations,
}: {
  organisations: readonly OperatorOrganisation[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.mono}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );
  const roleName = (code: string) =>
    ROLE_KEY[code] && t.has(`adminVetting.role.${ROLE_KEY[code]}`)
      ? t(`adminVetting.role.${ROLE_KEY[code]}`)
      : code;
  const stateName = (s: string) =>
    t.has(`adminVetting.state.${s}`) ? t(`adminVetting.state.${s}`) : s;
  const tone = (s: string) => STATE_TONE[s as VettingState] ?? 'neutral';

  return (
    <div className="table-scroll">
      <table className={styles.wideOrgs}>
        <caption>{label(t, ORGS.caption)}</caption>
        <thead>
          <tr>
            <th scope="col">{label(t, ORGS.colOrg)}</th>
            <th scope="col">{label(t, ORGS.colCountry)}</th>
            <th scope="col">{label(t, ORGS.colClass)}</th>
            <th scope="col">{label(t, ORGS.colApprovals)}</th>
            <th scope="col">{label(t, ORGS.colDecisions)}</th>
            <th scope="col">{label(t, ORGS.colPeople)}</th>
          </tr>
        </thead>
        <tbody>
          {organisations.map((o) => (
            <tr key={o.orgId}>
              <th scope="row" className={styles.rowHead}>
                <span className={styles.strong}>{o.legalName}</span>
                {o.registrationNumber !== null && (
                  <span className={styles.sub}>{o.registrationNumber}</span>
                )}
                <span className={styles.sub}>
                  {labelWith(t, ORGS.applications, { count: o.applications })}
                </span>
                {o.openSubmissionId !== null && (
                  <span className={styles.sub}>
                    <Link
                      href={{
                        pathname: '/admin/vetting',
                        query: { application: o.openSubmissionId },
                      }}
                    >
                      {label(t, ORGS.decide)}
                      <span className="visually-hidden"> {o.legalName}</span>
                    </Link>
                  </span>
                )}
              </th>

              <td>{o.countryName}</td>

              <td>
                {o.sectorLabel}
                <span className={styles.sub}>{o.sizeBandLabel}</span>
              </td>

              {/* Read back from the decision chain by a trigger, never set. */}
              <td>
                {o.approvals.length === 0 ? (
                  <span className={styles.muted}>{label(t, ORGS.noApproval)}</span>
                ) : (
                  o.approvals.map((a) => (
                    <span key={a.roleCode} className={styles.sub}>
                      <Badge tone={tone(a.status)}>{stateName(a.status)}</Badge>{' '}
                      {roleName(a.roleCode)} · {day(a.updatedOn)}
                    </span>
                  ))
                )}
              </td>

              <td>
                {o.decisions.length === 0 ? (
                  <span className={styles.muted}>{label(t, ORGS.noDecision)}</span>
                ) : (
                  o.decisions.map((d) => (
                    <span key={d.decisionId} className={styles.sub}>
                      {day(d.decidedOn)} · {stateName(d.decision)} ·{' '}
                      {roleName(d.roleCode)}
                      {d.isCurrent && (
                        <span className={`${styles.tag} ${styles.tagPublic}`}>
                          {label(t, ORGS.decisionCurrent)}
                        </span>
                      )}
                      {d.reason !== null && <span className={styles.sub}>{d.reason}</span>}
                      <span className={styles.sub}>{d.decidedByName}</span>
                    </span>
                  ))
                )}
              </td>

              <td>{labelWith(t, ORGS.peopleCount, { count: o.people })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
