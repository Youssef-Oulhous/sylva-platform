import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import OwnerProjectRow from '@/components/owner-dashboard/OwnerProjectRow';
import QuestionQueue from '@/components/owner-dashboard/QuestionQueue';
import InterestQueue from '@/components/owner-dashboard/InterestQueue';
import { requireRole } from '@/lib/auth/guards';
import {
  getOwnerOrganisationName, listOwnerInterest, listOwnerProjects, listOwnerQuestions,
} from '@/lib/owner/queries';
import { isAnswered } from '@/lib/owner/types';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * The project owner dashboard, read from the database as this organisation.
 *
 * Three things, in the order an owner needs them: what each project still needs
 * before it can be published, what buyers are waiting for an answer to, and
 * what interest is waiting for a response. Nothing is summarised into a score
 * and nothing is charted. A project owner opening this page should be able to
 * say what to do next after reading one screen.
 *
 * The publication gate is the centre of it, and it is the database's own
 * answer: each row's `gaps` is the array proj.publication_gaps() returned a
 * moment ago, not a reimplementation of it. The trigger on proj.project refuses
 * a change to 'published' while that array is not empty, so the screen and the
 * gate cannot disagree about whether a project is ready. Which of the ten items
 * are hard blockers and which are warnings is an open decision for the client -
 * stated on the page as an open decision rather than quietly resolved here.
 *
 * WHAT THIS PAGE IS NOT ALLOWED TO DO. It runs as sylva_project_owner with the
 * HMAC-signed organisation context, so every query is already narrowed to this
 * organisation by row-level security. requireRole() below decides what is
 * shown; it is not the boundary. See docs/FINDING-001.
 *
 * RULE 7. Every unit figure on this page sits inside one project's availability
 * table, for one period, rendered through formatQty() with that project's own
 * unit label. Nothing here adds across projects, and no figure spans more than
 * one project. The counts near the top count projects, questions and
 * expressions of interest - and say so, so they cannot be read as volume.
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
  const answered = questions.filter(isAnswered);

  // The date the page was rendered. Every figure below was read then, so that
  // is what the source stamps state.
  const asOf = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('owner.title')}</h1>
        </div>

        <p className={styles.lead}>{t('owner.lead')}</p>

        <p className={styles.org}>
          {t('owner.dashboardFor')}{' '}
          <span className={styles.orgName}>{orgName ?? ''}</span>
        </p>

        <p className={styles.demoNote}>{ownerText(t, 'liveNote')}</p>
      </header>

      <section className={styles.section} aria-labelledby="owner-projects">
        <div className={styles.sectionHead}>
          <h2 id="owner-projects">{t('owner.projects.title')}</h2>

          <p className={styles.counts}>
            {t('owner.projects.count', { count: projects.length })}{' '}
            {t('source.separator')}{' '}
            {t('owner.projects.published', { count: published.length })}{' '}
            {t('source.separator')}{' '}
            {t('owner.projects.blocked', { count: blocked.length })}
          </p>

          <SourceStamp
            source={{
              label: t('owner.source.dashboard'),
              locator: null,
              asOfDate: asOf,
            }}
          />

          {/* Said once, at the top, so the absence of a platform-wide figure
              reads as a decision rather than as something not built yet. */}
          <p className={styles.countNote}>{t('owner.countNote')}</p>

          <p className={styles.sectionFoot}>
            <Link href="/owner/projects/new">{ownerText(t, 'addProject')} &rarr;</Link>
          </p>
        </div>

        {projects.length === 0 ? (
          <p className={styles.empty}>{t('owner.projects.empty')}</p>
        ) : (
          <div className={styles.projects}>
            {projects.map((project) => (
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
              asOfDate: asOf,
            }}
          />
        </div>

        <QuestionQueue questions={questions} locale={locale} />

        <p className={styles.sectionFoot}>
          <Link href="/owner/questions">{t('owner.questions.openInbox')} &rarr;</Link>
        </p>
      </section>

      <section className={styles.section} aria-labelledby="owner-interest">
        <div className={styles.sectionHead}>
          <h2 id="owner-interest">{t('owner.interest.title')}</h2>

          <p className={styles.counts}>
            {t('owner.interest.count', { count: interest.length })}
          </p>

          <p className={styles.sectionLead}>{t('owner.interest.lead')}</p>

          <SourceStamp
            source={{
              label: t('owner.interest.source'),
              locator: null,
              asOfDate: asOf,
            }}
          />
        </div>

        <InterestQueue interest={interest} locale={locale} />
      </section>
    </div>
  );
}
