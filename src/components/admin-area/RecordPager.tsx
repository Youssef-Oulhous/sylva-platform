import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { label, labelWith, RECORD } from '@/lib/admin/labels';
import type { OperatorRecordPage, RecordScope } from '@/lib/admin/record';
import styles from './AdminArea.module.css';

/**
 * Paging that keeps the filter.
 *
 * Every link carries the project, event and scope currently applied, because a
 * "next page" that quietly widened the filter would be showing the operator
 * rows they did not ask for and would make the position line a lie.
 */
export default async function RecordPager({
  extract,
  projectSlug,
  entryType,
  scope,
}: {
  extract: OperatorRecordPage;
  projectSlug: string | null;
  entryType: string | null;
  scope: RecordScope;
}) {
  const t = await getTranslations();
  if (extract.pageCount <= 1) return null;

  const at = (page: number) => ({
    pathname: '/admin/record' as const,
    query: {
      ...(projectSlug !== null ? { project: projectSlug } : {}),
      ...(entryType !== null ? { event: entryType } : {}),
      ...(scope !== 'all' ? { scope } : {}),
      page: String(page),
    },
  });

  return (
    <nav className={styles.pager} aria-label={label(t, RECORD.title)}>
      {extract.page > 1 && (
        <Link href={at(extract.page - 1)}>{label(t, RECORD.prev)}</Link>
      )}
      <span className={styles.pagerPosition}>
        {labelWith(t, RECORD.showing, {
          from: extract.from,
          to: extract.to,
          total: extract.total,
        })}
      </span>
      {extract.page < extract.pageCount && (
        <Link href={at(extract.page + 1)}>{label(t, RECORD.next)}</Link>
      )}
    </nav>
  );
}
