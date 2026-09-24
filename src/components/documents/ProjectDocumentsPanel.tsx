import { getFormatter, getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import { FieldRow, Note, SelectField } from '@/components/owner-project-edit/Fields';
import form from '@/components/owner-project-edit/RecordForm.module.css';
import { uploadProjectDocumentAction, withdrawDocumentVersionAction } from '@/lib/documents/actions';
import { docText, visibilityText } from '@/lib/documents/messages';
import { listProjectDocuments } from '@/lib/documents/queries';
import { OWNER_SETTABLE_VISIBILITIES } from '@/lib/documents/types';
import { ALLOWED_MEDIA_TYPES } from '@/lib/documents/media';
import { readAs } from '@/lib/db/session';
import type { Actor } from '@/lib/db/actor';
import styles from './ProjectDocumentsPanel.module.css';

/**
 * The owner's document register, with an upload form and a withdrawal form.
 *
 * WHAT IS IN THE LIST IS DECIDED BY THE DATABASE. listProjectDocuments runs as
 * the viewer's own role; the row-level policies on doc.document decide what
 * comes back. Nothing here filters, so nothing here can disagree with the
 * policy - including the part added by migration 0056, which is that an
 * owner does not see the admin-class and auditor-class documents attached to
 * its own project.
 *
 * NO LINK CARRIES A STORAGE KEY. Every "Open" points at
 * /api/projects/<slug>/documents/<document id>, which performs the
 * authorisation again, server-side, before a byte moves. The key the file is
 * stored under never reaches this page.
 *
 * NO CLIENT JAVASCRIPT. Two plain forms over Server Actions. The file input is
 * a file input; the accept attribute is a convenience, and the real check is
 * the sniff in src/lib/documents/media.ts.
 */

interface Props {
  actor: Actor;
  projectId: string;
  slug: string;
  /** An operator may set any class; an owner may set three. */
  canChooseAllVisibilities?: boolean;
}

export default async function ProjectDocumentsPanel({
  actor, projectId, slug, canChooseAllVisibilities = false,
}: Props) {
  const t = await getTranslations();
  const format = await getFormatter();

  const [documents, kinds] = await Promise.all([
    listProjectDocuments(actor, projectId),
    documentKinds(actor),
  ]);

  const visibilities = canChooseAllVisibilities
    ? (['public', 'vetted_buyer', 'vetted_investor', 'deal_participants', 'admin', 'auditor'] as const)
    : OWNER_SETTABLE_VISIBILITIES;

  const accept = ALLOWED_MEDIA_TYPES.map((m) => m.mediaType).join(',');

  return (
    <div className={styles.panel}>
      {/* ------------------------------------------------------- register -- */}
      <h3 className={styles.heading}>{docText(t, 'registerTitle')}</h3>

      {documents.length === 0 ? (
        <p className={form.note}>{docText(t, 'registerEmpty')}</p>
      ) : (
        <div className="table-scroll">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('project.documentName')}</th>
                <th scope="col">{docText(t, 'fieldVisibility')}</th>
                <th scope="col">{t('project.documentVersion')}</th>
                <th scope="col">{t('project.documentDate')}</th>
                <th scope="col">
                  <span className="visually-hidden">{docText(t, 'openAction')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const href = `/api/projects/${slug}/documents/${d.documentId}`;
                return (
                  <tr key={d.documentId}>
                    <th scope="row" className={styles.rowHead}>
                      {d.kind}
                      {d.byteSize !== null && (
                        <span className={styles.meta}>
                          {format.number(Math.max(1, Math.round(d.byteSize / 1000)))} kB
                          {d.mediaType ? ` · ${d.mediaType}` : ''}
                        </span>
                      )}
                    </th>
                    <td>{visibilityText(t, d.visibility)}</td>
                    <td className={styles.mono}>
                      {d.versionNo === null ? '—' : `v${d.versionNo}`}
                    </td>
                    <td className={styles.mono}>
                      {d.uploadedAt ? (
                        <time dateTime={d.uploadedAt}>
                          {format.dateTime(new Date(d.uploadedAt), 'short')}
                        </time>
                      ) : '—'}
                    </td>
                    <td className={styles.actionsCell}>
                      {d.available && d.versionId ? (
                        <>
                          <a href={href} className={styles.action}>
                            {docText(t, 'openAction')}
                          </a>
                          <a href={`${href}?download=1`} className={styles.action}>
                            {docText(t, 'downloadAction')}
                          </a>
                          <form className={styles.withdraw} action={withdrawDocumentVersionAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="versionId" value={d.versionId} />
                            <label
                              className="visually-hidden"
                              htmlFor={`reason-${d.documentId}`}
                            >
                              {docText(t, 'fieldReason')}
                            </label>
                            <input
                              id={`reason-${d.documentId}`}
                              name="reason"
                              className={styles.reason}
                              required
                              minLength={3}
                              maxLength={500}
                              placeholder={docText(t, 'fieldReason')}
                            />
                            <button type="submit" className={styles.withdrawButton}>
                              {docText(t, 'withdrawAction')}
                            </button>
                          </form>
                        </>
                      ) : (
                        <Badge tone="neutral">{docText(t, 'notAvailable')}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Note>{docText(t, 'withdrawNote')}</Note>

      {/* --------------------------------------------------------- upload -- */}
      <h3 className={styles.heading}>{docText(t, 'uploadTitle')}</h3>
      <p className={form.note}>{docText(t, 'uploadLead')}</p>

      <form className={form.form} action={uploadProjectDocumentAction} encType="multipart/form-data">
        <input type="hidden" name="slug" value={slug} />

        <FieldRow>
          <SelectField
            id="document-kind"
            name="kind"
            label={docText(t, 'fieldKind')}
            hint={docText(t, 'fieldKindHint')}
            required
            options={kinds.map((k) => ({ value: k.code, label: k.labelEn }))}
            placeholderOption="—"
          />
          <SelectField
            id="document-visibility"
            name="visibility"
            label={docText(t, 'fieldVisibility')}
            hint={docText(t, 'fieldVisibilityHint')}
            required
            defaultValue="public"
            options={visibilities.map((v) => ({ value: v, label: visibilityText(t, v) }))}
          />
        </FieldRow>

        <FieldRow>
          <SelectField
            id="document-locale"
            name="documentLocale"
            label={docText(t, 'fieldLocale')}
            optional
            options={[
              { value: 'en', label: 'English' },
              { value: 'de', label: 'Deutsch' },
            ]}
            placeholderOption="—"
          />

          <div className={styles.fileField}>
            <label className={styles.fileLabel} htmlFor="document-file">
              {docText(t, 'fieldFile')}
            </label>
            <p className={styles.fileHint} id="document-file-hint">
              {docText(t, 'fieldFileHint')}
            </p>
            <input
              id="document-file"
              name="file"
              type="file"
              required
              accept={accept}
              aria-describedby="document-file-hint"
              className={styles.file}
            />
          </div>
        </FieldRow>

        <div className={form.actions}>
          <button type="submit" className={form.submit}>
            {docText(t, 'uploadAction')}
          </button>
          <p className={form.note}>{docText(t, 'appendNote')}</p>
        </div>
      </form>

      <Note tone="rule">{docText(t, 'storageNote')}</Note>
    </div>
  );
}

/** The reference table is the list of kinds. A copy in the code would drift. */
async function documentKinds(actor: Actor): Promise<{ code: string; labelEn: string }[]> {
  return readAs(actor, async (tx) => {
    const rows = await tx.query<{ code: string; label_en: string }>(
      'SELECT code, label_en FROM doc.document_kind ORDER BY label_en',
    );
    return rows.map((r) => ({ code: r.code, labelEn: r.label_en }));
  });
}
