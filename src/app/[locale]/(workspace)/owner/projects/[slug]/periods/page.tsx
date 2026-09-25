import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import ProjectStepFrame from '@/components/owner-project-edit/ProjectStepFrame';
import { PeriodsSection, UnitTypeSection } from '@/components/owner-project-edit/RecordSections';
import { openStep, queryValue, stepMetadata } from '@/lib/owner/step-page';

/**
 * Step 07: the periods, and what the project expects to issue in each.
 *
 * The scheme and unit type are declared on this page rather than on one of their
 * own, because a volume means nothing without the unit it is measured in: the
 * period form is disabled until the unit type exists, and the two belong
 * together on screen for the same reason they belong together in
 * proj.project_unit_type.
 *
 * RULE 7. Every figure here belongs to one project and one unit type by
 * composite foreign key, the unit label is printed beside each of them, and
 * there is no total - not across projects, and not across this project's own
 * periods.
 */

const SEGMENT = 'periods';

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
    <ProjectStepFrame record={record} segment={SEGMENT} lead={tf('section.periods.lead')}>
      <OutcomeNote error={queryValue(sp.error)} saved={queryValue(sp.saved)} />
      <UnitTypeSection record={record} reference={reference} locale={locale} bare />
      <PeriodsSection record={record} reference={reference} locale={locale} bare />
    </ProjectStepFrame>
  );
}
