import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DashboardOrganisation } from '@/lib/dashboard/types';
import styles from './OrganisationPanel.module.css';

/**
 * The organisation record, as the operator holds it.
 *
 * This is a record, not a profile: no logo, no photograph, no description
 * written by the organisation itself. What it shows is what the platform will
 * quote back on the public record - sector, country, size band - plus the
 * reference the operator uses to find it.
 *
 * The legal name, registration number and registered address come from
 * org.own_organisation(), a SECURITY DEFINER function scoped to the caller's
 * own organisation. No public-facing role holds a column grant on any of the
 * three, and this panel does not change that: an organisation reads its own
 * record, and nobody else's, by construction. See db/migrations/0080.
 *
 * No person appears here. Personal data sits in the user accounts table alone
 * (concept note, §9), so a contact name on this panel would be a second place
 * it lives, and the right to erasure would then have to reach into it.
 */
export default async function OrganisationPanel({
  organisation,
  locale,
}: {
  organisation: DashboardOrganisation;
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

  // A field the organisation never filled in is shown as a dash rather than as
  // an empty cell: an empty cell reads as a rendering fault.
  const orDash = (value: string | null) => value ?? '—';

  const rows: readonly { id: string; label: string; value: React.ReactNode }[] = [
    { id: 'legalName', label: t('org.legalName'), value: organisation.legalName },
    {
      id: 'registrationNumber',
      label: t('org.registrationNumber'),
      value: (
        <span className={styles.mono}>{orDash(organisation.registrationNumber)}</span>
      ),
    },
    {
      id: 'registeredAddress',
      label: t('org.registeredAddress'),
      value: orDash(organisation.registeredAddress),
    },
    {
      id: 'country',
      label: tRoot('projects.filters.country'),
      value: countryName(organisation.countryCode),
    },
    // The label comes from platform.sector / platform.size_band, already
    // resolved for this locale. Reference data is translated by the authority
    // that owns the codes, not by a key per code in the message catalogue.
    { id: 'sector', label: t('org.sector'), value: organisation.sectorLabel },
    { id: 'sizeBand', label: t('org.sizeBand'), value: organisation.sizeBandLabel },
    {
      id: 'orgRef',
      label: t('org.orgRef'),
      value: <span className={styles.mono}>{organisation.orgId}</span>,
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
          label: t('source.organisationRecord'),
          locator: null,
          asOfDate: organisation.recordedOn,
        }}
      />

      {/* There is no "request a correction" control, because there is nothing
          behind one yet. org.organisation is updatable by the operator alone
          (migration 0016), so a correction is a message to Sylva, and the note
          says that rather than a button pretending otherwise. */}
      <p className={styles.amend}>{t('org.amendNote')}</p>
    </section>
  );
}
