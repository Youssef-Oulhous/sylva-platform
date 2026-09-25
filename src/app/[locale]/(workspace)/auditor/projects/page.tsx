import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { getActor } from '@/lib/auth/session';
import { auditorErrorLabel, label, labelWith, PROJECTS } from '@/lib/auditor/labels';
import { logAuditorAccess, readAuditorProjects } from '@/lib/auditor/queries';
import type { AuditProjectSummary } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: label(t, PROJECTS.title), robots: { index: false, follow: false } };
}

/**
 * Every project, whatever its status.
 *
 * The gate column is the interesting one. It is proj.publication_gaps(), which
 * is the same function proj.enforce_publication_gate() consults before it
 * allows a project to be published, so what this column lists is exactly what
 * publication would refuse - not a restatement of the rule in TypeScript that
 * could drift away from it. A published project with a non-empty gap list
 * would be a finding, and it would be visible here.
 */
export default async function AuditorProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const actor = await getActor();

  let projects: AuditProjectSummary[] = [];
  let failure: unknown = null;
  try {
    projects = await readAuditorProjects(actor, locale);
  } catch (err) {
    console.error('[auditor] could not read the projects:', err);
    failure = err;
  }
  await logAuditorAccess(actor, 'auditor.projects');

  return (
    <section className={styles.section} aria-labelledby="auditor-projects">
      <h1 id="auditor-projects">{label(t, PROJECTS.title)}</h1>
      <p className={styles.lead}>{label(t, PROJECTS.lead)}</p>

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {label(t, auditorErrorLabel(failure))}
        </p>
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{label(t, PROJECTS.colProject)}</th>
                <th scope="col">{label(t, PROJECTS.colStatus)}</th>
                <th scope="col">{label(t, PROJECTS.colOwner)}</th>
                <th scope="col">{label(t, PROJECTS.colPublished)}</th>
                <th scope="col">{label(t, PROJECTS.colHolds)}</th>
                <th scope="col">{label(t, PROJECTS.colGate)}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/auditor/projects/${p.slug}`}>{p.title}</Link>
                    <span className={styles.sub}>{p.slug}</span>
                  </td>
                  <td>
                    <span className={`${styles.tag} ${
                      p.status === 'published' ? styles.tagPublic : styles.tagPrivate
                    }`}>
                      {p.status}
                    </span>
                    <span className={styles.sub}>{p.countryCode}</span>
                  </td>
                  <td>{p.ownerOrgName}</td>
                  <td className={styles.nowrap}>
                    {p.publishedAt ? (
                      <time dateTime={p.publishedAt}>
                        {format.dateTime(new Date(p.publishedAt), 'short')}
                      </time>
                    ) : (
                      <span className={styles.muted}>
                        {label(t, PROJECTS.notPublished)}
                      </span>
                    )}
                  </td>
                  <td className={styles.small}>
                    {labelWith(t, PROJECTS.holds, {
                      documents: p.documentCount,
                      parties: p.partyCount,
                      entries: p.entryCount,
                      deals: p.dealCount,
                    })}
                  </td>
                  <td className={styles.small}>
                    {p.gaps.length === 0 ? (
                      <span className={`${styles.tag} ${styles.tagPublic}`}>
                        {label(t, PROJECTS.gateComplete)}
                      </span>
                    ) : (
                      labelWith(t, PROJECTS.gateMissing, {
                        items: p.gaps.join(', '),
                      })
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
