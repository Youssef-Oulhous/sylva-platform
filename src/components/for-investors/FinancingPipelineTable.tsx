import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './FinancingPipelineTable.module.css';

export interface FinancingProject {
  slug: string;
  /** Fictional project name. Names are not translated. */
  name: string;
  locationKey: string;
  stageKey: string;
  dealTypeKeys: readonly string[];
  packState: 'prepared' | 'inPreparation';
  packSourceKey: string;
  packUpdatedOn: string;
}

/**
 * Projects seeking financing.
 *
 * RULE 7. This table deliberately carries NO unit volumes. Three projects side
 * by side, each issuing under a different scheme, is the exact shape in which a
 * column of volumes gets read as a ranking - and one project's hectare-years and
 * another's index points are not the same measurement. Volumes live on each
 * project's own page, beside the unit they are counted in. The note under the
 * table says so rather than leaving the absence to be guessed at.
 */
export default async function FinancingPipelineTable({
  projects,
}: {
  projects: readonly FinancingProject[];
}) {
  const t = await getTranslations('forInvestors');
  // The demo badge is an existing platform-wide key, not a page-local one.
  const tRoot = await getTranslations();

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('pipeline.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('pipeline.col.project')}</th>
              <th scope="col">{t('pipeline.col.location')}</th>
              <th scope="col">{t('pipeline.col.stage')}</th>
              <th scope="col">{t('pipeline.col.dealTypes')}</th>
              <th scope="col">{t('pipeline.col.financialPack')}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.slug}>
                <th scope="row" className={styles.rowHead}>
                  <Link href={`/projects/${project.slug}`} className={styles.projectLink}>
                    {project.name}
                  </Link>
                  <span className={styles.demoMark}>
                    <Badge tone="demo">{tRoot('demo.badge')}</Badge>
                  </span>
                </th>
                <td className={styles.place}>{t(project.locationKey)}</td>
                <td>{t(project.stageKey)}</td>
                <td>
                  <ul className={styles.dealTypes}>
                    {project.dealTypeKeys.map((key) => (
                      <li key={key}>{t(key)}</li>
                    ))}
                  </ul>
                </td>
                <td>
                  <Badge tone={project.packState === 'prepared' ? 'neutral' : 'warning'}>
                    {t(`pack.${project.packState}`)}
                  </Badge>
                  <SourceStamp
                    source={{ label: t(project.packSourceKey), asOfDate: project.packUpdatedOn }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.noVolumes}>{t('pipeline.noVolumes')}</p>
    </>
  );
}
