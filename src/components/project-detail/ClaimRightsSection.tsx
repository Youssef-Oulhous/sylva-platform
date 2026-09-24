import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoProject } from './demo-data';
import styles from './ClaimRightsSection.module.css';

/**
 * Who may claim what, and - given equal weight - what is excluded.
 *
 * One of the buyers interviewed said it would not fund a project if the onward
 * sale of credits removed its right to claim the benefit it had paid for. That
 * makes exclusions a decision input, not a footnote, so the exclusions column
 * is as wide as the permission column and is not collapsed behind a disclosure.
 */
export default async function ClaimRightsSection({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('project.claimRights')}</h2>
      <p className={styles.lead}>{t('projectPage.claims.lead')}</p>

      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('projectPage.claims.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('project.benefit')}</th>
              <th scope="col">{t('project.claimHolder')}</th>
              <th scope="col">{t('project.allowedUse')}</th>
              <th scope="col" className={styles.exclusionsHead}>
                {t('project.exclusions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {project.claims.map((c) => (
              <tr key={c.id}>
                <th scope="row" className={styles.rowHead}>
                  {t(c.benefitKey)}
                  <SourceStamp
                    source={{
                      label: t(c.source.labelKey),
                      locator: c.source.locator,
                      asOfDate: c.source.asOfDate,
                    }}
                  />
                </th>
                <td>{t(c.holderKey)}</td>
                <td>{t(c.allowedKey)}</td>
                <td className={styles.exclusions}>
                  <span className={styles.exclusionsMark} aria-hidden="true" />
                  {t(c.excludedKey)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>{t('projectPage.claims.note')}</p>
    </>
  );
}
