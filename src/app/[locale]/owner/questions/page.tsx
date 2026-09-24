import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import QuestionsScope from '@/components/owner-questions/QuestionsScope';
import QuestionFilters from '@/components/owner-questions/QuestionFilters';
import ProjectQuestions from '@/components/owner-questions/ProjectQuestions';
import NoQuestions from '@/components/owner-questions/NoQuestions';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import { requireRole } from '@/lib/auth/guards';
import { getOwnerOrganisationName, listOwnerQuestions } from '@/lib/owner/queries';
import { isAnswered, type OwnerQuestion } from '@/lib/owner/types';
import { ownerText } from '@/lib/owner/messages';
import styles from './page.module.css';

/**
 * The project owner's question inbox, reading deal.project_question and writing
 * deal.project_question_answer.
 *
 * The concept note (section 6) gives the question box one sentence: questions
 * go to the project owner and to the operator, not to a public comment feed.
 * This page is built around that sentence. It states who reads a question
 * before the first question is read, it says on every reply that Sylva can see
 * it and that nothing here is published, and it shows the buyer under the label
 * it has for its deal rather than by name.
 *
 * It is deliberately not a chat application. A question is a piece of
 * correspondence in a project file: it has a reference, a date, a project and a
 * counterparty, and the reply is written against the project's documents. So
 * each question is laid out as a filed item with a labelled column of metadata,
 * not as a bubble in a stream.
 *
 * WHAT MAKES THE SCOPING TRUE. p_question_owner admits only rows whose
 * owner_org_id is the actor's organisation, and p_answer_insert requires both
 * that the answer is written in the actor's own name and that the question
 * belongs to a project it owns. Another owner's question is not filtered out
 * here - it never arrives, and an answer to one is refused by the database.
 *
 * RULE 7. This page renders no unit volumes at all. The only figures on it
 * count questions, and the note under the count says so, so nothing here
 * belongs to a project's unit scheme and nothing here could be added across
 * projects. Volumes stay on each project's availability table, where the unit
 * type travels with the number.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ownerQuestions' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // A private inbox has nothing to index, and a buyer's question must never
    // turn up in a search.
    robots: { index: false, follow: false },
  };
}

function one(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function OwnerQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', '/owner/questions');
  const t = await getTranslations();
  const sp = await searchParams;

  const [orgName, all] = await Promise.all([
    getOwnerOrganisationName(viewer.actor),
    listOwnerQuestions(viewer.actor, locale),
  ]);

  const asOf = new Date().toISOString().slice(0, 10);

  // The projects this inbox holds questions for, in the order they first
  // appear. Built from the questions themselves, so the filter can never offer
  // a project the reader cannot see.
  const projects: { slug: string; title: string; countryCode: string }[] = [];
  for (const q of all) {
    if (!projects.some((p) => p.slug === q.projectSlug)) {
      projects.push({
        slug: q.projectSlug,
        title: q.projectTitle,
        countryCode: q.projectCountryCode,
      });
    }
  }

  const projectFilter = one(sp.project);
  const stateFilter = one(sp.state);

  const matches = (q: OwnerQuestion) => {
    if (projectFilter && q.projectSlug !== projectFilter) return false;
    if (stateFilter === 'answered' && !isAnswered(q)) return false;
    if (stateFilter === 'unanswered' && isAnswered(q)) return false;
    return true;
  };

  const shown = all.filter(matches);
  const awaiting = shown.filter((q) => !isAnswered(q)).length;
  const answered = shown.filter(isAnswered).length;
  const shownProjects = projectFilter
    ? projects.filter((p) => p.slug === projectFilter)
    : projects;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('ownerQuestions.title')}</h1>
        </div>

        <p className={styles.lead}>{t('ownerQuestions.lead')}</p>

        <p className={styles.owner}>
          {t('ownerQuestions.inboxFor')}{' '}
          <span className={styles.ownerName}>{orgName ?? ''}</span>
        </p>

        <p className={styles.demoNote}>{ownerText(t, 'liveNote')}</p>
      </header>

      <OutcomeNote
        error={one(sp.error)}
        saved={one(sp.answered)}
        savedText="replyRecorded"
      />

      <QuestionsScope />

      <section className={styles.inbox} aria-labelledby="owner-questions-inbox">
        <h2 id="owner-questions-inbox">{t('ownerQuestions.inbox.title')}</h2>

        <div className={styles.countRow}>
          <p className={styles.count}>
            {t('ownerQuestions.inbox.awaiting', { count: awaiting })}{' '}
            {t('source.separator')}{' '}
            {t('ownerQuestions.inbox.answered', { count: answered })}
          </p>
          <p className={styles.scope}>
            {t('ownerQuestions.inbox.scopeNote', { count: shownProjects.length })}
          </p>
          <SourceStamp
            source={{
              label: t('ownerQuestions.source.inbox'),
              locator: null,
              asOfDate: asOf,
            }}
          />
          {/* The page prints counts and nothing else. Said out loud, so the
              absence of a unit figure reads as a decision rather than a gap. */}
          <p className={styles.countNote}>{t('ownerQuestions.inbox.countNote')}</p>
        </div>

        <QuestionFilters
          projects={projects}
          selectedProject={projectFilter}
          selectedState={stateFilter}
        />

        {shown.length === 0 ? (
          <NoQuestions
            title={t('ownerQuestions.emptyAll.title')}
            body={t('ownerQuestions.emptyAll.body')}
          />
        ) : (
          shownProjects.map((project) => (
            <ProjectQuestions
              key={project.slug}
              project={project}
              questions={shown.filter((q) => q.projectSlug === project.slug)}
              locale={locale}
              asOf={asOf}
            />
          ))
        )}
      </section>
    </>
  );
}
