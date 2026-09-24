import { getTranslations } from 'next-intl/server';
import styles from './TermsList.module.css';

/**
 * The words, defined.
 *
 * The master prompt's own test asks whether a reader can tell a project from an
 * outcome from a unit, and a buyer from an investor from a co-investor. The
 * market uses these words loosely, so this page says how they are used here and
 * nowhere claims that anyone else uses them the same way.
 */
const TERM_KEYS = [
  'projectOwner',
  'buyer',
  'investor',
  'coInvestor',
  'verifier',
  'scheme',
  'unit',
  'retirement',
  'buffer',
  'catchment',
  'period',
  'dealRoom',
] as const;

export default async function TermsList() {
  const t = await getTranslations();

  return (
    <dl className={styles.terms}>
      {TERM_KEYS.map((key) => (
        <div key={key} className={styles.entry}>
          <dt className={styles.term}>{t(`howItWorks.terms.${key}.term`)}</dt>
          <dd className={styles.def}>{t(`howItWorks.terms.${key}.def`)}</dd>
        </div>
      ))}
    </dl>
  );
}
