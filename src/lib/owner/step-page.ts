import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import type { Viewer } from '@/lib/auth/session';
import { getOwnerProjectRecord, getOwnerReference } from './queries';
import { stepAt, stepHref, stepLabel } from './steps';
import type { OwnerProjectRecord, OwnerReference } from './types';

/**
 * What every page of the project record needs, read once.
 *
 * The record is now nine pages rather than one, and each of them shows where it
 * sits in the whole - so each of them needs the whole record's publication gaps,
 * not only its own section. Wrapping the two reads in React's cache() means a
 * page that renders both a step and the index beside it makes one round trip,
 * the same way getActor() is cached.
 *
 * THE GUARD STAYS ON THE PAGE. requireRole() is called here, from the function
 * every step page calls first, so no step page can be added without one. It
 * decides what the page SHOWS; the boundary is that the queries run as
 * sylva_project_owner under an HMAC-signed organisation context and every policy
 * in migration 0050 tests proj.is_owned_by_actor(project_id). See
 * docs/FINDING-001.
 *
 * A slug naming another organisation's project gets notFound(), exactly as a
 * slug naming nothing does: telling the two apart would turn these routes into a
 * way to discover which slugs exist as other organisations' drafts.
 */

const loadRecord = cache(getOwnerProjectRecord);
const loadReference = cache(getOwnerReference);

export interface StepContext {
  readonly viewer: Viewer;
  readonly record: OwnerProjectRecord;
  readonly reference: OwnerReference;
  readonly locale: string;
}

export async function openStep(
  slug: string,
  segment: string,
  locale: string,
): Promise<StepContext> {
  const viewer = await requireRole('project_owner', stepHref(slug, segment));

  const [record, reference] = await Promise.all([
    loadRecord(viewer.actor, slug, locale),
    loadReference(viewer.actor, locale),
  ]);

  if (record === null) notFound();

  return { viewer, record, reference, locale };
}

/**
 * The tab title for one step of the record.
 *
 * Named for the step and the project, because these pages are deep-linkable and
 * a browser history of nine entries all called "Project record" would be no
 * history at all. Never indexed: it is one organisation's unpublished draft.
 */
export async function stepMetadata(
  segment: string,
  params: Promise<{ locale: string; slug: string }>,
): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  const step = stepAt(segment);
  const name = step ? stepLabel(t, step) : slug;
  return {
    title: `${name} \u2014 ${slug}`,
    robots: { index: false, follow: false },
  };
}

/**
 * One value from a query string.
 *
 * A Server Action redirects with a CODE, so everything read here is a short
 * token this codebase wrote. It is still narrowed to a single string: `?error=a&
 * error=b` arrives as an array, and an array reaching a message lookup would be
 * a crash on a URL anybody can type.
 */
export function queryValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}
