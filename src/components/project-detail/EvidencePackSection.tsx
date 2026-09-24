import { getFormatter, getTranslations } from 'next-intl/server';
import { DOCUMENT_KIND, EVIDENCE_ELEMENT, label, UI } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './EvidencePackSection.module.css';

/**
 * The reporting evidence pack.
 *
 * The contents list is proj.evidence_pack_element - public reference data, and
 * exactly what one interviewed reporting company said its assessor asked it to
 * look for: a measurable action, a fixed timeframe, expected impact, a budget
 * and a verification standard.
 *
 * WHAT HAS ACTUALLY BEEN ASSEMBLED is a different thing and a private one.
 * proj.evidence_pack_item is granted to vetted buyers, the project owner, the
 * operator and the auditor and to nobody else, so `items === null` means "not
 * your question" and `items === []` means "nobody has assembled it yet". The
 * two are different sentences and the section says which it is rather than
 * showing an empty list to everyone.
 *
 * The caveat is quoted verbatim from the client's brief and is not softened,
 * moved into small print, or paired with any suggestion that the pack satisfies
 * a regime or an auditor. The platform makes no such claim.
 */
export default async function EvidencePackSection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const { elements, items, assembledAt } = project.evidencePack;

  const itemsFor = (code: string) => (items ?? []).filter((i) => i.elementCode === code);

  return (
    <>
      <h2>{t('projectPage.evidence.title')}</h2>
      <p className={styles.lead}>{t('projectPage.evidence.lead')}</p>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('projectPage.evidence.containsTitle')}</h3>
        <ul className={styles.items}>
          {elements.map((e) => (
            <li key={e.code}>
              {label(t, EVIDENCE_ELEMENT[e.code], e.labelEn)}
              {items !== null && itemsFor(e.code).length > 0 && (
                <ul className={styles.assembled}>
                  {itemsFor(e.code).map((i) => (
                    <li key={`${i.elementCode}-${i.itemNo}`}>
                      {i.documentKind
                        ? label(t, DOCUMENT_KIND[i.documentKind], i.documentKind)
                        : (i.metricCode ?? i.note ?? '')}
                      {i.documentVersionNo !== null && ` · v${i.documentVersionNo}`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {items === null ? (
          <p className={styles.caveat}>{label(t, UI.evidenceRestricted)}</p>
        ) : items.length === 0 ? (
          <p className={styles.caveat}>{label(t, UI.evidenceNotAssembled)}</p>
        ) : (
          assembledAt && (
            <p className={styles.format}>
              {label(t, UI.evidenceAssembledOn)}:{' '}
              {format.dateTime(new Date(assembledAt), 'short')}
            </p>
          )
        )}

        <div className={styles.actions}>
          <a
            href={`/api/projects/${project.slug}/evidence-pack.pdf`}
            className={styles.download}
          >
            {t('projectPage.evidence.download')}
          </a>
          <span className={styles.format}>{t('projectPage.evidence.format')}</span>
        </div>
      </div>

      <p className={styles.caveat}>{t('projectPage.evidence.caveat')}</p>
    </>
  );
}
