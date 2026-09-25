'use server';

import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirectTo } from '@/lib/i18n/navigate';
import { withActor, type Tx } from '@/lib/db/session';
import { requireRole } from '@/lib/auth/guards';
import type { Viewer } from '@/lib/auth/session';
import {
  geometryCodeForDatabaseError, logOwnerFailure, ownerCodeForDatabaseError,
  type OwnerErrorCode,
} from './errors';
import {
  addClaimRight, addDurability, addGeometry, addOutcome, addParty,
  addPeriodWithForecast, answerQuestion, createProject, declareUnitType,
  insertSource, ownProjectIdBySlug, saveText, submitForReview,
  type SourceKind,
} from './record';

/**
 * The owner's mutations, as Server Actions.
 *
 * The shape is the one src/lib/auth/actions.ts established and it is not
 * decoration:
 *
 *  - Every input is validated with zod HERE, from the FormData, on the server.
 *    The `required` attributes on the form are a convenience for the person
 *    typing. Nothing in this file trusts them.
 *  - Failure ends in a redirect back to the same page with an error CODE in the
 *    query string. The page renders the sentence from the code, so the wording
 *    stays in the message catalogue, and no free text the person typed is
 *    echoed into a URL and from there into a server log.
 *  - So the forms need no client JavaScript at all. Every one of them is a
 *    plain <form action={…}> over Server Components.
 *
 * WHAT THE GUARD DOES AND DOES NOT DO. requireRole('project_owner') decides
 * what the page shows. It is not the security boundary: the boundary is that
 * the query runs as sylva_project_owner under an HMAC-signed organisation
 * context, and every policy in migration 0050 tests
 * proj.is_owned_by_actor(project_id). A bug here cannot hand anybody another
 * organisation's project. See docs/FINDING-001.
 *
 * redirect() navigates by throwing, so it is never called inside a try block
 * that would catch it. Each action computes an outcome first and navigates
 * last, and isRedirectError() rethrows the signal rather than reporting it as a
 * database failure.
 */

/* ------------------------------------------------------------- PLUMBING */

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A decimal figure as typed. Kept as a string all the way to numeric. */
const DECIMAL = /^\d{1,18}([.,]\d{1,6})?$/;

const date = z.string().trim().regex(ISO_DATE);
const decimal = z.string().trim().regex(DECIMAL).transform((s) => s.replace(',', '.'));
const line = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((s) => (s ? s : null));

/** A key the owner types for a repeatable entry: stable, printable, matchable. */
const entryKey = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,60}$/);

const SOURCE_KINDS = [
  'document', 'external_publication', 'operator_statement',
  'project_owner_statement', 'calculated_by_sylva',
] as const;

/**
 * Provenance, asked for in the same breath as the thing it belongs to.
 *
 * `kind` defaults to project_owner_statement rather than operator_statement:
 * the owner is the one asserting it, and filing it as Sylva's assertion would
 * put a false attribution on the published page. See migration 0051.
 */
const Source = z.object({
  source_kind: z.enum(SOURCE_KINDS).default('project_owner_statement'),
  source_label: line(300),
  source_locator: optional(200),
  source_url: z.string().trim().url().max(2000).optional().or(z.literal(''))
    .transform((s) => (s ? s : null)),
  source_as_of: date,
});

type SourceFields = z.infer<typeof Source>;

function sourceInput(d: SourceFields) {
  return {
    kind: d.source_kind as SourceKind,
    label: d.source_label,
    locator: d.source_locator,
    sourceUrl: d.source_url,
    asOfDate: d.source_as_of,
  };
}

const TRANSLATION_STATUS = ['machine_draft', 'human_draft', 'reviewed', 'published'] as const;

/**
 * WHY THE DEFAULT IS 'published' ON THE ENTRY SECTIONS.
 *
 * The column default is 'human_draft' and the public project page admits only
 * 'published' and 'reviewed' (src/lib/projects/queries.ts, eleven places). So
 * every claim right, outcome detail and durability statement recorded before
 * this went in invisible: this form said "Already recorded" and the published
 * page showed the raw benefit key and three dashes - under the heading that
 * tells a buyer to read the exclusions column first.
 *
 * An owner recording a claim right is stating it for the page. Filing that
 * statement as a draft nobody can read is the wrong default, so the forms ask
 * and the answer starts at "Ready for the page". An owner who is not ready can
 * still choose Draft, and the record then says, in words, that a buyer cannot
 * see it.
 */
