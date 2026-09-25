import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import StandingPanel from '@/components/investor/StandingPanel';
import { Link } from '@/lib/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { investorErrorCode, investorText } from '@/lib/investor/messages';
import {
  financingProjects, investorInterests, investorOrganisation, investorStanding,
} from '@/lib/investor/queries';
import type {
  FinancingProject, InvestorInterest, InvestorStanding,
} from '@/lib/investor/types';
import styles from '@/components/investor/Investor.module.css';

/**
 * The investor's overview.
 *
 * THIS AREA DID NOT EXIST, and sign-in already routed here: homePathFor() sends
 * an investor to /investor because the buyer dashboard it used to send them to
 * greeted them with "Buyer dashboard" and offered site registration, which is a
 * buyer's feature. Until this page existed every investor signing in got a 404.
 *
 * WHAT THE PAGE IS FOR. An investor arriving here has three questions, and the
 * page is ordered by them: where does my organisation stand, what may I read,
 * and where do I go. SIMULATION item 14 is what happens when a dashboard answers
 * them wrongly - it told a just-approved investor "It is not access to financing
 * information", promised three capabilities the account does not have, and
 * headed itself with another role's name.
 *
 * WHAT IT MAY NOT SAY. No return, no yield, no IRR, no projection. The concept
 * note supplies none, proj.project_financials holds no column one could live in,
 * and the brief forbids unsupported financial-return calculations. The "what
 * this area does not show" list says so on the page rather than leaving the
 * absence to be noticed.
 *
 * RULE 7. The two figures are counts of ROWS - projects, and entries in the
 * transaction record. Neither is a unit volume, so neither is added to anything,
 * and the note under them says that rather than leaving a reader to assume it.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.investor.overview')} · ${t('workspace.investor.title')}`,
    description: investorText(t, 'overviewMeta'),
    // An organisation's own standing is not a page for a search index.
    robots: { index: false, follow: false },
  };
}

export default async function InvestorOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // The page keeps its own guard. The workspace shell above it is presentation,
  // and the real boundary is the database role this session is served by.
  const viewer = await requireRole('investor', '/investor');

  let standing: InvestorStanding = { vettedInvestor: false, submissions: [] };
  let projects: FinancingProject[] = [];
  let interests: InvestorInterest[] = [];
  let orgName = '';
  let failure: unknown = null;
  try {
    standing = await investorStanding(viewer.actor);
    projects = await financingProjects(viewer.actor, locale);
    interests = await investorInterests(viewer.actor, locale);
    const org = await investorOrganisation(viewer.actor, locale);
    orgName = org?.legalName ?? '';
  } catch (err) {
    // A plain sentence, never a stack trace. Nothing was being written, so there
    // is nothing to roll back and nothing to warn the reader about.
    console.error('[investor] could not read the overview:', err);
    failure = err;
  }

  const shows = [
    'canFinancing', 'canModel', 'canProjectPage', 'canQuestions', 'canRecord',
  ] as const;
  const doesNot = [
    'cannotReturns', 'cannotRanking', 'cannotTotals', 'cannotBuyers', 'cannotSettlement',
  ] as const;

  const routes = [
    { href: '/investor/projects', name: t('workspace.investor.projects'), note: 'goProjects' },
    { href: '/investor/interests', name: t('workspace.investor.interests'), note: 'goInterests' },
    { href: '/investor/organisation', name: t('workspace.investor.organisation'), note: 'goOrganisation' },
  ] as const;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{investorText(t, 'overviewTitle')}</h1>
        <p className={styles.lead}>{investorText(t, 'overviewLead')}</p>
        {orgName === '' ? null : (
          <p className={styles.org}>
            <span className={styles.orgLabel}>{t('mySites.orgLabel')}</span>
            <span className={styles.orgName}>{orgName}</span>
          </p>
        )}
      </header>

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {investorText(t, investorErrorCode(failure))}
        </p>
      ) : (
        <>
          <div className={styles.section}>
            <StandingPanel standing={standing} />
          </div>

          {/* §4's sequencing, and what the platform does and does not enforce
              about it. Both halves, because stating the observation alone would
              read as a rule the database does not have. */}
          <section className={styles.section} aria-labelledby="investor-sequence">
            <h2 id="investor-sequence">{investorText(t, 'sequenceTitle')}</h2>
            <p className={styles.sectionIntro}>{investorText(t, 'sequenceBody')}</p>
            <p className={styles.sectionIntro}>{investorText(t, 'sequenceNotAGate')}</p>
          </section>

          <section className={styles.section} aria-labelledby="investor-counts">
            <h2 id="investor-counts">{investorText(t, 'countsTitle')}</h2>
            <ul className={styles.counts}>
              <li className={styles.count}>
                <span className={styles.countValue}>{projects.length}</span>
                <span className={styles.countLabel}>
                  {investorText(t, 'countProjects')}
                </span>
              </li>
              <li className={styles.count}>
                <span className={styles.countValue}>{interests.length}</span>
                <span className={styles.countLabel}>
                  {investorText(t, 'countInterests')}
                </span>
              </li>
            </ul>
            <p className={styles.note}>{investorText(t, 'countNote')}</p>
          </section>

          <div className={styles.section}>
            <div className={styles.twoCol}>
              <section aria-labelledby="investor-can">
                <h2 id="investor-can">{investorText(t, 'canTitle')}</h2>
                <ul className={styles.points}>
                  {shows.map((code) => (
                    <li key={code}>{investorText(t, code)}</li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="investor-cannot">
                <h2 id="investor-cannot">{investorText(t, 'cannotTitle')}</h2>
                <ul className={styles.points}>
                  {doesNot.map((code) => (
                    <li key={code}>{investorText(t, code)}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <section className={styles.section} aria-labelledby="investor-routes">
            <h2 id="investor-routes">{investorText(t, 'goTitle')}</h2>
            <ul className={styles.routes}>
              {routes.map((r) => (
                <li key={r.href} className={styles.route}>
                  <Link href={r.href} className={styles.routeName}>{r.name}</Link>
                  <span className={styles.routeNote}>{investorText(t, r.note)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
