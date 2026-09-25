import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import ActorCell from '@/components/auditor/ActorCell';
import { getActor } from '@/lib/auth/session';
import { ACCESS, auditorErrorLabel, label } from '@/lib/auditor/labels';
import { logAuditorAccess, readAuditorAccessLog } from '@/lib/auditor/queries';
import type { AuditAccessLogRow } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: label(t, ACCESS.title), robots: { index: false, follow: false } };
}

/**
 * Who read what.
 *
 * The auditor's own reads are in here, including this one. That is deliberate:
 * a role that can read every private document on the platform should leave a
 * trace when it does, and an audit trail an auditor is exempt from is not one.
 *
 * Writing that line does not make this role writable. record.log_access is a
 * SECURITY DEFINER function; sylva_auditor holds EXECUTE on it and SELECT on
 * record.access_log, and no INSERT - ci.assert_auditor_is_read_only() fails if
 * it ever does. The log is append-only, so a line cannot be removed afterwards
 * either, by anybody.
 *
 * The role column carries a caveat rather than a value taken on trust. See
 * docs/FINDING-005: record.log_access fills actor_db_role from current_user
 * INSIDE a definer function, so on every row the platform has written so far
 * it names the function's owner rather than the caller. This view records the
 * real caller in the detail, evaluated in the caller's context, and prints
 * that where it exists.
 */
export default async function AuditorAccessLogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const actor = await getActor();

  // Logged BEFORE the read, so this visit appears in the table it renders.
  await logAuditorAccess(actor, 'auditor.accessLog');

  let rows: AuditAccessLogRow[] = [];
  let failure: unknown = null;
  try {
    rows = await readAuditorAccessLog(actor, 200);
  } catch (err) {
    console.error('[auditor] could not read the access log:', err);
    failure = err;
  }

  return (
    <section className={styles.section} aria-labelledby="auditor-access">
      <h1 id="auditor-access">{label(t, ACCESS.title)}</h1>
      <p className={styles.lead}>{label(t, ACCESS.lead)}</p>

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {label(t, auditorErrorLabel(failure))}
        </p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>{label(t, ACCESS.empty)}</p>
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{label(t, ACCESS.colWhen)}</th>
                <th scope="col">{label(t, ACCESS.colWho)}</th>
                <th scope="col">{label(t, ACCESS.colRole)}</th>
                <th scope="col">{label(t, ACCESS.colAction)}</th>
                <th scope="col">{label(t, ACCESS.colObject)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.entryNo}>
                  <td className={styles.nowrap}>
                    <time dateTime={r.at}>
                      {format.dateTime(new Date(r.at), 'short')}
                    </time>
                    <span className={styles.sub}>#{r.entryNo}</span>
                  </td>
                  <td><ActorCell actor={r.actor} /></td>
                  <td className={styles.mono}>
                    {r.callerRole ?? r.dbRole}
                    {r.callerRole === null && (
                      <span className={styles.sub}>
                        {/* Not translated: it names a file and a finding. */}
                        recorded as {r.dbRole} — see FINDING-005
                      </span>
                    )}
                  </td>
                  <td>{r.action}</td>
                  <td className={styles.small}>
                    {r.objectKind ?? '—'}
                    {r.objectId && <span className={styles.sub}>{r.objectId}</span>}
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
