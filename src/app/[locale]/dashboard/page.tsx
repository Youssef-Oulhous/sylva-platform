import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import DocumentsSection from '@/components/buyer-dashboard/DocumentsSection';
import EmptyState from '@/components/buyer-dashboard/EmptyState';
import InterestsTable from '@/components/buyer-dashboard/InterestsTable';
import OrganisationPanel from '@/components/buyer-dashboard/OrganisationPanel';
import PublicLabelPanel from '@/components/buyer-dashboard/PublicLabelPanel';
import SitesTable from '@/components/buyer-dashboard/SitesTable';
import VettingPanel from '@/components/buyer-dashboard/VettingPanel';
import { requireActor } from '@/lib/auth/guards';
import { buyerDashboard } from '@/lib/dashboard/queries';
import styles from './page.module.css';

/**
 * The buyer dashboard.
 *
 * What it is: a standing record of what one organisation has done on this
 * platform - its status with the operator, the interests it has expressed, the
 * sites it has registered and its documents. Four sections and three panels, in
 * the order a buyer needs them.
 *
 * What it deliberately is not: an analytics dashboard. There is no KPI tile, no
 * chart, no sparkline, no month-on-month figure and no score. A buyer with two
 * interests and two sites has nothing to plot, and a graph drawn over numbers
 * this small would be decoration standing where evidence belongs.
 *
 * RULE 7. There is not one unit volume on this page. The interests table spans
 * several projects, which is exactly the list where a volume column would
 * invite the comparison the rule forbids; it shows the unit each project issues
 * instead, which is the fact that makes those projects incomparable. No type
 * this page renders has a quantity field, so nothing here can be added to
 * anything.
 *
 * NO DEALS SECTION. The deal room is Phase 2 (DECISIONS D5; concept note §10
 * scopes the first release to "the public side plus a way in"), deal terms and
 * volumes are not written by anything in this release, and a section reading
 * from a table this release never fills would be demo data with a database
 * connection. Interests carry a "deal room open" state, which is the part of it
 * that is real today.
 *
 * PRIVACY. One readAs() transaction as the viewer's own role and signed
 * organisation context, so every panel describes the same instant. Every
 * statement behind it is scoped to sylva.actor_org_id() in src/lib/dashboard/
 * queries.ts - not only by the row-level policy, because the policy says
 * USING (true) for the operator and the auditor and this page is headed "your
 * organisation". The page calls cookies() through the guard, so it is dynamic
 * and never cached.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'buyerDashboard' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    // An organisation's own record is not a page for a search engine to hold.
    robots: { index: false, follow: false },
  };
}

export default async function BuyerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('buyerDashboard');

  // Signed in. Not restricted to the buyer role: an investor account has the
  // same organisation record, the same vetting decision and the same documents,
  // and sending it to the sign-in form would be wrong - homePathFor() sends an
  // investor here on sign-in. What such an account cannot read is refused by
  // privilege: geo.buyer_site for an investor and a project owner, deal.deal
  // for an investor. Those two statements are asked inside a SAVEPOINT, so the
  // refusal renders an empty section instead of turning the page into a 500.
  const viewer = await requireActor('/dashboard');
  const data = await buyerDashboard(viewer.actor, locale);

  // The most recent interest, shown as the specimen line on the disclosure
  // panel together with the label that project allocated. Both real; where
  // either is missing the specimen is simply not drawn.
  const newest = data.interests[0] ?? null;
  const specimen =
    newest === null
      ? null
      : (() => {
          const label = data.publicLabels.find((l) => l.projectId === newest.projectId);
          return label === undefined
            ? null
            : {
                projectTitle: newest.projectTitle,
                label: label.label,
                dateIso: newest.expressedOn,
              };
        })();

  return (
    <>
      <header className={styles.head}>
        <h1>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>

        {data.organisation === null ? null : (
          <div className={styles.identity}>
            <span className={styles.orgName}>{data.organisation.legalName}</span>
            <span className={styles.identityItem}>
              <span className={styles.identityLabel}>{t('org.orgRef')}</span>
              <span className={styles.identityValue}>{data.organisation.orgId}</span>
            </span>
          </div>
        )}
      </header>

      {/* 1. Status first. Nothing further down this page is available to an
             organisation the operator has not approved. */}
      <section className={styles.section} aria-labelledby="status-heading">
        <div className={styles.sectionHead}>
          <h2 id="status-heading">{t('section.status')}</h2>
          <p className={styles.sectionIntro}>{t('section.statusIntro')}</p>
        </div>

        <div className={styles.panels}>
          {data.organisation === null ? null : (
            <OrganisationPanel organisation={data.organisation} locale={locale} />
          )}

          {/* One panel per role the organisation has been vetted for. Most
              organisations have exactly one; an organisation that is both a
              buyer and a project owner has two decisions and they can differ. */}
          {data.vetting.length === 0 ? (
            <EmptyState
              title={t('vetting.state.none')}
              body={t('vetting.noneBody')}
            />
          ) : (
            data.vetting.map((v) => <VettingPanel key={v.roleCode} vetting={v} />)
          )}
        </div>

        {data.organisation === null ? null : (
          <PublicLabelPanel
            organisation={data.organisation}
            labels={data.publicLabels}
            specimen={specimen}
            locale={locale}
          />
        )}
      </section>

      {/* 2. Interests. The only list on this page spanning several projects,
             and therefore the one with no volume column. */}
      <section className={styles.section} aria-labelledby="interests-heading">
        <div className={styles.sectionHead}>
          <h2 id="interests-heading">{t('section.interests')}</h2>
          <p className={styles.sectionIntro}>{t('section.interestsIntro')}</p>
        </div>
        <InterestsTable interests={data.interests} />
      </section>

      {/* 3. Sites. Private to this organisation, and the panel says so. */}
      <section className={styles.section} aria-labelledby="sites-heading">
        <div className={styles.sectionHead}>
          <h2 id="sites-heading">{t('section.sites')}</h2>
          <p className={styles.sectionIntro}>{t('section.sitesIntro')}</p>
        </div>
        <SitesTable sites={data.sites} locale={locale} />
      </section>

      {/* 4. Documents, in three groups, any of which may be empty. */}
      <section className={styles.sectionLast} aria-labelledby="documents-heading">
        <div className={styles.sectionHead}>
          <h2 id="documents-heading">{t('section.documents')}</h2>
          <p className={styles.sectionIntro}>{t('section.documentsIntro')}</p>
        </div>
        <DocumentsSection documents={data.documents} />
      </section>
    </>
  );
}
