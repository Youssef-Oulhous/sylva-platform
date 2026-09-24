import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { STATE_TONE, VETTING_STATES, type VettingState } from './demo-vetting';
import styles from './StateReference.module.css';

/**
 * The four states, defined once.
 *
 * An application is in exactly one of them. Each row names the state in words
 * and says what that state means for the organisation - which is the only
 * question a reader of this page actually has.
 */
export default async function StateReference({
  currentState,
}: {
  currentState: VettingState;
}) {
  const t = await getTranslations();

  return (
    <table className={styles.table}>
      <caption>{t('vettingStatus.section.statesCaption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('vettingStatus.field.state')}</th>
          <th scope="col">{t('vettingStatus.section.statesMeaningCol')}</th>
        </tr>
      </thead>
      <tbody>
        {VETTING_STATES.map((state) => (
          <tr key={state}>
            <th scope="row" className={styles.rowHead}>
              <Badge tone={STATE_TONE[state]}>{t(`vettingStatus.state.${state}`)}</Badge>
              {state === currentState && (
                <span className={styles.here}>
                  {t('vettingStatus.section.thisApplicationMark')}
                </span>
              )}
            </th>
            <td>{t(`vettingStatus.stateMeaning.${state}`)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
