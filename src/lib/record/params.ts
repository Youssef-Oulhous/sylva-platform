import { z } from 'zod';
import type { RecordFilterOptions } from './types';

/**
 * The filter lives in the URL, so a filtered view can be sent to somebody.
 *
 * Which means the URL is untrusted input, and is validated here, on the
 * server, before it reaches a query - exactly like a form post. It is also
 * PUBLIC input: a search-engine crawler, a link shortener and a mistyped
 * address all arrive here, so an unusable value must produce a page that
 * explains itself rather than an error.
 *
 * Nothing in a query string is ever interpolated into SQL. These values are
 * bound as parameters by src/lib/record/queries.ts.
 */

export const PROJECT_PARAM = 'project';
export const EVENT_PARAM = 'event';
export const PAGE_PARAM = 'page';

/**
 * A slug and an entry-type code are both narrow, known alphabets. Bounding
 * them here keeps a megabyte of junk out of a bound parameter, and keeps the
 * value printable if the page has to quote it back.
 */
const slug = z.string().trim().min(1).max(200).regex(/^[a-z0-9][a-z0-9-]*$/);
const code = z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/);
const page = z.coerce.number().int().min(1).max(100_000);

const schema = z.object({
  [PROJECT_PARAM]: slug.optional().catch(undefined),
  [EVENT_PARAM]: code.optional().catch(undefined),
  [PAGE_PARAM]: page.optional().catch(undefined),
});

/** Next gives a repeated parameter as an array; the first value wins. */
function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export interface ParsedRecordParams {
  projectSlug: string | null;
  eventType: string | null;
  page: number;
  /**
   * Parameters that were present but could not be used - a malformed value, or
   * a well-formed one naming a project or an event type that does not exist.
   * The page says so rather than quietly showing the unfiltered record, which
   * would be a different record from the one the link promised.
   */
  ignored: Array<'project' | 'event'>;
}

/**
 * Parse and then CHECK the values against what the database actually offers.
 *
 * Shape validation alone is not enough here. `?project=does-not-exist` is a
 * perfectly well-formed slug and would return an empty table that looks like
 * "this project has no entries" rather than "there is no such project". The
 * options come from the same transaction-free read the filter control is built
 * from, so the two always agree.
 */
export function parseRecordParams(
  searchParams: Record<string, string | string[] | undefined>,
  options: RecordFilterOptions,
): ParsedRecordParams {
  const parsed = schema.safeParse({
    [PROJECT_PARAM]: first(searchParams[PROJECT_PARAM]),
    [EVENT_PARAM]: first(searchParams[EVENT_PARAM]),
    [PAGE_PARAM]: first(searchParams[PAGE_PARAM]),
  });

  const raw = parsed.success ? parsed.data : {};
  const ignored: ParsedRecordParams['ignored'] = [];

  const wantedProject = raw[PROJECT_PARAM] ?? null;
  const projectSlug =
    wantedProject && options.projects.some((p) => p.slug === wantedProject)
      ? wantedProject
      : null;
  if (first(searchParams[PROJECT_PARAM]) && projectSlug === null) ignored.push('project');

  const wantedEvent = raw[EVENT_PARAM] ?? null;
  const eventType =
    wantedEvent && options.eventTypes.some((e) => e.code === wantedEvent)
      ? wantedEvent
      : null;
  if (first(searchParams[EVENT_PARAM]) && eventType === null) ignored.push('event');

  return { projectSlug, eventType, page: raw[PAGE_PARAM] ?? 1, ignored };
}

/**
 * Build a record URL from a filter. Used for every link on the page, so a
 * shared address always carries the filter it was read under.
 *
 * Empty values are omitted rather than written as `?project=`, and page 1 is
 * omitted, so the unfiltered record has exactly one address.
 */
export function recordHref(params: {
  projectSlug?: string | null;
  eventType?: string | null;
  page?: number;
}): string {
  const qs = new URLSearchParams();
  if (params.projectSlug) qs.set(PROJECT_PARAM, params.projectSlug);
  if (params.eventType) qs.set(EVENT_PARAM, params.eventType);
  if (params.page && params.page > 1) qs.set(PAGE_PARAM, String(params.page));
  const s = qs.toString();
  return s ? `/record?${s}` : '/record';
}
