import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import {
  GATE_ERROR_CODE,
  GATE_KEY,
  gapsOf,
  type ReviewRow,
} from './demo-projects';
import styles from './PublishAction.module.css';

/**
 * The publication action.
 *
 * Three states, and which one an operator sees is decided by the same array the
 * database decides it by:
 *
 *   - items missing   -> the control is disabled and every missing item is
 *                        named above it, in the order the gate function returns
 *                        them;
 *   - nothing missing -> the control is offered;
 *   - already published -> no control, and the date it was published.
 *
 * WHY THE DISABLED CONTROL IS STILL RENDERED. Hiding it would leave an operator
 * looking for a button that is not there and guessing why. It is rendered,
 * marked disabled, and the reason is printed immediately above it as a list of
 * the missing items - a disabled control is not focusable, so the reason must be
 * readable without reaching it.
 *
 * WHY THIS SCREEN IS NOT THE ENFORCEMENT. The same ten items are checked inside
 * the database by `proj.publication_gaps()`, and the trigger on `proj.project`
 * refuses any change into `published` while that function returns anything,
 * raising SY008 and naming what is missing. A request that bypassed this screen
 * entirely would still be refused. That is stated on the screen, because an
 * operator should know that this control is a convenience and not the control.
 *
 * FRONTEND PASS. The form has no action, no method and no handler, and neither
 * control records anything yet.
 */
export default async function PublishAction({
  row,
  headingId,
}: {
  row: ReviewRow;
  headingId: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const gaps = gapsOf(row);
  const blocked = gaps.length > 0;
  /** Non-null only for a project the record already holds as published. */
  const publishedOn = row.status === 'published' ? row.publishedOn : null;

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminProjects.publish.title')}</h3>
      </div>

      {publishedOn !== null ? (
        <div className={styles.state}>
          <div className={styles.stateHead}>
            <Badge tone="bio">{t('status.published')}</Badge>
            <p className={styles.stateTitle}>{t('adminProjects.publish.publishedTitle')}</p>
          </div>
          <p className={styles.stateLead}>
            {t('adminProjects.publish.publishedLead', {
              date: format.dateTime(new Date(publishedOn), 'short'),
            })}
          </p>
        </div>
      ) : blocked ? (
        <div className={`${styles.state} ${styles.blocked}`}>
          <div className={styles.stateHead}>
            <Badge tone="error">{t('adminProjects.publish.blockedBadge')}</Badge>
            <p className={styles.stateTitle}>{t('adminProjects.publish.blockedTitle')}</p>
          </div>
          <p className={styles.stateLead}>
            {t('adminProjects.publish.blockedLead', { count: gaps.length })}
          </p>

          <div id="publish-reasons">
            <p className={styles.reasonsLabel}>
              {t('adminProjects.publish.reasonsLabel')}
            </p>
            <ul className={styles.reasons}>
              {gaps.map((code) => (
                <li key={code} className={styles.reason}>
                  <span className={styles.reasonLabel}>
                    {t(`adminProjects.gate.item.${GATE_KEY[code]}.label`)}
                  </span>
                  <span className={styles.reasonCode}>{code}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className={styles.state}>
          <div className={styles.stateHead}>
            <Badge tone="bio">{t('adminProjects.gate.complete')}</Badge>
            <p className={styles.stateTitle}>{t('adminProjects.publish.readyTitle')}</p>
          </div>
          <p className={styles.stateLead}>{t('adminProjects.publish.readyLead')}</p>
        </div>
      )}

      {publishedOn === null && (
        /* No action, no method, no handler. */
        <form className={styles.form} noValidate>
          <button
            type="button"
            className={blocked ? `${styles.publish} ${styles.publishOff}` : styles.publish}
            /* Blocked: genuinely disabled, with the reasons printed above it.
               Not blocked: still inert in this pass, so it stays focusable and
               points at the note that says why nothing happens. */
            disabled={blocked}
            aria-disabled={blocked ? undefined : 'true'}
            aria-describedby={blocked ? 'publish-reasons publish-blocked-note' : 'publish-inert-note'}
          >
            {t('adminProjects.publish.action')}
            <span className="visually-hidden"> {row.title}</span>
          </button>

          {blocked ? (
            <p id="publish-blocked-note" className={styles.note}>
              {t('adminProjects.publish.blockedNote')}
            </p>
          ) : (
            <p id="publish-inert-note" className={styles.note}>
              {t('adminProjects.publish.inertNote')}
            </p>
          )}
        </form>
      )}

      <div className={styles.statements}>
        <p className={styles.statement}>
          {t('adminProjects.publish.enforcedNote', { code: GATE_ERROR_CODE })}
        </p>
        <p className={styles.statement}>{t('adminProjects.publish.notRegistry')}</p>
      </div>
    </section>
  );
}
