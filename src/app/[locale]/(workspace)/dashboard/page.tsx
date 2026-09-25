import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import { Link } from '@/lib/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { buyerOverview } from '@/lib/dashboard/queries';
import { buyerText } from '@/lib/dashboard/messages';
import type { BuyerOverview, VettingState } from '@/lib/dashboard/types';
import { AREAS } from '@/lib/workspace/nav';
import styles from './page.module.css';

/**
 * The buyer's overview.
 *
 * WHAT CHANGED. This page used to be the whole buyer area: the organisation
 * record, the vetting panel, the public-label panel, the interests table, the
 * site register and three groups of documents, stacked one under another. A
 * buyer who came to check one thing scrolled past five others, and a deep link
 * could only ever land at the top of the stack.
 *
 * It is now the first of five pages under the buyer's own navigation, and it
 * answers one question: what, if anything, is waiting for me. The detail moved
 * to the sections that own it - /dashboard/interests, /dashboard/sites,
 * /dashboard/documents and /dashboard/organisation - and each of those keeps its
 * own guard and does its own reading. Nothing was deleted; it was given an
 * address.
 *
 * WHAT IT DELIBERATELY IS NOT. An analytics dashboard. The figures below are
 * counts of rows on this organisation's own record - four of them - and there is
 * no chart, no trend, no month-on-month figure and no score. A buyer with two
 * interests has nothing to plot, and a graph drawn over numbers this small would
 * be decoration standing where evidence belongs.
 *
 * RULE 7. Not one unit volume on this page, and no field one could be put in.
 * The counts are counts of rows and the note under them says so. The list that
 * spans several projects - the interests - carries the unit LABEL of each
 * project on its own page rather than a figure here.
 *
 * PRIVACY. Every statement behind this page is scoped to sylva.actor_org_id()
 * in src/lib/dashboard/queries.ts, not only by the row-level policy: the
 * policies on geo.buyer_site and doc.document say USING (true) for the operator
 * and the auditor, and this page is headed "your organisation". The guard calls
 * cookies(), so the page is dynamic and never cached.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.buyer.overview')} · ${t('workspace.buyer.title')}`,
    description: buyerText(t, 'overviewMeta'),
    // An organisation's own record is not a page for a search engine to hold.
    robots: { index: false, follow: false },
  };
}

/** The tone each vetting state gets. Green is reserved on this platform for
 *  biodiversity and for the primary action, so approved is neutral. */
const TONE: Record<VettingState, BadgeTone> = {
  approved: 'neutral',
  submitted: 'warning',
  declined: 'error',
  none: 'warning',
};

