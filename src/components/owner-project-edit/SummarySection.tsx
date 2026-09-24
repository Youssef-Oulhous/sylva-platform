import { getTranslations } from 'next-intl/server';
import FormSection from './FormSection';
import { ChoiceGroup, FieldRow, Note, TextField } from './Fields';
import { SECTION, SUMMARY } from './project-draft-data';

/**
 * The summary, in English and in German, side by side.
 *
 * English first, German second (concept note, section 9). The two languages are
 * shown as a pair rather than behind a language switch, so a gap in one of them
 * is visible while the other is being written - which is exactly the gap this
 * record has.
 */
export default async function SummarySection() {
  const t = await getTranslations('ownerProjectForm');

  return (
    <FormSection
      id={SECTION.summary}
      n={3}
      title={t('section.summary.title')}
      lead={t('section.summary.lead')}
    >
      <FieldRow>
        <TextField
          id="summary-lead-en"
          label={t('field.summaryLeadEn')}
          hint={t('field.summaryLeadHint')}
          defaultValue={SUMMARY.en.lead}
          rows={4}
          required
        />
        <TextField
          id="summary-lead-de"
          label={t('field.summaryLeadDe')}
          hint={t('field.summaryLeadHint')}
          defaultValue={SUMMARY.de.lead}
          rows={4}
          optional
        />
      </FieldRow>

      <FieldRow>
        <TextField
          id="summary-body-en"
          label={t('field.summaryBodyEn')}
          hint={t('field.summaryBodyHint')}
          defaultValue={SUMMARY.en.body}
          rows={12}
          required
        />
        <TextField
          id="summary-body-de"
          label={t('field.summaryBodyDe')}
          hint={t('field.summaryBodyHint')}
          defaultValue={SUMMARY.de.body}
          rows={12}
          optional
        />
      </FieldRow>

      <ChoiceGroup
        name="summary-de-reviewed"
        kind="checkbox"
        legend={t('field.deReviewed')}
        options={[
          {
            value: 'reviewed',
            label: t('field.deReviewedLabel'),
            hint: t('field.deReviewedHint'),
            checked: SUMMARY.deReviewed,
          },
        ]}
      />

      <Note tone="rule">{t('field.summaryFallback')}</Note>
    </FormSection>
  );
}