const ENTRY_TEXT_DEFAULT: (typeof TRANSLATION_STATUS)[number] = 'published';

/* ------------------------------------------------------------ NAVIGATION */

type Section =
  | 'text' | 'unit' | 'boundary' | 'claim' | 'outcome'
  | 'durability' | 'party' | 'period' | 'submit' | 'answer';

/**
 * Which page of the record each section's form now lives on.
 *
 * The record used to be one page, so every save came back to the same URL and
 * an anchor was the best it could do. It is nine pages now, so a save comes back
 * to the page the form is on - otherwise recording an outcome would throw the
 * owner out to the project overview and they would have to find their way back
 * in to record the next one.
 *
 * `unit` maps to the periods page because the scheme and unit type are declared
 * there: a volume means nothing without the unit it is measured in, so the two
 * belong on one page. `submit` maps to the project overview, which is where
 * sending the record to Sylva is done.
 */
const SECTION_PAGE: Record<Section, string> = {
  text: 'text',
  unit: 'periods',
  boundary: 'location',
  claim: 'claim-rights',
  outcome: 'outcomes',
  durability: 'durability',
  party: 'partners',
  period: 'periods',
  submit: '',
  answer: '',
};

/**
 * Back to the section's own page with the outcome in the query string.
 *
 * Synchronous and annotated `never` on purpose. TypeScript narrows control flow
 * on a call to a function whose return type is `never`, but not on `await` of a
 * Promise<never>, so an async version of this would leave every call site
 * needing a fake `return` and would stop `parsed.data` narrowing after a
 * validation failure. Same reasoning as src/lib/i18n/navigate.ts.
 */
function back(
  locale: string,
  slug: string,
  section: Section,
  outcome: { error: OwnerErrorCode } | { saved: true },
): never {
  const query = 'error' in outcome
    ? { error: outcome.error, section }
    : { saved: section };
  const page = SECTION_PAGE[section];
  const pathname = page === ''
    ? `/owner/projects/${slug}`
    : `/owner/projects/${slug}/${page}`;
  redirectTo({ href: { pathname, query }, locale });
}

function backToNew(locale: string, error: OwnerErrorCode, field?: string): never {
  redirectTo({
    href: { pathname: '/owner/projects/new', query: field ? { error, field } : { error } },
    locale,
  });
}

/**
 * Resolve the slug to a project this organisation owns, inside the caller's
 * transaction. Every section action starts here, so a slug that names somebody
 * else's project fails before anything is written - and fails with the same
 * sentence as a slug that names nothing at all.
 */
async function ownedProject(
  viewer: Viewer,
  slug: string,
  work: (projectId: string, tx: Tx) => Promise<void>,
): Promise<void> {
  await withActor(viewer.actor, async (tx) => {
    const project = await ownProjectIdBySlug(tx, slug);
    if (!project) throw new NotFound();
    await work(project.id, tx);
  });
}

class NotFound extends Error {
  constructor() { super('no such project for this organisation'); this.name = 'NotFound'; }
}

function codeFor(err: unknown): OwnerErrorCode {
  return err instanceof NotFound ? 'not_found' : ownerCodeForDatabaseError(err);
}

/* ------------------------------------------------------- CREATE A PROJECT */

const NewProject = Source.extend({
  // The database CHECK is the authority; this repeats it so the person gets a
  // sentence instead of a constraint name.
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  title_en: line(200),
  title_de: optional(200),
  summary_en: line(2000),
  summary_de: optional(2000),
});

/**
 * A new project, its first page text, and the provenance both hang off.
 *
 * All of it in ONE transaction. A project row with no title is a record that
 * says nothing and cannot be published, and half-creating one would leave the
 * owner with a draft they cannot explain.
 */
