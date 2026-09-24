import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import { ROLES_SOURCE, ROLE_ROWS } from './about-data';
import shared from './AboutSection.module.css';
import styles from './RolesSection.module.css';

/**
 * The five kinds of organisation on the platform, and what each of them sees.
 *
 * The third column is the point of the table. "Who uses it" is easy; "who sees
 * what" is the thing a buyer actually wants to know before it registers a site
 * or names a price, and it is stated here in the same table rather than left to
 * a paragraph further down.
 */
export default async function RolesSection() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('about.roles.title')}</h2>
      <p className={shared.lead}>{t('about.roles.lead')}</p>

      <div className={`table-scroll ${styles.tableWrap}`}>
        <table>
          <caption>{t('about.roles.caption')}</caption>
          <thead>
            <tr>
              {/* Reuses the existing project.role key: it already says "Role". */}
              <th scope="col" className={styles.colRole}>{t('project.role')}</th>
              <th scope="col">{t('about.roles.col.does')}</th>
              <th scope="col">{t('about.roles.col.sees')}</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_ROWS.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.rowHead}>{t(row.roleKey)}</th>
                <td>{t(row.doesKey)}</td>
                <td>{t(row.seesKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceStamp
        source={{
          label: t(ROLES_SOURCE.labelKey),
          locator: ROLES_SOURCE.locator,
          asOfDate: ROLES_SOURCE.asOfDate,
        }}
      />

      <p className={shared.note}>{t('about.roles.note')}</p>
    </>
  );
}
