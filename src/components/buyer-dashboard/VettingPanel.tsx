import { getFormatter, getTranslations } from 'next-intl/server';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import type { VettingRecord, VettingState } from './types';
import styles from './VettingPanel.module.css';

/**
 * Vetting status, and the two lists that keep it from being read as more than
 * it is.
 *
 * Vetting is what stands between an organisation and a deal - "no deal can be
 * created for an organisation we have not approved" (concept note, §8, rule 6)
 * - so the status is the first thing on this dashboard. What it does NOT do is
 * also stated, because an approval decision by the operator is not an issuance,
 * an allocation or an entry in a scheme's registry, and a screen that shows
 * only the word "Approved" invites exactly that reading.
 *
 * The status is never colour alone: the badge carries the word, and the word is
 * repeated in the row label beside it. Green is reserved on this platform for
 * biodiversity and for the primary action, so an approved status is neutral
 * here rather than green.
 */
const TONE: Record<VettingState, BadgeTone> = {
  approved: 'neutral',
  submitted: 'warning',
  declined: 'error',
};

const ALLOWS = ['interest', 'dealRoom', 'sites'] as const;
const LIMITS = ['investor', 'registry'] as const;

export default async function VettingPanel({ vetting }: { vetting: VettingRecord }) {
  const t = await getTranslations('buyerDashboard');
  // "Status" is the platform's existing word for this label, on project pages.
  const tRoot = await getTranslations();
  const format = await getFormatter();

  const date = (iso: string) => (
    <time dateTime={iso}>{format.dateTime(new Date(iso), 'short')}</time>
  );

  return (
    <section className={styles.panel} aria-labelledby="vetting-status">
      <h3 id="vetting-status" className={styles.panelTitle}>
        {t('vetting.title')}
      </h3>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>{tRoot('project.status')}</dt>
          <dd className={styles.factValue}>
            <Badge tone={TONE[vetting.state]}>{t(`vetting.state.${vetting.state}`)}</Badge>
          </dd>
        </div>

        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('vetting.submittedOn')}</dt>
          <dd className={styles.factValue}>{date(vetting.submittedOn)}</dd>
        </div>

        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('vetting.decidedOn')}</dt>
          <dd className={styles.factValue}>
            {vetting.decidedOn === null ? (
              <span className={styles.pending}>{t('vetting.notDecided')}</span>
            ) : (
              date(vetting.decidedOn)
            )}
          </dd>
        </div>

        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('vetting.decidedBy')}</dt>
          <dd className={styles.factValue}>{vetting.decidedByOrgName}</dd>
        </div>

        <div className={styles.fact}>
          <dt className={styles.factLabel}>{t('vetting.questionnaire')}</dt>
          <dd className={styles.factValue}>
            <span className={styles.mono}>{vetting.questionnaireVersion}</span>
          </dd>
        </div>

        {vetting.reasonKey === null ? null : (
          <div className={styles.fact}>
            <dt className={styles.factLabel}>{t('vetting.reason')}</dt>
            <dd className={styles.factValue}>{t(vetting.reasonKey)}</dd>
          </div>
        )}
      </dl>

      <SourceStamp
        source={{
          label: t(vetting.source.labelKey),
          locator: vetting.source.locator,
          asOfDate: vetting.source.asOfDate,
        }}
      />

      <h4 className={styles.listTitle}>{t('vetting.permitsTitle')}</h4>
      <ul className={styles.list}>
        {ALLOWS.map((key) => (
          <li key={key}>{t(`vetting.permits.${key}`)}</li>
        ))}
      </ul>

      <h4 className={styles.listTitle}>{t('vetting.limitsTitle')}</h4>
      <ul className={`${styles.list} ${styles.listMuted}`}>
        {LIMITS.map((key) => (
          <li key={key}>{t(`vetting.limits.${key}`)}</li>
        ))}
      </ul>
    </section>
  );
}
