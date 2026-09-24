import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import styles from './DealShapes.module.css';

/**
 * The three deal shapes, side by side.
 *
 * A table rather than three cards, because the question a buyer arrives with is
 * a comparison: do the units exist yet, and what is written down. Cards put
 * those answers in three separate places and make the reader hold them in their
 * head; a table puts them in one column.
 *
 * The forward row carries a word, not a highlight colour, to say it is the
 * common case: most pilot deals are forward commitments because units are
 * issued only after independent verification.
 */
const SHAPE_KEYS = ['spot', 'forward', 'coInvestment'] as const;

export default async function DealShapes() {
  const t = await getTranslations();

  return (
    <>
      <div className="table-scroll">
        <table>
          <caption>{t('howItWorks.dealShapes.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('howItWorks.dealShapes.colShape')}</th>
              <th scope="col">{t('howItWorks.dealShapes.colCommitment')}</th>
              <th scope="col">{t('howItWorks.dealShapes.colUnitsExist')}</th>
              <th scope="col">{t('howItWorks.dealShapes.colRecord')}</th>
            </tr>
          </thead>
          <tbody>
            {SHAPE_KEYS.map((key) => (
              <tr key={key}>
                <th scope="row" className={styles.shape}>
                  <span className={styles.shapeName}>
                    {t(`howItWorks.dealShapes.${key}.name`)}
                  </span>
                  {key === 'forward' && (
                    <span className={styles.shapeMark}>
                      <Badge tone="neutral">{t('howItWorks.dealShapes.mostPilot')}</Badge>
                    </span>
                  )}
                </th>
                <td>{t(`howItWorks.dealShapes.${key}.commitment`)}</td>
                <td>{t(`howItWorks.dealShapes.${key}.unitsExist`)}</td>
                <td>{t(`howItWorks.dealShapes.${key}.record`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.why}>{t('howItWorks.dealShapes.why')}</p>
    </>
  );
}
