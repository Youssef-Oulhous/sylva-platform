import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoOutcomeDomain, DemoOutcomeRow, DemoProject } from './demo-data';
import styles from './OutcomesSection.module.css';

/**
 * Water and biodiversity, in two separate tables.
 *
 * They are separate because they measure unrelated things and a reader must not
 * be able to read one against the other. There is deliberately no combined
 * score, no weighting and no roll-up: the concept note's buyers rank water
 * first and biodiversity second, and a single number would hide exactly the
 * distinction they are paying attention to.
 */
export default async function OutcomesSection({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  const block = (domain: DemoOutcomeDomain, rows: DemoOutcomeRow[]) => {
    const heading = domain === 'water' ? t('project.water') : t('project.biodiversity');
    return (
      <section
        key={domain}
        className={domain === 'water' ? styles.blockWater : styles.blockBio}
        aria-labelledby={`outcomes-${domain}`}
      >
        <div className={styles.blockHead}>
          <h3 id={`outcomes-${domain}`} className={styles.blockTitle}>
            {heading}
          </h3>
          <Badge tone={domain === 'water' ? 'water' : 'bio'}>
            {domain === 'water'
              ? t('projectPage.outcomes.waterDomain')
              : t('projectPage.outcomes.bioDomain')}
          </Badge>
        </div>
        <p className={styles.blockNote}>
          {domain === 'water'
            ? t('projectPage.outcomes.waterNote')
            : t('projectPage.outcomes.bioNote')}
        </p>

        <div className="table-scroll">
          <table>
            <caption>
              {domain === 'water'
                ? t('projectPage.outcomes.waterCaption')
                : t('projectPage.outcomes.bioCaption')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('project.metric')}</th>
                <th scope="col" className="num">
                  {t('project.baseline')}
                </th>
                <th scope="col" className="num">
                  {t('project.expected')}
                </th>
                <th scope="col">{t('project.method')}</th>
                <th scope="col">{t('project.verifier')}</th>
                <th scope="col" className="num">
                  {t('project.uncertainty')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className={styles.rowHead}>
                    {t(r.metricKey)}
                    <SourceStamp
                      source={{
                        label: t(r.source.labelKey),
                        locator: r.source.locator,
                        asOfDate: r.source.asOfDate,
                      }}
                    />
                  </th>
                  <td className={`num ${styles.figure}`}>{r.baseline}</td>
                  <td className={`num ${styles.figure} ${styles.expected}`}>
                    {r.expected}
                  </td>
                  <td className={styles.method}>{t(r.methodKey)}</td>
                  <td>{r.verifierName}</td>
                  <td className={`num ${styles.figure}`}>{r.uncertainty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <>
      <h2>{t('project.outcomes')}</h2>
      <p className={styles.lead}>{t('projectPage.outcomes.lead')}</p>
      <p className={styles.noScore}>{t('projectPage.outcomes.noCombinedScore')}</p>

      <div className={styles.blocks}>
        {block(
          'water',
          project.outcomes.filter((o) => o.domain === 'water'),
        )}
        {block(
          'biodiversity',
          project.outcomes.filter((o) => o.domain === 'biodiversity'),
        )}
      </div>
    </>
  );
}
