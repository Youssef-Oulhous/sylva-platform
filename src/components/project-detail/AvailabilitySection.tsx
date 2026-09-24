import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoProject } from './demo-data';
import styles from './AvailabilitySection.module.css';

/**
 * One row per period, for this project only.
 *
 * Rule 7 in three places, deliberately repeated rather than assumed:
 *   - the caption names the unit type,
 *   - the unit label is printed next to the figures in every row,
 *   - the note states that these units are not comparable with any other
 *     project's.
 * There is no footer row. A column total over periods would be arithmetically
 * valid here (one project, one unit type) but it is the figure most likely to be
 * screenshotted next to another project's, so the table does not offer it.
 *
 * "Period" is ambiguous across schemes, so the section says which meaning
 * applies here before the first number.
 */
export default async function AvailabilitySection({ project }: { project: DemoProject }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const unit = t(project.unitLabelKey);

  return (
    <>
      <h2>{t('project.availability')}</h2>

      <div className={styles.unitStrip}>
        <div>
          <span className={styles.unitLabel}>{t('project.unitType')}</span>
          <span className={styles.unitValue}>{unit}</span>
        </div>
        <div>
          <span className={styles.unitLabel}>{t('project.scheme')}</span>
          <span className={styles.unitValue}>{project.schemeName}</span>
        </div>
      </div>

      <div className={styles.periodMeaning}>
        <p className={styles.periodMeaningTitle}>
          {t('projectPage.availability.periodMeansTitle')}
        </p>
        <p className={styles.periodMeaningBody}>{t(project.vintageKey)}</p>
        <p className={styles.periodMeaningBody}>
          {t('projectPage.availability.periodMeansDetail')}
        </p>
      </div>

      <div className="table-scroll">
        <table className={styles.table}>
          <caption>
            {t('projectPage.availability.caption', {
              project: project.name,
              unit,
            })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('project.period')}</th>
              <th scope="col" className="num">
                {t('project.expectedIssuance')}
              </th>
              <th scope="col" className="num">
                {t('project.buffer')}
              </th>
              <th scope="col" className="num">
                {t('projectPage.availability.reserved')}
              </th>
              <th scope="col" className="num">
                {t('project.committed')}
              </th>
              <th scope="col" className="num">
                {t('project.remaining')}
              </th>
            </tr>
          </thead>
          <tbody>
            {project.periods.map((p) => (
              <tr key={p.id}>
                <th scope="row" className={styles.rowHead}>
                  <span className={styles.period}>{p.label}</span>
                  <span className={styles.periodRange}>
                    {format.dateTime(new Date(p.startsOn), 'short')} –{' '}
                    {format.dateTime(new Date(p.endsOn), 'short')}
                  </span>
                  <SourceStamp
                    source={{
                      label: t(p.source.labelKey),
                      locator: p.source.locator,
                      asOfDate: p.source.asOfDate,
                    }}
                  />
                </th>
                <td className={`num ${styles.cell}`}>
                  {format.number(p.expected)} <span className={styles.unit}>{unit}</span>
                </td>
                <td className={`num ${styles.cell}`}>
                  {format.number(p.buffer)} <span className={styles.unit}>{unit}</span>
                </td>
                <td className={`num ${styles.cell}`}>
                  {format.number(p.reserved)} <span className={styles.unit}>{unit}</span>
                </td>
                <td className={`num ${styles.cell}`}>
                  {format.number(p.committed)} <span className={styles.unit}>{unit}</span>
                </td>
                <td className={`num ${styles.cell} ${styles.remaining}`}>
                  {format.number(p.remaining)} <span className={styles.unit}>{unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className={styles.glossary}>
        <div>
          <dt>{t('project.expectedIssuance')}</dt>
          <dd>{t('projectPage.availability.defExpected')}</dd>
        </div>
        <div>
          <dt>{t('project.buffer')}</dt>
          <dd>{t('projectPage.availability.defBuffer')}</dd>
        </div>
        <div>
          <dt>{t('projectPage.availability.reserved')}</dt>
          <dd>{t('projectPage.availability.defReserved')}</dd>
        </div>
        <div>
          <dt>{t('project.committed')}</dt>
          <dd>{t('projectPage.availability.defCommitted')}</dd>
        </div>
        <div>
          <dt>{t('project.remaining')}</dt>
          <dd>{t('projectPage.availability.defRemaining')}</dd>
        </div>
      </dl>

      <p className={styles.incomparable}>{t('project.availabilityNote')}</p>
      <p className={styles.notIssued}>{t('projectPage.availability.notIssuedYet')}</p>
    </>
  );
}
