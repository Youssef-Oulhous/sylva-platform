import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import EventVocabulary from '@/components/record/EventVocabulary';
import RecordFilters from '@/components/record/RecordFilters';
import RecordScope from '@/components/record/RecordScope';
import RecordTable from '@/components/record/RecordTable';
import {
  DEMO_CORRECTION_CHAIN,
  DEMO_RECORD_ENTRIES,
  DEMO_RECORD_EXTRACT,
} from '@/components/record/demo-record';
import styles from './page.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'record' });
  return { title: t('title'), description: t('lead') };
}

/**
 * The public transaction record.
 *
 * Frontend only: the entries come from a demo module, not from the database.
 * The shape of that module mirrors record.v_public_entry, which is the view the
 * page will read once the data layer is wired in.
 *
 * Rule 7 on this page is structural rather than editorial. The record carries
 * no volume column and no price column, so there is no figure on the page that
 * belongs to a project's unit scheme, and therefore nothing that could be added
 * across projects. The one number the page does print - how many entries are in
 * the extract - counts entries, and says so next to itself, so it cannot be
 * mistaken for a unit volume.
 */
export default async function RecordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const entries = DEMO_RECORD_ENTRIES;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('record.title')}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{t('record.lead')}</p>
      </header>

      <RecordScope />

      <RecordFilters />

      <section className={styles.entries} aria-labelledby="record-entries">
        <h2 id="record-entries">{t('record.entriesTitle')}</h2>

        <div className={styles.countRow}>
          <p className={styles.count}>{t('record.count', { count: entries.length })}</p>
          <SourceStamp
            source={{
              label: t('record.extractSource'),
              locator: null,
              asOfDate: DEMO_RECORD_EXTRACT.asOfDate,
            }}
          />
          <p className={styles.countNote}>{t('record.countNote')}</p>
        </div>

        <RecordTable entries={entries} locale={locale} />

        <p className={styles.noVolumes}>{t('record.noVolumes')}</p>

        <details className={styles.details}>
          <summary className={styles.summary}>{t('record.correction.title')}</summary>
          <div className={styles.detailsBody}>
            <p>{t('record.correction.body')}</p>
            <ol className={styles.steps}>
              <li>
                {t('record.correction.step1', { wrong: DEMO_CORRECTION_CHAIN.wrongRef })}
              </li>
              <li>
                {t('record.correction.step2', {
                  correction: DEMO_CORRECTION_CHAIN.correctionRef,
                  wrong: DEMO_CORRECTION_CHAIN.wrongRef,
                })}
              </li>
              <li>
                {t('record.correction.step3', {
                  corrected: DEMO_CORRECTION_CHAIN.correctedRef,
                })}
              </li>
            </ol>
            <p className={styles.detailsClose}>{t('record.correction.close')}</p>
          </div>
        </details>
      </section>

      <EventVocabulary />

      <section className={styles.limits} aria-labelledby="record-limits">
        <h2 id="record-limits">{t('record.limits.title')}</h2>
        <p>{t('record.limits.privacy')}</p>
        <p>{t('record.limits.kAnonymity')}</p>
        <p className={styles.classification}>
          {t('record.limits.classification', {
            classification: DEMO_RECORD_EXTRACT.sectorClassification,
          })}
        </p>
        <SourceStamp
          source={{
            label: t('record.extractSource'),
            locator: null,
            asOfDate: DEMO_RECORD_EXTRACT.asOfDate,
          }}
        />
      </section>
    </>
  );
}