export default async function BuyerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');

  // The buyer role, not merely a signed-in account. An investor used to be sent
  // here on sign-in and greeted with "Buyer dashboard"; it has /investor now,
  // and the signed-in shell picks the navigation by role, so an investor
  // reaching this URL would otherwise see the investor's sections wrapped
  // around a buyer's page.
  const viewer = await requireRole('buyer', '/dashboard');

  let data: BuyerOverview | null = null;
  let failed = false;
  try {
    data = await buyerOverview(viewer.actor, locale);
  } catch (err) {
    // A plain sentence, never a stack trace. Nothing was being written.
    console.error('[buyer] could not read the overview:', err);
    failed = true;
  }

  const vettingState: VettingState =
    data?.vetting === null || data?.vetting === undefined
      ? 'none'
      : data.vetting.approvedNow
        ? 'approved'
        : data.vetting.state;

  // What is waiting for the reader: each item a real fact with one place to go.
  // An empty list is a good answer and gets a sentence of its own, not a blank.
  const attention: { id: string; body: string; href: string; action: string }[] = [];
  if (data !== null) {
    if (vettingState === 'none') {
      attention.push({
        id: 'vetting-none',
        body: buyerText(t, 'attentionVettingNone'),
        href: '/vetting',
        action: buyerText(t, 'open'),
      });
    } else if (vettingState === 'submitted') {
      attention.push({
        id: 'vetting-waiting',
        body: buyerText(t, 'attentionVettingWaiting'),
        href: '/vetting/status',
        action: buyerText(t, 'open'),
      });
    } else if (vettingState === 'declined') {
      attention.push({
        id: 'vetting-declined',
        body: buyerText(t, 'attentionVettingDeclined'),
        href: '/dashboard/organisation',
        action: buyerText(t, 'open'),
      });
    }

    // Only a deal that has MOVED past the stage the interest opened it at. See
    // buyerOverview(): a deal row at interest_expressed was created by the
    // buyer's own interest and is not somebody waiting for them.
    if (data.dealsAdvanced > 0) {
      attention.push({
        id: 'deal-open',
        body: buyerText(t, 'attentionDealOpen'),
        href: '/dashboard/interests',
        action: buyerText(t, 'open'),
      });
    }
    if (data.interests === 0) {
      attention.push({
        id: 'no-interests',
        body: buyerText(t, 'attentionNoInterests'),
        href: '/projects',
        action: t('home.ctaExplore'),
      });
    }
    // A viewer who holds no grant on geo.buyer_site is not told it has no
    // sites: the flag is what distinguishes the two.
    if (data.sitesVisible && data.sites === 0) {
      attention.push({
        id: 'no-sites',
        body: buyerText(t, 'attentionNoSites'),
        href: '/dashboard/sites',
        action: tb('sites.registerAction'),
      });
    }
  }

  // Counts of ROWS. Each one links into the page that holds the rows, so the
  // figure is a way in rather than a decoration.
  const counts: { id: string; value: number; label: string; href: string }[] =
    data === null
      ? []
      : [
          {
            id: 'interests',
            value: data.interests,
            label: buyerText(t, 'countInterests'),
            href: '/dashboard/interests',
          },
          {
            id: 'sites',
            value: data.sites,
            label: buyerText(t, 'countSites'),
            href: '/dashboard/sites',
          },
          {
            id: 'documents',
            value: data.documents,
            label: buyerText(t, 'countDocuments'),
            href: '/dashboard/documents',
          },
          {
            id: 'labels',
            value: data.publicLabels,
            label: buyerText(t, 'countLabels'),
            href: '/dashboard/organisation',
          },
        ];

  // The sections, taken from nav.ts so this list cannot drift from the
  // navigation above it. The overview is dropped: it is this page.
  const sectionBlurb: Record<string, string> = {
    '/dashboard/interests': buyerText(t, 'goInterests'),
    '/dashboard/sites': buyerText(t, 'goSites'),
    '/dashboard/documents': buyerText(t, 'goDocuments'),
    '/dashboard/organisation': buyerText(t, 'goOrganisation'),
  };
  const sections = AREAS.buyer.sections.filter((s) => s.href !== '/dashboard');

  return (
    <>
      <header className={styles.head}>
        <h1>{t('workspace.buyer.overview')}</h1>
        <p className={styles.lead}>{buyerText(t, 'overviewLead')}</p>

        {data?.organisation == null ? null : (
          <div className={styles.identity}>
            <span className={styles.orgName}>{data.organisation.legalName}</span>
            {/* Status is never colour alone: the badge carries the word. */}
            <span className={styles.identityItem}>
              <span className={styles.identityLabel}>{t('project.status')}</span>
              <span className={styles.identityValue}>
                <Badge tone={TONE[vettingState]}>
                  {tb(`vetting.state.${vettingState}`)}
                </Badge>
              </span>
            </span>
            <span className={styles.identityItem}>
              <span className={styles.identityLabel}>{tb('org.orgRef')}</span>
              <span className={styles.identityValue}>{data.organisation.orgId}</span>
            </span>
          </div>
        )}
      </header>

      {failed ? (
        <p className={styles.failure} role="alert">{buyerText(t, 'unavailable')}</p>
      ) : (
        <>
          {/* 1. What is waiting for you. First, because it is the only thing on
                 the page a reader may have to act on. */}
          <section className={styles.section} aria-labelledby="attention-heading">
            <div className={styles.sectionHead}>
              <h2 id="attention-heading">{buyerText(t, 'attentionTitle')}</h2>
            </div>

            {attention.length === 0 ? (
              <p className={styles.settled}>{buyerText(t, 'attentionNone')}</p>
            ) : (
              <ul className={styles.attention}>
                {attention.map((item) => (
                  <li key={item.id} className={styles.attentionItem}>
                    <span className={styles.attentionBody}>{item.body}</span>
                    <Link href={item.href} className={styles.attentionAction}>
                      {item.action}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 2. Four counts of rows. Not a metric between them. */}
          <section className={styles.section} aria-labelledby="counts-heading">
            <div className={styles.sectionHead}>
              <h2 id="counts-heading">{buyerText(t, 'countsTitle')}</h2>
            </div>

            <ul className={styles.counts}>
              {counts.map((c) => (
                <li key={c.id} className={styles.count}>
                  <Link href={c.href} className={styles.countLink}>
                    <span className={styles.countValue}>{c.value}</span>
                    <span className={styles.countLabel}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className={styles.inert}>{buyerText(t, 'countsNote')}</p>
          </section>

          {/* 3. The way in to each section, in the order the navigation has
                 them, because the list is read FROM the navigation. */}
          <section className={styles.sectionLast} aria-labelledby="sections-heading">
            <div className={styles.sectionHead}>
              <h2 id="sections-heading">{buyerText(t, 'sectionsTitle')}</h2>
            </div>

            <ul className={styles.cards}>
              {sections.map((s) => (
                <li key={s.href} className={styles.card}>
                  <h3 className={styles.cardTitle}>
                    <Link href={s.href}>{t(s.key)}</Link>
                  </h3>
                  <p className={styles.cardBody}>{sectionBlurb[s.href] ?? ''}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
