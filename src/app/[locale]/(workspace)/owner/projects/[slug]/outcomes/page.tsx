import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import ProjectStepFrame from '@/components/owner-project-edit/ProjectStepFrame';
import { OutcomesSection } from '@/components/owner-project-edit/RecordSections';
import { openStep, queryValue, stepMetadata } from '@/lib/owner/step-page';

/**
 * Step 03: what is measured, from what baseline, by whom, and how certain.
 *
 * Water and biodiversity are recorded separately and stay separate: nothing on
 * this platform combines unrelated metrics into one score. An indicator carries
 * no unit_type_id, so a hydrology figure can never enter an availability panel -
 * its measure unit is free text and is printed beside every value.
 *
 * RULE 7. No volume on this page, so nothing here could be added across
 * projects.
 */

const SEGMENT = 'outcomes';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  return stepMetadata(SEGMENT, params);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // openStep() holds this page's guard. The layout above is presentation.
  const { record, reference } = await openStep(slug, SEGMENT, locale);
  const sp = await searchParams;
  const tf = await getTranslations('ownerProjectForm');

  return (
    <ProjectStepFrame record={record} segment={SEGMENT} lead={tf('section.outcomes.lead')}>
      <OutcomeNote error={queryValue(sp.error)} saved={queryValue(sp.saved)} />
      <OutcomesSection record={record} reference={reference} locale={locale} bare />
    </ProjectStepFrame>
  );
}
