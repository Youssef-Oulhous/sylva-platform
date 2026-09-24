import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import styles from './RestrictedDocumentList.module.css';

export interface InvestorDocument {
  id: string;
  nameKey: string;
  typeKey: string;
  version: string;
  /** ISO date. Formatted per locale at render time. */
  dateIso: string;
  access: 'public' | 'restricted';
}

/**
 * A document register, laid out as a document register.
 *
 * Every row states its version and its date, because a financial model without
 * a version is not evidence of anything. The two actions are real buttons that
 * do nothing in this pass; the note under the table says so, once, rather than
 * each button pretending to be live.
 */
export default async function RestrictedDocumentList({
  documents,
}: {
  documents: readonly InvestorDocument[];
}) {
  const t = await getTranslations('forInvestors');
  const format = await getFormatter();

  return (
    <>
      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('documents.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('documents.col.name')}</th>
              <th scope="col">{t('documents.col.type')}</th>
              <th scope="col">{t('documents.col.version')}</th>
              <th scope="col">{t('documents.col.date')}</th>
              <th scope="col">{t('documents.col.access')}</th>
              <th scope="col">{t('documents.col.action')}</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const name = t(doc.nameKey);
              const restricted = doc.access === 'restricted';
              return (
                <tr key={doc.id}>
                  <th scope="row" className={styles.rowHead}>
                    {name}
                  </th>
                  <td className={styles.meta}>{t(doc.typeKey)}</td>
                  <td className={styles.version}>{doc.version}</td>
                  <td className={styles.version}>
                    <time dateTime={doc.dateIso}>
                      {format.dateTime(new Date(doc.dateIso), 'short')}
                    </time>
                  </td>
                  <td>
                    <Badge tone={restricted ? 'warning' : 'neutral'}>
                      {t(`documents.${restricted ? 'restricted' : 'open'}`)}
                    </Badge>
                  </td>
                  <td>
                    <button type="button" className={styles.action}>
                      {t(restricted ? 'documents.requestAccess' : 'documents.download')}
                      <span className="visually-hidden"> — {name}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{t('documents.inertNote')}</p>
    </>
  );
}
