import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import InterestQueue from '@/components/owner-dashboard/InterestQueue';
import { requireRole } from '@/lib/auth/guards';
import { listOwnerInterest } from '@/lib/owner/queries';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * Who has expressed interest in this organisation's projects, and where each
 * stands.
 *
 * Its own page because it is its own job. It used to be the third section of the
 * owner's overview, below the whole project list and the whole question queue, so
 * somebody coming in to answer a buyer had to scroll past everything else to find
 * out who was waiting.
 *
 * A buyer that expresses interest opens a private room between that buyer and the
 * project (concept note section 7). Nothing is reserved and no volume is agreed
 * at that point, which is also what the database holds at stage
 * 'interest_expressed' - so there is no volume column and no price column here,
 * and the note under the table says so rather than leaving an empty column to
 * read as missing data.
 *
 * WHO THE BUYER IS. Pseudonymous by default and named only where that buyer chose
 * disclosure for that deal. The query never selects org.organisation.legal_name;
 * no public-facing role holds the column privilege, which is what makes R5 a
 * privilege rather than a convention. The route to a name is
 * deal.counterparty_legal_name(), which writes an access-log row and so cannot
 * run in the READ ONLY transaction this page reads in: naming a counterparty is
 * an act, and an act belongs in the deal room rather than on a list.
 *
 * RULE 7. No unit figure on this page at all, so there is nothing here that could
 * be added across the projects it lists.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('owner.interest.title'),
    description: t('owner.interest.lead'),
    // A private room between one buyer and one project. Never indexed.
    robots: { index: false, follow: false },
  };
}

export default async function OwnerInterestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', '/owner/interest');
  const t = await getTranslations();

  const interest = await listOwnerInterest(viewer.actor, locale);
  const asOf = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('owner.interest.title')}</h1>

        <p className={styles.counts}>
          {t('owner.interest.count', { count: interest.length })}
        </p>

        <p className={styles.lead}>{t('owner.interest.lead')}</p>
        <p className={styles.lead}>{ownerText(t, 'partyLabelNote')}</p>

        <SourceStamp
          source={{ label: t('owner.interest.source'), locator: null, asOfDate: asOf }}
        />
      </header>

      <InterestQueue interest={interest} locale={locale} />
    </div>
  );
}