export async function createProjectAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner/projects/new');
  const locale = await getLocale();

  const parsed = NewProject.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') ?? 'form';
    backToNew(locale, field === 'slug' ? 'slug_invalid' : 'invalid_input', field);
  }
  const d = parsed.data;

  try {
    await withActor(viewer.actor, async (tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      const projectId = await createProject(tx, {
        slug: d.slug,
        countryCode: d.country,
      });
      // Recorded ready for the page, not as a draft. proj.publication_gaps()
      // reports 'english_page_text' until the English required fields are at
      // 'published', so creating a project at 'human_draft' left a gate item
      // open that nothing on this form mentioned - and the owner had typed the
      // title and the summary FOR the page. The record page can still put any
      // of them back to a draft.
      await saveText(tx, projectId,
        { fieldCode: 'title', locale: 'en', body: d.title_en, status: ENTRY_TEXT_DEFAULT },
        sourceRefId);
      await saveText(tx, projectId,
        { fieldCode: 'summary', locale: 'en', body: d.summary_en, status: ENTRY_TEXT_DEFAULT },
        sourceRefId);
      if (d.title_de) {
        await saveText(tx, projectId,
          { fieldCode: 'title', locale: 'de', body: d.title_de, status: ENTRY_TEXT_DEFAULT },
          sourceRefId);
      }
      if (d.summary_de) {
        await saveText(tx, projectId,
          { fieldCode: 'summary', locale: 'de', body: d.summary_de, status: ENTRY_TEXT_DEFAULT },
          sourceRefId);
      }
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('createProject', err);
    backToNew(locale, codeFor(err));
  }

  revalidatePath('/owner');
  redirectTo({
    href: { pathname: `/owner/projects/${d.slug}`, query: { saved: 'created' } },
    locale,
  });
}

/* --------------------------------------------------------------- SECTIONS */

const TextSection = Source.extend({
  slug: z.string().trim(),
  title_en: line(200),
  title_de: optional(200),
  summary_en: line(2000),
  summary_de: optional(2000),
  catchment_context_en: optional(4000),
  partners_note_en: optional(4000),
  durability_note_en: optional(4000),
  status_en: z.enum(TRANSLATION_STATUS).default('human_draft'),
  status_de: z.enum(TRANSLATION_STATUS).default('human_draft'),
});

/**
 * The page text, in both languages.
 *
 * Each field is compared with the version already recorded and only written
 * where it differs, so a save that changed one paragraph appends one row rather
 * than five. Every version stays visible for ever; filling that history with
 * rows that record nothing would make it useless for the thing it exists for.
 */
export async function saveProjectTextAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = TextSection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const slug = String(formData.get('slug') ?? '');
    back(locale, slug, 'text', { error: 'invalid_input' });
  }
  const d = parsed.data;

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      const en = [
        ['title', d.title_en],
        ['summary', d.summary_en],
        ['catchment_context', d.catchment_context_en],
        ['partners_note', d.partners_note_en],
        ['durability_note', d.durability_note_en],
      ] as const;
      for (const [fieldCode, body] of en) {
        if (body === null || body === '') continue;
        await saveText(tx, projectId,
          { fieldCode, locale: 'en', body, status: d.status_en }, sourceRefId);
      }
      const de = [
        ['title', d.title_de],
        ['summary', d.summary_de],
      ] as const;
      for (const [fieldCode, body] of de) {
        if (body === null || body === '') continue;
        await saveText(tx, projectId,
          { fieldCode, locale: 'de', body, status: d.status_de }, sourceRefId);
      }
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('saveProjectText', err);
    back(locale, d.slug, 'text', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'text', { saved: true });
}

const UnitSection = Source.extend({
  slug: z.string().trim(),
  unit_type: z.string().uuid(),
});

/** Which scheme and unit type this project issues under. */
export async function declareUnitTypeAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = UnitSection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'unit', { error: 'invalid_input' });
  }
  const d = parsed.data;

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      await declareUnitType(tx, projectId, d.unit_type, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('declareUnitType', err);
    back(locale, d.slug, 'unit', { error: codeFor(err) });
  }
  back(locale, d.slug, 'unit', { saved: true });
}

