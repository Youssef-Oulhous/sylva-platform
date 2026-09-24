import { getTranslations } from 'next-intl/server';
import styles from './PlatformBoundaries.module.css';

/**
 * What this platform is not.
 *
 * Every item here is a limit the concept note states about Sylva's own role:
 * the schemes run their own registries and give no outside system write access,
 * there is no payment, escrow or settlement, the verifier is an independent
 * body, the evidence pack claims nothing about any particular auditor, and a
 * unit is not an interest in the land.
 *
 * They are on the explainer page rather than in small print because each one is
 * a thing a reader will otherwise assume the other way round.
 */
const BOUNDARY_KEYS = [
  'registry',
  'payments',
  'verifier',
  'evidencePack',
  'ownership',
] as const;

export default async function PlatformBoundaries() {
  const t = await getTranslations();

  return (
    <ul className={styles.list}>
      {BOUNDARY_KEYS.map((key) => (
        <li key={key} className={styles.item}>
          <h3 className={styles.itemTitle}>{t(`howItWorks.boundaries.${key}.title`)}</h3>
          <p className={styles.itemBody}>{t(`howItWorks.boundaries.${key}.body`)}</p>
        </li>
      ))}
    </ul>
  );
}
