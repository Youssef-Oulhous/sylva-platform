import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { label, UI } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './InvestorBlock.module.css';

/**
 * Financing.
 *
 * The field NAMES are public; the values are not, and where they are withheld
 * there is no placeholder standing in for one. No blurred figure, no
 * "EUR 1,2xx,xxx", nothing a reader could squint at - a redacted value that
 * hints at its own size is a disclosure.
 *
 * Which it is, is not decided here. proj.project_financials is granted to the
 * investor, project-owner, operator and auditor roles only, and its policy for
 * an investor is `proj.is_publicly_visible(project_id) AND
 * sylva.is_vetted_investor()`. An unvetted investor gets no row, which arrives
 * as `visible: false` - the same state an anonymous visitor sees, because it is
 * the same answer.
 */
export default async function InvestorBlock({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const f = project.investor;

  const fields: { key: string; name: string; value: string | null }[] = [
    {
      key: 'financingNeed',
      name: label(t, UI.investorFinancingNeed),
      value:
        f.visible && f.financingNeed !== null && f.currency
          ? format.number(f.financingNeed, { style: 'currency', currency: f.currency })
          : null,
    },
    {
      key: 'revenueStreams',
      name: label(t, UI.investorRevenue),
      value: f.visible ? f.revenueStreamsNote : null,
    },
    {
      key: 'model',
      name: label(t, UI.investorModel),
      value: f.visible
        ? label(t, f.financialModelDocumentId ? UI.investorModelOnPlatform : UI.investorModelAbsent)
        : null,
    },
  ];

  return (
    <>
      <div className={styles.head}>
        <h2>{t('project.investorInfo')}</h2>
        <div className={styles.badges}>
          <Badge tone="neutral">{t('projectPage.investor.accessBadge')}</Badge>
          {!f.visible && <Badge tone="warning">{t('projectPage.investor.phaseBadge')}</Badge>}
        </div>
      </div>

      <p className={styles.lead}>{t('project.investorGate')}</p>

      <div className={styles.locked}>
        {!f.visible && (
          <p className={styles.lockedTitle}>
            <span className={styles.lockMark} aria-hidden="true" />
            {t('projectPage.investor.lockedTitle')}
          </p>
        )}

        <ul className={styles.fields}>
          {fields.map((field) => (
            <li key={field.key} className={styles.field}>
              <span className={styles.fieldName}>{field.name}</span>
              <span className={styles.fieldValue}>
                {field.value ?? t('projectPage.investor.withheld')}
              </span>
            </li>
          ))}
        </ul>

        {f.visible && f.source && (
          <>
            <p className={styles.lockedNote}>
              {label(t, UI.investorAsOf)} {f.asOfDate}
            </p>
            <SourceStamp
              source={{
                label: f.source.label,
                locator: f.source.locator,
                asOfDate: f.source.asOfDate,
              }}
            />
          </>
        )}

        {!f.visible && (
          <p className={styles.lockedNote}>{t('projectPage.investor.vettingNote')}</p>
        )}
        <p className={styles.lockedNote}>{t('projectPage.investor.notAdviceNote')}</p>
      </div>
    </>
  );
}
