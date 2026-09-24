import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import FigureField from './FigureField';
import { AddEntry, RepeatEntry } from './RepeatGroup';
import { FieldRow, Note, SelectField, TextField } from './Fields';
import { OUTCOMES, SECTION } from './project-draft-data';

/**
 * Environmental outcomes, one entry per outcome.
 *
 * Water and biodiversity are entered separately and stay separate: the platform
 * does not combine unrelated metrics into a single score, so there is no field
 * here that could hold one. Baseline, expected result and stated uncertainty are
 * figures, so each of the three carries its own source and as-of date.
 */
export default async function OutcomesSection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();

  const domainOptions = [
    { value: 'water', label: tRoot('project.water') },
    { value: 'biodiversity', label: tRoot('project.biodiversity') },
    { value: 'other', label: t('option.domain.other') },
  ];

  return (
    <FormSection
      id={SECTION.outcomes}
      n={4}
      title={tRoot('project.outcomes')}
      lead={t('section.outcomes.lead')}
    >
      {OUTCOMES.map((outcome, index) => (
        <RepeatEntry
          key={outcome.id}
          legend={t('repeat.outcome', { n: index + 1 })}
          removeLabel={t('repeat.remove')}
        >
          <FieldRow>
            <SelectField
              id={`${outcome.id}-domain`}
              label={t('field.outcomeDomain')}
              hint={t('field.outcomeDomainHint')}
              defaultValue={outcome.domain}
              options={domainOptions}
              required
            />
            <TextField
              id={`${outcome.id}-metric`}
              label={tRoot('project.metric')}
              hint={t('field.metricHint')}
              defaultValue={t(outcome.metricKey)}
              required
            />
          </FieldRow>

          <FigureField
            figure={outcome.baseline}
            label={tRoot('project.baseline')}
            hint={t('field.baselineHint')}
            required
          />

          <FigureField
            figure={outcome.expected}
            label={tRoot('project.expected')}
            hint={t('field.expectedHint')}
            required
          />

          <FigureField
            figure={outcome.uncertainty}
            label={tRoot('project.uncertainty')}
            hint={t('field.uncertaintyHint')}
            required
          />

          <TextField
            id={`${outcome.id}-method`}
            label={tRoot('project.method')}
            hint={t('field.methodHint')}
            defaultValue={t(outcome.methodKey)}
            rows={3}
            required
          />

          <FieldRow>
            <TextField
              id={`${outcome.id}-monitoring-period`}
              label={t('field.monitoringPeriod')}
              hint={t('field.monitoringPeriodHint')}
              defaultValue={outcome.monitoringPeriod}
              required
            />
            <TextField
              id={`${outcome.id}-verifier`}
              label={tRoot('project.verifier')}
              hint={t('field.verifierHint')}
              defaultValue={outcome.verifierName}
              required
            />
          </FieldRow>
        </RepeatEntry>
      ))}

      <AddEntry label={t('repeat.addOutcome')} note={t('repeat.addOutcomeNote')} />

      <Note tone="rule">{t('field.outcomesRule')}</Note>
    </FormSection>
  );
}
