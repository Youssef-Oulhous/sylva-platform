import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import type { DashboardOrganisation, PublicLabel } from '@/lib/dashboard/types';
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
 * public record shows, in the same order.
 *
 * THE LABEL IS ALLOCATED PER PROJECT, so this panel lists one per project
 * rather than printing a single "your label". That is not a display detail: the
 * whole point of a per-project label is that two of an organisation's projects
 * cannot be linked to each other through it, and a screen that showed one label
 * for the organisation would be asserting the opposite.
 *
 * The labels come from org.own_public_labels(), which resolves the caller's own
 * and nobody else's. Migration 0075 revoked the label -> organisation column
 * from every public-facing role precisely so that a reader of the public record
 * cannot do this lookup in the other direction.
 */
export default async function PublicLabelPanel({
  organisation,
  labels,
  specimen,
  locale,
}: {
  organisation: DashboardOrganisation;
  labels: readonly PublicLabel[];
  /** One real published line, or null where nothing has been published yet. */
  specimen: { projectTitle: string; label: string; dateIso: string } | null;
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
  let countryName: string = organisation.countryCode;
  try {
    countryName = regionNames?.of(organisation.countryCode) ?? organisation.countryCode;
  } catch {
    countryName = organisation.countryCode;
  }

  return (
    <section className={styles.panel} aria-labelledby="public-label">
      <div className={styles.text}>
        <h3 id="public-label" className={styles.panelTitle}>
          {t('disclosure.title')}
        </h3>
        <p className={styles.body}>{t('disclosure.body')}</p>
        <p className={styles.body}>{t('disclosure.perDealBody')}</p>

        {labels.length === 0 ? (
          <p className={styles.body}>{t('disclosure.noLabels')}</p>
        ) : (
          <ul className={styles.body}>
            {labels.map((l) => (
              <li key={l.projectId}>
                {l.projectTitle}: <strong>{l.label}</strong>{' '}
                <time dateTime={l.allocatedOn}>
                  ({format.dateTime(new Date(l.allocatedOn), 'short')})
                </time>
              </li>
            ))}
          </ul>
        )}

        <p className={styles.link}>
          <Link href="/record">{t('disclosure.recordLink')}</Link>
        </p>
      </div>

      {specimen === null ? null : (
        <div className={styles.specimen}>
          <p className={styles.specimenLabel}>{t('disclosure.specimenLabel')}</p>
          <dl className={styles.record}>
            <div className={styles.recordRow}>
              <dt className={styles.recordKey}>{t('disclosure.specimen.project')}</dt>
              <dd className={styles.recordValue}>{specimen.projectTitle}</dd>
            </div>
            <div className={styles.recordRow}>
              <dt className={styles.recordKey}>{t('disclosure.specimen.event')}</dt>
              <dd className={styles.recordValue}>
                {t('disclosure.event.interestExpressed')}
              </dd>
            </div>
            <div className={styles.recordRow}>
              <dt className={styles.recordKey}>{t('disclosure.specimen.buyer')}</dt>
              <dd className={styles.recordValue}>
                {[
                  specimen.label,
                  organisation.sectorLabel,
                  countryName,
                  organisation.sizeBandLabel,
                ].join(' · ')}
              </dd>
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
      )}
    </section>
  );
}
