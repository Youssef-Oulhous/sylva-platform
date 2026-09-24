import { useFormatter, useTranslations } from 'next-intl';
import styles from './SourceStamp.module.css';

export interface Source {
  label: string;
  asOfDate: string | Date;
  locator?: string | null;
}

/**
 * "Every figure on screen carries its source and date." (Concept note, §9.)
 *
 * This is a component rather than a convention because a convention is not
 * checkable. Every figure rendered on this platform is expected to be followed
 * by one of these, and a figure whose source_ref is missing cannot be inserted
 * into the database at all - source_ref_id is NOT NULL on the tables that hold
 * displayed values.
 */
export default function SourceStamp({
  source,
  inline = false,
}: {
  source: Source;
  inline?: boolean;
}) {
  const t = useTranslations('source');
  const format = useFormatter();
  const date =
    typeof source.asOfDate === 'string' ? new Date(source.asOfDate) : source.asOfDate;

  return (
    <small className={inline ? `${styles.stamp} ${styles.inline}` : styles.stamp}>
      {t('label')}: {source.label}
      {source.locator ? `, ${source.locator}` : ''} {t('separator')} {t('updated')}:{' '}
      <time dateTime={date.toISOString().slice(0, 10)}>
        {format.dateTime(date, 'short')}
      </time>
    </small>
  );
}
