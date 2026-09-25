import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import DecisionsTable from '@/components/investor/DecisionsTable';
import OrganisationRecord from '@/components/investor/OrganisationRecord';
import StandingPanel from '@/components/investor/StandingPanel';
import { requireRole } from '@/lib/auth/guards';
import { investorErrorCode, investorText } from '@/lib/investor/messages';
import { investorOrganisation, investorStanding } from '@/lib/investor/queries';
import type { InvestorOrganisation, InvestorStanding } from '@/lib/investor/types';
import styles from '@/components/investor/Investor.module.css';

/**
 * The organisation record Sylva holds, and every vetting decision on it.
 *
 * THE ONE WAY AN INVESTOR MAY READ ITS OWN ROW. Migration 0080 withholds a
 * column grant on org.organisation.legal_name, registration_number and
 * registered_address from every public-facing role, so this page reads
 * org.own_organisation() - SECURITY DEFINER, argument-less, scoped to
 * sylva.actor_org_id(). There is no query behind it that could name another
 * organisation, whoever opens it.
 *
 * EVERY DECISION, NOT THE CURRENT ONE. org.vetting_decision is append-only
 * (§8 rule 4): a suspension after an approval does not erase the approval and
 * this page does not either. Where the recorded decision and the answer in force
 * differ, both are shown - SIMULATION item 7 is what happens when a screen picks
 * one and tells a declined organisation the opposite of its own decision.
 *
 * NO ESTIMATE OF WHEN A DECISION WILL COME. None is published, so none is shown.
 *
 * NO PERSON ON THIS PAGE. Personal data lives in identity.user_account alone
 * (§9), and a contact name here would be a second place it lives.
 *
 * Rule 7: a vetting decision concerns an organisation rather than a project, so
 * there is no unit volume on this page and no field one could be put in.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.investor.organisation')} · ${t('workspace.investor.title')}`,
    description: investorText(t, 'organisationMeta'),
    // One organisation's own record. Nothing here should be indexed.
    robots: { index: false, follow: false },
  };
}

export default async function InvestorOrganisationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const viewer = await requireRole('investor', '/investor/organisation');

  let organisation: InvestorOrganisation | null = null;
  let standing: InvestorStanding = { vettedInvestor: false, submissions: [] };
  let failure: unknown = null;
  try {
    organisation = await investorOrganisation(viewer.actor, locale);
    standing = await investorStanding(viewer.actor);
  } catch (err) {
    console.error('[investor] could not read the organisation record:', err);
    failure = err;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{investorText(t, 'organisationTitle')}</h1>
        <p className={styles.lead}>{investorText(t, 'organisationLead')}</p>
      </header>

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {investorText(t, investorErrorCode(failure))}
        </p>
      ) : organisation === null ? (
        <p className={styles.failure} role="alert">
          {investorText(t, 'organisationMissing')}
        </p>
      ) : (
        <>
          <div className={styles.section}>
            {/* The gate note is on the overview and on the financing page; here
                the reader wants the decision, so the panel states the standing
                and the table below it states how that standing was reached. */}
            <StandingPanel standing={standing} showGateNote={false} />
          </div>

          <div className={styles.section}>
            <OrganisationRecord organisation={organisation} locale={locale} />
          </div>

          <section className={styles.section} aria-labelledby="investor-decisions">
            <h2 id="investor-decisions">{investorText(t, 'decisionsTitle')}</h2>
            <p className={styles.sectionIntro}>{investorText(t, 'decisionsLead')}</p>
            <DecisionsTable submissions={standing.submissions} />
          </section>
        </>
      )}
    </div>
  );
}
