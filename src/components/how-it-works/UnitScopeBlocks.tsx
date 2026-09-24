import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './UnitScopeBlocks.module.css';

/**
 * Two projects, two unit types, two separate tables.
 *
 * Rule 7 of the concept note: no screen, query, export or chart adds unit
 * volumes across different projects. This section is the explainer's version of
 * that rule, and it argues by layout rather than by asking the reader to trust
 * a sentence:
 *
 *   - each project gets its own table, so its figures never share a column with
 *     another project's, which is where a reader's eye invents a comparison;
 *   - the unit is printed next to every single figure, not once in a heading;
 *   - there is no row, and no block, underneath the two.
 *
 * Nothing here is added, subtracted or aggregated. The figures are held as
 * given and printed as given.
 */
export interface DemoUnitFigure {
  /** Existing message key for the figure's name, e.g. project.expectedIssuance. */
  readonly labelKey: string;
  readonly value: number;
}

export interface DemoUnitScope {
  readonly id: string;
  /** Fictional project name. Carries the DEMO prefix in the data itself. */
  readonly projectName: string;
  readonly schemeName: string;
  /** Message key for what one unit of this project measures. */
  readonly unitMetricKey: string;
  readonly periodLabel: string;
  readonly figures: readonly DemoUnitFigure[];
  readonly source: {
    readonly labelKey: string;
    readonly locator: string;
    readonly asOfDate: string;
  };
}

export default async function UnitScopeBlocks({
  scopes,
}: {
  scopes: readonly DemoUnitScope[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <div className={styles.pair}>
        {scopes.map((scope) => {
          const unitMetric = t(scope.unitMetricKey);
          return (
            <section key={scope.id} className={styles.block} aria-labelledby={`${scope.id}-name`}>
              <div className={styles.blockHead}>
                <h3 id={`${scope.id}-name`} className={styles.projectName}>
                  {scope.projectName}
                </h3>
                <Badge tone="demo">{t('demo.badge')}</Badge>
              </div>

              <dl className={styles.meta}>
                <div className={styles.metaRow}>
                  <dt>{t('project.scheme')}</dt>
                  <dd>{scope.schemeName}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('project.unitType')}</dt>
                  <dd className={styles.unit}>{unitMetric}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('project.period')}</dt>
                  <dd className={styles.period}>{scope.periodLabel}</dd>
                </div>
              </dl>

              <table>
                <caption>
                  {t('howItWorks.units.tableCaption', { project: scope.projectName })}
                </caption>
                <tbody>
                  {scope.figures.map((figure) => (
                    <tr key={figure.labelKey}>
                      <th scope="row" className={styles.figLabel}>
                        {t(figure.labelKey)}
                      </th>
                      <td className={`num ${styles.figValue}`}>
                        {format.number(figure.value)}{' '}
                        {/* The unit travels with the number, every time. A
                            figure without it can be misread as comparable. */}
                        <span className={styles.figUnit}>{unitMetric}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <SourceStamp
                source={{
                  label: t(scope.source.labelKey),
                  locator: scope.source.locator,
                  asOfDate: scope.source.asOfDate,
                }}
              />
            </section>
          );
        })}
      </div>

      <p className={styles.noTotal}>{t('howItWorks.units.noTotal')}</p>
    </>
  );
}
