import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { DEAL_SHAPE_LABEL_KEY, type RecordedInterest } from '@/lib/interest/types';
import { c } from './copy';
import styles from './InterestConfirmation.module.css';

/**
 * The confirmation screen.
 *
 * This is the screen that stops the main call to action dead-ending. It answers
 * the four questions a buyer has the moment the enquiry leaves their hands:
 * what exactly was recorded, who now knows about it, how they appear on the
 * public record, and what happens next.
 *
 * EVERY FIELD BELOW IS READ BACK FROM THE DATABASE, not echoed from the form.
 * If the buyer asked to be named and the disclosure event did not land, this
 * screen says "pseudonymous", because that is what the record says. A
 * confirmation that repeated the POST body would be a screenshot of an
 * intention rather than evidence of a fact.
 *
 * Rule 7. The volumes are listed per period, each with the project's unit
 * label, and no total is printed. Two lines are the same unit type of the same
 * project - so a sum would be arithmetically valid - and it is still not shown,
 * because 2028 and 2029 are different deliverables and a single figure would
 * read as one quantity.
 */
export default async function InterestConfirmation({
  recorded,
}: {
  recorded: RecordedInterest;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const unit = recorded.unitMetricLabel;
  const occurredAt = new Date(recorded.occurredAt);

  const shapeKey = recorded.intendedShape
    ? DEAL_SHAPE_LABEL_KEY[recorded.intendedShape]
    : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h2 className={styles.title}>{t('expressInterest.confirmation.title')}</h2>
          {/* The word carries the state. Neutral, not green: on this platform
              green means biodiversity or a primary action, and a confirmation is
              neither. */}
          <Badge tone="neutral">{t('expressInterest.confirmation.recordedWord')}</Badge>
        </div>
        <p className={styles.body}>{t('expressInterest.confirmation.body')}</p>

        {/* The record block, in the vocabulary the public record uses. */}
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.reference.project')}</dt>
            <dd className={styles.value}>
              <Link href={`/projects/${recorded.projectSlug}`}>{recorded.projectTitle}</Link>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{c(t, 'ownerLabel')}</dt>
            <dd className={styles.value}>{recorded.ownerOrgName}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.event')}</dt>
            <dd className={styles.value}>{t('expressInterest.event.interestExpressed')}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>
              {t('expressInterest.confirmation.organisation')}
            </dt>
            {/* org.actor_organisation_name() returns the caller's OWN name.
                null only if the signed context did not resolve, in which case
                the screen says nothing rather than guessing. */}
            <dd className={styles.value}>{recorded.organisationName ?? '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.publicRecord')}</dt>
            <dd className={styles.value}>
              {recorded.disclosed ? (
                recorded.organisationName ?? '—'
              ) : (
                <span className={styles.mono}>{recorded.pseudonym ?? '—'}</span>
              )}
              <span className={styles.valueNote}>
                {recorded.disclosed
                  ? t('expressInterest.confirmation.publicRecordNamed')
                  : t('expressInterest.confirmation.publicRecordPseudonym')}
              </span>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.date')}</dt>
            <dd className={styles.value}>
              <time dateTime={recorded.occurredAt} className={styles.mono}>
                {format.dateTime(occurredAt, 'long')}
              </time>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.reference')}</dt>
            <dd className={styles.value}>
              <span className={styles.mono}>{recorded.reference}</span>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{c(t, 'stageLabel')}</dt>
            <dd className={styles.value}>{c(t, 'stageInterest')}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.dealShape')}</dt>
            <dd className={styles.value}>
              {shapeKey ? t(shapeKey) : c(t, 'shapeUndecided')}
            </dd>
          </div>
        </dl>

        {recorded.volumes.length > 0 ? (
          <div className={styles.volumes}>
            <table className={styles.volumeTable}>
              <caption>{t('expressInterest.confirmation.volumesCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('project.period')}</th>
                  <th scope="col" className="num">
                    {t('expressInterest.confirmation.volumeHeader')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recorded.volumes.map((line) => (
                  <tr key={line.periodId}>
                    <th scope="row" className={styles.periodCell}>
                      {line.periodLabel}
                    </th>
                    <td className="num">
                      {format.number(line.requested.amount, 'volume')}{' '}
                      <span className={styles.unitInline}>{unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* These figures came from the buyer, so the buyer's own enquiry is
                their source - and the database says so: deal.interest_volume
                carries source_label and as_of_date as NOT NULL columns, so a
                volume cannot be stored without them. */}
            <SourceStamp
              source={{
                label: recorded.volumes[0]!.source.label,
                locator: recorded.reference,
                asOfDate: recorded.volumes[0]!.source.asOfDate,
              }}
            />
            <p className={styles.note}>{t('expressInterest.confirmation.noTotalNote')}</p>
          </div>
        ) : null}

        <p className={styles.note}>
          {recorded.hasMessage ? c(t, 'messageSent') : c(t, 'noMessage')}
        </p>

        <div className={styles.next}>
          <h3 className={styles.nextTitle}>{t('expressInterest.confirmation.nextTitle')}</h3>
          <ol className={styles.steps}>
            <li>{t('expressInterest.confirmation.next1')}</li>
            <li>{t('expressInterest.confirmation.next2')}</li>
            <li>{t('expressInterest.confirmation.next3')}</li>
          </ol>
        </div>

        {/* The release-1 boundary, stated plainly rather than as a disabled
            "Open deal room" button that would promise a room there is none. */}
        <div className={styles.later}>
          <h3 className={styles.nextTitle}>{t('expressInterest.confirmation.dealRoomTitle')}</h3>
          <p className={styles.laterBody}>{t('expressInterest.confirmation.dealRoomBody')}</p>
          <p className={styles.laterBody}>{t('expressInterest.confirmation.signingBody')}</p>
        </div>

        <p className={styles.permanent}>{t('expressInterest.confirmation.permanentNote')}</p>

        <div className={styles.actions}>
          <Link href={`/projects/${recorded.projectSlug}`} className={styles.primaryLink}>
            {t('expressInterest.confirmation.backToProject')}
          </Link>
          <Link href="/record" className={styles.secondaryLink}>
            {t('expressInterest.confirmation.viewRecord')}
          </Link>
        </div>
      </div>
    </div>
  );
}
