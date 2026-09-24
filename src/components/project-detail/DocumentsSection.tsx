import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { DOCUMENT_KIND, DOCUMENT_VISIBILITY, label, UI } from '@/lib/projects/labels';
import type { ProjectDetail, ProjectDocumentRow } from '@/lib/projects/types';
import styles from './DocumentsSection.module.css';

/**
 * The document register. Version and date are columns, not metadata in small
 * print: a reader checking a figure against the design document needs to know
 * which version produced it.
 *
 * WHAT IS IN THIS LIST IS DECIDED BY THE DATABASE. doc.document carries a
 * visibility class and the row-level policies on doc.document and
 * doc.document_version implement it: an anonymous visitor sees the public
 * documents, a vetted buyer additionally sees the vetted-buyer ones, a
 * withdrawn version disappears. Nothing here filters, so nothing here can
 * disagree with the policy. The visibility badge is shown so a reader can tell
 * that a restricted document exists - which is a deliberate disclosure and a
 * small one, since only its kind is named.
 */
export default async function DocumentsSection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <h2>{t('project.documents')}</h2>
      <p className={styles.lead}>{t('projectPage.documents.lead')}</p>

      {project.documents.length === 0 ? (
        <p className={styles.footNote}>{label(t, UI.noDocuments)}</p>
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <caption>{t('projectPage.documents.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('project.documentName')}</th>
                <th scope="col">{t('projectPage.documents.type')}</th>
                <th scope="col">{t('project.documentVersion')}</th>
                <th scope="col">{t('project.documentDate')}</th>
                <th scope="col">{t('projectPage.documents.uploadedBy')}</th>
                <th scope="col">
                  <span className="visually-hidden">
                    {t('projectPage.documents.actions')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {project.documents.map((d) => {
                const href = `/api/projects/${project.slug}/documents/${d.id}`;
                return (
                  <tr key={d.id}>
                    <th scope="row" className={styles.rowHead}>
                      {label(t, DOCUMENT_KIND[d.kind], d.kind)}
                      {d.visibility !== 'public' && (
                        <span className={styles.fileNote}>
                          {label(t, DOCUMENT_VISIBILITY[d.visibility], d.visibility)}
                        </span>
                      )}
                      {d.byteSize !== null && (
                        <span className={styles.fileNote}>{fileSize(d, format)}</span>
                      )}
                    </th>
                    <td>{mediaLabel(d.mediaType)}</td>
                    <td className={styles.mono}>
                      {d.versionNo === null ? '—' : `v${d.versionNo}`}
                    </td>
                    <td className={styles.mono}>
                      {d.uploadedAt ? (
                        <time dateTime={d.uploadedAt}>
                          {format.dateTime(new Date(d.uploadedAt), 'short')}
                        </time>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{d.uploadedByName ?? '—'}</td>
                    <td className={styles.actionsCell}>
                      {d.available ? (
                        <span className={styles.actions}>
                          <a href={href} className={styles.action}>
                            {t('projectPage.documents.view')}
                          </a>
                          <a href={`${href}?download=1`} className={styles.action}>
                            {t('projectPage.documents.download')}
                          </a>
                        </span>
                      ) : (
                        <Badge tone="neutral">
                          {t('projectPage.documents.notYetAvailable')}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.foot}>
        <a href={`/api/projects/${project.slug}/documents.zip`} className={styles.bulk}>
          {t('project.downloadDocuments')}
        </a>
        <p className={styles.footNote}>{t('projectPage.documents.note')}</p>
      </div>
    </>
  );
}

/** The media type as a person reads it. Not translated: these are formats. */
function mediaLabel(mediaType: string | null): string {
  if (!mediaType) return '—';
  if (mediaType === 'application/pdf') return 'PDF';
  if (mediaType === 'application/geo+json' || mediaType === 'application/json') return 'GeoJSON';
  if (mediaType.startsWith('text/')) return mediaType.slice(5).toUpperCase();
  return mediaType;
}

function fileSize(
  d: ProjectDocumentRow,
  format: { number: (n: number, opts?: Intl.NumberFormatOptions) => string },
): string {
  const bytes = d.byteSize ?? 0;
  if (bytes >= 1_000_000) {
    return `${format.number(bytes / 1_000_000, { maximumFractionDigits: 1 })} MB`;
  }
  return `${format.number(Math.round(bytes / 1000))} kB`;
}
