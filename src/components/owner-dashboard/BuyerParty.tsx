import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { ownerText } from '@/lib/owner/messages';
import type { OwnerParty } from '@/lib/owner/types';
import styles from './BuyerParty.module.css';

/**
 * How a counterparty appears to the project owner.
 *
 * Pseudonymous by default: the concept note makes naming the buyer's own
 * choice, deal by deal. The sector, country and size band beside the label are
 * the attributes the public record carries, and they come from the database as
 * localised labels rather than from a code-to-key map here - a sector added to
 * platform.sector later must not arrive on screen as a missing translation.
 *
 * Where no label has been issued the component says so in words instead of
 * inventing one. Since migration 0075 no application role may read the column
 * that maps a label back to an organisation, so a label exists for the owner
 * only where a deal ties the two together - and a deal is something the owner
 * is already a party to.
 *
 * One component for the question list and the interest table both, so a
 * counterparty cannot be presented one way in one place and another way in
 * another.
 */
export default async function BuyerParty({
  party,
  locale,
}: {
  party: OwnerParty;
  locale: string;
}) {
  const t = await getTranslations();

  // Locale-correct country name from the two-letter code the record holds.
  // Intl is in the platform, not a dependency.
  let country = party.countryCode;
  try {
    country = new Intl.DisplayNames([locale], { type: 'region' }).of(party.countryCode)
      ?? party.countryCode;
  } catch {
    country = party.countryCode;
  }

  return (
    <span className={styles.party}>
      <span className={styles.line}>
        {party.label === null ? (
          <span className={styles.unlabelled}>{ownerText(t, 'partyUnlabelled')}</span>
        ) : (
          <span className={styles.pseudonym}>{party.label}</span>
        )}
        {party.legalName !== null && (
          <>
            <span className={styles.named}>{party.legalName}</span>
            <Badge tone="neutral">{t('owner.buyer.namedForDeal')}</Badge>
          </>
        )}
      </span>
      <span className={styles.meta}>
        {party.sectorLabel} {t('source.separator')} {country}{' '}
        {t('source.separator')} {party.sizeBandLabel}
      </span>
    </span>
  );
}