const BoundarySection = Source.extend({
  slug: z.string().trim(),
  kind: z.enum(['boundary', 'catchment']).default('boundary'),
  geojson: z.string().trim().min(2).max(4_000_000),
  source_licence: line(200),
  dataset_name: optional(200),
  geometry_as_of: date,
});

/**
 * The boundary, or the catchment the project supplies for itself.
 *
 * docs/DECISIONS.md D4: the catchment relevant to a restoration project is a
 * hydrological judgement made in that project's design document. Deriving one
 * here would be the platform making an environmental claim, and it would carry
 * no provenance. So this takes the polygon the owner supplies, with its licence
 * and its as-of date, and stores it as a new version.
 */
export async function saveBoundaryAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = BoundarySection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'boundary', { error: 'invalid_input' });
  }
  const d = parsed.data;

  // A catchment must name the dataset it came from - the table has a CHECK that
  // says so. Caught here so the person reads a sentence, not a constraint.
  if (d.kind === 'catchment' && !d.dataset_name) {
    back(locale, d.slug, 'boundary', { error: 'invalid_input' });
  }

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      await addGeometry(tx, projectId, {
        kind: d.kind,
        geojson: d.geojson,
        sourceLicence: d.source_licence,
        datasetName: d.dataset_name,
        asOfDate: d.geometry_as_of,
      }, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('saveBoundary', err);
    // This is the one action whose failures are mostly the polygon's, so it
    // maps them with the geometry-aware mapper rather than the general one.
    back(locale, d.slug, 'boundary', {
      error: err instanceof NotFound ? 'not_found' : geometryCodeForDatabaseError(err),
    });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'boundary', { saved: true });
}

const ClaimSection = Source.extend({
  slug: z.string().trim(),
  benefit_key: entryKey,
  locale: z.enum(['en', 'de']).default('en'),
  benefit_label: line(200),
  who_may_claim: line(2000),
  for_what: line(2000),
  exclusions: line(2000),
  status: z.enum(TRANSLATION_STATUS).default(ENTRY_TEXT_DEFAULT),
});

/**
 * One claim right. Descriptive only: the platform computes nothing, asserts no
 * exclusivity and blocks no deal on claim-rights grounds, because that would be
 * a legal determination nothing in the concept note authorises.
 *
 * `exclusions` is required because it is NOT NULL and non-blank in the schema,
 * and it is non-blank in the schema because a blank exclusions field is the
 * failure the interviewed buyers described.
 */
export async function addClaimRightAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = ClaimSection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'claim', { error: 'invalid_input' });
  }
  const d = parsed.data;

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      await addClaimRight(tx, projectId, {
        benefitKey: d.benefit_key,
        locale: d.locale,
        benefitLabel: d.benefit_label,
        whoMayClaim: d.who_may_claim,
        forWhat: d.for_what,
        exclusions: d.exclusions,
        status: d.status,
      }, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('addClaimRight', err);
    back(locale, d.slug, 'claim', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'claim', { saved: true });
}

const OutcomeSection = Source.extend({
  slug: z.string().trim(),
  indicator_code: entryKey,
  domain: z.enum(['water', 'biodiversity']),
  measure_unit: line(100),
  verifier_org: z.string().uuid().optional().or(z.literal(''))
    .transform((s) => (s ? s : null)),
  uncertainty_note: optional(2000),
  locale: z.enum(['en', 'de']).default('en'),
  what_is_measured: line(2000),
  method_note: optional(4000),
  baseline_value: decimal.optional().or(z.literal(''))
    .transform((s) => (s ? String(s) : null)),
  baseline_as_of: z.string().trim().regex(ISO_DATE).optional().or(z.literal(''))
    .transform((s) => (s ? s : null)),
  status: z.enum(TRANSLATION_STATUS).default(ENTRY_TEXT_DEFAULT),
});

/**
 * One outcome indicator, with its baseline.
 *
 * An indicator carries no unit_type_id on purpose, so a hydrology figure can
 * never enter a unit_qty, a committed volume or an availability panel. Its
 * measure unit is free text describing what was measured, and it is printed
 * beside every value.
 *
 * The uncertainty note is reproduced as stated. Nothing here computes it,
 * narrows it or turns it into a range the project did not claim.
 */
