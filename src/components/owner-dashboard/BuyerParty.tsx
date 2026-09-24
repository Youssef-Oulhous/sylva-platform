import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { SECTOR_KEY, SIZE_BAND_KEY, type DemoBuyerParty } from './demo-owner';
import styles from './BuyerParty.module.css';

/**
 * How a buyer appears to the project owner.
 *
 * The concept note (sections 3 and 8) makes the pseudonym the default and
 * naming the buyer's own choice, deal by deal. So the label is what this
 * component renders by default, and the sector, country and size band beside it
 * are the attributes the public record carries. A buyer that chose to be named
 * for the deal is marked with a word, not only with a different typeface: a
 * reader who cannot tell a mono label from a name still reads "Named by the
 * buyer".
 *
 * One component for both the question list and the interest table, so a buyer
 * cannot be presented one way in one place and another way in another.
 */
export default async function BuyerParty({
  party,
  locale,
}: {
  party: DemoBuyerParty;
  locale: string;
}) {
  const t = await getTranslations();

  // Locale-correct country name from the two-letter code the record holds.
  // Intl is in the platform, not a dependency.
  const country =
    new Intl.DisplayNames([locale], { type: 'region' }).of(party.countryCode) ??
    party.countryCode;

  return (
    <span className={styles.party}>
      <span className={styles.line}>
        <span className={party.kind === 'label' ? styles.pseudonym : styles.named}>
          {party.display}
        </span>
        {party.kind === 'named' && (
          <Badge tone="neutral">{t('owner.buyer.namedForDeal')}</Badge>
        )}
      </span>
      <span className={styles.meta}>
        {t(SECTOR_KEY[party.sectorCode])} {t('source.separator')} {country}{' '}
        {t('source.separator')} {t(SIZE_BAND_KEY[party.sizeBandCode])}
      </span>
    </span>
  );
}
