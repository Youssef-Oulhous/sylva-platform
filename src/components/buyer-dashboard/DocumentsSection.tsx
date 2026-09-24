import { getFormatter, getTranslations } from 'next-intl/server';
import EmptyState from './EmptyState';
import type { DashboardDocument, DocumentGroupId } from '@/lib/dashboard/types';
import styles from './DocumentsSection.module.css';

/**
 * Every document this organisation can reach, in three groups.
 *
 * Grouping is what makes the empty group meaningful. A single list would show
 * seven documents and say nothing about the one that is missing; split into
 * organisation documents, deal documents and signed agreements, the reader can
 * see that no agreement has been signed yet, which is the most consequential
 * fact in the section. All three groups are rendered even when all three are
 * empty, for the same reason.
 *
 * Attribution is to an organisation, never to a person: personal data sits in
 * the user accounts table alone (concept note, §9). "Your organisation" or
 * nothing - a buyer holds no column grant on another organisation's legal name
 * and this section does not work around that.
 *
 * There is no download control. Document storage is not built (README §9.5):
 * a file is served from EU object storage through a short-lived signed URL
 * issued after a server-side authorization check, and a button that did
 * anything less than that would be the wrong button. The version and the date
 * are real; the bytes are not reachable yet, and the row says so.
 *
 * THE KIND OF DOCUMENT IS TRANSLATED HERE. doc.document_kind carries label_en
 * and no label_de - unlike platform.sector, which carries both - so rendering
 * the reference row directly put "Signed agreement" in the middle of an
 * otherwise German table. The code is looked up in the message catalogue and
 * the English reference label is the fallback, so a kind added to the table
 * later appears in English rather than as a missing key.
 */
const GROUPS: readonly DocumentGroupId[] = ['organisation', 'deal', 'signed'];

export default async function DocumentsSection({
  documents,
}: {
  documents: readonly DashboardDocument[];
}) {
  const t = await getTranslations('buyerDashboard');
  // Three column headings already exist on the platform, on the project page's
  // document list. A document table should not invent its own words for
  // "Document", "Version" and "Date".
  const tRoot = await getTranslations();
  const format = await getFormatter();

  // The key is built from doc.document_kind.code, so check:i18n cannot see it -
  // t.has() is what keeps a missing key from rendering as a key. The same shape
  // as src/components/express-interest/copy.ts.
  const kindLabel = (doc: DashboardDocument): string => {
    const key = `documents.kind.${doc.kind}`;
    try {
      if (typeof t.has === 'function' && t.has(key)) return t(key);
    } catch {
      /* fall through to the reference row's English label */
    }
    return doc.kindLabel;
  };

  return (
    <div className={styles.groups}>
      {GROUPS.map((group) => {
        const rows = documents.filter((d) => d.group === group);
        return (
          <section key={group} className={styles.group} aria-labelledby={`docs-${group}`}>
            <h3 id={`docs-${group}`} className={styles.groupTitle}>
              {t(`documents.group.${group}.title`)}
            </h3>
            <p className={styles.groupIntro}>{t(`documents.group.${group}.intro`)}</p>

            {rows.length === 0 ? (
              <EmptyState
                title={t(`documents.group.${group}.emptyTitle`)}
                body={t(`documents.group.${group}.emptyBody`)}
              />
            ) : (
              <div className="table-scroll">
                <table className={styles.table}>
                  <caption className={styles.caption}>
                    {t(`documents.group.${group}.title`)}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{tRoot('project.documentName')}</th>
                      <th scope="col">{t('documents.col.scope')}</th>
                      <th scope="col">{tRoot('project.documentVersion')}</th>
                      <th scope="col">{tRoot('project.documentDate')}</th>
                      <th scope="col">{t('documents.col.lodgedBy')}</th>
                      <th scope="col">{tRoot('project.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((doc) => (
                      <tr key={doc.id}>
                        {/* The kind comes from doc.document_kind, reference
                            data the operator maintains, and is translated here
                            because that table holds an English label only. */}
                        <th scope="row" className={styles.rowHead}>
                          {kindLabel(doc)}
                        </th>

                        <td className={styles.scopeCell}>
                          <span className={styles.scopeKind}>
                            {t(`documents.scope.${doc.group === 'organisation' ? 'organisation' : 'deal'}`)}
                          </span>
                          {doc.scopeName === null ? null : (
                            <span className={styles.scopeName}>{doc.scopeName}</span>
                          )}
                        </td>

                        <td className={styles.versionCell}>
                          <span className={styles.mono}>
                            {doc.versionNo === null ? '—' : `v${doc.versionNo}.0`}
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

                        <td className={styles.lodgedCell}>
                          {doc.lodgedByYou ? t('documents.lodgedBy.you') : '—'}
                        </td>

                        {/* Status is a word, and the word is the whole status.
                            A document with no readable version is listed - the
                            row is evidence that it exists - and says so. */}
                        <td className={styles.statusCell}>
                          {doc.available
                            ? t('documents.status.current')
                            : t('documents.status.notAvailable')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <p className={styles.attribution}>{t('documents.attributionNote')}</p>
      <p className={styles.attribution}>{t('documents.storageNote')}</p>
    </div>
  );
}
