import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { InvestorOrganisation } from '@/lib/investor/types';
import styles from './Investor.module.css';

/**
 * The organisation record, as Sylva holds it.
 *
 * A RECORD, NOT A PROFILE: no logo, no description the organisation wrote about
 * itself. What it shows is what the platform holds and, for three of the fields,
 * what it will quote on the public record.
 *
 * The legal name, registration number and registered address come from
 * org.own_organisation(). No public-facing role holds a column grant on any of
 * the three in org.organisation (db/migrations/0080), and that function is
 * SECURITY DEFINER, argument-less and scoped to sylva.actor_org_id() - so there
 * is no query behind this panel that could have answered with another
 * organisation's name.
 *
 * NO PERSON APPEARS HERE. Personal data lives in identity.user_account alone
 * (§9), so a contact name on this panel would be a second place it lives and the
 * right to erasure would then have to reach into it.
 *
 * The field labels are the buyer area's, deliberately: "Legal name" and
 * "Registration number" already have agreed wording and a German translation on
 * this platform, and a second set of keys saying the same words in an investor
 * dialect would be a second set to keep in step.
 */
export default async function OrganisationRecord({
  organisation,
  locale,
}: {
  organisation: InvestorOrganisation;
  locale: string;
}) {
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');
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

  // A field nobody filled in is a dash. An empty cell reads as a fault.
  const orDash = (value: string | null) => value ?? '—';

  const rows: readonly { id: string; label: string; value: React.ReactNode }[] = [
    { id: 'legalName', label: tb('org.legalName'), value: organisation.legalName },
    {
      id: 'registrationNumber',
      label: tb('org.registrationNumber'),
      value: <span className={styles.mono}>{orDash(organisation.registrationNumber)}</span>,
    },
    {
      id: 'registeredAddress',
      label: tb('org.registeredAddress'),
      value: orDash(organisation.registeredAddress),
    },
    {
      id: 'country',
      label: t('projects.filters.country'),
      value: countryName(organisation.countryCode),
    },
    { id: 'sector', label: tb('org.sector'), value: organisation.sectorLabel },
    { id: 'sizeBand', label: tb('org.sizeBand'), value: organisation.sizeBandLabel },
    {
      id: 'orgRef',
      label: tb('org.orgRef'),
      value: <span className={styles.mono}>{organisation.orgId}</span>,
    },
    {
      id: 'recordedOn',
      label: tb('org.recordedOn'),
      value: (
        <time dateTime={organisation.recordedOn}>
          {format.dateTime(new Date(organisation.recordedOn), 'short')}
        </time>
      ),
    },
  ];

  return (
    <section className={styles.panel} aria-labelledby="investor-org-record">
      <div className={styles.panelHead}>
        <h2 id="investor-org-record" className={styles.panelTitle}>
          {tb('org.recordTitle')}
        </h2>
      </div>

      <dl className={styles.record}>
        {rows.map((row) => (
          <div key={row.id} className={styles.recordRow}>
            <dt className={styles.recordLabel}>{row.label}</dt>
            <dd className={styles.recordValue}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.stampRow}>
        <SourceStamp
          source={{
            label: tb('source.organisationRecord'),
            locator: null,
            asOfDate: organisation.recordedOn,
          }}
        />
      </div>

      {/* No "request a correction" control, because there is nothing behind one.
          org.organisation is updatable by the operator alone (migration 0016),
          so a correction is a message to Sylva and the note says so rather than
          a button pretending otherwise. */}
      <p className={styles.note}>{tb('org.amendNote')}</p>
    </section>
  );
}
