import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import ProjectStepFrame from '@/components/owner-project-edit/ProjectStepFrame';
import { DurabilitySection } from '@/components/owner-project-edit/RecordSections';
import { openStep, queryValue, stepMetadata } from '@/lib/owner/step-page';

/**
 * Step 05: who controls the land, who maintains it, and for how long.
 *
 * A set of dated commitments with named responsible parties, not one number: one
 * interviewed buyer asked about the period after a five-year contract and
 * another about thirty to forty years, and a single "durability" figure cannot
 * answer both. The schema requires an end date or a horizon, because a
 * commitment with neither does not say how long it lasts.
 */

const SEGMENT = 'durability';

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
    <ProjectStepFrame record={record} segment={SEGMENT} lead={tf('section.durability.lead')}>
      <OutcomeNote error={queryValue(sp.error)} saved={queryValue(sp.saved)} />
      <DurabilitySection record={record} reference={reference} locale={locale} bare />
    </ProjectStepFrame>
  );
}
