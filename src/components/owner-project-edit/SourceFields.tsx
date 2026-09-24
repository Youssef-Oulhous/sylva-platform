import { getTranslations } from 'next-intl/server';
import { ownerText } from '@/lib/owner/messages';
import { FieldRow, Note, SelectField, TextField } from './Fields';
import styles from './Fields.module.css';

/**
 * Where an entry comes from, asked for in the same breath as the entry.
 *
 * "Every figure on screen carries its source and date" (concept note, section
 * 9) is a rule about the published page, so it is really a rule about this
 * form: a figure can only reach the project page with its source if the source
 * is asked for at the same moment as the figure. So these controls sit inside
 * each section's form rather than being collected in a section of their own,
 * and the section cannot be submitted without them - sylva.source_ref is
 * inserted first and its id is NOT NULL on every row the section writes.
 *
 * The default kind is "stated by this project" rather than "stated by Sylva".
 * Filing an owner's own assertion as Sylva's would put a false attribution on
 * the published page, which is worse than no attribution at all. See migration
 * 0051.
 */
export default async function SourceFields({
  prefix,
  defaultAsOf,
}: {
  /** Unique per form on the page, so two forms' labels point at two fields. */
  prefix: string;
  defaultAsOf: string;
}) {
  const t = await getTranslations();

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{ownerText(t, 'sourceHeading')}</legend>

      <Note>{ownerText(t, 'sourceLead')}</Note>

      <FieldRow>
        <SelectField
          id={`${prefix}-source-kind`}
          name="source_kind"
          label={ownerText(t, 'sourceKind')}
          defaultValue="project_owner_statement"
          options={[
            { value: 'project_owner_statement', label: ownerText(t, 'sourceKindOwner') },
            { value: 'document', label: ownerText(t, 'sourceKindDocument') },
            { value: 'external_publication', label: ownerText(t, 'sourceKindExternal') },
            { value: 'operator_statement', label: ownerText(t, 'sourceKindOperator') },
            { value: 'calculated_by_sylva', label: ownerText(t, 'sourceKindCalculated') },
          ]}
          required
        />
        <TextField
          id={`${prefix}-source-label`}
          name="source_label"
          label={ownerText(t, 'sourceLabelField')}
          hint={ownerText(t, 'sourceLabelHint')}
          required
        />
      </FieldRow>

      <FieldRow cols={3}>
        <TextField
          id={`${prefix}-source-locator`}
          name="source_locator"
          label={t('ownerProjectForm.provenance.locator')}
          placeholder={t('ownerProjectForm.provenance.locatorPlaceholder')}
          mono
          optional
        />
        <TextField
          id={`${prefix}-source-url`}
          name="source_url"
          type="url"
          label={ownerText(t, 'sourceUrlField')}
          optional
        />
        <TextField
          id={`${prefix}-source-as-of`}
          name="source_as_of"
          type="date"
          label={t('ownerProjectForm.provenance.asOf')}
          defaultValue={defaultAsOf}
          mono
          required
        />
      </FieldRow>
    </fieldset>
  );
}