export async function addOutcomeAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = OutcomeSection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'outcome', { error: 'invalid_input' });
  }
  const d = parsed.data;

  // A baseline is a figure, so it needs a date. One without the other is half a
  // fact and the publication gate would not accept it either.
  const baselineValue = d.baseline_value !== null && d.baseline_as_of !== null
    ? d.baseline_value : null;
  const baselineAsOf = baselineValue !== null ? d.baseline_as_of : null;

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      await addOutcome(tx, projectId, {
        indicatorCode: d.indicator_code,
        domain: d.domain,
        measureUnit: d.measure_unit,
        verifierOrgId: d.verifier_org,
        uncertaintyNote: d.uncertainty_note,
        locale: d.locale,
        whatIsMeasured: d.what_is_measured,
        methodNote: d.method_note,
        baselineValue,
        baselineAsOf,
        status: d.status,
      }, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('addOutcome', err);
    back(locale, d.slug, 'outcome', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'outcome', { saved: true });
}

const DurabilitySection = Source.extend({
  slug: z.string().trim(),
  commitment_key: entryKey,
  responsible_org: z.string().uuid().optional().or(z.literal(''))
    .transform((s) => (s ? s : null)),
  starts_on: z.string().trim().regex(ISO_DATE).optional().or(z.literal(''))
    .transform((s) => (s ? s : null)),
  ends_on: z.string().trim().regex(ISO_DATE).optional().or(z.literal(''))
    .transform((s) => (s ? s : null)),
  horizon_years: z.string().trim().regex(/^\d{1,3}$/).optional().or(z.literal(''))
    .transform((s) => (s ? Number(s) : null)),
  locale: z.enum(['en', 'de']).default('en'),
  statement: line(2000),
  land_control_note: line(2000),
  status: z.enum(TRANSLATION_STATUS).default(ENTRY_TEXT_DEFAULT),
});

/**
 * One durability commitment. A set of dated commitments with named responsible
 * parties, not one number: one interviewed buyer asked about the period after a
 * five-year contract and another about thirty to forty years, and a single
 * "durability" figure cannot answer both.
 */
export async function addDurabilityAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = DurabilitySection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'durability', { error: 'invalid_input' });
  }
  const d = parsed.data;

  // The schema requires at least one of an end date and a horizon: a commitment
  // with neither does not say how long it lasts.
  if (d.ends_on === null && d.horizon_years === null) {
    back(locale, d.slug, 'durability', { error: 'invalid_input' });
  }

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      await addDurability(tx, projectId, {
        commitmentKey: d.commitment_key,
        responsibleOrgId: d.responsible_org,
        startsOn: d.starts_on,
        endsOn: d.ends_on,
        horizonYears: d.horizon_years,
        locale: d.locale,
        statement: d.statement,
        landControlNote: d.land_control_note,
        status: d.status,
      }, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('addDurability', err);
    back(locale, d.slug, 'durability', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'durability', { saved: true });
}

const PartySection = Source.extend({
  slug: z.string().trim(),
  party_org: z.string().uuid(),
  party_role: z.string().trim().min(1).max(64),
  description_en: optional(2000),
});

/**
 * A partner on the ground: who develops the project, who owns the land, who
 * verifies. The verifier is one of the ten things the publication gate checks.
 *
 * The organisation is chosen from org.v_public_party, which is the only route
 * to a legal name this role has and names only declared parties and owners of
 * already-public projects. Where a landowner is a natural person, the page
 * carries a non-identifying description and the name stays out of the database
 * entirely - so `description_en` exists and a "name" field does not.
 */
export async function addPartyAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = PartySection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'party', { error: 'invalid_input' });
  }
  const d = parsed.data;

  let added = false;
  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      added = await addParty(tx, projectId, {
        partyOrgId: d.party_org,
        partyRole: d.party_role,
        descriptionEn: d.description_en,
      }, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('addParty', err);
    back(locale, d.slug, 'party', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'party', added ? { saved: true } : { error: 'already_recorded' });
}

const PeriodSection = Source.extend({
  slug: z.string().trim(),
  period_label: line(60),
  starts_on: date,
  ends_on: date,
  unit_type: z.string().uuid(),
  expected_issuance: decimal,
  buffer: decimal,
  forecast_as_of: date,
});

