import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import InterestsDetailTable from '@/components/buyer-dashboard/InterestsDetailTable';
import { requireRole } from '@/lib/auth/guards';
import { buyerInterests, buyerOrganisation } from '@/lib/dashboard/queries';
import { buyerText } from '@/lib/dashboard/messages';
import type { BuyerInterest } from '@/lib/dashboard/types';
import styles from '@/components/buyer-dashboard/BuyerPage.module.css';

/**
 * "My interests" - every interest this organisation has expressed.
 *
 * This used to be one section halfway down the buyer dashboard, and it was the
 * shortest version of itself: project, date, unit, and a state that was either
 * "Recorded" or "Deal room open". A buyer could not find out from it what shape
 * of deal had been discussed, how far it had got, or - the question the concept
 * note's rule 5 is entirely about - which name the public record was carrying
 * for them on it. It has a page of its own now, and it answers all three.
 *
 * NOT A LIST OF DEALS. The row is the INTEREST, from record.entry, which is
 * append-only: an interest that led nowhere stays in the list because it is part
 * of the public record. The deal is what may have followed, shown beside it,
 * absent for most rows.
 *
 * RULE 7. No volume column. See the note on the table component: it is the
 * cross-project list the rule exists for, and deal.interest_volume is
 * deliberately not joined in.
 *
 * PRIVACY. Read as the viewer's own role in one transaction, scoped by
 * sylva.actor_org_id() in the query as well as by the policy. deal.deal's
 * policy admits the two parties to a deal, and the query narrows that to the
 * buyer side: an organisation that is both a buyer and a project owner must not
 * find its own projects' incoming deals listed under "my interests".
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.buyer.interests')} · ${t('workspace.buyer.title')}`,
    description: buyerText(t, 'interestsLead'),
    // An organisation's own record is not a page for a search engine to hold.
    robots: { index: false, follow: false },
  };
}

export default async function BuyerInterestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const viewer = await requireRole('buyer', '/dashboard/interests');

  // The organisation's own name, for the line saying whose record this is. Read
  // through org.own_organisation(), which can only ever answer for the caller.
  let interests: BuyerInterest[] = [];
  let orgName = '';
  let failed = false;
  try {
    const [rows, org] = await Promise.all([
      buyerInterests(viewer.actor, locale),
      buyerOrganisation(viewer.actor, locale),
    ]);
    interests = rows;
    orgName = org.organisation?.legalName ?? '';
  } catch (err) {
    // A plain sentence, never a stack trace. Nothing was being written, so
    // there is nothing to roll back and nothing to warn the reader about.
    console.error('[buyer] could not read the interests:', err);
    failed = true;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('workspace.buyer.interests')}</h1>
        <p className={styles.lead}>{buyerText(t, 'interestsLead')}</p>
        {orgName === '' ? null : (
          <p className={styles.org}>
            <span className={styles.orgLabel}>{t('mySites.orgLabel')}</span>
            <span className={styles.orgName}>{orgName}</span>
          </p>
        )}
      </header>

      {failed ? (
        <p className={styles.failure} role="alert">{buyerText(t, 'unavailable')}</p>
      ) : (
        // The table IS the page, so it gets no second heading repeating the
        // h1 and no second lead repeating the one above it. Its <caption> is
        // what names it for a reader who reaches it on its own.
        <div className={styles.section}>
          <InterestsDetailTable interests={interests} />
        </div>
      )}
    </div>
  );
}
