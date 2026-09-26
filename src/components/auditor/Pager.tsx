import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';
import { label, labelWith, RECORD } from '@/lib/auditor/labels';
import styles from './Auditor.module.css';

/**
 * Paging a long table.
 *
 * Every link carries the filter the table was read under, so a page of an
 * extract has an address that reopens the same rows - which is why the caller
 * passes `hrefFor` rather than this component knowing about any one view. The
 * record and the access log both use it.
 *
 * The position is printed as well as linked, because an auditor quoting
 * "entries 26 to 50 of 312" in a report needs the numbers, not just the arrows.
 *
 * Numbered pages, not only Previous and Next. With arrows alone, reaching
 * entry 300 of an access log meant twelve clicks and twelve page loads, and
 * there was no way to tell how far in you were or to come back to the same
 * place afterwards. Long runs are collapsed to an ellipsis so the row stays one
 * line: first, last, and a window around where you are.
 */
function pageWindow(page: number, pageCount: number): Array<number | '…'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const out: Array<number | '…'> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push('…');
  for (let n = from; n <= to; n += 1) out.push(n);
  if (to < pageCount - 1) out.push('…');
  out.push(pageCount);
  return out;
}

export default function Pager({
  page,
  pageCount,
  from,
  to,
  count,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  count: number;
  hrefFor: (page: number) => string;
}) {
  const t = useTranslations();
  const position = labelWith(t, RECORD.showing, { from, to, count });

  if (pageCount <= 1) {
    return <p className={styles.pagerPosition}>{position}</p>;
  }

  return (
    <nav className={styles.pager} aria-label={label(t, RECORD.pager)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev">
          {label(t, RECORD.previous)}
        </Link>
      ) : (
        <span className={styles.muted}>{label(t, RECORD.previous)}</span>
      )}

      <span className={styles.pagerPages}>
        {pageWindow(page, pageCount).map((n, i) =>
          n === '…' ? (
            // eslint-disable-next-line react/no-array-index-key -- the gaps have no identity of their own
            <span key={`gap-${i}`} className={styles.muted} aria-hidden="true">…</span>
          ) : n === page ? (
            <span key={n} className={styles.pageCurrent} aria-current="page">{n}</span>
          ) : (
            <Link key={n} href={hrefFor(n)} className={styles.pageLink}>{n}</Link>
          ),
        )}
      </span>

      <span className={styles.pagerPosition}>{position}</span>

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next">
          {label(t, RECORD.next)}
        </Link>
      ) : (
        <span className={styles.muted}>{label(t, RECORD.next)}</span>
      )}
    </nav>
  );
}
