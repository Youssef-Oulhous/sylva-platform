import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import FigureField from './FigureField';
import { AddEntry, RepeatEntry } from './RepeatGroup';
import { FieldRow, Note, TextField } from './Fields';
import { DURABILITY, SECTION } from './project-draft-data';

/**
 * Long-term protection.
 *
 * Who controls the land, who maintains it, how long the commitment lasts and
 * what happens when it ends. The buyers asked about two different horizons - the
 * years just after a short contract, and thirty to forty years out (concept
 * note, section 6) - so the answer is asked for in prose rather than reduced to
 * a single number, with the timeline underneath it.
 */
export default async function DurabilitySection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  return (
    <FormSection
      id={SECTION.durability}
      n={6}
      title={tRoot('project.durability')}
      lead={t('section.durability.lead')}
    >
      <FieldRow>
        <TextField
          id="land-control"
          label={tRoot('project.landControl')}
          hint={t('field.landControlHint')}
          defaultValue={t(DURABILITY.landControlKey)}
          rows={3}
          required
        />
        <TextField
          id="maintenance"
          label={t('field.maintenance')}
          hint={t('field.maintenanceHint')}
          defaultValue={DURABILITY.maintenanceOrg}
          rows={3}
          required
        />
      </FieldRow>

      <FigureField
        figure={DURABILITY.commitmentLength}
        label={t('field.commitmentLength')}
        hint={t('field.commitmentLengthHint')}
        required
      />

      <TextField
        id="after-contract"
        label={t('field.afterContract')}
        hint={t('field.afterContractHint')}
        defaultValue={DURABILITY.afterContract}
        rows={4}
        required
      />

      <h3 className="visually-hidden">{t('field.timelineHeading')}</h3>
      {DURABILITY.timeline.map((entry, index) => (
        <RepeatEntry
          key={entry.id}
          legend={t('repeat.timeline', { n: index + 1 })}
          removeLabel={t('repeat.remove')}
        >
          <FieldRow>
            <TextField
              id={`timeline-${entry.id}-when`}
              label={t('field.timelineWhen')}
              hint={t('field.timelineWhenHint')}
              defaultValue={entry.when}
              mono
              required
            />
            <TextField
              id={`timeline-${entry.id}-note`}
              label={t('field.timelineNote')}
              defaultValue={t(entry.noteKey)}
              rows={2}
              required
            />
          </FieldRow>
        </RepeatEntry>
      ))}

      <AddEntry label={t('repeat.addTimeline')} note={t('repeat.addTimelineNote')} />

      <Note tone="rule">{t('field.timelineRule')}</Note>
    </FormSection>
  );
}
