import { getTranslations } from 'next-intl/server';
import type { DemoProject } from './demo-data';
import styles from './EvidencePackSection.module.css';

/**
 * The reporting evidence pack.
 *
 * The contents list is what one interviewed reporting company said its assessor
 * asked it to look for: a measurable action, a fixed timeframe, expected impact,
 * a budget and a verification standard. The pack assembles exactly that.
 *
 * The caveat is quoted verbatim from the client's brief and is not softened,
 * moved into small print, or paired with any suggestion that the pack satisfies
 * a regime or an auditor. The platform makes no such claim.
 */
export default async function EvidencePackSection({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('projectPage.evidence.title')}</h2>
      <p className={styles.lead}>{t('projectPage.evidence.lead')}</p>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('projectPage.evidence.containsTitle')}</h3>
        <ul className={styles.items}>
          {project.evidencePackItemKeys.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>

        <div className={styles.actions}>
          <a
            href={`/api/projects/${project.slug}/evidence-pack.pdf`}
            className={styles.download}
          >
            {t('projectPage.evidence.download')}
          </a>
          <span className={styles.format}>{t('projectPage.evidence.format')}</span>
        </div>
      </div>

      <p className={styles.caveat}>{t('projectPage.evidence.caveat')}</p>
    </>
  );
}
