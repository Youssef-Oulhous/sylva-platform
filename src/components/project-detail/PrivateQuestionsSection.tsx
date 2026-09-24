import { getTranslations } from 'next-intl/server';
import type { DemoProject } from './demo-data';
import styles from './PrivateQuestionsSection.module.css';

/**
 * A private question to the project owner and to Sylva.
 *
 * There is no public comment thread on this platform, and the absence is stated
 * rather than left to be inferred: a visitor who expects a Q&A feed needs to
 * know their question is not about to be published.
 *
 * Frontend pass: the form renders, is labelled, and has no action and no
 * validation. It submits nowhere. The recipients are stated as fact, not offered
 * as a control, because the routing is not the sender's choice.
 */
export default async function PrivateQuestionsSection({
  project,
}: {
  project: DemoProject;
}) {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('projectPage.questions.title')}</h2>
      <p className={styles.lead}>{t('projectPage.questions.lead')}</p>

      <div className={styles.grid}>
        <form className={styles.form} aria-describedby="questions-recipients">
          <div className={styles.field}>
            <label htmlFor="question-subject" className={styles.label}>
              {t('projectPage.questions.subjectLabel')}
            </label>
            <select id="question-subject" name="subject" className={styles.select} defaultValue="">
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
              className={styles.textarea}
              placeholder={t('projectPage.questions.bodyPlaceholder')}
            />
            <p className={styles.hint}>{t('projectPage.questions.bodyHint')}</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="question-reply" className={styles.label}>
              {t('projectPage.questions.replyLabel')}
            </label>
            <input
              id="question-reply"
              name="replyTo"
              type="email"
              className={styles.input}
              autoComplete="email"
            />
            <p className={styles.hint}>{t('projectPage.questions.replyHint')}</p>
          </div>

          <button type="button" className={styles.submit}>
            {t('projectPage.questions.send')}
          </button>
          <p className={styles.pending}>{t('projectPage.questions.notWiredYet')}</p>
        </form>

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
