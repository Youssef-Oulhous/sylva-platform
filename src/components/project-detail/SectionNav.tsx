import { getTranslations } from 'next-intl/server';
import styles from './SectionNav.module.css';

/**
 * In-page navigation for a long document. Plain anchors and `position: sticky`,
 * no JavaScript: a ten-minute read has to be navigable with the page's own
 * mechanics, and a scroll-spy would add a client bundle for nothing.
 *
 * The numbers are part of the document, not decoration - a reader forwarding
 * this page to a colleague can say "section 5".
 */
export const PROJECT_SECTIONS = [
  { id: 'map', labelKey: 'project.map' },
  { id: 'summary', labelKey: 'project.summary' },
  { id: 'outcomes', labelKey: 'project.outcomes' },
  { id: 'claim-rights', labelKey: 'project.claimRights' },
  { id: 'durability', labelKey: 'project.durability' },
  { id: 'availability', labelKey: 'project.availability' },
  { id: 'documents', labelKey: 'project.documents' },
  { id: 'partners', labelKey: 'project.partners' },
  { id: 'evidence', labelKey: 'projectPage.evidence.title' },
  { id: 'questions', labelKey: 'projectPage.questions.title' },
  { id: 'financing', labelKey: 'project.investorInfo' },
] as const;

export default async function SectionNav() {
  const t = await getTranslations();

  return (
    <nav aria-label={t('projectPage.nav.label')} className={styles.nav}>
      <p className={styles.heading}>{t('projectPage.nav.heading')}</p>
      <ol className={styles.list}>
        {PROJECT_SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={styles.link}>
              <span className={styles.index} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{t(s.labelKey)}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
