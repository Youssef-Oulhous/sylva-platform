import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoInterestProject, DemoRecordedInterest } from './demo-interest';
import styles from './InterestConfirmation.module.css';

/**
 * The confirmation screen, rendered here as a specimen.
 *
 * This is the screen that stops the main call to action dead-ending. It answers
 * the four questions a buyer has the moment the enquiry leaves their hands: what
 * exactly was recorded, who now knows about it, how they appear on the public
 * record, and what happens next.
 *
 * It is labelled as an example because the enquiry above it does not submit. The
 * label matters: without it, a reader could take the reference below for one of
 * their own.
 *
 * Rule 7. The volumes are listed per period, each with the project's unit label,
 * and no total is printed. Both lines happen to be the same unit type of the same
 * project - so a sum would be arithmetically valid - and it is still not shown,
 * because 2028 and 2029 are different deliverables and a single figure would read
 * as one quantity.
 */
export default async function InterestConfirmation({
  project,
  interest,
}: {
  project: DemoInterestProject;
  interest: DemoRecordedInterest;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const unit = t(project.unitLabelKey);
  const recordedOn = new Date(interest.recordedOn);

  return (
    <div className={styles.wrap}>
      <p className={styles.exampleLabel}>{t('expressInterest.confirmation.exampleLabel')}</p>

      <div className={styles.card}>
        <div className={styles.head}>
          <h3 className={styles.title}>{t('expressInterest.confirmation.title')}</h3>
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
            <dd className={styles.value}>{project.name}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.event')}</dt>
            <dd className={styles.value}>{t(interest.eventKey)}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>
              {t('expressInterest.confirmation.organisation')}
            </dt>
            <dd className={styles.value}>{interest.buyerOrgName}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.publicRecord')}</dt>
            <dd className={styles.value}>
              {interest.disclosed ? (
                interest.buyerOrgName
              ) : (
                <>
                  <span className={styles.mono}>{interest.buyerPseudonym}</span>
                  <span className={styles.sep}> · </span>
                  {t(interest.buyerSectorKey)}
                  <span className={styles.sep}> · </span>
                  {t(interest.buyerCountryKey)}
                </>
              )}
              <span className={styles.valueNote}>
                {interest.disclosed
                  ? t('expressInterest.confirmation.publicRecordNamed')
                  : t('expressInterest.confirmation.publicRecordPseudonym')}
              </span>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.date')}</dt>
            <dd className={styles.value}>
              <time dateTime={interest.recordedOn} className={styles.mono}>
                {format.dateTime(recordedOn, 'long')}
              </time>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.reference')}</dt>
            <dd className={styles.value}>
              <span className={styles.mono}>{interest.reference}</span>
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>{t('expressInterest.confirmation.dealShape')}</dt>
            <dd className={styles.value}>{t(interest.dealShapeKey)}</dd>
          </div>
        </dl>

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
              {interest.requested.map((line) => (
                <tr key={line.periodLabel}>
                  <th scope="row" className={styles.periodCell}>
                    {line.periodLabel}
                  </th>
                  <td className="num">
                    {format.number(line.amount, 'volume')}{' '}
                    <span className={styles.unitInline}>{unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* These figures came from the buyer, so the buyer's own enquiry is
              their source. Saying so is more useful than omitting the stamp. */}
          <SourceStamp
            source={{
              label: t('expressInterest.confirmation.volumeSource'),
              locator: interest.reference,
              asOfDate: interest.recordedOn,
            }}
          />
          <p className={styles.note}>{t('expressInterest.confirmation.noTotalNote')}</p>
        </div>

        <div className={styles.next}>
          <h4 className={styles.nextTitle}>{t('expressInterest.confirmation.nextTitle')}</h4>
          <ol className={styles.steps}>
            <li>{t('expressInterest.confirmation.next1')}</li>
            <li>{t('expressInterest.confirmation.next2')}</li>
            <li>{t('expressInterest.confirmation.next3')}</li>
          </ol>
        </div>

        {/* The release-1 boundary, stated plainly rather than as a disabled
            "Open deal room" button that would promise a room there is none. */}
        <div className={styles.later}>
          <h4 className={styles.nextTitle}>{t('expressInterest.confirmation.dealRoomTitle')}</h4>
          <p className={styles.laterBody}>{t('expressInterest.confirmation.dealRoomBody')}</p>
          <p className={styles.laterBody}>{t('expressInterest.confirmation.signingBody')}</p>
        </div>

        <p className={styles.permanent}>{t('expressInterest.confirmation.permanentNote')}</p>

        <div className={styles.actions}>
          <Link href={`/projects/${project.slug}`} className={styles.primaryLink}>
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
