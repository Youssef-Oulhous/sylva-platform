import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import {
  AlreadyPublishedError,
  UnknownApplicationError,
  adminProjectsIn,
  publishProjectIn,
  recordDecisionIn,
  vettingApplicationIn,
  vettingQueueIn,
} from '@/lib/admin/queries';
import {
  codeForAdminError,
  missingFromGateError,
  resolveAdminMessage,
} from '@/lib/admin/errors';
import { inRolledBackTransaction, refusalOf } from './rollback';

/**
 * The operator's two screens, against the real database, as the real roles.
 *
 * The demo fixtures these tests stand on, from db/seed/0001, 0002 and 0003:
 *
 *   DEMO Sylva Operations       operator
 *   DEMO Nordbräu AG            buyer, APPROVED (a decision is on record)
 *   DEMO Unvetted Trading       buyer, SUBMITTED - a questionnaire, never decided
 *   demo-untere-havel…          published, publication gate complete
 *   demo-oder-floodplain…       draft, every one of the ten gate items missing
 *
 * Every test that WRITES runs through inRolledBackTransaction():
 * `org.vetting_decision` is append-only - UPDATE and DELETE are revoked AND
 * blocked by ENABLE ALWAYS triggers - so a test that records a decision could
 * never remove it, and would put an approval on a real organisation's permanent
 * record for ever. What runs is the same SQL, as the same PostgreSQL role, with
 * a real HMAC-signed actor context, through every trigger. Only the COMMIT is
 * missing. See tests/db/rollback.ts.
 */

const OPERATOR: Actor = {
  kind: 'operator',
  orgId: '10000000-0000-0000-0000-000000000010',
  personRef: 'b0000000-0000-0000-0000-0000000000b7',
};

const APPROVED_BUYER: Actor = {
  kind: 'member',
  role: 'buyer',
  orgId: '0c000000-0000-0000-0000-00000000000c',
  personRef: 'b0000000-0000-0000-0000-0000000000b3',
};

/** DEMO Unvetted Trading: it applied, and nobody has decided. That is R6. */
const UNVETTED_ORG = '14000000-0000-0000-0000-000000000014';
const UNVETTED_SUBMISSION = '70000000-0000-0000-0000-000000000007';
/** DEMO Nordbräu AG's buyer application, already approved. */
const APPROVED_SUBMISSION = '70000000-0000-0000-0000-000000000003';

const PUBLISHED_PROJECT = 'a1000000-0000-0000-0000-000000000001';
const DRAFT_PROJECT = 'a1000000-0000-0000-0000-000000000003';

/** next-intl's `t` before the catalogue has the key: the English fallback. */
const noCatalogue = Object.assign((key: string) => key, {
  has: () => false,
});

afterAll(async () => { await closeAllPools(); });

/* ========================================================================== */
/*  THE VETTING QUEUE                                                         */
/* ========================================================================== */

