import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { label, ORGS } from '@/lib/admin/labels';
import type { ResolvedPseudonym } from '@/lib/admin/organisations';
import styles from './AdminArea.module.css';

/**
 * Resolving one pseudonym to one organisation.
 *
 * This is the capability the simulation found the operator did not have on any
 * screen: /record rendered byte-identically for a Sylva operator and for an
 * anonymous visitor, and /auditor/deals said of itself that a public row and a
 * named row "can be reconciled here and nowhere else". Operating the platform -
 * confirming a record, answering an audit query, deciding a dispute - needs the
 * mapping, and the operator is one of only two roles the database grants it to.
 *
 * SO THE PAGE SAYS WHY IT IS RESTRICTED, and the shape of the control is part
 * of the answer. ONE LABEL AT A TIME, asked for by hand. A table of every
 * allocation would turn a restricted capability into a bulk export of exactly
 * the mapping rule 5 exists to keep out of sight, and the labels and the names
 * would then be printed side by side on a screen - which is the one thing a
 * buyer is promised will not happen.
 *
 * Every lookup is written to the platform's access log. A restricted capability
 * that leaves no trace is one nobody can audit.
 *
 * A label nobody has been allocated returns nothing and says nothing was looked
 * up, rather than an empty table that reads like an answer.
 */
export default async function PseudonymLookup({
  asked,
  results,
  tooShort,
}: {
  asked: string | null;
  results: readonly ResolvedPseudonym[] | null;
  tooShort: boolean;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <section className={styles.section} aria-labelledby="resolve-title">
      <h2 id="resolve-title">{label(t, ORGS.resolveTitle)}</h2>
      <p className={styles.sectionLead}>{label(t, ORGS.resolveLead)}</p>
      <p className={`${styles.statement} ${styles.statementStrong}`}>
        {label(t, ORGS.resolveWhy)}
      </p>

      <form className={styles.filters} method="get" action="">
        <p className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="resolve-label">
            {label(t, ORGS.resolveField)}
          </label>
          <input
            className={styles.input}
            id="resolve-label"
            name="pseudonym"
            type="text"
            defaultValue={asked ?? ''}
            maxLength={120}
            autoComplete="off"
            aria-describedby="resolve-hint"
          />
        </p>
        <button className={styles.apply} type="submit">
          {label(t, ORGS.resolveSubmit)}
        </button>
        {asked !== null && (
          <Link className={styles.clear} href="/admin/organisations">
            {label(t, ORGS.resolveClear)}
          </Link>
        )}
      </form>
      <p id="resolve-hint" className={styles.help}>{label(t, ORGS.resolveHint)}</p>

      {tooShort && (
        <p className={styles.failure} role="alert">{label(t, ORGS.resolveTooShort)}</p>
      )}

      {results !== null && results.length === 0 && !tooShort && (
        <p className={styles.empty} role="status">{label(t, ORGS.resolveNone)}</p>
      )}

      {results !== null && results.length > 0 && (
        <>
          <h3>{label(t, ORGS.resolveResult)}</h3>
          <div className="table-scroll">
            <table>
              <caption>{label(t, ORGS.resolveCaption)}</caption>
              <thead>
                <tr>
                  <th scope="col">{label(t, ORGS.resolveColLabel)}</th>
                  <th scope="col">{label(t, ORGS.resolveColScope)}</th>
                  <th scope="col">{label(t, ORGS.resolveColProject)}</th>
                  <th scope="col">{label(t, ORGS.resolveColOrg)}</th>
                  <th scope="col">{label(t, ORGS.resolveColDisclosed)}</th>
                  <th scope="col">{label(t, ORGS.resolveColAllocated)}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.scope}-${r.projectSlug}-${r.label}`}>
                    <th scope="row" className={`${styles.rowHead} ${styles.mono}`}>
                      {r.label}
                    </th>
                    <td>
                      {label(
                        t,
                        r.scope === 'deal' ? ORGS.resolveScopeDeal : ORGS.resolveScopeProject,
                      )}
                    </td>
                    <td>
                      {r.projectTitle}
                      <span className={styles.sub}>{r.projectSlug}</span>
                    </td>
                    <td>
                      <span className={styles.strong}>{r.legalName}</span>
                      <span className={styles.sub}>{r.countryName}</span>
                    </td>
                    <td>
                      {r.disclosed === null
                        ? label(t, ORGS.resolveDisclosedNo)
                        : r.disclosed
                          ? label(t, ORGS.resolveDisclosedYes)
                          : label(t, ORGS.resolveDisclosedNo)}
                    </td>
                    <td>
                      <time dateTime={r.allocatedOn} className={styles.mono}>
                        {format.dateTime(new Date(r.allocatedOn), 'short')}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.small}>{label(t, ORGS.resolveLogged)}</p>
        </>
      )}
    </section>
  );
}
