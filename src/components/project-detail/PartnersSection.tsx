import { getTranslations } from 'next-intl/server';
import type { DemoProject } from './demo-data';
import styles from './PartnersSection.module.css';

/**
 * The organisations behind the project, as register rows.
 *
 * Deliberately not cards with avatars: one buyer told the client it judges a
 * project by meeting the people behind it, and the useful answer to that is a
 * legible register of who holds which role, not a profile grid. No logos, no
 * portraits, no follower counts.
 */
export default async function PartnersSection({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('project.partners')}</h2>
      <p className={styles.lead}>{t('projectPage.partners.lead')}</p>

      <ul className={styles.list}>
        {project.partners.map((p) => (
          <li key={p.id} className={styles.row}>
            <div className={styles.role}>{t(p.roleKey)}</div>
            <div className={styles.body}>
              <p className={styles.name}>{p.name}</p>
              <p className={styles.note}>{t(p.noteKey)}</p>
            </div>
            <div className={styles.meta}>
              <span className={styles.place}>{p.place}</span>
              {p.registryRef && (
                <span className={styles.ref}>
                  <span className={styles.refLabel}>
                    {t('projectPage.partners.reference')}
                  </span>{' '}
                  {p.registryRef}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.footNote}>{t('projectPage.partners.note')}</p>
    </>
  );
}
