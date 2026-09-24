import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import type { BuyerOrganisation } from './types';
import styles from './PublicLabelPanel.module.css';

/**
 * How this organisation appears to everybody else.
 *
 * "On the public version of that record the buyer appears as a label such as
 * 'Buyer 014' with its sector, country and size, unless it has chosen to be
 * named for that deal." (Concept note, §8, rule 5.)
 *
 * A buyer cannot check that statement against a sentence describing it, so the
 * panel prints the actual published line instead - the same four fields the
 * public record shows, in the same order - and says which of them are the
 * organisation's own choice.
 */
export default async function PublicLabelPanel({
  organisation,
  specimen,
  locale,
}: {
  organisation: BuyerOrganisation;
  /** One published line, reproduced exactly as the public record renders it. */
  specimen: { projectName: string; eventKey: string; dateIso: string };
  locale: string;
}) {
  const t = await getTranslations('buyerDashboard');
  const format = await getFormatter();

  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  let countryName = organisation.countryCode;
  try {
    countryName = regionNames?.of(organisation.countryCode) ?? organisation.countryCode;
  } catch {
    countryName = organisation.countryCode;
  }

  const buyerLine = [
    organisation.publicLabel,
    t(organisation.sectorKey),
    countryName,
    t(organisation.sizeBandKey),
  ].join(' · ');

  return (
    <section className={styles.panel} aria-labelledby="public-label">
      <div className={styles.text}>
        <h3 id="public-label" className={styles.panelTitle}>
          {t('disclosure.title')}
        </h3>
        <p className={styles.body}>{t('disclosure.body')}</p>
        <p className={styles.body}>{t('disclosure.perDealBody')}</p>
        <p className={styles.link}>
          <Link href="/record">{t('disclosure.recordLink')}</Link>
        </p>
      </div>

      <div className={styles.specimen}>
        <p className={styles.specimenLabel}>{t('disclosure.specimenLabel')}</p>
        <dl className={styles.record}>
          <div className={styles.recordRow}>
            <dt className={styles.recordKey}>{t('disclosure.specimen.project')}</dt>
            <dd className={styles.recordValue}>{specimen.projectName}</dd>
          </div>
          <div className={styles.recordRow}>
            <dt className={styles.recordKey}>{t('disclosure.specimen.event')}</dt>
            <dd className={styles.recordValue}>{t(specimen.eventKey)}</dd>
          </div>
          <div className={styles.recordRow}>
            <dt className={styles.recordKey}>{t('disclosure.specimen.buyer')}</dt>
            <dd className={styles.recordValue}>{buyerLine}</dd>
          </div>
          <div className={styles.recordRow}>
            <dt className={styles.recordKey}>{t('disclosure.specimen.date')}</dt>
            <dd className={styles.recordValue}>
              <time dateTime={specimen.dateIso}>
                {format.dateTime(new Date(specimen.dateIso), 'short')}
              </time>
            </dd>
          </div>
        </dl>
        <p className={styles.specimenNote}>{t('disclosure.specimenNote')}</p>
      </div>
    </section>
  );
}
