import { z } from 'zod';
import type { AuditFilterOptions } from './types';

/**
 * The auditor's record filter lives in the URL, so a filtered extract can be
 * cited in a report and reopened by somebody else exactly as it was read.
 *
 * Which makes the URL untrusted input, validated here, on the server, before
 * it reaches a query - exactly like a form post. Nothing below is ever
 * interpolated into SQL; src/lib/auditor/queries.ts binds these as parameters.
 *
 * The validated value is then CHECKED against what the database actually holds,
 * because `?project=does-not-exist` is a perfectly well-formed slug and would
 * otherwise produce an empty table that reads like "this project has no
 * entries" rather than "there is no such project". On an audit page that
 * difference is the whole point.
 */

export const PROJECT_PARAM = 'project';
export const EVENT_PARAM = 'event';
export const PAGE_PARAM = 'page';

const slug = z.string().trim().min(1).max(200).regex(/^[a-z0-9][a-z0-9-]*$/);
const code = z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/);
const page = z.coerce.number().int().min(1).max(100_000);

const schema = z.object({
  [PROJECT_PARAM]: slug.optional().catch(undefined),
  [EVENT_PARAM]: code.optional().catch(undefined),
  [PAGE_PARAM]: page.optional().catch(undefined),
});

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export interface ParsedAuditParams {
  projectSlug: string | null;
  entryType: string | null;
  page: number;
  /** Present but unusable, so the page can say so instead of quietly widening. */
  ignored: Array<'project' | 'event'>;
}

export function parseAuditParams(
  searchParams: Record<string, string | string[] | undefined>,
  options: AuditFilterOptions,
): ParsedAuditParams {
  const parsed = schema.safeParse({
    [PROJECT_PARAM]: first(searchParams[PROJECT_PARAM]),
    [EVENT_PARAM]: first(searchParams[EVENT_PARAM]),
    [PAGE_PARAM]: first(searchParams[PAGE_PARAM]),
  });

  const raw = parsed.success ? parsed.data : {};
  const ignored: ParsedAuditParams['ignored'] = [];

  const wantedProject = raw[PROJECT_PARAM] ?? null;
  const projectSlug =
    wantedProject && options.projects.some((p) => p.slug === wantedProject)
      ? wantedProject
      : null;
  if (first(searchParams[PROJECT_PARAM]) && projectSlug === null) ignored.push('project');

  const wantedEvent = raw[EVENT_PARAM] ?? null;
  const entryType =
    wantedEvent && options.entryTypes.some((e) => e.code === wantedEvent)
      ? wantedEvent
      : null;
  if (first(searchParams[EVENT_PARAM]) && entryType === null) ignored.push('event');

  return { projectSlug, entryType, page: raw[PAGE_PARAM] ?? 1, ignored };
}

/**
 * Build a record URL from a filter. Empty values are omitted rather than
 * written as `?project=`, and page 1 is omitted, so one view has one address.
 */
export function auditRecordHref(params: {
  projectSlug?: string | null;
  entryType?: string | null;
  page?: number;
}): string {
  const qs = new URLSearchParams();
  if (params.projectSlug) qs.set(PROJECT_PARAM, params.projectSlug);
  if (params.entryType) qs.set(EVENT_PARAM, params.entryType);
  if (params.page && params.page > 1) qs.set(PAGE_PARAM, String(params.page));
  const s = qs.toString();
  return s ? `/auditor/record?${s}` : '/auditor/record';
}
