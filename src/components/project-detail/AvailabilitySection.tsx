import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { label, UI, VINTAGE_SENTENCE } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
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
 * valid here (one project, one unit type) but it is the figure most likely to
 * be screenshotted next to another project's, so the table does not offer it.
 *
 * Each figure arrives as a UnitQty carrying its project and unit type, and
 * `.amount` is read HERE, in the formatter, and nowhere else. A period with no
 * effective forecast is still listed: its absence from the forecast is
 * information, and hiding the row would make the table look complete.
 *
 * "Period" is ambiguous across schemes, so the section says which meaning
 * applies here before the first number.
 */
export default async function AvailabilitySection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const unit = project.unitType.metricLabel.body;

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
          <span className={styles.unitValue}>{project.scheme.name}</span>
        </div>
      </div>
      <FallbackNote text={project.unitType.metricLabel} />

      <div className={styles.periodMeaning}>
        <p className={styles.periodMeaningTitle}>
          {t('projectPage.availability.periodMeansTitle')}
        </p>
        <p className={styles.periodMeaningBody}>
          {label(t, VINTAGE_SENTENCE[project.unitType.vintageSemantics])}
        </p>
        <p className={styles.periodMeaningBody}>
          {t('projectPage.availability.periodMeansDetail')}
        </p>
      </div>

      {project.periods.length === 0 ? (
        <p className={styles.notIssued}>{label(t, UI.noPeriods)}</p>
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <caption>
              {t('projectPage.availability.caption', {
                project: project.title.body,
                unit,
              })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('project.period')}</th>
                <th scope="col" className="num">{t('project.expectedIssuance')}</th>
                <th scope="col" className="num">{t('project.buffer')}</th>
                <th scope="col" className="num">{t('projectPage.availability.reserved')}</th>
                <th scope="col" className="num">{t('project.committed')}</th>
                <th scope="col" className="num">{t('project.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {project.periods.map((p) => {
                const a = p.availability;
                const source = a?.source ?? p.source;
                return (
                  <tr key={p.id}>
                    <th scope="row" className={styles.rowHead}>
                      <span className={styles.period}>{p.label}</span>
                      <span className={styles.periodRange}>
                        {format.dateTime(new Date(p.startsOn), 'short')} –{' '}
                        {format.dateTime(new Date(p.endsOn), 'short')}
                      </span>
                      <SourceStamp
                        source={{
                          label: source.label,
                          locator: source.locator,
                          asOfDate: source.asOfDate,
                        }}
                      />
                    </th>
                    {a === null ? (
                      <td className={styles.cell} colSpan={5}>
                        {label(t, UI.noForecast)}
                      </td>
                    ) : (
                      <>
                        <td className={`num ${styles.cell}`}>
                          {format.number(a.expected.amount)}{' '}
                          <span className={styles.unit}>{unit}</span>
                        </td>
                        <td className={`num ${styles.cell}`}>
                          {format.number(a.buffer.amount)}{' '}
                          <span className={styles.unit}>{unit}</span>
                        </td>
                        <td className={`num ${styles.cell}`}>
                          {format.number(a.reserved.amount)}{' '}
                          <span className={styles.unit}>{unit}</span>
                        </td>
                        <td className={`num ${styles.cell}`}>
                          {format.number(a.committed.amount)}{' '}
                          <span className={styles.unit}>{unit}</span>
                        </td>
                        <td className={`num ${styles.cell} ${styles.remaining}`}>
                          {format.number(a.remaining.amount)}{' '}
                          <span className={styles.unit}>{unit}</span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
