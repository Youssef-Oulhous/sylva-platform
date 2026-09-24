import { readAs } from '@/lib/db/session';
import { getViewer, type Viewer } from '@/lib/auth/session';
import { findOpenInterest } from './queries';
import type { OpenInterest } from './types';

/**
 * Which of the states the Express interest page is in, for this viewer, on
 * this project.
 *
 * This is NOT the security boundary and must not be read as one. The boundary
 * is the PostgreSQL role the write runs as, the row-level policy that filters
 * it, the R6 trigger and the unique partial index - all of which fire whether
 * or not this function was ever called. What this function decides is what the
 * page SAYS, which is a different job:
 *
 *   not_signed_in  there is no organisation to record an event against
 *   wrong_role     this account is not a buyer account
 *   not_approved   R6: Sylva has not approved this organisation as a buyer
 *   already_open   there is a live deal here; a second one is not a second
 *                  conversation, it is a duplicate of the first
 *   ok             show the form
 *
 * Every one of those is a sentence with something to do next, not a dead end,
 * which is why this returns a state rather than redirecting.
 *
 * `not_approved` asks sylva.is_vetted() - the same function the guards in
 * src/lib/auth use - which reads org.org_role_approval, the trigger-maintained
 * cache of the vetting decision chain. The application never decides approval;
 * it asks. And when it asks and gets the wrong answer, the R6 trigger still
 * refuses the write.
 */

export type InterestGate =
  | { state: 'not_signed_in' }
  | { state: 'wrong_role'; viewer: Viewer }
  | { state: 'not_approved'; viewer: Viewer; submittedAt: string | null }
  | { state: 'already_open'; viewer: Viewer; open: OpenInterest }
  | { state: 'ok'; viewer: Viewer };

interface VettingRow extends Record<string, unknown> {
  approved: boolean;
  submitted_at: string | null;
}

// One round trip for both answers. The submission date is what turns "not yet
// approved" into "we have your questionnaire, it was submitted on this date",
// which is the difference between a refusal and a status.
const VETTING_SQL = `
  SELECT sylva.is_vetted('buyer', sylva.actor_org_id()) AS approved,
         (SELECT max(s.submitted_at)::text
            FROM org.vetting_submission s
           WHERE s.org_id = sylva.actor_org_id()
             AND s.role_code = 'buyer') AS submitted_at`;

export async function interestGate(projectId: string): Promise<InterestGate> {
  const viewer = await getViewer();
  if (!viewer) return { state: 'not_signed_in' };
  if (!viewer.roles.includes('buyer')) return { state: 'wrong_role', viewer };

  const vetting = await readAs(viewer.actor, (tx) =>
    tx.one<VettingRow>(VETTING_SQL, []));
  if (!vetting.approved) {
    return { state: 'not_approved', viewer, submittedAt: vetting.submitted_at };
  }

  const open = await findOpenInterest(viewer.actor, projectId);
  if (open) return { state: 'already_open', viewer, open };

  return { state: 'ok', viewer };
}
