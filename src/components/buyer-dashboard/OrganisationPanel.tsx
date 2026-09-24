import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { BuyerOrganisation } from './types';
import styles from './OrganisationPanel.module.css';

/**
 * The organisation record, as the operator holds it.
 *
 * This is a record, not a profile: no logo, no photograph, no description
 * written by the organisation itself. What it shows is what the platform will
 * quote back on the public record - sector, country, size band - plus the
 * reference the operator uses to find it.
 *
 * No person appears here. Personal data sits in the user accounts table alone
 * (concept note, §9), so a contact name on this panel would be a second place
 * it lives, and the right to erasure would then have to reach into it.
 */
export default async function OrganisationPanel({
  organisation,
  locale,
}: {
  organisation: BuyerOrganisation;
  locale: string;
}) {
  const t = await getTranslations('buyerDashboard');
  // "Country" already has a word on this platform. A second key for it would be
  // a second thing to translate and a second thing to get out of step.
  const tRoot = await getTranslations();
  const format = await getFormatter();

  // Country names come from the platform's own locale data rather than a key
  // per country, so a new country in the data never arrives untranslated.
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

  const rows: readonly { id: string; label: string; value: React.ReactNode }[] = [
    { id: 'legalName', label: t('org.legalName'), value: organisation.legalName },
    {
      id: 'registrationNumber',
      label: t('org.registrationNumber'),
      value: <span className={styles.mono}>{organisation.registrationNumber}</span>,
    },
    {
      id: 'registeredAddress',
      label: t('org.registeredAddress'),
      value: organisation.registeredAddress,
    },
    {
      id: 'country',
      label: tRoot('projects.filters.country'),
      value: countryName(organisation.countryCode),
    },
    { id: 'sector', label: t('org.sector'), value: t(organisation.sectorKey) },
    { id: 'sizeBand', label: t('org.sizeBand'), value: t(organisation.sizeBandKey) },
    {
      id: 'orgRef',
      label: t('org.orgRef'),
      value: <span className={styles.mono}>{organisation.orgRef}</span>,
    },
    {
      id: 'recordedOn',
      label: t('org.recordedOn'),
      value: (
        <time dateTime={organisation.recordedOn}>
          {format.dateTime(new Date(organisation.recordedOn), 'short')}
        </time>
      ),
    },
  ];

  return (
    <section className={styles.panel} aria-labelledby="organisation-record">
      <h3 id="organisation-record" className={styles.panelTitle}>
        {t('org.recordTitle')}
      </h3>

      <dl className={styles.facts}>
        {rows.map((row) => (
          <div key={row.id} className={styles.fact}>
            <dt className={styles.factLabel}>{row.label}</dt>
            <dd className={styles.factValue}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <SourceStamp
        source={{
          label: t(organisation.source.labelKey),
          locator: organisation.source.locator,
          asOfDate: organisation.source.asOfDate,
        }}
      />

      <p className={styles.amend}>{t('org.amendNote')}</p>
      <button type="button" className={styles.action}>
        {t('org.amendAction')}
      </button>
    </section>
  );
}
