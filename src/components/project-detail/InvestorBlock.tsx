import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import type { DemoProject } from './demo-data';
import styles from './InvestorBlock.module.css';

/**
 * Financing, visibly locked.
 *
 * The field NAMES are public; the values are not, and there is no placeholder
 * standing in for one. No blurred figure, no "€1,2xx,xxx", nothing a reader could
 * squint at - a redacted value that hints at its own size is a disclosure.
 *
 * This is also the honest place to say the section is Phase 2: the concept note
 * puts investor data after the public side, and a locked panel that promises a
 * screen which does not exist yet is worse than one that dates itself.
 */
export default async function InvestorBlock({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  return (
    <>
      <div className={styles.head}>
        <h2>{t('project.investorInfo')}</h2>
        <div className={styles.badges}>
          <Badge tone="neutral">{t('projectPage.investor.accessBadge')}</Badge>
          <Badge tone="warning">{t('projectPage.investor.phaseBadge')}</Badge>
        </div>
      </div>

      <p className={styles.lead}>{t('project.investorGate')}</p>

      <div className={styles.locked}>
        <p className={styles.lockedTitle}>
          <span className={styles.lockMark} aria-hidden="true" />
          {t('projectPage.investor.lockedTitle')}
        </p>

        <ul className={styles.fields}>
          {project.investorFieldKeys.map((k) => (
            <li key={k} className={styles.field}>
              <span className={styles.fieldName}>{t(k)}</span>
              <span className={styles.fieldValue}>
                {t('projectPage.investor.withheld')}
              </span>
            </li>
          ))}
        </ul>

        <p className={styles.lockedNote}>{t('projectPage.investor.vettingNote')}</p>
        <p className={styles.lockedNote}>{t('projectPage.investor.notAdviceNote')}</p>
      </div>
    </>
  );
}
