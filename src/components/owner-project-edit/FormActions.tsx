import { getTranslations } from 'next-intl/server';
import { INERT_NOTE_ID } from './project-draft-data';
import styles from './FormActions.module.css';

/**
 * Save draft, and submit for review.
 *
 * Save draft is the action an owner uses most and the one that must not compete
 * with submitting, so it is the same size with no fill; submit for review is the
 * one primary action on the page and the only forest-green fill on it.
 *
 * FRONTEND PASS. Both controls are type="button", so nothing is submitted, and
 * both are marked aria-disabled and described by the note that says why -
 * removing them would hide from a keyboard reader that the actions exist at all.
 * Every inert control elsewhere on the form points at the same note.
 */
export default async function FormActions() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  return (
    <div className={styles.foot}>
      <p id={INERT_NOTE_ID} className={styles.inertNote}>
        {t('actions.inertNote')}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          aria-disabled="true"
          aria-describedby={INERT_NOTE_ID}
        >
          {t('actions.submit')}
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-disabled="true"
          aria-describedby={INERT_NOTE_ID}
        >
          {t('actions.saveDraft')}
        </button>
      </div>

      {/* The two status words are the ones the rest of the platform uses. */}
      <p className={styles.footNote}>
        {t('actions.submitNote', {
          draft: tRoot('status.draft'),
          review: tRoot('status.submitted_for_review'),
        })}
      </p>
      <p className={styles.footNote}>{t('actions.reviewNote')}</p>
    </div>
  );
}