/**
 * A period and the forecast that gives it availability.
 *
 * RULE 7. The figures belong to one project and one unit type, which is what
 * the composite foreign key to proj.project_unit_type makes unavoidable: a
 * volume in a unit type this project does not sell is unrepresentable. Nothing
 * here adds anything to anything.
 *
 * R1 lives on proj.period_balance and the forecast trigger applies it. A
 * revision that would leave committed volume above the ceiling is RECORDED but
 * not applied - it is a fact about the project - and the page shows it as a
 * pending revision rather than the database refusing to hear it.
 */
export async function addPeriodAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = PeriodSection.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    back(locale, String(formData.get('slug') ?? ''), 'period', { error: 'invalid_input' });
  }
  const d = parsed.data;

  if (d.ends_on <= d.starts_on) {
    back(locale, d.slug, 'period', { error: 'invalid_input' });
  }

  try {
    await ownedProject(viewer, d.slug, async (projectId, tx) => {
      const sourceRefId = await insertSource(tx, sourceInput(d));
      await addPeriodWithForecast(tx, projectId, {
        label: d.period_label,
        startsOn: d.starts_on,
        endsOn: d.ends_on,
        unitTypeId: d.unit_type,
        expectedIssuance: d.expected_issuance,
        buffer: d.buffer,
        asOfDate: d.forecast_as_of,
      }, sourceRefId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('addPeriod', err);
    back(locale, d.slug, 'period', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, d.slug, 'period', { saved: true });
}

/* --------------------------------------------------------- SUBMIT FOR REVIEW */

const Submit = z.object({ slug: z.string().trim() });

/**
 * Hand the project to Sylva.
 *
 * The database decides whether the transition is allowed, and the answer is
 * zero rows rather than an exception: p_project_owner_submit admits a draft or
 * a project sent back for changes and no other starting point. So `false` here
 * means "not from this status", which is what the sentence says.
 */
export async function submitForReviewAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner');
  const locale = await getLocale();
  const parsed = Submit.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) back(locale, '', 'submit', { error: 'invalid_input' });
  const { slug } = parsed.data;

  let moved = false;
  try {
    await ownedProject(viewer, slug, async (projectId, tx) => {
      moved = await submitForReview(tx, projectId);
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('submitForReview', err);
    back(locale, slug, 'submit', { error: codeFor(err) });
  }

  revalidatePath('/owner');
  back(locale, slug, 'submit', moved ? { saved: true } : { error: 'not_editable' });
}

/* ------------------------------------------------- THE PRIVATE QUESTION BOX */

const Answer = z.object({
  question_id: z.string().trim().regex(/^\d{1,19}$/),
  body: line(8000),
});

/**
 * Reply to a buyer's question.
 *
 * The reply goes to the buyer that asked and to Sylva, and to nobody else:
 * p_answer_read admits the asker, the owner, the operator and the auditor, and
 * there is no public route to this table at all. The form says so above the
 * box, at the point of typing, because that is where it is read.
 *
 * Zero rows back means the question is not one asked of this organisation,
 * which is the same answer as a question id that does not exist.
 */
export async function answerQuestionAction(formData: FormData): Promise<void> {
  const viewer = await requireRole('project_owner', '/owner/questions');
  const locale = await getLocale();

  const parsed = Answer.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    redirectTo({
      href: { pathname: '/owner/questions', query: { error: 'invalid_input' } },
      locale,
    });
  }
  const d = parsed.data;

  let answerId: string | null = null;
  try {
    answerId = await withActor(viewer.actor, (tx) =>
      answerQuestion(tx, d.question_id, d.body, viewer.personRef));
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logOwnerFailure('answerQuestion', err);
    redirectTo({
      href: {
        pathname: '/owner/questions',
        query: { error: ownerCodeForDatabaseError(err) },
      },
      locale,
    });
  }

  revalidatePath('/owner');
  revalidatePath('/owner/questions');
  redirectTo({
    href: {
      pathname: '/owner/questions',
      query: answerId === null
        ? { error: 'not_found' as const }
        : { answered: d.question_id },
    },
    locale,
  });
}
