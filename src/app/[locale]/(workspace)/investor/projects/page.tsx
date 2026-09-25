import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import FinancingList from '@/components/investor/FinancingList';
import { Link } from '@/lib/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { investorErrorCode, investorText } from '@/lib/investor/messages';
import { financingProjects, investorStanding } from '@/lib/investor/queries';
import type { FinancingProject, InvestorStanding } from '@/lib/investor/types';
import styles from '@/components/investor/Investor.module.css';

/**
 * Projects seeking finance.
 *
 * THE GATE IS THE DATABASE'S, AND THIS PAGE LETS IT BE. proj.project_financials
 * has no permissive policy for the public or buyer roles at all, and its policy
 * for an investor is `proj.is_publicly_visible(project_id) AND
 * sylva.is_vetted_investor()` (db/migrations/0106). So there is no approval test
 * in the query and none in this component: an unapproved organisation is
 * returned no financing row, and the list is empty because the database refused
 * it, not because the page hid it.
 *
 * THE SAME URL SHOWS MORE ONCE SYLVA HAS APPROVED THE ORGANISATION, and the page
 * says so in as many words. That is the honest description of what happens -
 * the simulation confirmed the figures appear at this URL after one approval,
 * with nothing about the route changing - and it matters because the alternative
 * reading, that there is some other page an approved investor is given, is
 * wrong.
 *
 * THE SECTION IS NOT HIDDEN BEFORE VETTING. An unapproved investor gets the
 * heading, the explanation and an empty list, because a missing section reads as
 * a platform with nothing in it. What is NOT shown is any stand-in for a
 * withheld value: no blurred figure, no "EUR 1,2xx,xxx", nothing a reader could
 * squint at. A redacted value that hints at its own size is a disclosure.
 *
 * NEVER A RETURN. Financing need, revenue streams, the model and its date are
 * the whole of what is shown, because they are the whole of what the table
 * holds. Nothing on this page is derived from anything else on it, so there is
 * no arithmetic here a yield could come out of.
 *
 * RULE 7: no unit volume on this page, and no total of anything. Each project's
 * scheme and unit LABEL is printed beside it, which is the fact that makes two
 * of these projects incomparable.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.investor.projects')} · ${t('workspace.investor.title')}`,
    description: investorText(t, 'projectsMeta'),
    // Financing information released to vetted investors has no business in a
    // search index, whoever happens to be reading it.
    robots: { index: false, follow: false },
  };
}

export default async function InvestorProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const viewer = await requireRole('investor', '/investor/projects');

  let projects: FinancingProject[] = [];
  let standing: InvestorStanding = { vettedInvestor: false, submissions: [] };
  let failure: unknown = null;
  try {
    standing = await investorStanding(viewer.actor);
    projects = await financingProjects(viewer.actor, locale);
  } catch (err) {
    console.error('[investor] could not read the financing list:', err);
    failure = err;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{investorText(t, 'projectsTitle')}</h1>
        <p className={styles.lead}>{investorText(t, 'projectsLead')}</p>
      </header>

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {investorText(t, investorErrorCode(failure))}
        </p>
      ) : (
        <>
          {/* Not vetted: say why the list below is empty, and say that this URL
              is the one that will show the figures. */}
          {!standing.vettedInvestor && (
            <section className={`${styles.panel} ${styles.gate}`} aria-labelledby="financing-gate">
              <div className={styles.panelHead}>
                <h2 id="financing-gate" className={styles.panelTitle}>
                  {investorText(t, 'gateTitle')}
                </h2>
              </div>
              <p className={styles.panelBody}>{investorText(t, 'gateBody')}</p>
              <p className={styles.panelBody}>{investorText(t, 'standingGate')}</p>
              <p className={styles.panelBody}>
                <Link href="/vetting/status" className={styles.inlineLink}>
                  {investorText(t, 'gateStatusLink')}
                </Link>
              </p>
            </section>
          )}

          {projects.length === 0 ? (
            // Two different sentences on purpose. An approved investor with an
            // empty list is being told the truth about the platform; an
            // unapproved one has already been told why above, and must not also
            // be told that no project is seeking finance.
            standing.vettedInvestor ? (
              <p className={styles.sectionIntro}>{investorText(t, 'projectsEmpty')}</p>
            ) : null
          ) : (
            <>
              <FinancingList projects={projects} locale={locale} />

              <p className={styles.note}>{investorText(t, 'projectsOrderNote')}</p>
              <p className={styles.note}>{investorText(t, 'projectsUnitNote')}</p>
              <p className={styles.note}>{investorText(t, 'cannotTotals')}</p>
              <p className={styles.note}>{investorText(t, 'projectsLocaleNote')}</p>
              <p className={styles.note}>{investorText(t, 'projectsVersionNote')}</p>
            </>
          )}

          {/* On every state of this page, approved or not: an ecological
              verification is not a statement about financial return. */}
          <p className={styles.note}>{investorText(t, 'projectsNotAdvice')}</p>
        </>
      )}
    </div>
  );
}
