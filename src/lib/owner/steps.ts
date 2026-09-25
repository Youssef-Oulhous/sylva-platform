import type { PublicationGateCode } from './types';

/**
 * The project record, as a small number of navigable pages.
 *
 * It used to be ONE page: thirteen forms and around 120 inputs, stacked, with
 * the publication list pinned beside them. Everything was reachable and nothing
 * was findable - an owner who came back to fix the exclusions column scrolled
 * past eight other sections to get there, and a deep link into the record
 * landed at the top of all of it.
 *
 * So the sections became pages, and this file is the list of them. It is the
 * single place that knows the order, so the navigation, the "where does this
 * sit" line on each step and the index on the project overview cannot disagree
 * with each other.
 *
 * WHY EACH STEP CARRIES GATE CODES. The publication gate is the database's own
 * answer - proj.publication_gaps() returns the codes, and the trigger on
 * proj.project refuses publication while the array is not empty. Mapping each
 * code to the step that can fix it is what lets a step page say what is still
 * missing HERE rather than only what is missing somewhere. The mapping follows
 * the function definition exactly:
 *
 *   english_page_text        -> text        (English required fields at 'published')
 *   boundary                 -> location    (a geo.project_geometry of kind 'boundary')
 *   claim_rights             -> claim-rights
 *   outcomes, outcome_baseline -> outcomes
 *   durability               -> durability
 *   verifier                 -> partners    (a proj.project_party with role 'verifier',
 *                                            NOT the verifier named on an outcome)
 *   project_idea_note,
 *   project_design_document  -> documents
 *   availability             -> periods
 *
 * Nothing here is a total and nothing here is a volume, so there is no figure
 * on this list that Rule 7 could be broken with.
 */

export interface ProjectStep {
  /** Path segment under /owner/projects/[slug]. '' is the project overview. */
  readonly segment: string;
  /**
   * The catalogue key for the label. Resolved with t.has(), so a catalogue that
   * does not hold it yet falls back to `labelEn` rather than printing a key at
   * a person. Every key here but one already exists: the sections of the record
   * are the sections of the public project page and are named with the same
   * words.
   */
  readonly labelKey: string;
  /** What that key says in English, for the fallback. */
  readonly labelEn: string;
  /** Which of the ten publication-gate codes this page can clear. */
  readonly gates: readonly PublicationGateCode[];
}

export const PROJECT_STEPS: readonly ProjectStep[] = [
  {
    segment: 'text',
    // The one step with no existing key: it covers the title AND the summary,
    // in both languages, which no single catalogue entry names.
    labelKey: 'ownerUi.step.textTitle',
    labelEn: 'Name and summary',
    gates: ['english_page_text'],
  },
  {
    segment: 'location',
    labelKey: 'ownerProjectForm.section.location.title',
    labelEn: 'Location and geometry',
    gates: ['boundary'],
  },
  {
    segment: 'outcomes',
    labelKey: 'project.outcomes',
    labelEn: 'Environmental outcomes',
    gates: ['outcomes', 'outcome_baseline'],
  },
  {
    segment: 'claim-rights',
    labelKey: 'project.claimRights',
    labelEn: 'Claim rights',
    gates: ['claim_rights'],
  },
  {
    segment: 'durability',
    labelKey: 'project.durability',
    labelEn: 'Long-term protection',
    gates: ['durability'],
  },
  {
    segment: 'partners',
    labelKey: 'project.partners',
    labelEn: 'Project partners',
    gates: ['verifier'],
  },
  {
    segment: 'periods',
    labelKey: 'project.availability',
    labelEn: 'Availability',
    gates: ['availability'],
  },
  {
    segment: 'documents',
    labelKey: 'project.documents',
    labelEn: 'Documents',
    gates: ['project_idea_note', 'project_design_document'],
  },
];

/** The label, from the catalogue where it has it and from the file where not. */
export function stepLabel(
  t: { (key: string): string; has?: (key: string) => boolean },
  step: ProjectStep,
): string {
  try {
    if (typeof t.has === 'function' && t.has(step.labelKey)) return t(step.labelKey);
  } catch {
    /* fall through to the English label */
  }
  return step.labelEn;
}

export type StepSegment = (typeof PROJECT_STEPS)[number]['segment'];

export function stepAt(segment: string): ProjectStep | null {
  return PROJECT_STEPS.find((s) => s.segment === segment) ?? null;
}

/** Position in the whole, 1-based. 0 where the segment is not a step. */
export function stepNumber(segment: string): number {
  return PROJECT_STEPS.findIndex((s) => s.segment === segment) + 1;
}

export function stepHref(slug: string, segment: string): string {
  return segment === ''
    ? `/owner/projects/${slug}`
    : `/owner/projects/${slug}/${segment}`;
}

/** The gate codes this step could clear that are still open. */
export function stepGaps(
  step: ProjectStep,
  gaps: readonly PublicationGateCode[],
): readonly PublicationGateCode[] {
  return step.gates.filter((g) => gaps.includes(g));
}

export function neighbours(segment: string): {
  previous: ProjectStep | null;
  next: ProjectStep | null;
} {
  const i = PROJECT_STEPS.findIndex((s) => s.segment === segment);
  if (i < 0) return { previous: null, next: null };
  return {
    previous: PROJECT_STEPS[i - 1] ?? null,
    next: PROJECT_STEPS[i + 1] ?? null,
  };
}

/**
 * A translation status that the PUBLIC project page will actually show.
 *
 * src/lib/projects/queries.ts admits 'published' and 'reviewed' and nothing
 * else, in eleven places. This predicate is the screen's side of that rule, so
 * an owner is told which of their entries a buyer cannot see rather than
 * finding out from the published page.
 */
export const PUBLIC_TEXT_STATUSES: readonly string[] = ['published', 'reviewed'];

export function reachesTheBuyer(status: string | null): boolean {
  return status !== null && PUBLIC_TEXT_STATUSES.includes(status);
}
