import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { askProjectQuestionAction } from '@/lib/projects/actions';
import { authMessage, isAuthErrorCode, resolveAuthMessage } from '@/lib/auth/errors';
import { label, UI } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './PrivateQuestionsSection.module.css';

/**
 * A private question to the project owner and to Sylva.
 *
 * There is no public comment thread on this platform, and the absence is stated
 * rather than left to be inferred: a visitor who expects a Q&A feed needs to
 * know their question is not about to be published.
 *
 * The form posts to a Server Action and needs no client JavaScript: the whole
 * outcome is a redirect back to this page with `?qsent=1` or `?qerror=CODE`, so
 * nothing a person typed travels in a URL and the wording of every failure
 * stays in the message catalogue. The database decides who may write - only the
 * buyer and investor roles hold INSERT on deal.project_question, under a policy
 * requiring asker_org_id to equal the signed organisation context.
 *
 * The threads below the form are the VIEWER'S OWN, by the same policy. A buyer
 * cannot see another buyer's questions and an anonymous visitor sees none: the
 * role holds no privilege on the table at all, which is why `questions` is null
 * rather than empty for them.
 */
export default async function PrivateQuestionsSection({
  project,
  sent,
  error,
}: {
  project: ProjectDetail;
  sent: boolean;
  error: string | null;
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const signedOut = project.questions === null;

  return (
    <>
      <h2>{t('projectPage.questions.title')}</h2>
      <p className={styles.lead}>{t('projectPage.questions.lead')}</p>

      <div className={styles.grid}>
        <div className={styles.form}>
          {sent && <p className={styles.sent}>{label(t, UI.questionSent)}</p>}
          {error && isAuthErrorCode(error) && (
            <p className={styles.error} role="alert">
              {resolveAuthMessage(t, authMessage(error).code)}
            </p>
          )}

          {!project.canAskQuestion ? (
            <div className={styles.field}>
              <p className={styles.hint}>{label(t, UI.questionsSignIn)}</p>
              {signedOut && (
                <Link href="/sign-in" className={styles.submit}>
                  {t('nav.signIn')}
                </Link>
              )}
            </div>
          ) : (
            <form action={askProjectQuestionAction} aria-describedby="questions-recipients">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="slug" value={project.slug} />

              <div className={styles.field}>
                <label htmlFor="question-subject" className={styles.label}>
                  {t('projectPage.questions.subjectLabel')}
                </label>
                <select
                  id="question-subject"
                  name="subject"
                  className={styles.select}
                  defaultValue=""
                >
                  <option value="">{t('projectPage.questions.subjectPlaceholder')}</option>
                  <option value="outcomes">{t('project.outcomes')}</option>
                  <option value="claims">{t('project.claimRights')}</option>
                  <option value="durability">{t('project.durability')}</option>
                  <option value="availability">{t('project.availability')}</option>
                  <option value="documents">{t('project.documents')}</option>
                  <option value="other">{t('projectPage.questions.subjectOther')}</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="question-body" className={styles.label}>
                  {t('projectPage.questions.bodyLabel')}
                </label>
                <textarea
                  id="question-body"
                  name="question"
                  rows={6}
                  required
                  minLength={10}
                  maxLength={4000}
                  className={styles.textarea}
                  placeholder={t('projectPage.questions.bodyPlaceholder')}
                />
                <p className={styles.hint}>{t('projectPage.questions.bodyHint')}</p>
              </div>

              <button type="submit" className={styles.submit}>
                {t('projectPage.questions.send')}
              </button>
              {/* No reply-address field: the answer comes back to this page,
                  and an email address typed into a form is one more copy of a
                  personal datum than this platform needs. */}
              <p className={styles.hint}>{label(t, UI.questionsIdentity)}</p>
            </form>
          )}

          {project.questions !== null && (
            <div className={styles.threads}>
              <h3 className={styles.label}>{label(t, UI.questionsYours)}</h3>
              {project.questions.length === 0 ? (
                <p className={styles.hint}>{label(t, UI.questionsNone)}</p>
              ) : (
                <ol className={styles.threadList}>
                  {project.questions.map((q) => (
                    <li key={q.id} className={styles.thread}>
                      <p className={styles.threadBody}>{q.body}</p>
                      <p className={styles.threadMeta}>
                        <time dateTime={q.askedAt}>
                          {format.dateTime(new Date(q.askedAt), 'short')}
                        </time>
                      </p>
                      {q.answers.length === 0 ? (
                        <p className={styles.threadMeta}>
                          {label(t, UI.questionsAwaiting)}
                        </p>
                      ) : (
                        q.answers.map((a) => (
                          <div key={a.id} className={styles.answer}>
                            <p className={styles.threadBody}>{a.body}</p>
                            <p className={styles.threadMeta}>
                              {label(t, UI.questionsAnsweredBy)}{' '}
                              {a.answeredByName ?? t('projectPage.questions.operatorName')}
                              {' · '}
                              <time dateTime={a.answeredAt}>
                                {format.dateTime(new Date(a.answeredAt), 'short')}
                              </time>
                            </p>
                          </div>
                        ))
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <aside className={styles.side}>
          <div className={styles.panel} id="questions-recipients">
            <h3 className={styles.panelTitle}>{t('projectPage.questions.goesToTitle')}</h3>
            <ul className={styles.recipients}>
              <li>
                <span className={styles.recipientRole}>{t('project.owner')}</span>
                <span>{project.ownerOrgName}</span>
              </li>
              <li>
                <span className={styles.recipientRole}>
                  {t('projectPage.questions.operator')}
                </span>
                <span>{t('projectPage.questions.operatorName')}</span>
              </li>
            </ul>
          </div>

          <div className={styles.noPublic}>
            <p className={styles.noPublicTitle}>
              {t('projectPage.questions.noThreadTitle')}
            </p>
            <p className={styles.noPublicBody}>{t('projectPage.questions.noThreadBody')}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
