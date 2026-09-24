import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import { AddEntry, RepeatEntry } from './RepeatGroup';
import { FieldRow, FileField, Note, SelectField, StaticValue, TextField } from './Fields';
import { DOCUMENTS, DOC_VISIBILITY, SECTION } from './project-draft-data';

/**
 * The documents behind the record: the project idea note and the design
 * document the pilot projects already hold, the monitoring plan, and the
 * verification reports that only exist after an independent body has verified
 * the result (concept note, section 2).
 *
 * A document is also what a figure cites: every source select elsewhere on this
 * form is a list of these documents, so a row added here is a source that
 * becomes available to every figure.
 */
export default async function DocumentsSection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  const visibilityOptions = DOC_VISIBILITY.map((value) => ({
    value,
    label: t(`option.visibility.${value}`),
  }));

  return (
    <FormSection
      id={SECTION.documents}
      n={9}
      title={tRoot('project.documents')}
      lead={t('section.documents.lead')}
    >
      {DOCUMENTS.map((document) => (
        <RepeatEntry
          key={document.id}
          legend={t(document.labelKey)}
          meta={document.version ? `v${document.version}` : undefined}
          removeLabel={t('repeat.remove')}
        >
          <FieldRow>
            <TextField
              id={`doc-${document.id}-version`}
              label={tRoot('project.documentVersion')}
              hint={t('field.versionHint')}
              defaultValue={document.version ?? ''}
              mono
              required
            />
            <TextField
              id={`doc-${document.id}-date`}
              label={tRoot('project.documentDate')}
              hint={t('field.documentDateHint')}
              type="date"
              defaultValue={document.dateOn ?? ''}
              required
            />
          </FieldRow>

          <FileField
            id={`doc-${document.id}-file`}
            label={t('field.documentFile')}
            accept=".pdf,.xlsx,.csv,.geojson"
            file={
              document.fileName
                ? {
                    name: document.fileName,
                    sizeNote: document.fileSize ?? '',
                    uploadedOn: document.uploadedOn ?? '',
                  }
                : null
            }
            emptyNote={t('field.noFile')}
            required
          />

          <FieldRow>
            <SelectField
              id={`doc-${document.id}-visibility`}
              label={t('field.visibility')}
              hint={t('field.visibilityHint')}
              defaultValue={document.visibility}
              options={visibilityOptions}
              required
            />
            <StaticValue
              label={t('field.uploadedBy')}
              value={document.uploadedBy ?? '—'}
            />
          </FieldRow>

          {document.noteKey && <Note>{t(document.noteKey)}</Note>}
        </RepeatEntry>
      ))}

      <AddEntry label={t('repeat.addDocument')} note={t('repeat.addDocumentNote')} />

      <Note tone="rule">{t('field.documentsRule')}</Note>
    </FormSection>
  );
}
