import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { getActor } from '@/lib/auth/session';
import { auditorErrorLabel, label, labelWith, ORGS } from '@/lib/auditor/labels';
import { logAuditorAccess, readAuditorOrganisations } from '@/lib/auditor/queries';
import type { AuditOrganisation } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: label(t, ORGS.title), robots: { index: false, follow: false } };
}

/**
 * Organisations, their approvals, and the decisions those approvals come from.
 *
 * The two columns are worth reading together. org.org_role_approval is never
 * written by anybody: it is derived from a recorded org.vetting_decision by a
 * trigger. So an approval with no decision behind it, or a decision that has
 * not produced the approval it should have, is a finding - and putting them
 * side by side is the only way an auditor can see it.
 *
 * R6 hangs off this table: a deal cannot be created for an organisation that
 * has no approval, and the refusal is a trigger rather than a screen. An
 * organisation with an empty approvals cell is one the database will refuse a
 * deal to, today.
 *
 * Individual people are counted, not listed. The auditor may read
 * identity.user_account, but a page that prints every employee of every
 * organisation collects personal data into one screen for no stated purpose.
 * Where a person is relevant - who recorded an entry - they are named there.
 */
export default async function AuditorOrganisationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const actor = await getActor();

  let orgs: AuditOrganisation[] = [];
  let failure: unknown = null;
  try {
    orgs = await readAuditorOrganisations(actor);
  } catch (err) {
    console.error('[auditor] could not read the organisations:', err);
    failure = err;
  }
  await logAuditorAccess(actor, 'auditor.organisations');

  return (
    <section className={styles.section} aria-labelledby="auditor-orgs">
      <h2 id="auditor-orgs">{label(t, ORGS.title)}</h2>
      <p className={styles.lead}>{label(t, ORGS.lead)}</p>
      <p className={styles.small}>{label(t, ORGS.r6)}</p>

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {label(t, auditorErrorLabel(failure))}
        </p>
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{label(t, ORGS.colOrg)}</th>
                <th scope="col">{label(t, ORGS.colCountry)}</th>
                <th scope="col">{label(t, ORGS.colSector)}</th>
                <th scope="col">{label(t, ORGS.colApprovals)}</th>
                <th scope="col">{label(t, ORGS.colDecisions)}</th>
                <th scope="col">{label(t, ORGS.colPeople)}</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.legalName}
                    {o.registrationNumber && (
                      <span className={styles.sub}>{o.registrationNumber}</span>
                    )}
                  </td>
                  <td>{o.countryCode}</td>
                  <td className={styles.small}>
                    {o.sectorCode}
                    <span className={styles.sub}>{o.sizeBandCode}</span>
                  </td>
                  <td className={styles.small}>
                    {o.approvals.length === 0 ? (
                      <span className={`${styles.tag} ${styles.tagPrivate}`}>
                        {label(t, ORGS.noApproval)}
                      </span>
                    ) : (
                      o.approvals.map((a) => (
                        <span key={a.roleCode} className={styles.sub}>
                          {a.roleCode}: {a.status}
                        </span>
                      ))
                    )}
                  </td>
                  <td className={styles.small}>
                    {o.decisions.length === 0 ? (
                      <span className={styles.muted}>
                        {label(t, ORGS.noDecision)}
                      </span>
                    ) : (
                      o.decisions.map((d) => (
                        <span key={`${d.roleCode}-${d.decidedAt}`} className={styles.sub}>
                          {d.roleCode}: {d.decision} ·{' '}
                          {format.dateTime(new Date(d.decidedAt), 'short')}
                          {d.decidedByOrgName ? ` · ${d.decidedByOrgName}` : ''}
                          {d.reason ? ` — ${d.reason}` : ''}
                        </span>
                      ))
                    )}
                    <span className={styles.sub}>
                      {labelWith(t, ORGS.submissions, { count: o.submissionCount })}
                    </span>
                  </td>
                  <td className={styles.small}>
                    {labelWith(t, ORGS.peopleCount, { count: o.peopleCount })}
                    {o.erasureCount > 0 && (
                      <span className={styles.sub}>
                        {labelWith(t, ORGS.erasedCount, { count: o.erasureCount })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
