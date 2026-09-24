import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import type { DemoProject } from './demo-data';
import styles from './DocumentsSection.module.css';

/**
 * The document register. Version and date are columns, not metadata in small
 * print: a reader checking a figure against the design document needs to know
 * which version produced it.
 *
 * A document that does not exist yet is listed with its expected period rather
 * than hidden, because its absence is part of what a reader is assessing.
 */
export default async function DocumentsSection({ project }: { project: DemoProject }) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <h2>{t('project.documents')}</h2>
      <p className={styles.lead}>{t('projectPage.documents.lead')}</p>

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
            {project.documents.map((d) => (
              <tr key={d.id}>
                <th scope="row" className={styles.rowHead}>
                  {t(d.nameKey)}
                  {d.fileNote && <span className={styles.fileNote}>{d.fileNote}</span>}
                </th>
                <td>{t(d.typeKey)}</td>
                <td className={styles.mono}>{d.version ?? '—'}</td>
                <td className={styles.mono}>
                  {d.date ? (
                    <time dateTime={d.date}>
                      {format.dateTime(new Date(d.date), 'short')}
                    </time>
                  ) : (
                    t('projectPage.documents.expected2029')
                  )}
                </td>
                <td>{d.uploadedBy ?? '—'}</td>
                <td className={styles.actionsCell}>
                  {d.available ? (
                    <span className={styles.actions}>
                      <a href={d.href} className={styles.action}>
                        {t('projectPage.documents.view')}
                      </a>
                      <a href={`${d.href}?download=1`} className={styles.action}>
                        {t('projectPage.documents.download')}
                      </a>
                    </span>
                  ) : (
                    <Badge tone="neutral">{t('projectPage.documents.notYetAvailable')}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.foot}>
        <a href={`/api/projects/${project.slug}/documents.zip`} className={styles.bulk}>
          {t('project.downloadDocuments')}
        </a>
        <p className={styles.footNote}>{t('projectPage.documents.note')}</p>
      </div>
    </>
  );
}
