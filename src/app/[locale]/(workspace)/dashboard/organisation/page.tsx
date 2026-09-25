import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import EmptyState from '@/components/buyer-dashboard/EmptyState';
import OrganisationPanel from '@/components/buyer-dashboard/OrganisationPanel';
import PublicLabelPanel from '@/components/buyer-dashboard/PublicLabelPanel';
import VettingPanel from '@/components/buyer-dashboard/VettingPanel';
import { requireRole } from '@/lib/auth/guards';
import { buyerInterests, buyerOrganisation } from '@/lib/dashboard/queries';
import { buyerText } from '@/lib/dashboard/messages';
import type { BuyerInterest, BuyerOrganisationRecord } from '@/lib/dashboard/types';
import styles from '@/components/buyer-dashboard/BuyerPage.module.css';

/**
 * "Organisation" - the record Sylva holds, and the decision recorded against it.
 *
 * This used to be the top third of the buyer dashboard, which meant the one
 * question it answers - am I approved, and what does the outside world see of me
 * - was mixed in with the interests table and the site register. It is a page.
 *
 * THE ORGANISATION READS ITS OWN ROW AND NO OTHER, and not because this page
 * says so. org.own_organisation() is a SECURITY DEFINER function scoped to
 * sylva.actor_org_id(); no public-facing role holds a column grant on
 * org.organisation.legal_name, registration_number or registered_address at all
 * (db/migrations/0080), so there is no query this page could have written that
 * would answer with somebody else's name.
 *
 * VETTING IS NOT DERIVED HERE. `approvedNow` comes from sylva.is_vetted(), the
 * trigger-maintained approval cache that rule 6 itself consults, so the word on
 * screen is the same fact that decides whether a deal may exist. A second
 * implementation in TypeScript would be a second thing that can disagree with
 * the database.
 *
 * ONE PANEL PER DECISION. An organisation that is both a buyer and a project
 * owner has two submissions and two decisions, and they can differ. Both are
 * shown rather than the one that suits the area the reader is in.
 *
 * Rule 7: no unit volume on this page, and no field one could be put in.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.buyer.organisation')} · ${t('workspace.buyer.title')}`,
    description: buyerText(t, 'organisationLead'),
    // An organisation's own record is not a page for a search engine to hold.
    robots: { index: false, follow: false },
  };
}

export default async function BuyerOrganisationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');

  const viewer = await requireRole('buyer', '/dashboard/organisation');

  let record: BuyerOrganisationRecord = {
    organisation: null, vetting: [], publicLabels: [],
  };
  let interests: BuyerInterest[] = [];
  let failed = false;
  try {
    const [org, rows] = await Promise.all([
      buyerOrganisation(viewer.actor, locale),
      buyerInterests(viewer.actor, locale),
    ]);
    record = org;
    interests = rows;
  } catch (err) {
    console.error('[buyer] could not read the organisation record:', err);
    failed = true;
  }

  // The most recent interest, shown as the specimen line on the disclosure
  // panel together with the label that project allocated. Both real; where
  // either is missing the specimen is simply not drawn, rather than invented.
  const newest = interests[0] ?? null;
  const specimen =
    newest === null
      ? null
      : (() => {
          const label = record.publicLabels.find(
            (l) => l.projectId === newest.projectId,
          );
          return label === undefined
            ? null
            : {
                projectTitle: newest.projectTitle,
                label: label.label,
                dateIso: newest.expressedOn,
              };
        })();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('workspace.buyer.organisation')}</h1>
        <p className={styles.lead}>{buyerText(t, 'organisationLead')}</p>
      </header>

      {failed ? (
        <p className={styles.failure} role="alert">{buyerText(t, 'unavailable')}</p>
      ) : record.organisation === null ? (
        <p className={styles.failure} role="alert">
          {buyerText(t, 'organisationMissing')}
        </p>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="record-heading">
            <div className={styles.sectionHead}>
              <h2 id="record-heading">{tb('section.status')}</h2>
              <p className={styles.sectionIntro}>{tb('section.statusIntro')}</p>
            </div>

            <div className={styles.panels}>
              <OrganisationPanel
                organisation={record.organisation}
                locale={locale}
              />

              {/* One panel per role the organisation has been vetted for. */}
              {record.vetting.length === 0 ? (
                <EmptyState
                  title={tb('vetting.state.none')}
                  body={tb('vetting.noneBody')}
                />
              ) : (
                record.vetting.map((v) => (
                  <VettingPanel key={v.roleCode} vetting={v} />
                ))
              )}
            </div>
          </section>

          {/* How the organisation appears to everybody else. Kept next to the
              record it is derived from, and below it, because the record is the
              thing a reader came to check.

              No heading of its own here: PublicLabelPanel is a <section> and
              carries one. A second heading above it would say the same sentence
              twice. */}
          <div className={styles.section}>
            <PublicLabelPanel
              organisation={record.organisation}
              labels={record.publicLabels}
              specimen={specimen}
              locale={locale}
            />
          </div>
        </>
      )}
    </div>
  );
}
