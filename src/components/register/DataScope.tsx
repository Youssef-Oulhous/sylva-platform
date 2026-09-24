import { getTranslations } from 'next-intl/server';
import styles from './DataScope.module.css';

/**
 * What the registration puts where.
 *
 * The concept note (§9) is specific: personal data sits in one table only, the
 * user accounts, and everything else references organisations by ID - which is
 * how the right to erasure and an append-only record manage to coexist. A
 * registration form is the moment that distinction matters to the person
 * filling it in, so it is stated here as a table rather than buried in a
 * privacy page.
 *
 * Three rows, three columns: what the data is, where it is held, who can read
 * it. It claims nothing about compliance with any particular regulation - it
 * describes where the data sits, which is a fact about the system.
 */

interface DataRow {
  id: string;
  whatKey: string;
  whereKey: string;
  whoKey: string;
}

const ROWS: readonly DataRow[] = [
  {
    id: 'person',
    whatKey: 'register.data.r1.what',
    whereKey: 'register.data.r1.where',
    whoKey: 'register.data.r1.who',
  },
  {
    id: 'organisation',
    whatKey: 'register.data.r2.what',
    whereKey: 'register.data.r2.where',
    whoKey: 'register.data.r2.who',
  },
  {
    id: 'record',
    whatKey: 'register.data.r3.what',
    whereKey: 'register.data.r3.where',
    whoKey: 'register.data.r3.who',
  },
];

export default async function DataScope() {
  const t = await getTranslations();

  return (
    <div className={styles.wrap}>
      <p className={styles.body}>{t('register.data.body')}</p>

      <div className="table-scroll">
        <table className={styles.table}>
          <caption>{t('register.data.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('register.data.colWhat')}</th>
              <th scope="col">{t('register.data.colWhere')}</th>
              <th scope="col">{t('register.data.colWho')}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.id}>
                <th scope="row" className={styles.rowHead}>
                  {t(row.whatKey)}
                </th>
                <td>{t(row.whereKey)}</td>
                <td>{t(row.whoKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.notes}>
        <p className={styles.note}>{t('register.data.erasure')}</p>
        <p className={styles.note}>{t('register.data.hosting')}</p>
      </div>
    </div>
  );
}
