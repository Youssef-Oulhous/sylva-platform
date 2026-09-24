import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { publishProjectAction } from '@/lib/admin/actions';
import { resolveAdminMessage, type AdminErrorCode } from '@/lib/admin/errors';
import { adminText } from '@/lib/admin/messages';
import {
  GATE_ITEM_KEY,
  type AdminProject,
  type PublicationGateCode,
} from '@/lib/admin/types';
import styles from './PublishAction.module.css';

const GATE_ERROR_CODE = 'SY008';

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
 * raising SY008 and naming what is missing. The action behind this form does
 * NOT pre-check the gate: it sends the UPDATE and lets the database answer,
 * because the database's answer is the only one that is true at the moment of
 * writing. A refusal comes back as `error=gate_blocked` with the codes the
 * trigger named, and they are rendered below with the same labels the checklist
 * uses - never the raw database sentence, which also carries a table name and a
 * project UUID.
 */
export default async function PublishAction({
  project,
  headingId,
  error,
  refusedItems,
  published,
}: {
  project: AdminProject;
  headingId: string;
  error: AdminErrorCode | null;
  /** The items SY008 named on the last attempt, if it was refused. */
  refusedItems: readonly PublicationGateCode[];
  /** True right after this project was published. */
  published: boolean;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const gaps = project.gaps;
  const blocked = gaps.length > 0;
  /** Non-null only for a project the record already holds as published. */
  const publishedOn = project.status === 'published' ? project.publishedOn : null;

  const itemLabel = (code: PublicationGateCode) => (
    <>
      <span className={styles.reasonLabel}>
        {t(`adminProjects.gate.item.${GATE_ITEM_KEY[code]}.label`)}
      </span>
      <span className={styles.reasonCode}>{code}</span>
    </>
  );

  return (
    <section className={styles.wrap} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId}>{t('adminProjects.publish.title')}</h3>
      </div>

      {published && (
        <p className={styles.statement} role="status">
          {adminText(t, 'publishDone')}
        </p>
      )}

      {/* The database refused the last attempt. Its reasons, in words. */}
      {error !== null && (
        <div className={`${styles.state} ${styles.blocked}`} role="alert">
          <div className={styles.stateHead}>
            <Badge tone="error">{GATE_ERROR_CODE}</Badge>
            <p className={styles.stateTitle}>{adminText(t, 'publishRefusedTitle')}</p>
          </div>
          <p className={styles.stateLead}>{resolveAdminMessage(t, error)}</p>
          {refusedItems.length > 0 && (
            <ul className={styles.reasons}>
              {refusedItems.map((code) => (
                <li key={code} className={styles.reason}>
                  {itemLabel(code)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
                  {itemLabel(code)}
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
        <form className={styles.form} action={publishProjectAction} noValidate>
          <input type="hidden" name="projectId" value={project.id} />
          <button
            type="submit"
            className={blocked ? `${styles.publish} ${styles.publishOff}` : styles.publish}
            /* Genuinely disabled while an item is missing, with the reasons
               printed above it. The database would refuse it anyway; this is
               the courtesy, not the control. */
            disabled={blocked}
            aria-describedby={blocked ? 'publish-reasons publish-blocked-note' : 'publish-note'}
          >
            {t('adminProjects.publish.action')}
            <span className="visually-hidden"> {project.title}</span>
          </button>

          {blocked ? (
            <p id="publish-blocked-note" className={styles.note}>
              {t('adminProjects.publish.blockedNote')}
            </p>
          ) : (
            <p id="publish-note" className={styles.note}>
              {adminText(t, 'publishNote')}
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
