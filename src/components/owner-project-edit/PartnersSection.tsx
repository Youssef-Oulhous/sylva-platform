import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import { AddEntry, RepeatEntry } from './RepeatGroup';
import { FieldRow, SelectField, TextField } from './Fields';
import { PARTNERS, PARTNER_ROLES, SECTION } from './project-draft-data';

/**
 * The partners on the ground: who develops the project, who owns the land, who
 * verifies, who maintains it afterwards. One buyer told the client it judges a
 * project by meeting the people behind it (concept note, section 6), so these
 * are organisation records with a role and a reference, not profiles.
 */
export default async function PartnersSection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  const roleOptions = PARTNER_ROLES.map((role) => ({
    value: role,
    label: t(`option.role.${role}`),
  }));

  return (
    <FormSection
      id={SECTION.partners}
      n={7}
      title={tRoot('project.partners')}
      lead={t('section.partners.lead')}
    >
      {PARTNERS.map((partner, index) => (
        <RepeatEntry
          key={partner.id}
          legend={t('repeat.partner', { n: index + 1 })}
          meta={partner.registryRef ?? undefined}
          removeLabel={t('repeat.remove')}
        >
          <FieldRow>
            <SelectField
              id={`partner-${partner.id}-role`}
              label={tRoot('project.role')}
              defaultValue={partner.role}
              options={roleOptions}
              required
            />
            <TextField
              id={`partner-${partner.id}-name`}
              label={t('field.partnerName')}
              hint={t('field.partnerNameHint')}
              defaultValue={partner.name}
              required
            />
          </FieldRow>

          <FieldRow>
            <TextField
              id={`partner-${partner.id}-place`}
              label={t('field.partnerPlace')}
              defaultValue={partner.place}
              required
            />
            <TextField
              id={`partner-${partner.id}-ref`}
              label={t('field.partnerRef')}
              hint={t('field.partnerRefHint')}
              defaultValue={partner.registryRef ?? ''}
              mono
              optional
            />
          </FieldRow>

          <TextField
            id={`partner-${partner.id}-note`}
            label={t('field.partnerNote')}
            hint={t('field.partnerNoteHint')}
            defaultValue={partner.noteKey ? t(partner.noteKey) : ''}
            rows={2}
            optional
          />
        </RepeatEntry>
      ))}

      <AddEntry label={t('repeat.addPartner')} note={t('repeat.addPartnerNote')} />
    </FormSection>
  );
}
