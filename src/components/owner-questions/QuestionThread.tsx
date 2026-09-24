import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import ReplyBox from './ReplyBox';
import type { DemoQuestion, DemoQuestionProject } from './demo-questions';
import styles from './QuestionThread.module.css';

/**
 * One question, one reply box.
 *
 * Laid out as a piece of correspondence in a file, not as a chat bubble: the
 * reference, the date, the project and the buyer stand in a labelled column on
 * the left, the question and the reply run down the right. At 375px the column
 * moves above the text rather than shrinking.
 *
 * Status is never colour alone. An unanswered question carries the words
 * "Awaiting your reply", an answered one carries "Answered", and an unsent draft
 * carries "Draft saved" - the tint behind each badge repeats what the word
 * already said.
 *
 * The buyer appears under the label it has for this deal. Where the buyer chose
 * disclosure, the name is shown as well as the label, and a line says which of
 * the two it is, because an owner reading two questions side by side must be able
 * to tell a label from a name.
 */
export default async function QuestionThread({
  question,
  project,
  locale,
}: {
  question: DemoQuestion;
  project: DemoQuestionProject;
  locale: string;
}) {
  const t = await getTranslations('ownerQuestions');
  const tRoot = await getTranslations();
  const format = await getFormatter();

  // Country names come from the platform's own locale data rather than a key per
  // country, so a new country in the data never arrives untranslated.
  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryName = (code: string) => {
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const answered = question.reply !== null;
  const headingId = `question-${question.ref}`;
  const named = question.buyer.kind === 'named' && question.buyer.name !== null;

  return (
    <article className={styles.thread} aria-labelledby={headingId} id={question.ref}>
      <div className={styles.head}>
        <h4 id={headingId} className={styles.topic}>
          {t(`topic.${question.topic}`)}
        </h4>
        <div className={styles.badges}>
          {answered ? (
            <Badge tone="neutral">{t('state.answered')}</Badge>
          ) : (
            <Badge tone="warning">{t('state.unanswered')}</Badge>
          )}
          {!answered && question.draftKey !== null && (
            <Badge tone="neutral">{t('state.draft')}</Badge>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{t('thread.refLabel')}</dt>
            <dd className={styles.metaValueMono}>{question.ref}</dd>
          </div>

          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{t('thread.askedLabel')}</dt>
            <dd className={styles.metaValue}>
              <time dateTime={question.askedOn}>
                {format.dateTime(new Date(question.askedOn), 'short')}
              </time>
            </dd>
          </div>

          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{t('thread.projectLabel')}</dt>
            <dd className={styles.metaValue}>
              <Link href={`/projects/${project.slug}`}>{project.name}</Link>
            </dd>
          </div>

          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{t('thread.buyerLabel')}</dt>
            <dd className={styles.metaValue}>
              <span className={styles.buyerLabel}>{question.buyer.label}</span>
              {named && <span className={styles.buyerName}>{question.buyer.name}</span>}
              <span className={styles.identityKind}>
                {named ? t('identity.named') : t('identity.pseudonym')}
              </span>
              <span className={styles.buyerProfile}>
                {t(`sector.${question.buyer.sectorCode}`)} {tRoot('source.separator')}{' '}
                {countryName(question.buyer.countryCode)} {tRoot('source.separator')}{' '}
                {t(`sizeBand.${question.buyer.sizeBandCode}`)}
              </span>
            </dd>
          </div>
        </dl>

        <div className={styles.body}>
          <div className={styles.question}>
            <p className={styles.blockLabel}>
              {t('thread.questionLabel', { buyer: question.buyer.label })}
            </p>
            <p className={styles.questionText}>{t(question.bodyKey)}</p>
          </div>

          {question.reply !== null ? (
            <>
              <div className={styles.reply}>
                <p className={styles.blockLabel}>{t('thread.replyLabel')}</p>
                <p className={styles.replyText}>{t(question.reply.bodyKey)}</p>
                <p className={styles.replyMeta}>
                  {t('thread.replySentBy', { org: question.reply.byOrgName })}{' '}
                  {tRoot('source.separator')}{' '}
                  <time dateTime={question.reply.sentOn}>
                    {format.dateTime(new Date(question.reply.sentOn), 'short')}
                  </time>
                </p>
                <p className={styles.replyVisibility}>{t('thread.replyVisibility')}</p>
              </div>

              {/* Native details. No client component is needed to open a panel,
                  and a further reply is not the main action on an answered
                  question, so it starts closed. */}
              <details className={styles.further}>
                <summary className={styles.furtherSummary}>
                  {t('thread.furtherReply')}
                </summary>
                <div className={styles.furtherBody}>
                  <ReplyBox questionRef={question.ref} variant="further" />
                </div>
              </details>
            </>
          ) : (
            <ReplyBox questionRef={question.ref} draftKey={question.draftKey} />
          )}
        </div>
      </div>
    </article>
  );
}
