import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import ProjectStepFrame from '@/components/owner-project-edit/ProjectStepFrame';
import { PartnersSection } from '@/components/owner-project-edit/RecordSections';
import { openStep, queryValue, stepMetadata } from '@/lib/owner/step-page';

/**
 * Step 06: who develops the project, who owns the land, who verifies it.
 *
 * The verifier named HERE is the one the publication gate checks - a
 * proj.project_party with role 'verifier'. The verifier chosen on an outcome is a
 * different row and does not clear that item, which is why the standing note on
 * this page and not the outcomes page carries it.
 *
 * Organisations come from org.v_public_party, the only route to another
 * organisation's legal name this role has. Where a landowner is a natural
 * person, the arrangement is described without naming anyone and the name stays
 * out of the database entirely.
 */

const SEGMENT = 'partners';

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
    <ProjectStepFrame record={record} segment={SEGMENT} lead={tf('section.partners.lead')}>
      <OutcomeNote error={queryValue(sp.error)} saved={queryValue(sp.saved)} />
      <PartnersSection record={record} reference={reference} locale={locale} bare />
    </ProjectStepFrame>
  );
}
