import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { getActor } from '@/lib/auth/session';
import { auditorErrorLabel, label, labelWith, PROJECTS } from '@/lib/auditor/labels';
import { logAuditorAccess, readAuditorProject } from '@/lib/auditor/queries';
import { formatQty } from '@/lib/units/qty';
import type { AuditProjectDetail } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${slug} — ${label(t, PROJECTS.title)}`,
    robots: { index: false, follow: false },
  };
}

/**
 * One project, as the database holds it.
 *
 * Everything on this page carries its provenance, because on this platform
 * every displayed figure does: source_ref_id is NOT NULL on the tables these
 * rows come from, so a figure without a source could not have been inserted.
 * The auditor's page is the one place where that promise is worth showing in
 * full rather than summarising.
 *
 * RULE 7. The availability table prints five figures per period, each with the
 * project's own unit label beside it. They are never added, not across periods
 * and certainly not across projects: this page has no total row, and the note
 * above the table says why rather than leaving the absence to be noticed.
 */
export default async function AuditorProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const actor = await getActor();

  let detail: AuditProjectDetail | null = null;
  let failure: unknown = null;
  try {
    detail = await readAuditorProject(actor, slug, locale);
  } catch (err) {
    console.error('[auditor] could not read the project:', err);
    failure = err;
  }
  await logAuditorAccess(actor, 'auditor.project', 'project', slug);

  if (failure !== null) {
    return (
      <p className={styles.failure} role="alert">
        {label(t, auditorErrorLabel(failure))}
      </p>
    );
  }
  if (detail === null) notFound();

  const { summary } = detail;

  return (
    <>
      <section className={styles.section} aria-labelledby="auditor-project">
        <h2 id="auditor-project">{summary.title}</h2>
        <dl className={styles.pairs}>
          <dt>slug</dt><dd className={styles.mono}>{summary.slug}</dd>
          <dt>{label(t, PROJECTS.colStatus)}</dt><dd>{summary.status}</dd>
          <dt>{label(t, PROJECTS.colOwner)}</dt><dd>{summary.ownerOrgName}</dd>
          <dt>{label(t, PROJECTS.colPublished)}</dt>
          <dd>
            {summary.publishedAt
              ? format.dateTime(new Date(summary.publishedAt), 'short')
              : label(t, PROJECTS.notPublished)}
          </dd>
          <dt>{label(t, PROJECTS.detailGate)}</dt>
          <dd>
            {summary.gaps.length === 0
              ? label(t, PROJECTS.gateComplete)
              : labelWith(t, PROJECTS.gateMissing, { items: summary.gaps.join(', ') })}
          </dd>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-parties">
        <h3 id="auditor-project-parties">{label(t, PROJECTS.detailParties)}</h3>
        {detail.parties.length === 0 ? (
          <p className={styles.empty}>{label(t, PROJECTS.noVerifier)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Organisation</th>
                  <th scope="col">Role</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {detail.parties.map((p) => (
                  <tr key={`${p.role}-${p.orgName}`}>
                    <td>
                      {p.orgName}
                      {p.descriptionEn && (
                        <span className={styles.sub}>{p.descriptionEn}</span>
                      )}
                    </td>
                    <td>{p.role}</td>
                    <td><SourceStamp source={p.source} inline /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-verification">
        <h3 id="auditor-project-verification">{label(t, PROJECTS.detailVerification)}</h3>
        {detail.verification.length === 0 ? (
          <p className={styles.empty}>{label(t, PROJECTS.noVerification)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Indicator</th>
                  <th scope="col">Domain</th>
                  <th scope="col">{label(t, PROJECTS.verifier)}</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {detail.verification.map((v) => (
                  <tr key={v.indicatorCode}>
                    <td>
                      {v.indicatorCode}
                      <span className={styles.sub}>
                        {v.measureUnit} · v{v.versionNo}
                      </span>
                    </td>
                    <td>{v.domain}</td>
                    <td>
                      {v.verifierOrgName ?? (
                        <span className={styles.muted}>
                          {label(t, PROJECTS.noVerifier)}
                        </span>
                      )}
                      {v.uncertaintyNote && (
                        <span className={styles.sub}>{v.uncertaintyNote}</span>
                      )}
                    </td>
                    <td><SourceStamp source={v.source} inline /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-documents">
        <h3 id="auditor-project-documents">{label(t, PROJECTS.detailDocuments)}</h3>
        {detail.documents.length === 0 ? (
          <p className={styles.empty}>{label(t, PROJECTS.noDocuments)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Visibility</th>
                  <th scope="col">{label(t, PROJECTS.docHash)}</th>
                  <th scope="col">{label(t, PROJECTS.docStoredIn)}</th>
                  <th scope="col">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.flatMap((d) =>
                  (d.versions.length > 0
                    ? d.versions
                    : [null]
                  ).map((v) => (
                    <tr key={v ? v.versionId : d.id}>
                      <td>
                        {d.kindLabelEn}
                        <span className={styles.sub}>
                          {v ? labelWith(t, PROJECTS.docVersion, { n: v.versionNo }) : '—'}
                          {v?.mediaType ? ` · ${v.mediaType}` : ''}
                          {v ? ` · ${labelWith(t, PROJECTS.docBytes, { bytes: v.byteSize })}` : ''}
                        </span>
                        {v?.withdrawnAt && (
                          <span className={`${styles.tag} ${styles.tagError}`}>
                            {label(t, PROJECTS.docWithdrawn)}
                          </span>
                        )}
                      </td>
                      <td>{d.visibility}</td>
                      {/* The content hash is what makes a document version
                          citable: a copy held outside this platform can be
                          checked against it without trusting us. */}
                      <td className={styles.mono}>{v?.contentSha256 ?? '—'}</td>
                      <td className={styles.small}>
                        {v ? `${v.storageRegion}` : '—'}
                        {v?.storageMemberState && (
                          <span className={styles.sub}>{v.storageMemberState}</span>
                        )}
                      </td>
                      <td className={styles.small}>
                        {v?.uploadedByOrgName ?? '—'}
                        {v && (
                          <span className={styles.sub}>
                            {format.dateTime(new Date(v.uploadedAt), 'short')}
                          </span>
                        )}
                        {v?.withdrawalReason && (
                          <span className={styles.sub}>{v.withdrawalReason}</span>
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-registry">
        <h3 id="auditor-project-registry">{label(t, PROJECTS.detailRegistry)}</h3>
        {detail.registry.length === 0 ? (
          <p className={styles.empty}>{label(t, PROJECTS.noRegistry)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Scheme</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {detail.registry.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.schemeName}
                      <span className={styles.sub}>{r.recordType} · {r.periodLabel}</span>
                    </td>
                    <td className={styles.mono}>
                      {r.recordUrl ? (
                        <a href={r.recordUrl} rel="noreferrer noopener external">
                          {r.externalRecordId}
                        </a>
                      ) : (
                        r.externalRecordId
                      )}
                    </td>
                    <td className={styles.nowrap}>
                      {/* One figure, one unit label, one project. Never summed. */}
                      {r.quantity && r.unitLabel
                        ? formatQty(r.quantity, r.unitLabel, locale)
                        : '—'}
                    </td>
                    <td>
                      {r.confirmationStatus}
                      {r.confirmedByOrgName && (
                        <span className={styles.sub}>{r.confirmedByOrgName}</span>
                      )}
                    </td>
                    <td><SourceStamp source={r.source} inline /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-availability">
        <h3 id="auditor-project-availability">{label(t, PROJECTS.detailAvailability)}</h3>
        <p className={styles.small}>{label(t, PROJECTS.unitNote)}</p>
        {detail.availability.length === 0 ? (
          <p className={styles.empty}>{label(t, PROJECTS.noAvailability)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Buffer</th>
                  <th scope="col">Reserved</th>
                  <th scope="col">Committed</th>
                  <th scope="col">Remaining</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {detail.availability.map((a) => (
                  <tr key={a.periodLabel}>
                    <td>
                      {a.periodLabel}
                      <span className={styles.sub}>
                        {a.startsOn} – {a.endsOn} · {a.vintageSemantics}
                      </span>
                    </td>
                    <td>{formatQty(a.expected, a.unitLabel, locale)}</td>
                    <td>{formatQty(a.buffer, a.unitLabel, locale)}</td>
                    <td>{formatQty(a.reserved, a.unitLabel, locale)}</td>
                    <td>{formatQty(a.committed, a.unitLabel, locale)}</td>
                    <td>{formatQty(a.remaining, a.unitLabel, locale)}</td>
                    <td><SourceStamp source={a.source} inline /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-text">
        <h3 id="auditor-project-text">{label(t, PROJECTS.detailText)}</h3>
        {/* Page text is append-only and versioned: a correction is a new
            version and the old one stays. Showing every version, with the
            current one marked, is what makes that visible rather than
            claimed. */}
        <div className="table-scroll">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Locale</th>
                <th scope="col">Version</th>
                <th scope="col">Translation status</th>
              </tr>
            </thead>
            <tbody>
              {detail.texts.map((x) => (
                <tr key={`${x.fieldCode}-${x.locale}-${x.versionNo}`}>
                  <td>{x.fieldCode}</td>
                  <td>{x.locale}</td>
                  <td>
                    {x.versionNo}
                    {x.isCurrent && (
                      <span className={`${styles.tag} ${styles.tagWater}`}>current</span>
                    )}
                  </td>
                  <td>{x.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="auditor-project-geometry">
        <h3 id="auditor-project-geometry">{label(t, PROJECTS.detailGeometry)}</h3>
        <div className="table-scroll">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Layer</th>
                <th scope="col">Version</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {detail.geometry.map((g) => (
                <tr key={`${g.kind}-${g.versionNo}`}>
                  <td>{g.kind}</td>
                  <td>{g.versionNo}</td>
                  <td><SourceStamp source={g.source} inline /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
