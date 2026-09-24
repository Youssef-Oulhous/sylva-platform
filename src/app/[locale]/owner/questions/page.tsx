import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import QuestionsScope from '@/components/owner-questions/QuestionsScope';
import QuestionFilters from '@/components/owner-questions/QuestionFilters';
import ProjectQuestions from '@/components/owner-questions/ProjectQuestions';
import NoQuestions from '@/components/owner-questions/NoQuestions';
import {
  DEMO_INBOX_EXTRACT,
  DEMO_OWNER,
  DEMO_OWNER_PROJECTS,
  DEMO_QUESTIONS,
  countAnswered,
  countAwaiting,
  questionsForProject,
} from '@/components/owner-questions/demo-questions';
import styles from './page.module.css';

/**
 * The project owner's question inbox.
 *
 * The concept note (section 6) gives the question box one sentence: questions go
 * to the project owner and to the operator, not to a public comment feed. This
 * page is built around that sentence. It states who reads a question before the
 * first question is read, it says on every reply that the operator can see it and
 * that nothing here is published, and it shows the buyer under the label it has
 * for that deal rather than by name.
 *
 * It is deliberately not a chat application. A question is a piece of
 * correspondence in a project file: it has a reference, a date, a project and a
 * counterparty, and the reply is written against the project's documents. So each
 * question is laid out as a filed item with a labelled column of metadata, not as
 * a bubble in a stream.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. The owner,
 * its projects and the questions are typed DEMO constants in
 * src/components/owner-questions/demo-questions.ts. No form element exists on the
 * page, every control is an inert type="button", and there is no client
 * component: the one thing that opens and closes is a native <details>.
 *
 * RULE 7. This page renders no unit volumes at all. The only figures on it count
 * questions, and the note under the count says so, so nothing here belongs to a
 * project's unit scheme and nothing here could be added across projects. The
 * counts are stated per project as well as for the inbox; the inbox figure counts
 * messages, which are the same kind of thing on every project, whereas a unit is
 * not. Volumes stay on each project's availability table, where the unit type
 * travels with the number.
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

export default async function OwnerQuestionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const awaiting = countAwaiting(DEMO_QUESTIONS);
  const answered = countAnswered(DEMO_QUESTIONS);

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('ownerQuestions.title')}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>

        <p className={styles.lead}>{t('ownerQuestions.lead')}</p>

        <p className={styles.owner}>
          {t('ownerQuestions.inboxFor')}{' '}
          <span className={styles.ownerName}>{DEMO_OWNER.name}</span>
        </p>

        <p className={styles.demoNote}>{t('ownerQuestions.demoNote')}</p>
      </header>

      <QuestionsScope />

      <section className={styles.inbox} aria-labelledby="owner-questions-inbox">
        <h2 id="owner-questions-inbox">{t('ownerQuestions.inbox.title')}</h2>

        <div className={styles.countRow}>
          <p className={styles.count}>
            {t('ownerQuestions.inbox.awaiting', { count: awaiting })}{' '}
            {t('source.separator')} {t('ownerQuestions.inbox.answered', { count: answered })}
          </p>
          <p className={styles.scope}>
            {t('ownerQuestions.inbox.scopeNote', { count: DEMO_OWNER_PROJECTS.length })}
          </p>
          <SourceStamp
            source={{
              label: t('ownerQuestions.source.inbox'),
              locator: null,
              asOfDate: DEMO_INBOX_EXTRACT.asOfDate,
            }}
          />
          {/* The page prints counts and nothing else. Said out loud, so the
              absence of a unit figure reads as a decision rather than a gap. */}
          <p className={styles.countNote}>{t('ownerQuestions.inbox.countNote')}</p>
        </div>

        <QuestionFilters />

        {DEMO_QUESTIONS.length === 0 ? (
          <NoQuestions
            title={t('ownerQuestions.emptyAll.title')}
            body={t('ownerQuestions.emptyAll.body')}
          />
        ) : (
          DEMO_OWNER_PROJECTS.map((project) => (
            <ProjectQuestions
              key={project.slug}
              project={project}
              questions={questionsForProject(project.slug)}
              locale={locale}
            />
          ))
        )}
      </section>
    </>
  );
}
