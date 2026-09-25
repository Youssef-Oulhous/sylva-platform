import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import EmptyState from './EmptyState';
import { buyerText } from '@/lib/dashboard/messages';
import { docText, visibilityText } from '@/lib/documents/messages';
import type { ProjectDocument } from '@/lib/dashboard/types';
import styles from './ProjectDocumentsTable.module.css';

/**
 * The documents of the projects this organisation has expressed interest in.
 *
 * WHY THIS BELONGS HERE AT ALL. A buyer who has expressed interest in three
 * projects has to open three project pages to collect the design documents, and
 * the buyer area's own document section listed nothing but the organisation's
 * two vetting files. This is the one list where "the documents I need for the
 * projects I am looking at" is a single page.
 *
 * WHICH ROWS APPEAR IS THE DATABASE'S ANSWER. There is no visibility test in the
 * query behind this table and there must never be one: the six visibility
 * classes are row-level policies on doc.document (migrations 0017 and 0056), so
 * an approved buyer is shown the public documents and the vetted-buyer
 * documents, and an unapproved one is shown the public documents alone. The
 * class is PRINTED, in the "Who may read it" column, so a reader can see the
 * footing each file is offered on instead of having to assume it.
 *
 * NO LINK CARRIES A STORAGE KEY. Every link points at
 * /api/projects/<slug>/documents/<document id>, which checks that the document
 * belongs to the project in the path and then resolves it as the reader's own
 * PostgreSQL role before a byte moves. The project-scoped route rather than the
 * bare one, because every row here does belong to a project and the extra check
 * costs nothing.
 *
 * Rule 7 does not apply: there is not a quantity on this table. The one number
 * is a file size in kilobytes, which carries its own unit beside it.
 */
export default async function ProjectDocumentsTable({
  documents,
}: {
  documents: readonly ProjectDocument[];
}) {
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');
  const format = await getFormatter();

  // doc.document_kind holds label_en and no German label, so the CODE is looked
  // up in the catalogue and the English reference label is the fallback. The
  // same mechanism as DocumentsSection, and for the same reason.
  const kindLabel = (doc: ProjectDocument): string => {
    const key = `documents.kind.${doc.kind}`;
    try {
      if (typeof tb.has === 'function' && tb.has(key)) return tb(key);
    } catch {
      /* fall through to the reference row's English label */
    }
    return doc.kindLabel;
  };

  if (documents.length === 0) {
    return (
      <EmptyState
        title={buyerText(t, 'projectDocsEmptyTitle')}
        body={buyerText(t, 'projectDocsEmptyBody')}
        action={
          <Link href="/projects" className={styles.emptyLink}>
            {t('home.ctaExplore')}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption className={styles.caption}>
            {buyerText(t, 'projectDocsCaption')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('project.documentName')}</th>
              <th scope="col">{buyerText(t, 'colProject')}</th>
              <th scope="col">{buyerText(t, 'colReadableBy')}</th>
              <th scope="col">{t('project.documentVersion')}</th>
              <th scope="col">{t('project.documentDate')}</th>
              <th scope="col">{buyerText(t, 'colSize')}</th>
              <th scope="col">{tb('documents.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const href = `/api/projects/${doc.projectSlug}/documents/${doc.id}`;
              return (
                <tr key={doc.id}>
                  <th scope="row" className={styles.rowHead}>{kindLabel(doc)}</th>

                  <td className={styles.projectCell}>
                    <Link href={`/projects/${doc.projectSlug}`}>
                      {doc.projectTitle}
                    </Link>
                  </td>

                  {/* The visibility class, as a sentence. Printed, never used
                      here to decide anything - the policy already decided. */}
                  <td className={styles.visibilityCell}>
                    {visibilityText(t, doc.visibility)}
                  </td>

                  <td className={styles.versionCell}>
                    <span className={styles.mono}>
                      {doc.versionNo === null ? '—' : `v${doc.versionNo}`}
                    </span>
                  </td>

                  <td className={styles.dateCell}>
                    {doc.uploadedOn === null ? (
                      '—'
                    ) : (
                      <time dateTime={doc.uploadedOn}>
                        {format.dateTime(new Date(doc.uploadedOn), 'short')}
                      </time>
                    )}
                  </td>

                  {/* The unit stands beside the figure, as it does everywhere on
                      this platform. Rounded up, so a small file is not "0 kB". */}
                  <td className={styles.sizeCell}>
                    {doc.byteSize === null ? (
                      '—'
                    ) : (
                      <span className={styles.mono}>
                        {format.number(Math.max(1, Math.round(doc.byteSize / 1000)))} kB
                      </span>
                    )}
                  </td>

                  <td className={styles.actionsCell}>
                    {doc.available ? (
                      <>
                        <a href={href} className={styles.action}>
                          {docText(t, 'openAction')}
                        </a>
                        <a href={`${href}?download`} className={styles.action}>
                          {docText(t, 'downloadAction')}
                        </a>
                      </>
                    ) : (
                      <span className={styles.quiet}>{docText(t, 'notAvailable')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>{buyerText(t, 'serveNote')}</p>
    </>
  );
}
