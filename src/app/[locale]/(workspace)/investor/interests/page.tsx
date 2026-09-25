import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import InterestList from '@/components/investor/InterestList';
import { requireRole } from '@/lib/auth/guards';
import { investorErrorCode, investorText } from '@/lib/investor/messages';
import { investorInterests, investorOrganisation } from '@/lib/investor/queries';
import type { InvestorInterest } from '@/lib/investor/types';
import styles from '@/components/investor/Investor.module.css';

/**
 * "My interests" - the entries in the transaction record that name this
 * organisation as the party who expressed interest in a project.
 *
 * FOR AN INVESTOR THIS IS NORMALLY EMPTY, AND THAT IS NOT A BUG WITH A PAGE
 * MISSING BEHIND IT. Expressing interest is a buyer's action in this release -
 * one button that opens a private room about taking a volume of units - and
 * sylva_investor holds no INSERT on deal.deal at all, so the refusal is a
 * database privilege rather than a hidden control. SIMULATION item 14 recorded
 * the opposite of this page: an investor was offered an "Express interest"
 * button whose copy promised a private conversation and which led only to "NOT
 * A BUYER ACCOUNT". This page states the position instead of offering the
 * button, and points at the one route that does work today - a question on the
 * project's own page, which the simulation confirmed works end to end for an
 * investor.
 *
 * WHY THE SECTION EXISTS AT ALL. It is one of the four sections nav.ts gives
 * this role, an organisation that is both an investor and a buyer will have rows
 * here, and record.entry is append-only, so any entry ever recorded against this
 * organisation stays readable. A section that disappeared when it was empty
 * would leave a reader unable to tell "nothing recorded" from "not built".
 *
 * RULE 7: no volume column anywhere on this page. See the note on the list.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.investor.interests')} · ${t('workspace.investor.title')}`,
    description: investorText(t, 'interestsMeta'),
    // An organisation's own entries in the record are not for a search index.
    robots: { index: false, follow: false },
  };
}

export default async function InvestorInterestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const viewer = await requireRole('investor', '/investor/interests');

  let interests: InvestorInterest[] = [];
  let orgName = '';
  let failure: unknown = null;
  try {
    interests = await investorInterests(viewer.actor, locale);
    // The organisation's own name, for the line saying whose record this is.
    // org.own_organisation() can only ever answer for the caller.
    const org = await investorOrganisation(viewer.actor, locale);
    orgName = org?.legalName ?? '';
  } catch (err) {
    console.error('[investor] could not read the interests:', err);
    failure = err;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{investorText(t, 'interestsTitle')}</h1>
        <p className={styles.lead}>{investorText(t, 'interestsLead')}</p>
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
        <div className={styles.section}>
          <InterestList interests={interests} />
        </div>
      )}
    </div>
  );
}
