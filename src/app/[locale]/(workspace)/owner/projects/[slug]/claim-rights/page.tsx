import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import ProjectStepFrame from '@/components/owner-project-edit/ProjectStepFrame';
import { ClaimRightsSection } from '@/components/owner-project-edit/RecordSections';
import { openStep, queryValue, stepMetadata } from '@/lib/owner/step-page';

/**
 * Step 04: who may claim, for what, and WHAT IS EXCLUDED.
 *
 * Interviewed buyers said this section can decide whether they take part at all,
 * so it is four plain statements per benefit rather than a paragraph of contract
 * language, and `exclusions` is non-blank in the schema because a blank
 * exclusions column is the failure they described.
 *
 * It is also where the invisible-text defect did the most damage: an owner
 * recorded all four statements, the rows went in at 'human_draft', and the
 * published page carried the raw benefit key and three dashes under the heading
 * telling the buyer to read the exclusions first. The form now asks whether the
 * entry is ready for the page, and the list above it says, in words, which
 * entries a buyer cannot see.
 */

const SEGMENT = 'claim-rights';

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
    <ProjectStepFrame record={record} segment={SEGMENT} lead={tf('section.claims.lead')}>
      <OutcomeNote error={queryValue(sp.error)} saved={queryValue(sp.saved)} />
      <ClaimRightsSection record={record} reference={reference} locale={locale} bare />
    </ProjectStepFrame>
  );
}
