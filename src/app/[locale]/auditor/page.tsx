import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import ReadOnlyNotice from '@/components/auditor/ReadOnlyNotice';
import { getActor } from '@/lib/auth/session';
import { AUDIT, auditorErrorLabel, label, OVERVIEW } from '@/lib/auditor/labels';
import {
  logAuditorAccess, readAuditorOverview, runAuditorGuards,
} from '@/lib/auditor/queries';
import type { AuditGuard, AuditOverview } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: label(t, AUDIT.title),
    description: label(t, AUDIT.lead),
    // An auditor's view of private material has no business in a search index.
    robots: { index: false, follow: false },
  };
}

/**
 * What the platform holds, and the guarantees this view rests on.
 *
 * The counts are counts of ROWS. None of them is a unit volume and none is
 * added across projects: Rule 7 is not so much obeyed here as inapplicable,
 * and the page says so under the figures rather than leaving a reader to
 * assume it.
 */
export default async function AuditorOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const actor = await getActor();

  let overview: AuditOverview | null = null;
  let guards: AuditGuard[] = [];
  let failure: unknown = null;

  try {
    overview = await readAuditorOverview(actor);
    guards = await runAuditorGuards(actor);
  } catch (err) {
    console.error('[auditor] could not read the overview:', err);
    failure = err;
  }
  await logAuditorAccess(actor, 'auditor.overview');

  const figures: { value: number; label: string; sub?: string }[] = overview
    ? [
        {
          value: overview.projects,
          label: label(t, OVERVIEW.projects),
          sub: `${overview.projectsPublished} ${label(t, OVERVIEW.projectsPublished)}`,
        },
        {
          value: overview.organisations,
          label: label(t, OVERVIEW.organisations),
          sub: `${overview.approvals} ${label(t, OVERVIEW.approvals)}`,
        },
        {
          value: overview.entries,
          label: label(t, OVERVIEW.entries),
          sub: `${overview.publicEntries} ${label(t, OVERVIEW.publicEntries)}`,
        },
        {
          value: overview.deals,
          label: label(t, OVERVIEW.deals),
          sub: `${overview.dealsDisclosed} ${label(t, OVERVIEW.dealsDisclosed)}`,
        },
        {
          value: overview.documents,
          label: label(t, OVERVIEW.documents),
          sub: `${overview.documentVersions} ${label(t, OVERVIEW.documentVersions)}`,
        },
        {
          value: overview.registryRecords,
          label: label(t, OVERVIEW.registry),
          sub: `${overview.registryConfirmed} ${label(t, OVERVIEW.registryConfirmed)}`,
        },
        {
          value: overview.people,
          label: label(t, OVERVIEW.people),
          sub: `${overview.erasures} ${label(t, OVERVIEW.erasures)}`,
        },
        {
          value: overview.unresolvedPeople,
          label: label(t, OVERVIEW.unresolvedPeople),
        },
        { value: overview.accessLogRows, label: label(t, OVERVIEW.accessLog) },
      ]
    : [];

  return (
    <>
      <ReadOnlyNotice guards={guards} />

      <section className={styles.section} aria-labelledby="auditor-counts">
        <h2 id="auditor-counts">{label(t, OVERVIEW.countsTitle)}</h2>

        {failure !== null ? (
          <p className={styles.failure} role="alert">
            {label(t, auditorErrorLabel(failure))}
          </p>
        ) : (
          <>
            <ul className={styles.counts}>
              {figures.map((f) => (
                <li key={f.label} className={styles.count}>
                  <span className={styles.countValue}>{f.value}</span>
                  <span className={styles.countLabel}>{f.label}</span>
                  {f.sub && <span className={styles.countSub}>{f.sub}</span>}
                </li>
              ))}
            </ul>
            <p className={styles.small}>{label(t, OVERVIEW.countsNote)}</p>
          </>
        )}
      </section>

      <section className={`${styles.notice} ${styles.noticeWater}`}
               aria-labelledby="auditor-erasure">
        <h2 id="auditor-erasure" className={styles.noticeTitle}>
          {label(t, AUDIT.erasureTitle)}
        </h2>
        <p className={styles.noticeBody}>{label(t, AUDIT.erasureBody)}</p>
      </section>

      <section className={styles.notice} aria-labelledby="auditor-names">
        <h2 id="auditor-names" className={styles.noticeTitle}>
          {label(t, AUDIT.namesTitle)}
        </h2>
        <p className={styles.noticeBody}>{label(t, AUDIT.namesBody)}</p>
      </section>

      <section className={styles.notice} aria-labelledby="auditor-scope">
        <h2 id="auditor-scope" className={styles.noticeTitle}>
          {label(t, AUDIT.scopeTitle)}
        </h2>
        <p className={styles.noticeBody}>{label(t, AUDIT.scopeBody)}</p>
        <p className={styles.noticeBody}>{label(t, AUDIT.scopeGap)}</p>
      </section>
    </>
  );
}
