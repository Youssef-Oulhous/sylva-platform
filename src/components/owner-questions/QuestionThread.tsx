import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import { isAnswered, type OwnerQuestion } from '@/lib/owner/types';
import { ownerText } from '@/lib/owner/messages';
import ReplyBox from './ReplyBox';
import styles from './QuestionThread.module.css';

/**
 * One question, its replies, and a box to add another.
 *
 * Laid out as a piece of correspondence in a file, not as a chat bubble: the
 * reference, the date, the project and the counterparty stand in a labelled
 * column on the left, the question and the replies run down the right. At 375px
 * the column moves above the text rather than shrinking.
 *
 * Status is never colour alone. An unanswered question carries the words
 * "Awaiting your reply" and an answered one carries "Answered"; the tint behind
 * each badge repeats what the word already said.
 *
 * The counterparty appears under the label it has for its deal with this
 * project, and the line beneath says whether that is a label or a name, because
 * an owner reading two questions side by side must be able to tell them apart.
 * Where no deal ties the two together there is no label, and the page says that
 * rather than inventing one - see migration 0075 and FINDING-006.
 *
 * Every reply is shown, oldest first, because a reply is a new append-only row:
 * a correction is a further reply and the first one stays on the record.
 */
export default async function QuestionThread({
  question,
  locale,
}: {
  question: OwnerQuestion;
  locale: string;
}) {
  const t = await getTranslations();
  const tq = await getTranslations('ownerQuestions');
  const format = await getFormatter();

  let countryName = question.asker.countryCode;
  try {
    countryName = new Intl.DisplayNames([locale], { type: 'region' })
      .of(question.asker.countryCode) ?? question.asker.countryCode;
  } catch {
    countryName = question.asker.countryCode;
  }

  const answered = isAnswered(question);
  const anchor = `question-${question.id}`;
  const headingId = `${anchor}-heading`;
  const askerName = question.asker.label ?? ownerText(t, 'partyUnlabelled');

  return (
    <article className={styles.thread} aria-labelledby={headingId} id={anchor}>
      <div className={styles.head}>
        <h4 id={headingId} className={styles.topic}>
          {ownerText(t, 'questionRef')} {question.id}
        </h4>
        <div className={styles.badges}>
          {answered ? (
            <Badge tone="neutral">{tq('state.answered')}</Badge>
          ) : (
            <Badge tone="warning">{tq('state.unanswered')}</Badge>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{tq('thread.refLabel')}</dt>
            <dd className={styles.metaValueMono}>{question.id}</dd>
          </div>

          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{tq('thread.askedLabel')}</dt>
            <dd className={styles.metaValue}>
              <time dateTime={question.askedOn}>
                {format.dateTime(new Date(question.askedOn), 'short')}
              </time>
            </dd>
          </div>

          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{tq('thread.projectLabel')}</dt>
            <dd className={styles.metaValue}>
              <Link href={`/projects/${question.projectSlug}`}>
                {question.projectTitle}
              </Link>
            </dd>
          </div>

          <div className={styles.metaItem}>
            <dt className={styles.metaTerm}>{tq('thread.buyerLabel')}</dt>
            <dd className={styles.metaValue}>
              <span className={styles.buyerLabel}>{askerName}</span>
              {question.asker.legalName !== null && (
                <span className={styles.buyerName}>{question.asker.legalName}</span>
              )}
              <span className={styles.identityKind}>
                {question.asker.legalName !== null
                  ? tq('identity.named')
                  : question.asker.label !== null
                    ? tq('identity.pseudonym')
                    /* No deal ties this asker to this project yet, so no label
                       has been issued. Said in a sentence rather than left as a
                       blank the reader has to interpret. */
                    : ownerText(t, 'partyUnlabelledNote')}
              </span>
              <span className={styles.buyerProfile}>
                {question.asker.sectorLabel} {t('source.separator')} {countryName}{' '}
                {t('source.separator')} {question.asker.sizeBandLabel}
              </span>
            </dd>
          </div>
        </dl>

        <div className={styles.body}>
          <div className={styles.question}>
            <p className={styles.blockLabel}>
              {tq('thread.questionLabel', { buyer: askerName })}
            </p>
            <p className={styles.questionText}>{question.body}</p>
          </div>

          {question.answers.map((answer) => (
            <div key={answer.id} className={styles.reply}>
              <p className={styles.blockLabel}>{tq('thread.replyLabel')}</p>
              <p className={styles.replyText}>{answer.body}</p>
              <p className={styles.replyMeta}>
                {tq('thread.replySentBy', {
                  org: answer.byOrgName ?? ownerText(t, 'notStated'),
                })}{' '}
                {t('source.separator')}{' '}
                <time dateTime={answer.answeredOn}>
                  {format.dateTime(new Date(answer.answeredOn), 'short')}
                </time>
              </p>
              <p className={styles.replyVisibility}>{tq('thread.replyVisibility')}</p>
            </div>
          ))}

          {answered ? (
            /* Native details. No client component is needed to open a panel,
               and a further reply is not the main action on an answered
               question, so it starts closed. */
            <details className={styles.further}>
              <summary className={styles.furtherSummary}>
                {tq('thread.furtherReply')}
              </summary>
              <div className={styles.furtherBody}>
                <ReplyBox questionId={question.id} variant="further" />
              </div>
            </details>
          ) : (
            <ReplyBox questionId={question.id} />
          )}
        </div>
      </div>
    </article>
  );
}
