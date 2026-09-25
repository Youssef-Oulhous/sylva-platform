import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import { requireRole } from '@/lib/auth/guards';
import {
  getOwnerOrganisationName, listOwnerInterest, listOwnerProjects, listOwnerQuestions,
} from '@/lib/owner/queries';
import { isAnswered } from '@/lib/owner/types';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * Where a project owner lands, and nothing more.
 *
 * WHAT THIS PAGE USED TO BE. Everything. The whole project list with a
 * publication panel and an availability table per project, then the whole
 * question queue, then the whole interest table - one page that answered every
 * question the role has and made none of them findable. Sections of a page are
 * not navigation: an owner who came in to answer one buyer scrolled past every
 * project to reach the queue.
 *
 * WHAT IT IS NOW. The three counts that say whether anything needs this
 * organisation today, each a link into the section that does that work. Projects,
 * Questions, Interest received and Organisation are pages of their own, in the
 * workspace navigation above, and this page's job is to say which of them to open.
 *
 * Nothing is summarised into a score and nothing is charted. Every count is read
 * from the database as this organisation, now, and carries the date it was read.
 *
 * WHAT THIS PAGE IS NOT ALLOWED TO DO. It runs as sylva_project_owner with the
 * HMAC-signed organisation context, so every query is already narrowed to this
 * organisation by row-level security. requireRole() decides what is shown; it is
 * not the boundary. See docs/FINDING-001.
 *
 * RULE 7. There is no unit figure on this page at all. The counts count projects,
 * questions and expressions of interest - and say so, so they cannot be read as
 * volume. Volumes stay on each project's periods page, beside their own unit
 * label.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'owner' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // A private workspace. Nothing here belongs in a search index, and a buyer's
    // question must never turn up in one.
    robots: { index: false, follow: false },
  };
}

export default async function OwnerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', '/owner');
  const t = await getTranslations();

  const [orgName, projects, questions, interest] = await Promise.all([
    getOwnerOrganisationName(viewer.actor),
    listOwnerProjects(viewer.actor, locale),
    listOwnerQuestions(viewer.actor, locale),
    listOwnerInterest(viewer.actor, locale),
  ]);

  const published = projects.filter((p) => p.isPublished);
  const blocked = projects.filter((p) => p.gaps.length > 0);
  const awaitingAnswer = questions.filter((q) => !isAnswered(q));

  // The date the page was rendered. Every count below was read then, so that is
  // what the source stamp states.
  const asOf = new Date().toISOString().slice(0, 10);

  const nothingWaiting =
    blocked.length === 0 && awaitingAnswer.length === 0 && interest.length === 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        {/* Not owner.title: that is the heading of /owner/projects, the list
            itself. This is the overview, and when both carried the same words a
            reader clicking between them could not tell the pages apart. */}
        <h1>{t('owner.overviewTitle')}</h1>
        <p className={styles.lead}>{t('owner.lead')}</p>

        <p className={styles.org}>
          {t('owner.dashboardFor')}{' '}
          <span className={styles.orgName}>{orgName ?? ''}</span>
        </p>

        <p className={styles.demoNote}>{ownerText(t, 'liveNote')}</p>
      </header>

      <section className={styles.section} aria-labelledby="owner-needs-you">
        <h2 id="owner-needs-you">{ownerText(t, 'overviewNeedsYou')}</h2>

        {nothingWaiting && (
          <p className={styles.clear}>{ownerText(t, 'overviewClear')}</p>
        )}

        {/* Three cards, three pages. Each card states its count in words and
            links to the section that acts on it - it does not reproduce the
            section here. */}
        <ul className={styles.cards}>
          <li className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Link href="/owner/projects">{t('owner.projects.title')}</Link>
            </h3>
            <p className={styles.cardCount}>
              {t('owner.projects.count', { count: projects.length })}{' '}
              {t('source.separator')}{' '}
              {t('owner.projects.published', { count: published.length })}{' '}
              {t('source.separator')}{' '}
              {t('owner.projects.blocked', { count: blocked.length })}
            </p>
            <p className={styles.cardNote}>{ownerText(t, 'overviewProjectsNote')}</p>
            <p className={styles.cardLink}>
              <Link href="/owner/projects">{ownerText(t, 'overviewGoTo')} &rarr;</Link>
            </p>
          </li>

          <li className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Link href="/owner/questions">{t('owner.questions.title')}</Link>
            </h3>
            <p className={styles.cardCount}>
              {t('owner.questions.awaiting', { count: awaitingAnswer.length })}
            </p>
            <p className={styles.cardNote}>{t('owner.questions.lead')}</p>
            <p className={styles.cardLink}>
              <Link href="/owner/questions">
                {t('owner.questions.openInbox')} &rarr;
              </Link>
            </p>
          </li>

          <li className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Link href="/owner/interest">{t('owner.interest.title')}</Link>
            </h3>
            <p className={styles.cardCount}>
              {t('owner.interest.count', { count: interest.length })}
            </p>
            <p className={styles.cardNote}>{t('owner.interest.lead')}</p>
            <p className={styles.cardLink}>
              <Link href="/owner/interest">{ownerText(t, 'overviewGoTo')} &rarr;</Link>
            </p>
          </li>
        </ul>

        <SourceStamp
          source={{ label: t('owner.source.dashboard'), locator: null, asOfDate: asOf }}
        />

        {/* Said once, near the only figures on the page, so the absence of a
            platform-wide volume reads as a decision rather than as an omission. */}
        <p className={styles.countNote}>{t('owner.countNote')}</p>

        <p className={styles.sectionFoot}>
          <Link href="/owner/projects/new">{ownerText(t, 'addProject')} &rarr;</Link>
        </p>
      </section>
    </div>
  );
}
