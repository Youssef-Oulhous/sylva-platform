import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import { ChoiceGroup, FieldRow, Note, SelectField, TextField } from './Fields';
import {
  DEAL_SHAPES,
  OWNER_ORGS,
  RECORD,
  SCHEMES,
  SECTION,
  VINTAGE_CHOICES,
} from './project-draft-data';

/**
 * Identity: what the project is called, who answers for it, and under which
 * scheme its units are issued.
 *
 * The unit label and the meaning of a period are asked here rather than with the
 * periods, because both are properties of the scheme and both change how every
 * volume further down the form is read.
 */
export default async function IdentitySection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  return (
    <FormSection
      id={SECTION.identity}
      n={1}
      title={t('section.identity.title')}
      lead={t('section.identity.lead')}
    >
      <FieldRow>
        <TextField
          id="name-en"
          label={t('field.nameEn')}
          hint={t('field.nameEnHint')}
          defaultValue={RECORD.nameEn}
          required
        />
        <TextField
          id="name-de"
          label={t('field.nameDe')}
          hint={t('field.nameDeHint')}
          defaultValue={RECORD.nameDe}
          optional
        />
      </FieldRow>

      <FieldRow>
        <TextField
          id="slug"
          label={t('field.slug')}
          hint={t('field.slugHint')}
          defaultValue={RECORD.slug}
          mono
          required
        />
        <SelectField
          id="owner-org"
          label={tRoot('project.owner')}
          hint={t('field.ownerHint')}
          defaultValue={RECORD.ownerOrgId}
          options={OWNER_ORGS.map((org) => ({ value: org.id, label: org.name }))}
          required
        />
      </FieldRow>

      <FieldRow>
        <SelectField
          id="scheme"
          label={tRoot('project.scheme')}
          hint={t('field.schemeHint')}
          defaultValue={RECORD.schemeId}
          options={SCHEMES.map((scheme) => ({ value: scheme.id, label: scheme.name }))}
          required
        />
        <TextField
          id="unit-label"
          label={tRoot('project.unitType')}
          hint={t('field.unitHint')}
          defaultValue={t(RECORD.unitKey)}
          required
        />
      </FieldRow>

      {/* Stated here because every volume in section 08 is read through it. */}
      <Note tone="rule">{t('field.unitRule')}</Note>

      <ChoiceGroup
        name="vintage"
        kind="radio"
        legend={t('field.vintage')}
        hint={t('field.vintageHint')}
        options={VINTAGE_CHOICES.map((choice) => ({
          value: choice.value,
          label: tRoot(choice.labelKey),
          checked: RECORD.vintage === choice.value,
        }))}
        required
      />

      <ChoiceGroup
        name="deal-shape"
        kind="checkbox"
        legend={t('field.dealShapes')}
        hint={t('field.dealShapesHint')}
        options={DEAL_SHAPES.map((shape) => ({
          value: shape,
          label: t(`option.deal.${shape}`),
          hint: t(`option.deal.${shape}Hint`),
          checked: RECORD.dealShapes.includes(shape),
        }))}
        required
      />
    </FormSection>
  );
}
