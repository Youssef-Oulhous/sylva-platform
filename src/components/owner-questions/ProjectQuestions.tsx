import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import { isAnswered, type OwnerQuestion } from '@/lib/owner/types';
import QuestionThread from './QuestionThread';
import NoQuestions from './NoQuestions';
import styles from './ProjectQuestions.module.css';

/**
 * One project's questions.
 *
 * The inbox is grouped by project because a question only means something
 * against the project it was asked about: a counterparty label is scoped to a
 * deal on one project, and the answer an owner can give depends on that
 * project's documents.
 *
 * Unanswered questions come first inside the group, then answered ones, each
 * set newest first. Nothing is hidden, and a project that has had no questions
 * still gets its heading and says so - an absent section would read as a page
 * that failed to load rather than as information.
 *
 * The two figures in the head count questions. Neither is a unit volume, and no
 * figure in this group is added to a figure in another group.
 */
export default async function ProjectQuestions({
  project,
  questions,
  locale,
  asOf,
}: {
  project: { slug: string; title: string; countryCode: string };
  questions: readonly OwnerQuestion[];
  locale: string;
  /** The date this page read the inbox. Carried by the source stamp. */
  asOf: string;
}) {
  const t = await getTranslations('ownerQuestions');
  const tRoot = await getTranslations();

  let country = project.countryCode;
  try {
    country = new Intl.DisplayNames([locale], { type: 'region' }).of(project.countryCode)
      ?? project.countryCode;
  } catch {
    country = project.countryCode;
  }

  // Unanswered first, then answered. Both sets keep the order they arrive in,
  // which is newest first.
  const ordered = [
    ...questions.filter((q) => !isAnswered(q)),
    ...questions.filter(isAnswered),
  ];
  const awaiting = questions.filter((q) => !isAnswered(q)).length;

  const headingId = `owner-questions-project-${project.slug}`;

  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          <h3 id={headingId} className={styles.title}>
            {project.title}
          </h3>
          <p className={styles.place}>{country}</p>
        </div>

        <div className={styles.headSide}>
          <p className={styles.counts}>
            {t('project.questionCount', { count: questions.length })}{' '}
            {tRoot('source.separator')}{' '}
            {t('project.awaitingCount', { count: awaiting })}
          </p>
          <SourceStamp
            source={{ label: t('source.inbox'), locator: null, asOfDate: asOf }}
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
            <QuestionThread key={question.id} question={question} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
