import type { VettingState } from '@/lib/admin/types';

/**
 * The derivation table: recorded entry on the left, resulting state on the
 * right. This is the screen's argument, so it is data rather than prose.
 *
 * This is NOT demo data. Every row below is a row the database can actually
 * produce: `submitted` is an application with no decision recorded against it,
 * and the other three are members of `org.vetting_decision_kind` that
 * `org.apply_vetting_decision()` maps to a status in `org.org_role_approval`.
 *
 * Two rows the earlier frontend pass carried are gone, because the schema has
 * no such events:
 *
 *   review_opened  nothing records that a reviewer picked an application up.
 *                  Printing "In review" would tell an organisation that work
 *                  had started when no row says so.
 *   correction     a decision recorded in error is corrected by recording a
 *                  LATER decision; there is no separate correction row in
 *                  org.vetting_decision. The log says so in words instead.
 *
 * The two enum members an operator cannot choose here - `reinstated` and
 * `revoked` - are absent for the same reason the form has only three options:
 * this screen records approve, decline and suspend. Both still render in a log
 * that holds them.
 */

/** 'notSet' where the pilot material does not settle the point. RULE J. */
export type PermitValue = 'yes' | 'no' | 'notSet';

export interface DerivationRow {
  readonly id: string;
  /** Subkey under `adminVetting.entry`. */
  readonly entryKey: string;
  readonly state: VettingState;
  /** May a deal be created for the organisation in that state? Rule 6. */
  readonly mayDeal: PermitValue;
  /** Subkey under `adminVetting.derivation`, explaining the row. */
  readonly noteKey: string;
}

export const DERIVATION_ROWS: readonly DerivationRow[] = [
  {
    id: 'submitted',
    entryKey: 'submitted',
    state: 'submitted',
    mayDeal: 'no',
    noteKey: 'submittedNote',
  },
  {
    id: 'approved',
    entryKey: 'approved',
    state: 'approved',
    mayDeal: 'yes',
    noteKey: 'approvedNote',
  },
  {
    id: 'declined',
    entryKey: 'declined',
    state: 'declined',
    mayDeal: 'no',
    noteKey: 'declinedNote',
  },
  {
    id: 'suspended',
    entryKey: 'suspended',
    state: 'suspended',
    mayDeal: 'notSet',
    noteKey: 'suspendedNote',
  },
];
