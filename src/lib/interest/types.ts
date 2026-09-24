import type { UnitQty } from '@/lib/units/qty';

/**
 * Express interest, as the screens see it.
 *
 * Every volume below is a UnitQty, never a bare number: it carries the project
 * and unit type it belongs to, so nothing on these screens can add a volume
 * from this project to a volume from another one (R7). The only place a raw
 * number appears is inside a formatter.
 */

export interface SourceRef {
  label: string;
  locator: string | null;
  asOfDate: string;
  kind: string;
}

/** One period of this project, with what is left in it. Never a total. */
export interface InterestPeriod {
  periodId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  remaining: UnitQty;
  source: SourceRef;
}

/**
 * The project an enquiry is about.
 *
 * One project, one unit type. `proj.project_unit_type` is a composite-FK spine,
 * so a period of this project cannot carry a unit type this project does not
 * sell - which is why a single unit label for the page is honest rather than a
 * simplification.
 */
export interface InterestProject {
  id: string;
  slug: string;
  title: string;
  titleIsFallback: boolean;
  countryCode: string;
  ownerOrgId: string;
  ownerOrgName: string;
  schemeName: string;
  unitTypeId: string;
  unitTypeCode: string;
  /** e.g. "hectares under restoration for a year". Printed beside every figure. */
  unitMetricLabel: string;
  unitOfMeasure: string;
  vintageSemantics: 'period_of_issuance' | 'period_of_outcome' | 'undefined_by_scheme';
  periods: InterestPeriod[];
}

/** A live deal this buyer already has on this project. */
export interface OpenInterest {
  dealId: string;
  stage: string;
  openedAt: string;
  pseudonym: string | null;
  /** The record entry that opened it, so the page can link to its confirmation. */
  recordPublicId: string | null;
}

export type DealShapeChoice = 'spot' | 'forward' | 'co_investment' | 'undecided';

/** One line of an enquiry. Per period, and never added to another line. */
export interface RequestedVolume {
  periodId: string;
  periodLabel: string;
  requested: UnitQty;
  source: SourceRef;
}

/**
 * What was actually written, read back from the database rather than echoed
 * from the form. If a column did not take the value, the confirmation does not
 * claim it did.
 */
export interface RecordedInterest {
  /** record.entry.public_id. The id in the URL. */
  publicId: string;
  /** The human reference, derived from publicId. Not enumerable. */
  reference: string;
  entryType: string;
  occurredAt: string;
  dealId: string;
  dealStage: string;
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  ownerOrgName: string;
  /** The buyer's own organisation, via org.actor_organisation_name(). */
  organisationName: string | null;
  pseudonym: string | null;
  disclosed: boolean;
  intendedShape: string | null;
  unitTypeId: string;
  unitMetricLabel: string;
  unitOfMeasure: string;
  volumes: RequestedVolume[];
  /** True when the enquiry carried a message to the project owner. */
  hasMessage: boolean;
}

export interface InterestInput {
  projectId: string;
  ownerOrgId: string;
  unitTypeId: string;
  dealShape: DealShapeChoice;
  /** Whole units per period. Periods the buyer left blank are absent. */
  volumes: { periodId: string; amount: number }[];
  message: string | null;
  disclose: boolean;
}

/**
 * The four answers to "which deal shape".
 *
 * The first three are the codes in deal.deal_shape (migration 0011), which is
 * where the foreign key on deal.deal.intended_shape points; 'undecided' is the
 * honest fourth answer and is stored as NULL, because the concept note offers
 * three shapes and not four. The labels are the message keys that already
 * exist for them.
 */
export const DEAL_SHAPE_CHOICES: readonly {
  code: DealShapeChoice;
  labelKey: string;
  noteKey: string;
}[] = [
  {
    code: 'spot',
    labelKey: 'expressInterest.form.deal.spot',
    noteKey: 'expressInterest.form.deal.spotNote',
  },
  {
    code: 'forward',
    labelKey: 'expressInterest.form.deal.forward',
    noteKey: 'expressInterest.form.deal.forwardNote',
  },
  {
    code: 'co_investment',
    labelKey: 'expressInterest.form.deal.coInvestment',
    noteKey: 'expressInterest.form.deal.coInvestmentNote',
  },
  {
    code: 'undecided',
    labelKey: 'expressInterest.form.deal.undecided',
    noteKey: 'expressInterest.form.deal.undecidedNote',
  },
];

/** The message key for a stored shape code, for the confirmation screen. */
export const DEAL_SHAPE_LABEL_KEY: Record<string, string> = {
  spot: 'expressInterest.form.deal.spot',
  forward: 'expressInterest.form.deal.forward',
  co_investment: 'expressInterest.form.deal.coInvestment',
};