describe('the vetting queue, read as an operator', () => {
  it('lists real submissions with the organisation behind each one', async () => {
    const rows = await inRolledBackTransaction(OPERATOR, (tx) => vettingQueueIn(tx, 'en'));

    expect(rows.length).toBeGreaterThan(0);
    const unvetted = rows.find((r) => r.submissionId === UNVETTED_SUBMISSION);
    expect(unvetted).toBeDefined();
    // legal_name is withheld from every public-facing role by column grant.
    // The operator holds it, which is why this screen can show it at all.
    expect(unvetted!.organisationName).toContain('DEMO');
    expect(unvetted!.roleCode).toBe('buyer');
    expect(unvetted!.sectorLabel).toBeTruthy();
    expect(unvetted!.countryName).toBeTruthy();
    expect(unvetted!.submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reads the state from the trigger-maintained approval, never from a guess', async () => {
    const rows = await inRolledBackTransaction(OPERATOR, (tx) => vettingQueueIn(tx, 'en'));

    const unvetted = rows.find((r) => r.submissionId === UNVETTED_SUBMISSION)!;
    // No decision has been recorded, so org.org_role_approval has no row and
    // the application is simply submitted. This is R6: an organisation cannot
    // approve itself by completing the questionnaire.
    expect(unvetted.approvalStatus).toBeNull();
    expect(unvetted.state).toBe('submitted');

    const approved = rows.find((r) => r.submissionId === APPROVED_SUBMISSION)!;
    expect(approved.approvalStatus).toBe('approved');
    expect(approved.state).toBe('approved');
  });

  it('carries the append-only chain each state was read from', async () => {
    const rows = await inRolledBackTransaction(OPERATOR, (tx) => vettingQueueIn(tx, 'en'));

    const approved = rows.find((r) => r.submissionId === APPROVED_SUBMISSION)!;
    // The submission itself, then every decision for this organisation and role.
    expect(approved.entries[0]!.kind).toBe('submitted');
    expect(approved.entries.at(-1)!.kind).toBe('approved');
    expect(approved.entries.at(-1)!.reason).toBeTruthy();
    // The newest entry is never marked superseded; it is what the state follows.
    expect(approved.entries.at(-1)!.superseded).toBe(false);

    const unvetted = rows.find((r) => r.submissionId === UNVETTED_SUBMISSION)!;
    expect(unvetted.entries).toHaveLength(1);
    expect(unvetted.entries[0]!.reason).toBeNull();
  });

  it('shows the questionnaire as it was asked, from org.question', async () => {
    const app = await inRolledBackTransaction(OPERATOR, (tx) =>
      vettingApplicationIn(tx, APPROVED_SUBMISSION, 'en'));

    expect(app).not.toBeNull();
    // The buyer questionnaire in db/seed/0002 has eight questions. Nothing in
    // src/ hardcodes them: change the seed and this count changes with it.
    expect(app!.answers.length).toBe(8);
    expect(app!.answers.map((a) => a.sortOrder))
      .toEqual([...app!.answers.map((a) => a.sortOrder)].sort((x, y) => x - y));
    expect(app!.answers[0]!.promptEn).toBeTruthy();

    const boolean = app!.answers.find((a) => a.answerKind === 'boolean');
    expect(boolean).toBeDefined();
    expect(typeof boolean!.boolean).toBe('boolean');
    expect(app!.answeredCount).toBeGreaterThan(0);
  });

  it('returns null for an application id that is not one', async () => {
    const app = await inRolledBackTransaction(OPERATOR, (tx) =>
      vettingApplicationIn(tx, '00000000-0000-0000-0000-0000000000ff', 'en'));
    expect(app).toBeNull();
  });
});

/* ========================================================================== */
/*  RECORDING A DECISION                                                      */
/* ========================================================================== */

describe('recording a vetting decision', () => {
  it('approves by INSERTING an entry, and the TRIGGER moves the state', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const before = await tx.one<{ ok: boolean }>(
        'SELECT sylva.is_vetted($1::text, $2::uuid) AS ok', ['buyer', UNVETTED_ORG]);
      expect(before.ok).toBe(false);

      const result = await recordDecisionIn(tx, {
        submissionId: UNVETTED_SUBMISSION,
        choice: 'approve',
        reason: 'TEST: intended claim is specific and consistent with the pilot.',
        decidedByOrgId: OPERATOR.kind === 'operator' ? OPERATOR.orgId : '',
        decidedByPersonRef: OPERATOR.kind === 'operator' ? OPERATOR.personRef : '',
      });

      expect(result.recorded).toBe('approved');
      // Read back from org.org_role_approval, which nothing in src/ can write.
      expect(result.state).toBe('approved');

      const after = await tx.one<{ ok: boolean }>(
        'SELECT sylva.is_vetted($1::text, $2::uuid) AS ok', ['buyer', UNVETTED_ORG]);
      // R6 now permits a deal for this organisation - and it does so because a
      // decision is on record, not because anything set a flag.
      expect(after.ok).toBe(true);
    });
  });

  it('takes the organisation and the role FROM THE SUBMISSION, not from the caller', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const { decisionId } = await recordDecisionIn(tx, {
        submissionId: UNVETTED_SUBMISSION,
        choice: 'decline',
        reason: 'TEST: the stated use is outside what the pilot offers.',
        decidedByOrgId: '10000000-0000-0000-0000-000000000010',
        decidedByPersonRef: 'b0000000-0000-0000-0000-0000000000b7',
      });

      const row = await tx.one<{ org_id: string; role_code: string; decision: string }>(
        `SELECT org_id::text, role_code, decision::text AS decision
           FROM org.vetting_decision WHERE id = $1::uuid`, [decisionId]);
      expect(row.org_id).toBe(UNVETTED_ORG);
      expect(row.role_code).toBe('buyer');
      expect(row.decision).toBe('declined');
    });
  });

  it('records a REINSTATEMENT rather than an approval when the org is suspended', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const suspended = await recordDecisionIn(tx, {
        submissionId: APPROVED_SUBMISSION,
        choice: 'suspend',
        reason: 'TEST: suspended while the organisation reorganises.',
        decidedByOrgId: '10000000-0000-0000-0000-000000000010',
        decidedByPersonRef: 'b0000000-0000-0000-0000-0000000000b7',
      });
      expect(suspended.recorded).toBe('suspended');
      expect(suspended.state).toBe('suspended');

      const back = await recordDecisionIn(tx, {
        submissionId: APPROVED_SUBMISSION,
        choice: 'approve',
        reason: 'TEST: the reorganisation is complete and the mandate is unchanged.',
        decidedByOrgId: '10000000-0000-0000-0000-000000000010',
        decidedByPersonRef: 'b0000000-0000-0000-0000-0000000000b7',
      });
      // Both read as approved; the record keeps which one happened.
      expect(back.recorded).toBe('reinstated');
      expect(back.state).toBe('approved');
    });
  });

  it('refuses an application id that is not in the table', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      await expect(recordDecisionIn(tx, {
        submissionId: '00000000-0000-0000-0000-0000000000ff',
        choice: 'approve',
        reason: 'TEST: this application does not exist.',
        decidedByOrgId: '10000000-0000-0000-0000-000000000010',
        decidedByPersonRef: 'b0000000-0000-0000-0000-0000000000b7',
      })).rejects.toBeInstanceOf(UnknownApplicationError);
    });
  });

  it('is refused for a buyer twice over: the row is invisible AND the grant is absent', async () => {
    // First refusal: row-level security. Another organisation's application is
    // not in the buyer's SELECT at all, so the decision never gets as far as
    // the INSERT. The buyer learns nothing about whether it exists.
    await inRolledBackTransaction(APPROVED_BUYER, async (tx) => {
      await expect(recordDecisionIn(tx, {
        submissionId: UNVETTED_SUBMISSION,
        choice: 'approve',
        reason: 'TEST: a buyer trying to approve an organisation.',
        decidedByOrgId: '0c000000-0000-0000-0000-00000000000c',
        decidedByPersonRef: 'b0000000-0000-0000-0000-0000000000b3',
      })).rejects.toBeInstanceOf(UnknownApplicationError);
    });

    // Second refusal, and the one that matters: even for its OWN application,
    // a buyer holds no INSERT on org.vetting_decision. Only Sylva decides.
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(APPROVED_BUYER, (tx) => tx.query(
        `INSERT INTO org.vetting_decision
           (submission_id, org_id, role_code, decision, reason,
            decided_by_org_id, decided_by_person_ref)
         VALUES ($1::uuid, $2::uuid, 'buyer', 'approved', 'TEST', $2::uuid, $3::uuid)`,
        [APPROVED_SUBMISSION, '0c000000-0000-0000-0000-00000000000c',
         'b0000000-0000-0000-0000-0000000000b3'])));

    expect(refusal.code).toBe('42501');
    // And the person reads a sentence, not a table name.
    expect(codeForAdminError({ code: refusal.code })).toBe('no_access');
    expect(resolveAdminMessage(noCatalogue, 'no_access'))
      .toBe("You don't have access to this information.");
  });

  it('cannot reach the approval cache directly, even as an operator', async () => {
    // R6's other half: approval is a CONSEQUENCE of a recorded decision and can
    // be reached no other way. ci.assert_approval_is_derived() asserts the
    // privilege; this asserts it against the live role.
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(OPERATOR, (tx) => tx.query(
        `UPDATE org.org_role_approval SET status = 'approved'
          WHERE org_id = $1::uuid AND role_code = 'buyer'`, [UNVETTED_ORG])));
    expect(refusal.code).toBe('42501');
  });
});

