import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import StageTimeline from './StageTimeline';
import type { BuyerDeal } from './types';
import styles from './DealCard.module.css';

/**
 * One deal, one card.
 *
 * RULE 7 lives here, because this is the only part of the dashboard that prints
 * a unit volume. One card is one project, one period and one unit type, and
 * both figures on it are printed against that unit label. The two figures are
 * comparable with each other - they are the same project, period and unit - and
 * with nothing on any other card.
 *
 * The cards are therefore deliberately NOT a table. A table of deals would put
 * 2,400 hectare-years directly above 120 index points in a shared column, and a
 * column is a promise that its cells can be compared. Nothing on this page adds
 * the two, and nothing arranges them so that a reader would try.
 *
 * The card is not a chat thread either: it is the state of a transaction, so it
 * leads with who, what shape of deal, which stage, and what is under
 * discussion. The message count is not here; the documents are.
 */
export default async function DealCard({ deal }: { deal: BuyerDeal }) {
  const t = await getTranslations('buyerDashboard');
  const tRoot = await getTranslations();
  const format = await getFormatter();

  const unit = t(deal.volume.unitLabelKey);
  const headingId = `deal-${deal.id}`;
  const stageHeadingId = `deal-${deal.id}-stage`;
  const volumeHeadingId = `deal-${deal.id}-volume`;

  const date = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'short')}</time>
  );

  return (
    <article className={styles.card} aria-labelledby={headingId}>
      <div className={styles.head}>
        <div>
          <h3 id={headingId} className={styles.projectName}>
            <Link href={`/projects/${deal.projectSlug}`}>{deal.projectName}</Link>
          </h3>
          <p className={styles.place}>
            {deal.locationLabel} · {tRoot('project.owner')}: {deal.ownerOrgName}
          </p>
        </div>
        <div className={styles.headBadges}>
          {/* A deal shape is a financial fact, so it takes the neutral tone.
              Green is reserved for biodiversity and the primary action. */}
          <Badge tone="neutral">{t(deal.dealTypeKey)}</Badge>
          <Badge tone="demo">{tRoot('demo.badge')}</Badge>
        </div>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('deals.dealRef')}</dt>
          <dd className={styles.factValue}>
            <span className={styles.mono}>{deal.dealRef}</span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('deals.openedOn')}</dt>
          <dd className={styles.factValue}>{date(deal.openedOn)}</dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('deals.lastActivity')}</dt>
          <dd className={styles.factValue}>
            {date(deal.lastActivityOn)}
            <span className={styles.factNote}>{t(deal.lastActivityKey)}</span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('deals.disclosureLabel')}</dt>
          <dd className={styles.factValue}>
            {t(`deals.disclosureState.${deal.disclosure}`)}
            <span className={styles.factNote}>{deal.disclosureDisplay}</span>
          </dd>
        </div>
        <div className={styles.fact}>
          {/* A count of documents. Its label names what it counts, so the
              number cannot be read as a unit volume. */}
          <dt className={styles.factLabel}>{t('deals.documentsInRoom')}</dt>
          <dd className={styles.factValue}>{format.number(deal.documentCount)}</dd>
        </div>
      </dl>

      <div className={styles.block}>
        <h4 id={stageHeadingId} className={styles.blockTitle}>
          {t('deals.stageTitle')}
        </h4>
        <StageTimeline stage={deal.stage} labelledBy={stageHeadingId} />
      </div>

      <div className={styles.block}>
        <h4 id={volumeHeadingId} className={styles.blockTitle}>
          {t('deals.volumeTitle')}
        </h4>

        <p className={styles.volumeScope}>
          {tRoot('project.period')} {deal.volume.periodLabel} · {deal.volume.schemeName}
        </p>

        <dl className={styles.figures} aria-labelledby={volumeHeadingId}>
          <div className={styles.figure}>
            <dt className={styles.figureLabel}>{t('deals.underDiscussion')}</dt>
            <dd className={styles.figureValue}>
              <span className={styles.figureNumber}>
                {format.number(deal.volume.underDiscussion)}
              </span>{' '}
              {/* The unit travels with the number, always. */}
              <span className={styles.figureUnit}>{unit}</span>
            </dd>
          </div>

          <div className={styles.figure}>
            <dt className={styles.figureLabel}>
              {t('deals.remainingInPeriod', { period: deal.volume.periodLabel })}
            </dt>
            <dd className={styles.figureValue}>
              <span className={styles.figureNumber}>
                {format.number(deal.volume.remainingInPeriod)}
              </span>{' '}
              <span className={styles.figureUnit}>{unit}</span>
            </dd>
          </div>
        </dl>

        <SourceStamp
          source={{
            label: t(deal.volume.source.labelKey),
            locator: deal.volume.source.locator,
            asOfDate: deal.volume.source.asOfDate,
          }}
        />

        <p className={styles.unitNote}>
          {t('deals.unitNote', { unit, scheme: deal.volume.schemeName })}
        </p>
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.primary}>
          {t('deals.openDealRoom')}
        </button>
        <Link href={`/projects/${deal.projectSlug}`} className={styles.secondary}>
          {tRoot('projects.viewProject')}
        </Link>
      </div>
    </article>
  );
}
