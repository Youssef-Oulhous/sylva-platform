import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './DealShapesTable.module.css';

/**
 * The three shapes a buyer can agree, in a table rather than in three cards.
 *
 * A buyer comparing them is comparing the same four things across three rows,
 * which is what a table is for. Nothing here is priced, and no shape is
 * presented as recommended: the client's position is only that most pilot deals
 * will be forward contracts, because units are issued after verification.
 */

interface DealShape {
  id: 'spot' | 'forward' | 'coinvestment';
  nameKey: string;
  whatKey: string;
  fitsKey: string;
  /** Whether units already exist when the agreement is signed. */
  unitsExistKey: string;
}

const DEAL_SHAPES: readonly DealShape[] = [
  {
    id: 'spot',
    nameKey: 'forBuyers.dealShapes.spot.name',
    whatKey: 'forBuyers.dealShapes.spot.what',
    fitsKey: 'forBuyers.dealShapes.spot.fits',
    unitsExistKey: 'forBuyers.dealShapes.unitsIssued',
  },
  {
    id: 'forward',
    nameKey: 'forBuyers.dealShapes.forward.name',
    whatKey: 'forBuyers.dealShapes.forward.what',
    fitsKey: 'forBuyers.dealShapes.forward.fits',
    unitsExistKey: 'forBuyers.dealShapes.unitsFuture',
  },
  {
    id: 'coinvestment',
    nameKey: 'forBuyers.dealShapes.coinvestment.name',
    whatKey: 'forBuyers.dealShapes.coinvestment.what',
    fitsKey: 'forBuyers.dealShapes.coinvestment.fits',
    unitsExistKey: 'forBuyers.dealShapes.unitsFuture',
  },
];

/** DEMO source: the fictional document these descriptions would come from. */
const DEAL_SHAPES_SOURCE = {
  labelKey: 'forBuyers.source.participationTerms',
  locator: 'Section 4',
  asOfDate: '2026-09-15',
} as const;

export default async function DealShapesTable() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('forBuyers.dealShapes.title')}</h2>
      <p className={styles.lead}>{t('forBuyers.dealShapes.lead')}</p>

      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('forBuyers.dealShapes.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('forBuyers.dealShapes.colShape')}</th>
              <th scope="col">{t('forBuyers.dealShapes.colWhat')}</th>
              <th scope="col">{t('forBuyers.dealShapes.colFits')}</th>
              <th scope="col">{t('forBuyers.dealShapes.colUnits')}</th>
            </tr>
          </thead>
          <tbody>
            {DEAL_SHAPES.map((shape) => (
              <tr key={shape.id}>
                <th scope="row" className={styles.rowHead}>{t(shape.nameKey)}</th>
                <td>{t(shape.whatKey)}</td>
                <td>{t(shape.fitsKey)}</td>
                <td className={styles.units}>{t(shape.unitsExistKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SourceStamp
        source={{
          label: t(DEAL_SHAPES_SOURCE.labelKey),
          locator: DEAL_SHAPES_SOURCE.locator,
          asOfDate: DEAL_SHAPES_SOURCE.asOfDate,
        }}
      />

      <dl className={styles.clarifications}>
        <div className={styles.clarification}>
          <dt className={styles.clarificationTerm}>{t('forBuyers.dealShapes.retireTerm')}</dt>
          <dd className={styles.clarificationBody}>{t('forBuyers.dealShapes.retireBody')}</dd>
        </div>
        <div className={styles.clarification}>
          <dt className={styles.clarificationTerm}>{t('forBuyers.dealShapes.landTerm')}</dt>
          <dd className={styles.clarificationBody}>{t('forBuyers.dealShapes.landBody')}</dd>
        </div>
        <div className={styles.clarification}>
          <dt className={styles.clarificationTerm}>{t('project.availability')}</dt>
          <dd className={styles.clarificationBody}>{t('project.availabilityNote')}</dd>
        </div>
      </dl>
    </>
  );
}