/* ========================================================================== */
/*  PROJECT REVIEW AND PUBLICATION                                            */
/* ========================================================================== */

describe('the project review queue', () => {
  it('shows every project with the gate the database itself would apply', async () => {
    const rows = await inRolledBackTransaction(OPERATOR, (tx) => adminProjectsIn(tx, 'en'));

    const draft = rows.find((r) => r.id === DRAFT_PROJECT)!;
    expect(draft.status).toBe('draft');
    expect(draft.gaps.length).toBe(10);
    expect(draft.gate.every((g) => !g.recorded)).toBe(true);
    expect(draft.gate.every((g) => g.detail.kind === 'missing')).toBe(true);

    const published = rows.find((r) => r.id === PUBLISHED_PROJECT)!;
    expect(published.status).toBe('published');
    expect(published.gaps).toEqual([]);
    expect(published.gate.every((g) => g.recorded)).toBe(true);
    expect(published.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('agrees with proj.publication_gaps() item for item', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const rows = await adminProjectsIn(tx, 'en');
      for (const project of rows) {
        const live = await tx.one<{ gaps: string[] }>(
          'SELECT proj.publication_gaps($1::uuid) AS gaps', [project.id]);
        // The screen's list and the trigger's list are the same array.
        expect([...project.gaps].sort()).toEqual([...(live.gaps ?? [])].sort());
      }
    });
  });

  it('counts rows, never unit volumes (rule 7)', async () => {
    const rows = await inRolledBackTransaction(OPERATOR, (tx) => adminProjectsIn(tx, 'en'));
    // This is the one table that puts projects from different schemes side by
    // side. Nothing it returns is a quantity, so there is nothing on it that
    // two projects' units could be summed into.
    const json = JSON.stringify(rows);
    expect(json).not.toContain('"amount"');
    expect(json).not.toContain('_qty');
    for (const row of rows) {
      for (const item of row.gate) {
        if (item.detail.kind === 'count') {
          expect(Number.isInteger(item.detail.count)).toBe(true);
        }
      }
    }
    // And every project states its own unit, so no two rows read as comparable.
    expect(rows.find((r) => r.id === PUBLISHED_PROJECT)!.unitLabel).toBeTruthy();
  });
});

