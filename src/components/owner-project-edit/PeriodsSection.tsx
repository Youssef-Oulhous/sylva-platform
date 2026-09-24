import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import FormSection from './FormSection';
import FigureField from './FigureField';
import { AddEntry, RepeatEntry } from './RepeatGroup';
import { FieldRow, Note, StaticValue, TextField } from './Fields';
import { PERIODS, RECORD, SECTION } from './project-draft-data';

/**
 * Periods: what the project expects to issue, and how much of that is held back
 * as a buffer.
 *
 * Rule 7 is enforced here by what the section does not contain. There is no
 * total row, no figure spanning the periods, and no comparison with another
 * project. Every box on this section carries the project's own unit label, and
 * the two figures this form does not set - committed, which comes from recorded
 * deals, and remaining, which the project page states per period - are shown as
 * values rather than as fields, each with its own source.
 *
 * Committed is left blank as a dash where a figure above it is missing: a
 * remaining volume calculated from an expected issuance nobody has sourced would
 * be a number the record cannot stand behind.
 */
export default async function PeriodsSection() {
  const t = await getTranslations('ownerProjectForm');
  const tRoot = await getTranslations();
  const unit = t(RECORD.unitKey);

  return (
    <FormSection
      id={SECTION.periods}
      n={8}
      title={tRoot('project.availability')}
      lead={t('section.periods.lead')}
    >
      {/* The rule that stops this section being read as a comparison table.
          Stated once, visibly, rather than implied by the absence of a total. */}
      <Note tone="rule">{tRoot('project.availabilityNote')}</Note>

      <Note>{t('field.periodUnitNote', { unit })}</Note>
      <Note>{t('field.bufferRule')}</Note>

      {PERIODS.map((period) => (
        <RepeatEntry
          key={period.id}
          legend={`${tRoot('project.period')} ${period.label}`}
          meta={unit}
          removeLabel={t('repeat.remove')}
        >
          <FieldRow>
            <TextField
              id={`period-${period.id}-starts`}
              label={t('field.periodStarts')}
              type="date"
              defaultValue={period.startsOn}
              required
            />
            <TextField
              id={`period-${period.id}-ends`}
              label={t('field.periodEnds')}
              type="date"
              defaultValue={period.endsOn}
              required
            />
          </FieldRow>

          <FigureField
            figure={period.expected}
            label={tRoot('project.expectedIssuance')}
            hint={t('field.expectedIssuanceHint')}
            required
          />

          <FigureField
            figure={period.buffer}
            label={tRoot('project.buffer')}
            hint={t('field.bufferHint')}
            required
          />

          <FieldRow>
            <StaticValue
              label={tRoot('project.committed')}
              value={period.committedValue}
              unit={unit}
              note={
                <SourceStamp
                  source={{
                    label: t('field.committedSource'),
                    asOfDate: period.committedAsOf,
                  }}
                />
              }
            />
            <StaticValue
              label={tRoot('project.remaining')}
              value={period.remainingValue ?? '—'}
              unit={unit}
              note={
                period.remainingValue === null ? (
                  <Note>{t('field.remainingUnknown')}</Note>
                ) : (
                  <Note>{t('field.remainingNote')}</Note>
                )
              }
            />
          </FieldRow>
        </RepeatEntry>
      ))}

      <AddEntry label={t('repeat.addPeriod')} note={t('repeat.addPeriodNote')} />

      <Note tone="rule">{t('field.periodsRule')}</Note>
    </FormSection>
  );
}
