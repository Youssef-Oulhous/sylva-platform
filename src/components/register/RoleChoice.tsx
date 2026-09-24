import { getTranslations } from 'next-intl/server';
import styles from './RoleChoice.module.css';

/**
 * The role the organisation registers as: buyer, project owner or investor.
 *
 * Three native radios in one fieldset. A radio group is the correct control
 * because the choice is exclusive and because it needs no JavaScript, which
 * keeps the whole form a Server Component.
 *
 * Each option states what the role is and what it allows once the organisation
 * has been approved, because the difference between the three roles is a
 * difference in what happens after vetting, not a difference in what this form
 * asks for. Auditor and operator access is not in the list: the concept note
 * (§4) describes those as read-only access arranged by Sylva, and nothing here
 * should suggest a fourth self-service route.
 */

interface RoleOption {
  value: string;
  nameKey: string;
  noteKey: string;
  afterKey: string;
}

const ROLES: readonly RoleOption[] = [
  {
    value: 'buyer',
    nameKey: 'register.role.buyer',
    noteKey: 'register.role.buyerNote',
    afterKey: 'register.role.buyerAfter',
  },
  {
    value: 'project_owner',
    nameKey: 'register.role.owner',
    noteKey: 'register.role.ownerNote',
    afterKey: 'register.role.ownerAfter',
  },
  {
    value: 'investor',
    nameKey: 'register.role.investor',
    noteKey: 'register.role.investorNote',
    afterKey: 'register.role.investorAfter',
  },
];

export default async function RoleChoice({ idPrefix }: { idPrefix: string }) {
  const t = await getTranslations();
  const hintId = `${idPrefix}-role-hint`;

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t('register.role.legend')}</legend>
      <p id={hintId} className={styles.hint}>
        {t('register.role.hint')}
      </p>

      <div className={styles.options}>
        {ROLES.map((role) => {
          const id = `${idPrefix}-role-${role.value}`;
          const noteId = `${id}-note`;
          return (
            <div key={role.value} className={styles.option}>
              <input
                type="radio"
                id={id}
                name="role"
                value={role.value}
                required
                className={styles.radio}
                aria-describedby={`${noteId} ${hintId}`}
              />
              <label htmlFor={id} className={styles.optionLabel}>
                {t(role.nameKey)}
              </label>
              <div id={noteId} className={styles.note}>
                <p className={styles.noteBody}>{t(role.noteKey)}</p>
                <p className={styles.after}>
                  <span className={styles.afterLabel}>{t('register.role.afterLabel')}</span>
                  <span>{t(role.afterKey)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.notHere}>{t('register.role.notHere')}</p>
    </fieldset>
  );
}
