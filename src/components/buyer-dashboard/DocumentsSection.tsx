import { getFormatter, getTranslations } from 'next-intl/server';
import EmptyState from './EmptyState';
import type { DocumentGroup } from './types';
import styles from './DocumentsSection.module.css';

/**
 * Every document this organisation can reach, in three groups.
 *
 * Grouping is what makes the empty group meaningful. A single list would show
 * seven documents and say nothing about the one that is missing; split into
 * organisation documents, deal documents and signed agreements, the reader can
 * see that no agreement has been signed yet, which is the most consequential
 * fact in the section.
 *
 * Attribution is to an organisation, never to a person: personal data sits in
 * the user accounts table alone (concept note, §9). A superseded version stays
 * in the list, carrying the word "Superseded" and the version that replaced it,
 * because a list that silently drops old versions cannot be used to follow what
 * was agreed.
 */
export default async function DocumentsSection({
  groups,
}: {
  groups: readonly DocumentGroup[];
}) {
  const t = await getTranslations('buyerDashboard');
  // Three column headings already exist on the platform, on the project page's
  // document list. A document table should not invent its own words for
  // "Document", "Version" and "Date".
  const tRoot = await getTranslations();
  const format = await getFormatter();

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.id} className={styles.group} aria-labelledby={`docs-${group.id}`}>
          <h3 id={`docs-${group.id}`} className={styles.groupTitle}>
            {t(group.titleKey)}
          </h3>
          <p className={styles.groupIntro}>{t(group.introKey)}</p>

          {group.documents.length === 0 ? (
            <EmptyState title={t(group.emptyTitleKey)} body={t(group.emptyBodyKey)} />
          ) : (
            <div className="table-scroll">
              <table className={styles.table}>
                <caption className={styles.caption}>{t(group.titleKey)}</caption>
                <thead>
                  <tr>
                    <th scope="col">{tRoot('project.documentName')}</th>
                    <th scope="col">{t('documents.col.scope')}</th>
                    <th scope="col">{tRoot('project.documentVersion')}</th>
                    <th scope="col">{tRoot('project.documentDate')}</th>
                    <th scope="col">{t('documents.col.lodgedBy')}</th>
                    <th scope="col">{tRoot('project.status')}</th>
                    <th scope="col">
                      {/* The actions column needs a name for a screen reader
                          and none on screen: the controls name themselves. */}
                      <span className="visually-hidden">{t('documents.col.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.documents.map((doc) => {
                    const name = t(doc.nameKey);

                    return (
                      <tr key={doc.id}>
                        <th scope="row" className={styles.rowHead}>
                          {name}
                        </th>

                        <td className={styles.scopeCell}>
                          <span className={styles.scopeKind}>{t(doc.scopeKey)}</span>
                          {doc.scopeName === null ? null : (
                            <span className={styles.scopeName}>{doc.scopeName}</span>
                          )}
                        </td>

                        <td className={styles.versionCell}>
                          <span className={styles.mono}>{doc.version}</span>
                        </td>

                        <td className={styles.dateCell}>
                          <time dateTime={doc.dateIso}>
                            {format.dateTime(new Date(doc.dateIso), 'short')}
                          </time>
                        </td>

                        <td className={styles.lodgedCell}>
                          {doc.lodgedByKey === null
                            ? doc.lodgedByOrgName
                            : t(doc.lodgedByKey)}
                        </td>

                        {/* Status is a word, and the word is the whole status.
                            A superseded row also names the version that
                            replaced it, so the reader can find that one. */}
                        <td className={styles.statusCell}>
                          {t(doc.statusKey)}
                          {doc.replacedByVersion === null ? null : (
                            <span className={styles.statusNote}>
                              {t('documents.replacedBy', { version: doc.replacedByVersion })}
                            </span>
                          )}
                        </td>

                        <td className={styles.actionsCell}>
                          {/* Two controls that would otherwise both be
                              announced as "View", so each carries the document
                              name in its accessible name. */}
                          <button
                            type="button"
                            className={styles.action}
                            aria-label={t('documents.viewAria', { name })}
                          >
                            {t('documents.view')}
                          </button>
                          <button
                            type="button"
                            className={styles.action}
                            aria-label={t('documents.downloadAria', { name })}
                          >
                            {t('documents.download')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <p className={styles.attribution}>{t('documents.attributionNote')}</p>
    </div>
  );
}
