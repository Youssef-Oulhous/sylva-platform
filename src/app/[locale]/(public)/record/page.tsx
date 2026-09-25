import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import EventVocabulary from '@/components/record/EventVocabulary';
import RecordFilters from '@/components/record/RecordFilters';
import RecordPagination from '@/components/record/RecordPagination';
import RecordScope from '@/components/record/RecordScope';
import RecordTable from '@/components/record/RecordTable';
import { getActor } from '@/lib/auth/session';
import { CORRECTION, label, recordErrorLabel, TABLE } from '@/lib/record/labels';
import { parseRecordParams } from '@/lib/record/params';
import {
  readRecordClassifications,
  readRecordExtract,
  readRecordFilterOptions,
} from '@/lib/record/queries';
import type {
  RecordClassifications,
  RecordExtract,
  RecordFilterOptions,
} from '@/lib/record/types';
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
 * The public transaction record, read from record.v_public_entry.
 *
 * Read as the actual viewer rather than as an anonymous visitor. The record is
 * public and the view resolves every counterparty the same way for every role,
 * so this changes nothing about who is named; what it does change is that a
 * signed-in operator sees the project titles of projects that are no longer
 * offered, where an anonymous reader sees the slug. Reading as somebody the
 * viewer is not would be a small lie on a page whose whole subject is evidence.
 *
 * Rule 7 on this page is structural rather than editorial. The record carries
 * no volume column and no price column, so there is no figure on the page that
 * belongs to a project's unit scheme, and therefore nothing that could be added
 * across projects. The numbers the page does print - how many entries match,
 * and which of them are on this page - count entries, and say so next to
 * themselves, so they cannot be mistaken for a unit volume.
 *
 * Nothing here filters the record. Superseded entries are returned, shown in
 * date order and marked. That is R4, and a page that quietly dropped them
 * would be a different product.
 */
export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const query = await searchParams;

  const actor = await getActor();

  let options: RecordFilterOptions = { projects: [], eventTypes: [] };
  let extract: RecordExtract | null = null;
  let classifications: RecordClassifications = { sector: null, sizeBandBasis: null };
  let failure: unknown = null;
  let parsed = { projectSlug: null as string | null, eventType: null as string | null, page: 1, ignored: [] as Array<'project' | 'event'> };

  try {
    // The options are read first because the filter is validated against them:
    // ?project=does-not-exist is a well-formed slug and must be reported, not
    // silently turned into an empty table that reads like "no entries".
    options = await readRecordFilterOptions(actor, locale);
    parsed = parseRecordParams(query, options);
    extract = await readRecordExtract(actor, {
      locale,
      projectSlug: parsed.projectSlug,
      eventType: parsed.eventType,
      page: parsed.page,
    });
    classifications = await readRecordClassifications(actor);
  } catch (err) {
    // The record is evidence, so a failure to read it says so plainly and does
    // not pretend the record is empty. "Something went wrong" would leave a
    // reader unsure whether entries had been removed.
    console.error('[record] could not read the public record:', err);
    failure = err;
  }

  // The date the extract was READ. It is the source of the count and of which
  // rows are on this page, and nothing else: each entry carries its own source
  // and its own as-of date, in its own row. See RecordTable.
  const asOf = new Date().toISOString().slice(0, 10);
  const isFiltered = parsed.projectSlug !== null || parsed.eventType !== null;

  // The correction explainer describes something the reader can see. On an
  // extract with no correction in it - a filter by project or event type, an
  // empty record, or a failed read - it would be describing rows that are not
  // there, on the one page whose subject is evidence. So it is rendered from
  // what this extract actually holds rather than from what the demo seed
  // happens to contain.
  const hasCorrection =
    extract?.entries.some((e) => e.correctsPublicId !== null || e.isSuperseded) ?? false;

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

      <RecordFilters
        options={options}
        locale={locale}
        projectSlug={parsed.projectSlug}
        eventType={parsed.eventType}
        ignored={parsed.ignored}
      />

      <section className={styles.entries} aria-labelledby="record-entries">
        <h2 id="record-entries">{t('record.entriesTitle')}</h2>

        {failure !== null ? (
          <p className={styles.failure} role="alert">
            {label(t, recordErrorLabel(failure))}
          </p>
        ) : extract === null || extract.total === 0 ? (
          <p className={styles.empty}>
            {label(t, isFiltered ? TABLE.empty : TABLE.emptyAll)}
          </p>
        ) : (
          <>
            <div className={styles.countRow}>
              <p className={styles.count}>
                {t('record.count', { count: extract.total })}
              </p>
              <SourceStamp
                source={{
                  label: t('record.extractSource'),
                  locator: null,
                  asOfDate: asOf,
                }}
              />
              <p className={styles.countNote}>{t('record.countNote')}</p>
            </div>

            <RecordTable entries={extract.entries} locale={locale} />

            <RecordPagination
              extract={extract}
              projectSlug={parsed.projectSlug}
              eventType={parsed.eventType}
            />

            <p className={styles.noVolumes}>{t('record.noVolumes')}</p>
          </>
        )}

        {hasCorrection && (
          <details className={styles.details}>
            <summary className={styles.summary}>{t('record.correction.title')}</summary>
            <div className={styles.detailsBody}>
              <p>{label(t, CORRECTION.body)}</p>
              <p className={styles.detailsClose}>{label(t, CORRECTION.close)}</p>
            </div>
          </details>
        )}
      </section>

      <EventVocabulary eventTypes={options.eventTypes} />

      <section className={styles.limits} aria-labelledby="record-limits">
        <h2 id="record-limits">{t('record.limits.title')}</h2>
        <p>{t('record.limits.privacy')}</p>
        <p>{t('record.limits.kAnonymity')}</p>
        {classifications.sector && (
          <p className={styles.classification}>
            {t('record.limits.classification', {
              classification: classifications.sector,
            })}
          </p>
        )}
        <SourceStamp
          source={{
            label: t('record.extractSource'),
            locator: null,
            asOfDate: asOf,
          }}
        />
      </section>
    </>
  );
}
