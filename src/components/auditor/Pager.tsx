import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';
import { auditRecordHref } from '@/lib/auditor/params';
import { label, labelWith, RECORD } from '@/lib/auditor/labels';
import type { AuditRecordPage } from '@/lib/auditor/types';
import styles from './Auditor.module.css';

/**
 * Paging the record.
 *
 * Every link carries the filter it was read under, so a page of an extract has
 * an address that reopens the same rows. The position is printed as well as
 * linked, because an auditor quoting "entries 26 to 50 of 312" in a report
 * needs the numbers, not just the arrows.
 */
export default function Pager({
  extract,
  projectSlug,
  entryType,
}: {
  extract: AuditRecordPage;
  projectSlug: string | null;
  entryType: string | null;
}) {
  const t = useTranslations();
  if (extract.pageCount <= 1) {
    return (
      <p className={styles.pagerPosition}>
        {labelWith(t, RECORD.showing, {
          from: extract.from, to: extract.to, count: extract.entryCount,
        })}
      </p>
    );
  }

  const href = (page: number) =>
    auditRecordHref({ projectSlug, entryType, page });

  return (
    <nav className={styles.pager} aria-label={label(t, RECORD.pager)}>
      {extract.page > 1 ? (
        <Link href={href(extract.page - 1)} rel="prev">
          {label(t, RECORD.previous)}
        </Link>
      ) : (
        <span className={styles.muted}>{label(t, RECORD.previous)}</span>
      )}

      <span className={styles.pagerPosition}>
        {labelWith(t, RECORD.showing, {
          from: extract.from, to: extract.to, count: extract.entryCount,
        })}
      </span>

      {extract.page < extract.pageCount ? (
        <Link href={href(extract.page + 1)} rel="next">
          {label(t, RECORD.next)}
        </Link>
      ) : (
        <span className={styles.muted}>{label(t, RECORD.next)}</span>
      )}
    </nav>
  );
}
