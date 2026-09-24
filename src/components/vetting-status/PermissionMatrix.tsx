import { getTranslations } from 'next-intl/server';
import {
  DEMO_ACTIONS,
  VETTING_STATES,
  type CellValue,
  type VettingState,
} from './demo-vetting';
import styles from './PermissionMatrix.module.css';

/**
 * What an organisation can do, by state.
 *
 * One table rather than a paragraph per state, because the reader's question is
 * comparative: what changes when the decision arrives, and what does not. A
 * table answers that in one glance and is the platform's instrument for data.
 *
 * Every cell contains a word - Available, Not available, Not stated. There is
 * no tick, no cross and no colour doing the work alone.
 *
 * "Not stated" is used once, deliberately. The pilot material this page can
 * cite does not say whether a declined organisation keeps site registration,
 * and answering it here would invent a rule the client has not written.
 */
/* `string | undefined`: CSS-module classes are typed that way under
   noUncheckedIndexedAccess, and className accepts undefined. */
const CELL_CLASS: Readonly<Record<CellValue, string | undefined>> = {
  yes: styles.yes,
  no: styles.no,
  notSet: styles.notSet,
};

export default async function PermissionMatrix({
  currentState,
}: {
  currentState: VettingState;
}) {
  const t = await getTranslations();

  return (
    <div className="table-scroll">
      <table className={styles.table}>
        <caption>{t('vettingStatus.section.matrixCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('vettingStatus.action.heading')}</th>
            {VETTING_STATES.map((state) => (
              <th key={state} scope="col" className={styles.stateCol}>
                {t(`vettingStatus.state.${state}`)}
                {state === currentState && (
                  <span className={styles.here}>
                    {t('vettingStatus.section.thisApplicationMark')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEMO_ACTIONS.map((action) => (
            <tr key={action.id}>
              <th scope="row" className={styles.rowHead}>
                <span className={styles.actionLabel}>{t(action.labelKey)}</span>
                <span className={styles.actionNote}>{t(action.noteKey)}</span>
              </th>
              {VETTING_STATES.map((state) => (
                <td key={state} className={CELL_CLASS[action.by[state]]}>
                  {t(`vettingStatus.cell.${action.by[state]}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
