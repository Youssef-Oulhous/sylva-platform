import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import QuestionFilter from '@/components/admin-area/QuestionFilter';
import QuestionThread from '@/components/admin-area/QuestionThread';
import { requireRole } from '@/lib/auth/guards';
import { AREA, QUESTIONS, label, labelWith } from '@/lib/admin/labels';
import {
  isQuestionState,
  loadOperatorQuestions,
  type OperatorQuestions,
  type QuestionState,
} from '@/lib/admin/questions';
import { logOperatorRead } from '@/lib/admin/record';
import styles from '@/components/admin-area/AdminArea.module.css';

/**
 * The private questions, from Sylva's side.
 *
 * §6 of the concept note is explicit: a question asked about a project goes "to
 * the project owner and to us, not to a public comment feed". The owner half has
 * had /owner/questions for a while. The "and to us" half had nowhere at all - an
 * operator could reach a question only by opening one project page at a time,
 * under a heading that read "your questions about this project", with no
 * indication of who had asked. So half of a stated promise was undeliverable.
 *
 * THIS PAGE READS AND DOES NOT WRITE. deal.project_question is append-only and
 * the operator's policy on it is USING (true). Whether Sylva may answer on a
 * project owner's behalf is not settled by the pilot material, so no answer
 * control is offered and the page says why rather than leaving a gap. (The
 * database does grant the operator INSERT on deal.project_question_answer,
 * which is worth knowing when that decision is taken - see the notes in
 * src/lib/admin/questions.ts.)
 *
 * IDENTITY. The asker is named, and so is the label it appears under on the
 * record. Rule 5 governs the PUBLIC record; a question never reaches it, and the
 * only readers of a question are the asker, the owner, an auditor and a Sylva
 * operator. Both are printed because an operator arriving from the record has
 * the label and needs the name, and one arriving from the vetting queue has the
 * name and needs the label.
 *
 * RULE 7. There is no unit volume on this page. The figures count questions, and
 * each prints the word beside the number.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: label(t, QUESTIONS.title),
    // Other organisations' private correspondence. Never indexed.
    robots: { index: false, follow: false },
  };
}

export default async function AdminQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireRole('operator', '/admin/questions');

  const t = await getTranslations();
  const query = await searchParams;
  const state: QuestionState = isQuestionState(query.state) ? query.state : 'all';

  let inbox: OperatorQuestions | null = null;
  let failed = false;
  try {
    inbox = await loadOperatorQuestions(viewer.actor, locale, state);
  } catch (err) {
    console.error('[admin] could not read the questions:', err);
    failed = true;
  }

  await logOperatorRead(viewer.actor, 'admin.questions');

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{label(t, AREA.eyebrow)}</p>
        <div className={styles.headTop}>
          <h1>{label(t, QUESTIONS.title)}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{label(t, QUESTIONS.lead)}</p>
        <p className={`${styles.statement} ${styles.statementStrong}`}>
          {label(t, QUESTIONS.noPublicThread)}
        </p>
        <p className={styles.statement}>{label(t, QUESTIONS.whyIdentity)}</p>
        <p className={styles.statement}>{label(t, QUESTIONS.answerRule)}</p>
        {inbox && (
          <div className={styles.stamp}>
            <SourceStamp
              source={{
                label: label(t, QUESTIONS.sourceLabel),
                locator: null,
                asOfDate: inbox.asOf,
              }}
            />
          </div>
        )}
      </header>

      {failed && (
        <p className={styles.failure} role="alert">{label(t, AREA.readFailed)}</p>
      )}

      {inbox && (
        <section className={styles.section} aria-labelledby="questions-list">
          <h2 id="questions-list">{label(t, QUESTIONS.listTitle)}</h2>

          <div className={styles.countRow}>
            <p className={styles.count}>
              {labelWith(t, QUESTIONS.count, { count: inbox.total })}
              {' · '}
              {labelWith(t, QUESTIONS.openCount, { count: inbox.open })}
            </p>
          </div>

          <QuestionFilter state={state} />

          {inbox.questions.length === 0 ? (
            <p className={styles.empty}>
              {label(t, inbox.total === 0 ? QUESTIONS.emptyAll : QUESTIONS.empty)}
            </p>
          ) : (
            inbox.questions.map((q) => (
              <QuestionThread
                key={q.questionId}
                question={q}
                headingId={`question-${q.questionId}`}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}
