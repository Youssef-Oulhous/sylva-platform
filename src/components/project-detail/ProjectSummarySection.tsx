import { getTranslations } from 'next-intl/server';
import type { DemoProject } from './demo-data';
import styles from './ProjectSummarySection.module.css';

/**
 * What is being restored, why, and what is measured - in that order, in plain
 * language, before any table.
 *
 * The deeper detail uses native <details>/<summary>, so disclosure costs no
 * client JavaScript and works before hydration. On a document this long that
 * matters: the reader may open three of these in the first minute.
 */
export default async function ProjectSummarySection({
  project,
}: {
  project: DemoProject;
}) {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('project.summary')}</h2>

      <p className={styles.lead}>{t(project.summaryLeadKey)}</p>

      <div className={styles.prose}>
        {project.summaryParagraphKeys.map((k) => (
          <p key={k}>{t(k)}</p>
        ))}
      </div>

      <div className={styles.details}>
        {project.summaryDetailKeys.map((d) => (
          <details key={d.titleKey} className={styles.detail}>
            <summary className={styles.summary}>{t(d.titleKey)}</summary>
            <div className={styles.detailBody}>
              <p>{t(d.bodyKey)}</p>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
