import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoProject } from './demo-data';
import styles from './DurabilitySection.module.css';

/**
 * Long-term protection: land control, maintenance, term, and what the documents
 * say happens afterwards.
 *
 * The last entry states that the project documents do not say what happens
 * after the management agreement ends. That is the honest answer and it stays on
 * screen: one interviewed buyer asked about the period after a five-year
 * contract and another about thirty to forty years, so silence is information.
 *
 * The timeline is an ordered list with CSS markers. No library, and it degrades
 * to a plain numbered list of dates if the stylesheet never arrives.
 */
export default async function DurabilitySection({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  const stateLabel = (state: 'recorded' | 'planned' | 'open') =>
    state === 'recorded'
      ? t('projectPage.durability.stateRecorded')
      : state === 'planned'
        ? t('projectPage.durability.statePlanned')
        : t('projectPage.durability.stateOpen');

  return (
    <>
      <h2>{t('project.durability')}</h2>
      <p className={styles.lead}>{t('projectPage.durability.lead')}</p>

      <dl className={styles.facts}>
        {project.durabilityFacts.map((f) => (
          <div key={f.id} className={styles.fact}>
            <dt className={styles.factLabel}>{t(f.labelKey)}</dt>
            <dd className={styles.factValue}>
              {t(f.valueKey)}
              <SourceStamp
                source={{
                  label: t(f.source.labelKey),
                  locator: f.source.locator,
                  asOfDate: f.source.asOfDate,
                }}
              />
            </dd>
          </div>
        ))}
      </dl>

      <h3 className={styles.timelineTitle}>{t('projectPage.durability.timelineTitle')}</h3>
      <p className={styles.timelineNote}>{t('projectPage.durability.timelineNote')}</p>

      <ol className={styles.timeline}>
        {project.timeline.map((e) => (
          <li key={e.id} className={e.state === 'open' ? styles.entryOpen : styles.entry}>
            <span className={styles.when}>{e.when}</span>
            <span className={styles.entryBody}>
              <span className={styles.entryTitle}>
                {t(e.titleKey)}
                <span className={styles.state}>{stateLabel(e.state)}</span>
              </span>
              <span className={styles.entryText}>{t(e.bodyKey)}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
