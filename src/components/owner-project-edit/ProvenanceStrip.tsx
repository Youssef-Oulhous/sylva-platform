import { getTranslations } from 'next-intl/server';
import { SOURCE_DOCS } from './project-draft-data';
import styles from './ProvenanceStrip.module.css';

/**
 * The document a value comes from, the place inside it, and the date it is
 * stated as of.
 *
 * "Every figure on screen carries its source and date" (concept note, section 9)
 * is a rule about the published page, which means it is really a rule about this
 * form: a figure can only arrive on the project page with its provenance if the
 * provenance is asked for at the same moment as the figure. So the three
 * controls are attached to the value rather than collected in a section of their
 * own, and they are drawn as one block so a reader sees that the value and its
 * source are one field.
 *
 * The source is a select over the documents this record holds, not a free-text
 * box: a source naming a document the record does not have is not a source.
 *
 * FRONTEND PASS. Uncontrolled controls, no handlers, no submit.
 */
export default async function ProvenanceStrip({
  idBase,
  sourceDocId,
  locator,
  asOfDate,
}: {
  /** Prefix for the three control ids. Unique per value on the page. */
  idBase: string;
  sourceDocId: string | null;
  locator: string | null;
  asOfDate: string | null;
}) {
  const t = await getTranslations('ownerProjectForm');

  const sourceId = `${idBase}-source`;
  const locatorId = `${idBase}-locator`;
  const asOfId = `${idBase}-asof`;
  const flagId = `${idBase}-flag`;

  const stated = sourceDocId !== null && asOfDate !== null && asOfDate.length > 0;

  return (
    <div className={stated ? styles.strip : `${styles.strip} ${styles.stripOpen}`}>
      <p className={styles.stripLabel}>{t('provenance.label')}</p>

      <div className={styles.grid}>
        <div className={styles.cell}>
          <label className={styles.cellLabel} htmlFor={sourceId}>
            {t('provenance.source')}
          </label>
          <select
            id={sourceId}
            name={sourceId}
            className={styles.select}
            defaultValue={sourceDocId ?? ''}
            aria-describedby={stated ? undefined : flagId}
          >
            <option value="">{t('provenance.sourceUnset')}</option>
            {SOURCE_DOCS.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {t(doc.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.cell}>
          <label className={styles.cellLabel} htmlFor={locatorId}>
            {t('provenance.locator')}
          </label>
          <input
            id={locatorId}
            name={locatorId}
            type="text"
            className={`${styles.control} ${styles.mono}`}
            defaultValue={locator ?? ''}
            placeholder={t('provenance.locatorPlaceholder')}
          />
        </div>

        <div className={styles.cell}>
          <label className={styles.cellLabel} htmlFor={asOfId}>
            {t('provenance.asOf')}
          </label>
          <input
            id={asOfId}
            name={asOfId}
            type="date"
            className={`${styles.control} ${styles.mono}`}
            defaultValue={asOfDate ?? ''}
            aria-describedby={stated ? undefined : flagId}
          />
        </div>
      </div>

      {/* The gap is stated in words. The amber edge repeats it; it never carries
          it alone. */}
      {!stated && (
        <p className={styles.flag} id={flagId}>
          {t('provenance.missing')}
        </p>
      )}
    </div>
  );
}
