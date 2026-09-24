import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { label, labelWith, PAGER } from '@/lib/record/labels';
import { recordHref } from '@/lib/record/params';
import type { RecordExtract } from '@/lib/record/types';
import styles from './RecordPagination.module.css';

/**
 * Pagination as links, not buttons.
 *
 * Every page of the record has its own address, carrying the filter it was
 * read under, so page 3 of "interest expressed on the Untere Havel project"
 * can be sent to somebody. Links also mean the whole control works before any
 * JavaScript runs, and that a reader can open a page in a new tab - which is
 * what people do with evidence.
 *
 * The position is stated in words as well as in arrows: "Page 2 of 4", and
 * "Showing entries 26 to 50 of 87". The second sentence is there because a
 * reader of a permanent record needs to know how much of it they are looking
 * at. Both numbers count ENTRIES, and nothing on this page is a unit volume.
 */
export default async function RecordPagination({
  extract,
  projectSlug,
  eventType,
}: {
  extract: RecordExtract;
  projectSlug: string | null;
  eventType: string | null;
}) {
  const t = await getTranslations();
  if (extract.pageCount <= 1) return null;

  const href = (page: number) => recordHref({ projectSlug, eventType, page });
  const hasPrev = extract.page > 1;
  const hasNext = extract.page < extract.pageCount;

  return (
    <nav className={styles.pager} aria-label={label(t, PAGER.label)}>
      <div className={styles.controls}>
        {hasPrev ? (
          <Link className={styles.step} href={href(extract.page - 1)} rel="prev">
            ← {label(t, PAGER.previous)}
          </Link>
        ) : (
          <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
            ← {label(t, PAGER.previous)}
          </span>
        )}

        <p className={styles.position}>
          {labelWith(t, PAGER.position, {
            page: extract.page,
            pageCount: extract.pageCount,
          })}
        </p>

        {hasNext ? (
          <Link className={styles.step} href={href(extract.page + 1)} rel="next">
            {label(t, PAGER.next)} →
          </Link>
        ) : (
          <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
            {label(t, PAGER.next)} →
          </span>
        )}
      </div>

      <p className={styles.showing}>
        {labelWith(t, PAGER.showing, {
          from: extract.from,
          to: extract.to,
          total: extract.total,
        })}
      </p>
    </nav>
  );
}