describe('publishing', () => {
  it('is REFUSED for a project with a missing gate item, and the refusal is a sentence', async () => {
    // The task this screen exists for, tested the way it actually happens: the
    // action does not pre-check the gate, it sends the UPDATE and lets the
    // database answer.
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(OPERATOR, (tx) => publishProjectIn(tx, DRAFT_PROJECT)));

    expect(refusal.code).toBe('SY008');

    // What reaches the screen is a code, a list of items, and a sentence.
    const err = { code: refusal.code, message: refusal.message };
    expect(codeForAdminError(err)).toBe('gate_blocked');

    const missing = missingFromGateError(err);
    expect(missing).toContain('boundary');
    expect(missing).toContain('availability');
    expect(missing.length).toBe(10);

    const sentence = resolveAdminMessage(noCatalogue, 'gate_blocked');
    // A sentence a person can act on - not a stack trace, not "Something went
    // wrong", and not a database identifier.
    expect(sentence).toMatch(/publication gate/i);
    expect(sentence).not.toMatch(/proj\.|SY008|ERROR|permission denied/);
    expect(sentence).not.toContain(DRAFT_PROJECT);
  });

  it('never leaks the raw database message to the reader', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(OPERATOR, (tx) => publishProjectIn(tx, DRAFT_PROJECT)));
    // The raw message names the table's project id. That is for the server log.
    expect(refusal.message).toContain(DRAFT_PROJECT);
    // Nothing that reaches a page carries it: the code and the item list do not.
    const carried = [
      codeForAdminError(refusal),
      ...missingFromGateError(refusal),
    ].join(' ');
    expect(carried).not.toContain(DRAFT_PROJECT);
  });

  it('leaves the project exactly as it was after a refusal', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const before = await tx.one<{ status: string; published_at: string | null }>(
        'SELECT status::text AS status, published_at FROM proj.project WHERE id = $1::uuid',
        [DRAFT_PROJECT]);
      // SY008 aborts the transaction, so the attempt runs inside a savepoint -
      // which is what a real request does not need, because its transaction
      // ends with the failure.
      await tx.query('SAVEPOINT before_publish');
      await expect(publishProjectIn(tx, DRAFT_PROJECT)).rejects.toBeTruthy();
      await tx.query('ROLLBACK TO SAVEPOINT before_publish');

      // The statement was refused by a BEFORE trigger, so the row is untouched.
      // Asserted rather than assumed: a gate that half-published would be worse
      // than one that did not fire.
      const after = await tx.one<{ status: string; published_at: string | null }>(
        'SELECT status::text AS status, published_at FROM proj.project WHERE id = $1::uuid',
        [DRAFT_PROJECT]);
      expect(after.status).toBe(before.status);
      expect(after.published_at).toBe(before.published_at);
    });
  });

  it('succeeds for a project whose gate is complete, and the TRIGGER dates it', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      // Take the complete project back to draft inside this transaction, so the
      // publication path can be exercised on a project that really does satisfy
      // the gate. Rolled back with everything else.
      await tx.query(
        `UPDATE proj.project SET status = 'draft', published_at = NULL
          WHERE id = $1::uuid`, [PUBLISHED_PROJECT]);

      const result = await publishProjectIn(tx, PUBLISHED_PROJECT);
      expect(result.slug).toBe('demo-untere-havel-wetland-restoration');
      // publishProjectIn sets `status` alone; published_at is filled by
      // proj.enforce_publication_gate(). A null here would mean the gate
      // trigger had not run.
      expect(result.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('refuses to publish something already published, without touching it', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      await expect(publishProjectIn(tx, PUBLISHED_PROJECT))
        .rejects.toBeInstanceOf(AlreadyPublishedError);
    });
  });

  it('is refused for a buyer, by PostgreSQL rather than by the page', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(APPROVED_BUYER, (tx) =>
        tx.query(`UPDATE proj.project SET status = 'published' WHERE id = $1::uuid`,
          [DRAFT_PROJECT])));
    // A buyer cannot even see the draft, let alone publish it: the grant is to
    // sylva_operator and to nothing else.
    expect(refusal.code).toBe('42501');
  });
});
