import { getTranslations } from 'next-intl/server';
import styles from './EuFundingNotice.module.css';

/**
 * The EU funding notice. Concept note section 9: "Every page carries the EU
 * emblem, the co-funding line and the disclaimer."
 *
 * Two of those three we can render. The third we cannot, and must not guess.
 *
 * The emblem is a controlled visual asset and the disclaimer wording is fixed
 * by the grant agreement of the specific funding programme. Inventing either
 * would put wrong compliance text on every page of an EU-funded pilot. So:
 *
 *   - the co-funding line is translated and rendered;
 *   - the emblem renders from /eu/emblem.svg if the client has supplied it,
 *     and otherwise renders a conspicuous red placeholder;
 *   - the disclaimer renders from SYLVA_EU_DISCLAIMER_EN / _DE and otherwise
 *     states, visibly, that the grant agreement wording is still outstanding.
 *
 * See docs/DECISIONS.md - this is a tracked OPEN DECISION, not an oversight.
 */
export default async function EuFundingNotice({
  locale,
  hasEmblem = false,
}: {
  locale: string;
  hasEmblem?: boolean;
}) {
  const t = await getTranslations('eu');

  const disclaimer =
    locale === 'de'
      ? process.env.SYLVA_EU_DISCLAIMER_DE
      : process.env.SYLVA_EU_DISCLAIMER_EN;

  return (
    <div className={styles.notice}>
      <div className={styles.emblem}>
        {hasEmblem ? (
          // Decorative here: the co-funding line beside it carries the meaning,
          // so an alt text would be read out twice by a screen reader.
          <img src="/eu/emblem.svg" alt="" className={styles.emblemImg} width={72} height={48} />
        ) : (
          <div className={styles.placeholder} role="img" aria-label={t('emblemMissingAlt')}>
            {t('emblemMissingShort')}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.line}>{t('coFunded')}</p>
        {disclaimer ? (
          <p className={styles.disclaimer}>{disclaimer}</p>
        ) : (
          <p className={styles.missing}>{t('disclaimerMissing')}</p>
        )}
      </div>
    </div>
  );
}
