import { getTranslations } from 'next-intl/server';
import { AUDIT, label } from '@/lib/auditor/labels';
import type { AuditGuard } from '@/lib/auditor/types';
import styles from './Auditor.module.css';

/**
 * "This role cannot change anything", and the proof.
 *
 * The sentence on its own is worth nothing, so the panel prints the result of
 * calling ci.assert_auditor_is_read_only() against this database, on this
 * request. That function reads information_schema and raises if sylva_auditor
 * holds any privilege other than SELECT on any table or column. The two beside
 * it are the other guarantees an auditor is relying on when reading a record
 * that claims to be permanent.
 *
 * A guard that FAILS is rendered loudly rather than hidden. It is the single
 * most important thing this page could say, and it is exactly the thing a
 * quietly-caught exception would bury.
 */
export default async function ReadOnlyNotice({ guards }: { guards: AuditGuard[] }) {
  const t = await getTranslations();
  const anyFailed = guards.some((g) => !g.ok);

  return (
    <section
      className={anyFailed ? `${styles.notice} ${styles.failure}` : styles.notice}
      aria-labelledby="auditor-read-only"
    >
      <h2 id="auditor-read-only" className={styles.noticeTitle}>
        {label(t, AUDIT.readOnlyTitle)}
      </h2>
      <p className={styles.noticeBody}>{label(t, AUDIT.readOnlyBody)}</p>

      {guards.length > 0 && (
        <>
          <p className={styles.noticeBody}>{label(t, AUDIT.readOnlyChecked)}</p>
          <ul className={styles.guards}>
            {guards.map((g) => (
              <li key={g.name} className={styles.guard}>
                <code className={styles.guardName}>ci.{g.name}()</code>
                <span className={g.ok ? styles.guardOk : styles.guardBad}>
                  {label(t, g.ok ? AUDIT.guardPassed : AUDIT.guardFailed)}
                </span>
                {!g.ok && g.detail && (
                  <span className={styles.guardDetail}>{g.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
