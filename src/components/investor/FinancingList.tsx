import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { Link } from '@/lib/i18n/routing';
import { investorText, investorTextWith } from '@/lib/investor/messages';
import type { FinancingProject } from '@/lib/investor/types';
import styles from './Investor.module.css';

/**
 * The projects that have filed financing information.
 *
 * A BLOCK PER PROJECT, NOT A TABLE. A project's statement of its revenue
 * streams runs to a paragraph, and a table of paragraphs is unreadable at
 * 375px. More than that: a column of financing needs listed one under another
 * is read as a ranking of comparable things, and these are two separate
 * conversations about two projects issuing units of different schemes. Blocks
 * put each figure inside the project that stated it.
 *
 * NO TOTAL, AND NO ROW THAT COULD HOLD ONE. Rule 7 is about unit volumes and a
 * financing need is money, so the rule does not strictly reach it - but a
 * platform-wide sum of what unrelated projects are seeking would be a figure no
 * source stamp could cover, and the page says so rather than relying on nobody
 * asking for it. The scheme and the unit LABEL are printed beside each project
 * because that is the fact that makes two projects incomparable; no quantity of
 * units appears anywhere on this page.
 *
 * NO RETURN, ANYWHERE. Financing need, currency, revenue streams and the
 * model's date are the whole of what is shown, because they are the whole of
 * what proj.project_financials holds. There is no derived figure on this page at
 * all - nothing is divided by anything - so there is no place a yield or a
 * multiple could appear even by accident.
 *
 * THE MODEL HAS THREE STATES and they are three different sentences: no model
 * filed, a model filed and readable, and a model filed that doc.document's own
 * policy did not release to this viewer. The third is not shown as the first.
 */
export default async function FinancingList({
  projects,
  locale,
}: {
  projects: readonly FinancingProject[];
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryName = (code: string) => {
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  if (projects.length === 0) return null;

  return (
    <>
      {projects.map((p) => {
        const need =
          p.financingNeed !== null && p.currency !== null
            ? format.number(p.financingNeed, { style: 'currency', currency: p.currency })
            : null;

        const headingId = `financing-${p.slug}`;

        return (
          <article key={p.projectId} className={styles.project} aria-labelledby={headingId}>
            <div className={styles.projectHead}>
              <h3 id={headingId} className={styles.projectTitle}>
                {p.title}
              </h3>
              <span className={styles.quiet}>
                {investorTextWith(t, 'projectsVersion', { version: p.versionNo })}
              </span>
            </div>

            {/* The unit this project issues travels with it everywhere in this
                area. A NAME, never a quantity. */}
            <p className={styles.projectMeta}>
              <span>
                {investorText(t, 'projectsOwner')}: {p.ownerOrgName}
              </span>
              <span>
                {t('projects.filters.country')}: {countryName(p.countryCode)}
              </span>
              {p.schemeName !== null && (
                <span>
                  {investorText(t, 'projectsUnit')}: {p.unitLabel ?? '—'}
                  {' · '}
                  {p.schemeName}
                </span>
              )}
              {/* The date the PROJECT states its figures are as at, which is
                  proj.project_financials.as_of_date and not the date the source
                  document carries. Both are printed - the stamp below holds the
                  second - because they are two different facts and can differ. */}
              <span>
                {investorText(t, 'projectsAsOf')}{' '}
                <time dateTime={p.asOfDate}>
                  {format.dateTime(new Date(p.asOfDate), 'short')}
                </time>
              </span>
            </p>

            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>
                  {t('projectPage.investor.field.financingNeed')}
                </dt>
                <dd className={styles.factValue}>
                  {need === null ? (
                    <span className={styles.quiet}>—</span>
                  ) : (
                    <span className={styles.money}>{need}</span>
                  )}
                </dd>
              </div>

              <div className={styles.fact}>
                <dt className={styles.factLabel}>
                  {t('projectPage.investor.field.revenueStreams')}
                </dt>
                <dd className={styles.factValue}>
                  {p.revenueStreamsNote ?? <span className={styles.quiet}>—</span>}
                </dd>
              </div>

              <div className={styles.fact}>
                <dt className={styles.factLabel}>
                  {t('projectPage.investor.field.model')}
                </dt>
                <dd className={styles.factValue}>
                  {p.model === null ? (
                    <span className={styles.quiet}>
                      {investorText(t, 'projectsModelNone')}
                    </span>
                  ) : p.model.readable ? (
                    // The one route bytes leave by. Authorisation happens inside
                    // it, as this viewer's own PostgreSQL role, under the
                    // policies on doc.document and doc.document_version - this
                    // link is not the permission.
                    <a href={`/api/documents/${p.model.documentId}?download`}>
                      {investorText(t, 'projectsDownloadModel')}
                    </a>
                  ) : (
                    <span className={styles.quiet}>
                      {investorText(t, 'projectsModelClosed')}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <div className={styles.stampRow}>
              <SourceStamp
                source={{
                  label: p.source.label,
                  locator: p.source.locator,
                  asOfDate: p.source.asOfDate,
                }}
              />
            </div>

            <p className={styles.projectActions}>
              <Link href={`/projects/${p.slug}`}>
                {investorText(t, 'projectsOpenProject')}
              </Link>
            </p>
          </article>
        );
      })}
    </>
  );
}
