import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import OutcomeNote from '@/components/owner-shared/OutcomeNote';
import ProjectStepFrame from '@/components/owner-project-edit/ProjectStepFrame';
import { DocumentsSection } from '@/components/owner-project-edit/RecordSections';
import { openStep, queryValue, stepMetadata } from '@/lib/owner/step-page';

/**
 * Step 08: the documents behind the record.
 *
 * Two of the ten items the publication gate checks are documents, so this page
 * is a gate of its own. No link on it carries a storage key: every download goes
 * through /api/projects/<slug>/documents/<id>, which authorises again before a
 * byte moves.
 */

const SEGMENT = 'documents';

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
    <ProjectStepFrame record={record} segment={SEGMENT} lead={tf('section.documents.lead')}>
      <OutcomeNote error={queryValue(sp.error)} saved={queryValue(sp.saved)} />
      <DocumentsSection record={record} reference={reference} locale={locale} bare />
    </ProjectStepFrame>
  );
}
