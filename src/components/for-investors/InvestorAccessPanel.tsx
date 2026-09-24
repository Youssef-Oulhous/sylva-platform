import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './InvestorAccessPanel.module.css';

export interface RestrictedItem {
  id: string;
  nameKey: string;
  /** Version of the file the project owner has lodged, e.g. "v2.1". */
  version: string;
  updatedOn: string;
  sourceKey: string;
}

export interface InvestorPanelProject {
  slug: string;
  name: string;
  locationKey: string;
  schemeName: string;
  unitLabelKey: string;
  periodLabel: string;
  /** Figures for ONE period of ONE project, held as given, never computed here. */
  expected: number;
  buffer: number;
  committed: number;
  remaining: number;
  figureSourceKey: string;
  figureLocator: string;
  figureAsOf: string;
  restricted: readonly RestrictedItem[];
}

/**
 * One project, with the line between public and restricted drawn through it.
 *
 * No value behind investor access is previewed here - not blurred, not
 * truncated, not replaced by a figure of the right shape. A redacted number
 * that still shows its own magnitude is a disclosure, so each restricted item
 * shows its name, its version and its date, and the words "Not shown".
 *
 * RULE 7. The public figures belong to one period of one project and every one
 * of them is printed against its unit label. There is no row, and no total,
 * spanning more than that.
 */
export default async function InvestorAccessPanel({
  project,
}: {
  project: InvestorPanelProject;
}) {
  const t = await getTranslations('forInvestors');
  // The demo badge is an existing platform-wide key, not a page-local one.
  const tRoot = await getTranslations();
  const tp = await getTranslations('project');
  const format = await getFormatter();
  const unit = t(project.unitLabelKey);
  // Heading ids are derived from the slug so two panels on one page cannot
  // collide on an id that an aria-labelledby depends on.
  const publicHeadingId = `public-${project.slug}`;
  const restrictedHeadingId = `restricted-${project.slug}`;

  const figures: readonly { labelKey: string; amount: number }[] = [
    { labelKey: 'expectedIssuance', amount: project.expected },
    { labelKey: 'buffer', amount: project.buffer },
    { labelKey: 'committed', amount: project.committed },
    { labelKey: 'remaining', amount: project.remaining },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.projectName}>
            <Link href={`/projects/${project.slug}`}>{project.name}</Link>
          </h3>
          <p className={styles.place}>
            {t(project.locationKey)} · {project.schemeName}
          </p>
        </div>
        <div className={styles.headBadges}>
          <Badge tone="demo">{tRoot('demo.badge')}</Badge>
        </div>
      </div>

      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby={publicHeadingId}>
          <h4 id={publicHeadingId} className={styles.columnHead}>
            {t('panel.publicHeading')}
          </h4>

          <p className={styles.periodLine}>
            {tp('period')} {project.periodLabel}
          </p>

          <dl className={styles.figures}>
            {figures.map((figure) => (
              <div key={figure.labelKey} className={styles.figure}>
                <dt className={styles.figureLabel}>{tp(figure.labelKey)}</dt>
                <dd className={styles.figureValue}>
                  <span className={styles.figureNumber}>{format.number(figure.amount)}</span>{' '}
                  {/* The unit travels with the number, always. */}
                  <span className={styles.figureUnit}>{unit}</span>
                </dd>
              </div>
            ))}
          </dl>

          <SourceStamp
            source={{
              label: t(project.figureSourceKey),
              locator: project.figureLocator,
              asOfDate: project.figureAsOf,
            }}
          />

          <p className={styles.unitNote}>
            {t('panel.unitNote', { unit, scheme: project.schemeName })}
          </p>
        </section>

        <section className={styles.column} aria-labelledby={restrictedHeadingId}>
          <h4 id={restrictedHeadingId} className={styles.columnHead}>
            {t('panel.restrictedHeading')}
          </h4>

          <ul className={styles.restricted}>
            {project.restricted.map((item) => (
              <li key={item.id} className={styles.restrictedItem}>
                <div className={styles.restrictedRow}>
                  <span className={styles.restrictedName}>{t(item.nameKey)}</span>
                  <span className={styles.withheld}>{t('panel.withheld')}</span>
                </div>
                <span className={styles.version}>{item.version}</span>
                <SourceStamp
                  source={{ label: t(item.sourceKey), asOfDate: item.updatedOn }}
                />
              </li>
            ))}
          </ul>

          <p className={styles.withheldNote}>{t('panel.withheldNote')}</p>
        </section>
      </div>
    </div>
  );
}
