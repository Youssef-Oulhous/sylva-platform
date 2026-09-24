import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { label, UI } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './ClaimRightsSection.module.css';

/**
 * Who may claim what, and - given equal weight - what is excluded.
 *
 * One of the buyers interviewed said it would not fund a project if the onward
 * sale of credits removed its right to claim the benefit it had paid for. That
 * makes exclusions a decision input, not a footnote, so the exclusions column
 * is as wide as the permission column and is not collapsed behind a disclosure.
 *
 * All four cells are separate translatable fields and each falls back on its
 * own. A German exclusions clause beside an English one is unusual but honest;
 * quietly serving the English row for all four would not be.
 */
export default async function ClaimRightsSection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();

  if (project.claimRights.length === 0) {
    return (
      <>
        <h2>{t('project.claimRights')}</h2>
        <p className={styles.lead}>{label(t, UI.noClaims)}</p>
      </>
    );
  }

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
            {project.claimRights.map((c) => (
              <tr key={c.benefitKey}>
                <th scope="row" className={styles.rowHead}>
                  {c.benefitLabel?.body ?? c.benefitKey}
                  <FallbackNote text={c.benefitLabel} />
                  <SourceStamp
                    source={{
                      label: c.source.label,
                      locator: c.source.locator,
                      asOfDate: c.source.asOfDate,
                    }}
                  />
                </th>
                <td>
                  {c.whoMayClaim?.body ?? '—'}
                  <FallbackNote text={c.whoMayClaim} />
                </td>
                <td>
                  {c.forWhat?.body ?? '—'}
                  <FallbackNote text={c.forWhat} />
                </td>
                <td className={styles.exclusions}>
                  <span className={styles.exclusionsMark} aria-hidden="true" />
                  {c.exclusions?.body ?? '—'}
                  <FallbackNote text={c.exclusions} />
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
