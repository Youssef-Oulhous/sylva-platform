import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import OwnerProjectRow from '@/components/owner-dashboard/OwnerProjectRow';
import QuestionQueue from '@/components/owner-dashboard/QuestionQueue';
import InterestQueue from '@/components/owner-dashboard/InterestQueue';
import {
  DEMO_OWNER_AS_OF,
  DEMO_OWNER_INTEREST,
  DEMO_OWNER_ORG,
  DEMO_OWNER_PROJECTS,
  DEMO_OWNER_QUESTIONS,
  questionsAnswered,
  questionsAwaitingAnswer,
} from '@/components/owner-dashboard/demo-owner';
import styles from './page.module.css';

/**
 * The project owner dashboard.
 *
 * Three things, in the order an owner needs them: what each project still needs
 * before it can be published, what buyers are waiting for an answer to, and what
 * interest is waiting for a response. Nothing is summarised into a score and
 * nothing is charted. A project owner opening this page should be able to say
 * what to do next after reading one screen.
 *
 * The publication gate is the centre of it. proj.publication_gaps() in
 * db/migrations/0013_a11_publication_gate.sql builds an array of ten codes and
 * the trigger on proj.project refuses a change to 'published' while that array
 * is not empty. PublicationGateList renders the same ten codes in the same
 * order, so the screen and the database never disagree about whether a project
 * is ready. Which of the ten are hard blockers and which are warnings is an open
 * decision for the client - stated on the page as an open decision rather than
 * quietly resolved here.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. Every value
 * comes from the typed DEMO constants in
 * src/components/owner-dashboard/demo-owner.ts. There is no form on the page,
 * every control is an inert type="button", and there is no client component: the
 * only thing that opens and closes is a native <details>.
 *
 * RULE 7. Every unit figure on this page sits inside one project's availability
 * table, for one period, rendered through formatQty() so the unit type is
 * printed beside the number. Two of these projects sell hectare-years and two
 * sell index points; nothing on this page adds across them, and no figure here
 * spans more than one project. The counts near the top count projects,
 * questions and expressions of interest - and say so, so they cannot be read as
 * volume.
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
    // A private workspace. Nothing here belongs in a search index, and a
    // buyer's question must never turn up in one.
    robots: { index: false, follow: false },
  };
}

export default async function OwnerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const published = DEMO_OWNER_PROJECTS.filter((p) => p.isPublished);
  const blocked = DEMO_OWNER_PROJECTS.filter((p) => p.gaps.length > 0);
  const awaitingAnswer = questionsAwaitingAnswer(DEMO_OWNER_QUESTIONS);
  const answered = questionsAnswered(DEMO_OWNER_QUESTIONS);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('owner.title')}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>

        <p className={styles.lead}>{t('owner.lead')}</p>

        <p className={styles.org}>
          {t('owner.dashboardFor')}{' '}
          <span className={styles.orgName}>{DEMO_OWNER_ORG}</span>
        </p>

        <p className={styles.demoNote}>{t('owner.demoNote')}</p>
      </header>

      <section className={styles.section} aria-labelledby="owner-projects">
        <div className={styles.sectionHead}>
          <h2 id="owner-projects">{t('owner.projects.title')}</h2>

          <p className={styles.counts}>
            {t('owner.projects.count', { count: DEMO_OWNER_PROJECTS.length })}{' '}
            {t('source.separator')}{' '}
            {t('owner.projects.published', { count: published.length })}{' '}
            {t('source.separator')}{' '}
            {t('owner.projects.blocked', { count: blocked.length })}
          </p>

          <SourceStamp
            source={{
              label: t('owner.source.dashboard'),
              locator: null,
              asOfDate: DEMO_OWNER_AS_OF,
            }}
          />

          {/* Said once, at the top, so the absence of a platform-wide figure
              reads as a decision rather than as something not built yet. */}
          <p className={styles.countNote}>{t('owner.countNote')}</p>
        </div>

        {DEMO_OWNER_PROJECTS.length === 0 ? (
          <p className={styles.empty}>{t('owner.projects.empty')}</p>
        ) : (
          <div className={styles.projects}>
            {DEMO_OWNER_PROJECTS.map((project) => (
              <OwnerProjectRow key={project.id} project={project} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="owner-questions">
        <div className={styles.sectionHead}>
          <h2 id="owner-questions">{t('owner.questions.title')}</h2>

          <p className={styles.counts}>
            {t('owner.questions.awaiting', { count: awaitingAnswer.length })}{' '}
            {t('source.separator')}{' '}
            {t('owner.questions.answeredCount', { count: answered.length })}
          </p>

          <p className={styles.sectionLead}>{t('owner.questions.lead')}</p>

          <SourceStamp
            source={{
              label: t('owner.questions.source'),
              locator: null,
              asOfDate: DEMO_OWNER_AS_OF,
            }}
          />
        </div>

        <QuestionQueue questions={DEMO_OWNER_QUESTIONS} locale={locale} />

        <p className={styles.sectionFoot}>
          <Link href="/owner/questions">{t('owner.questions.openInbox')} &rarr;</Link>
        </p>
      </section>

      <section className={styles.section} aria-labelledby="owner-interest">
        <div className={styles.sectionHead}>
          <h2 id="owner-interest">{t('owner.interest.title')}</h2>

          <p className={styles.counts}>
            {t('owner.interest.count', { count: DEMO_OWNER_INTEREST.length })}
          </p>

          <p className={styles.sectionLead}>{t('owner.interest.lead')}</p>

          <SourceStamp
            source={{
              label: t('owner.interest.source'),
              locator: null,
              asOfDate: DEMO_OWNER_AS_OF,
            }}
          />
        </div>

        <InterestQueue interest={DEMO_OWNER_INTEREST} locale={locale} />
      </section>
    </div>
  );
}
