import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import QuestionThread from './QuestionThread';
import NoQuestions from './NoQuestions';
import {
  DEMO_INBOX_EXTRACT,
  countAwaiting,
  isAnswered,
  type DemoQuestion,
  type DemoQuestionProject,
} from './demo-questions';
import styles from './ProjectQuestions.module.css';

/**
 * One project's questions.
 *
 * The inbox is grouped by project because a question only means something
 * against the project it was asked about: the same buyer label belongs to a
 * different organisation on a different project, and the answer an owner can
 * give depends on that project's documents.
 *
 * Unanswered questions come first inside the group, then answered ones, each set
 * newest first. Nothing is hidden behind a filter, and a project that has had no
 * questions still gets its heading and says so.
 *
 * The two figures in the head count questions, and both carry the extract they
 * were counted from. Neither is a unit volume, and no figure in this group is
 * added to a figure in another group.
 */
export default async function ProjectQuestions({
  project,
  questions,
  locale,
}: {
  project: DemoQuestionProject;
  questions: readonly DemoQuestion[];
  locale: string;
}) {
  const t = await getTranslations('ownerQuestions');
  const tRoot = await getTranslations();

  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  let country = project.countryCode;
  try {
    country = regionNames?.of(project.countryCode) ?? project.countryCode;
  } catch {
    country = project.countryCode;
  }

  // Unanswered first, then answered. Both sets keep the order they arrive in,
  // which is newest first.
  const ordered = [
    ...questions.filter((q) => !isAnswered(q)),
    ...questions.filter(isAnswered),
  ];

  const headingId = `owner-questions-project-${project.slug}`;

  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          <h3 id={headingId} className={styles.title}>
            {project.name}
          </h3>
          <p className={styles.place}>{country}</p>
        </div>

        <div className={styles.headSide}>
          <p className={styles.counts}>
            {t('project.questionCount', { count: questions.length })}{' '}
            {tRoot('source.separator')}{' '}
            {t('project.awaitingCount', { count: countAwaiting(questions) })}
          </p>
          <SourceStamp
            source={{
              label: t('source.inbox'),
              locator: null,
              asOfDate: DEMO_INBOX_EXTRACT.asOfDate,
            }}
          />
          <p className={styles.away}>
            <Link href={`/projects/${project.slug}`}>{tRoot('projects.viewProject')}</Link>
          </p>
        </div>
      </div>

      {ordered.length === 0 ? (
        <NoQuestions title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <div className={styles.threads}>
          {ordered.map((question) => (
            <QuestionThread
              key={question.ref}
              question={question}
              project={project}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}
