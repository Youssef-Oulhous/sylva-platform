import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { orFallback } from '@/components/vetting/labels';
import type { VettingState } from '@/lib/vetting/types';
import {
  STATE_FALLBACK_EN, STATE_MEANING_FALLBACK_EN, STATE_TONE, VETTING_STATES,
} from './states';
import styles from './StateReference.module.css';

/**
 * The six states, defined once.
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
              <Badge tone={STATE_TONE[state]}>
                {orFallback(t, `vettingStatus.state.${state}`, STATE_FALLBACK_EN[state])}
              </Badge>
              {state === currentState && (
                <span className={styles.here}>
                  {t('vettingStatus.section.thisApplicationMark')}
                </span>
              )}
            </th>
            <td>
              {orFallback(
                t,
                `vettingStatus.stateMeaning.${state}`,
                STATE_MEANING_FALLBACK_EN[state],
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
