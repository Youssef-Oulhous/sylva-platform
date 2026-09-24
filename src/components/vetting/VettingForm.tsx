import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { saveVettingDraftAction, submitVettingAction } from '@/lib/vetting/actions';
import type { AnswerMap, Questionnaire } from '@/lib/vetting/types';
import QuestionField from './QuestionField';
import { orFallback, orFallbackWith } from './labels';
import styles from './VettingForm.module.css';

/**
 * The questionnaire, as published.
 *
 * There are no parts and no headings between the questions any more, and that
 * is a data decision rather than a design one: org.question has a sort_order
 * and nothing that groups questions. The three-part structure the first build
 * showed was invented in a TypeScript constant, and it would have gone stale
 * the first time Sylva added a ninth question. The order on screen is
 * ORDER BY sort_order, which is the order Sylva set.
 *
 * Two submit buttons, one form, two Server Actions:
 *
 *   Save draft   writes org.vetting_draft. No completeness check.
 *   Submit       writes org.vetting_submission + org.vetting_answer, which are
 *                append-only, and supersedes the previous application.
 *
 * `formAction` on the buttons is what lets one form do both without any client
 * JavaScript. The form itself has no action, so a submit that reaches it by
 * some other route does nothing rather than guessing which of the two was
 * meant.
 *
 * Submitting is NOT approval. The footer says so, because an organisation that
 * believes it has been approved will try to express interest and be refused by
 * R6 with no explanation it can act on.
 */
export default async function VettingForm({
  questionnaire,
  answers,
  missing,
  readOnly = false,
  savedAt,
  savedLabel,
}: {
  questionnaire: Questionnaire;
  answers: AnswerMap;
  /** Question codes the last submit refused for being blank. */
  missing: readonly string[];
  /** True once submitted: the answers are shown, not re-typed. */
  readOnly?: boolean;
  /** When the answers shown were last written, for the source stamp. */
  savedAt: string | null;
  /** What that date IS - a saved draft, or a submitted application. */
  savedLabel: string;
}) {
  const t = await getTranslations('vettingForm');
  const missingSet = new Set(missing);
  const total = questionnaire.questions.length;

  return (
    <section aria-labelledby="vetting-questions-title">
      <div className={styles.head}>
        {/* The count is the database's, so the heading cannot say "eight
            questions" while org.question holds nine. */}
        <h2 id="vetting-questions-title">
          {orFallbackWith(
            t,
            'questionsCountTitle',
            { count: questionnaire.questions.length },
            'The questionnaire',
          )}
        </h2>
        <p className={styles.lead}>{t('questionsLead')}</p>
        <SourceStamp
          source={{
            label: t('source.questionnaire'),
            // The questionnaire is a versioned document like any other here,
            // and the version is the database's, not a constant in a file.
            locator: `v${questionnaire.versionNo}`,
            asOfDate: questionnaire.publishedAt,
          }}
        />
      </div>

      <form className={styles.form} noValidate>
        <div className={styles.questions}>
          {questionnaire.questions.map((question, index) => (
            <QuestionField
              key={question.questionCode}
              question={question}
              n={index + 1}
              total={total}
              answer={answers[question.questionCode]}
              missing={missingSet.has(question.questionCode)}
              readOnly={readOnly}
            />
          ))}
        </div>

        <div className={styles.foot}>
          {readOnly ? (
            <p className={styles.footNote}>
              {orFallback(
                t,
                'actions.submittedNote',
                'This questionnaire has been submitted. The answers above are the '
                + 'ones Sylva is reading. They cannot be edited - the record is '
                + 'append-only - but a new application can be submitted, and it '
                + 'supersedes this one while this one stays on record.',
              )}
            </p>
          ) : (
            <>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.submit}
                  formAction={submitVettingAction}
                >
                  {t('actions.submit')}
                </button>
                <button
                  type="submit"
                  className={styles.secondary}
                  formAction={saveVettingDraftAction}
                >
                  {t('actions.saveDraft')}
                </button>
              </div>

              {savedAt && (
                <SourceStamp
                  source={{
                    label: savedLabel,
                    locator: null,
                    asOfDate: savedAt,
                  }}
                />
              )}

              <p className={styles.footNote}>{t('actions.footNote')}</p>
              <p className={styles.footNote}>
                {orFallback(
                  t,
                  'actions.notApprovalNote',
                  'Submitting is not approval. Sylva reads the answers and records a '
                  + 'decision; until it does, this organisation cannot express interest '
                  + 'in a project.',
                )}
              </p>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
