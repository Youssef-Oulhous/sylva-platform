import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { withActor } from '@/lib/db/session';
import {
  MissingRequiredAnswersError,
  draftIn,
  loadDraft,
  loadQuestionnaire,
  loadVettingStatus,
  questionnaireIn,
  saveDraft,
  saveDraftIn,
  submitVettingIn,
  vettingStatusIn,
} from '@/lib/vetting/queries';
import { isAnswered } from '@/lib/vetting/types';
import { codeForVettingError } from '@/lib/vetting/errors';
import { inRolledBackTransaction, refusalOf } from './rollback';

/**
 * The vetting flow, against the real database, as the real roles.
 *
 * The demo fixtures these tests stand on, from db/seed/0001 and db/seed/0002:
 *
 *   DEMO Nordbräu AG        buyer, APPROVED      (a decision is on record)
 *   DEMO Unvetted Trading   buyer, SUBMITTED     (a submission, never decided)
 *   DEMO Sylva Operations   operator
 *
 * "Unvetted" is the one that matters: it has done everything an organisation
 * can do for itself and is still not approved, because approval is not
 * something an organisation can do for itself. That is R6.
 *
 * Every test that WRITES an append-only row runs through
 * inRolledBackTransaction(): the same SQL, the same role, a real signed
 * context, every trigger live, and no COMMIT. See tests/db/rollback.ts for why
 * that is not a shortcut but the only honest option on an append-only table.
 */

const BUYER_QUESTIONNAIRE = '60000000-0000-0000-0000-000000000001';

const APPROVED_BUYER: Actor = {
  kind: 'member',
  role: 'buyer',
  orgId: '0c000000-0000-0000-0000-00000000000c',
  personRef: 'b0000000-0000-0000-0000-0000000000b3',
};

const UNVETTED_BUYER: Actor = {
  kind: 'member',
  role: 'buyer',
  orgId: '14000000-0000-0000-0000-000000000014',
  personRef: 'b0000000-0000-0000-0000-0000000000b9',
};

const OTHER_BUYER: Actor = {
  kind: 'member',
  role: 'buyer',
  orgId: '0d000000-0000-0000-0000-00000000000d',
  personRef: 'b0000000-0000-0000-0000-0000000000b4',
};

const OPERATOR: Actor = {
  kind: 'operator',
  orgId: '10000000-0000-0000-0000-000000000010',
  personRef: 'b0000000-0000-0000-0000-0000000000b7',
};

const PUBLISHED_PROJECT = 'a1000000-0000-0000-0000-000000000001';
const PUBLISHED_PROJECT_OWNER = '0a000000-0000-0000-0000-00000000000a';

/** A complete set of answers to the published buyer questionnaire. */
const FULL_ANSWERS = [
  { questionCode: 'intended_claim', text: 'TEST: a water-related benefit in our catchments.' },
  { questionCode: 'claim_publication', text: 'TEST: our annual sustainability statement.' },
  { questionCode: 'operations', text: 'TEST: three sites, all water-dependent.' },
  { questionCode: 'water_dependence', text: 'TEST: Havel.' },
  { questionCode: 'sustainability', text: 'TEST: a stewardship programme.' },
  { questionCode: 'onward_sale_intent', boolean: false },
  { questionCode: 'offset_use', boolean: false },
  { questionCode: 'exclusivity_needed', boolean: true },
];

/** The draft rows a test writes outside a rolled-back transaction. */
const draftsToClear: Actor[] = [];

afterAll(async () => {
  // org.vetting_draft is deliberately NOT append-only, so a test can and must
  // clean up after itself. This is the only cleanup this file needs.
  for (const actor of draftsToClear) {
    await withActor(actor, (tx) =>
      tx.query('DELETE FROM org.vetting_draft WHERE questionnaire_id = $1', [
        BUYER_QUESTIONNAIRE,
      ]),
    );
  }
  await closeAllPools();
});

/* ====================================================================== */
describe('the questionnaire comes from the database', () => {
  it('loads the published buyer questionnaire, in the order Sylva set', async () => {
    const q = await loadQuestionnaire(UNVETTED_BUYER, 'buyer');
    expect(q).not.toBeNull();
    expect(q!.id).toBe(BUYER_QUESTIONNAIRE);
    expect(q!.roleCode).toBe('buyer');
    expect(q!.questions.length).toBe(8);

    const orders = q!.questions.map((x) => x.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);

    expect(q!.questions[0]!.questionCode).toBe('intended_claim');
    // The prompt is the database's text, not a string in src/.
    expect(q!.questions[0]!.promptEn).toContain('environmental benefit');
  });

  it('carries answer_kind and is_required, which the form and the submit path obey', async () => {
    const q = await loadQuestionnaire(UNVETTED_BUYER, 'buyer');
    const byCode = new Map(q!.questions.map((x) => [x.questionCode, x]));
    expect(byCode.get('onward_sale_intent')!.answerKind).toBe('boolean');
    expect(byCode.get('intended_claim')!.answerKind).toBe('text');
    // The one optional question in the published set.
    expect(byCode.get('water_dependence')!.isRequired).toBe(false);
    expect(byCode.get('sustainability')!.isRequired).toBe(true);
  });

  it('serves a different questionnaire to each transacting role', async () => {
    const buyer = await loadQuestionnaire(UNVETTED_BUYER, 'buyer');
    const owner = await loadQuestionnaire(UNVETTED_BUYER, 'project_owner');
    const investor = await loadQuestionnaire(UNVETTED_BUYER, 'investor');
    const ids = [buyer!.id, owner!.id, investor!.id];
    expect(new Set(ids).size).toBe(3);
    expect(owner!.questions.some((x) => x.questionCode === 'land_control')).toBe(true);
  });
});

/* ====================================================================== */
describe('the draft', () => {
  it('saves and reads back, and is not a submission', async () => {
    draftsToClear.push(UNVETTED_BUYER);

    const { saved } = await saveDraft(UNVETTED_BUYER, {
      questionnaireId: BUYER_QUESTIONNAIRE,
      roleCode: 'buyer',
      personRef: UNVETTED_BUYER.kind === 'member' ? UNVETTED_BUYER.personRef : null,
      answers: [
        { questionCode: 'intended_claim', text: 'TEST draft: a water benefit.' },
        { questionCode: 'onward_sale_intent', boolean: false },
      ],
    });
    expect(saved).toBe(2);

    const draft = await loadDraft(UNVETTED_BUYER, BUYER_QUESTIONNAIRE);
    expect(draft.answers.intended_claim!.text).toBe('TEST draft: a water benefit.');
    expect(draft.answers.onward_sale_intent!.boolean).toBe(false);
    expect(draft.savedAt).not.toBeNull();

    // Saving a draft creates no submission and therefore no approval.
    const status = await loadVettingStatus(UNVETTED_BUYER, 'buyer');
    expect(status.approvalStatus).toBeNull();
  });

  it('replaces rather than merges, so a cleared answer stays cleared', async () => {
    draftsToClear.push(UNVETTED_BUYER);

    const personRef = UNVETTED_BUYER.kind === 'member' ? UNVETTED_BUYER.personRef : null;
    await saveDraft(UNVETTED_BUYER, {
      questionnaireId: BUYER_QUESTIONNAIRE,
      roleCode: 'buyer',
      personRef,
      answers: [
        { questionCode: 'intended_claim', text: 'TEST: first' },
        { questionCode: 'operations', text: 'TEST: second' },
      ],
    });
    await saveDraft(UNVETTED_BUYER, {
      questionnaireId: BUYER_QUESTIONNAIRE,
      roleCode: 'buyer',
      personRef,
      // 'operations' cleared by the person; it must not come back.
      answers: [
        { questionCode: 'intended_claim', text: 'TEST: first' },
        { questionCode: 'operations', text: '   ' },
      ],
    });

    const draft = await loadDraft(UNVETTED_BUYER, BUYER_QUESTIONNAIRE);
    expect(isAnswered(draft.answers.intended_claim)).toBe(true);
    expect(draft.answers.operations).toBeUndefined();
  });

  it('is invisible to every other organisation', async () => {
    draftsToClear.push(UNVETTED_BUYER);

    await saveDraft(UNVETTED_BUYER, {
      questionnaireId: BUYER_QUESTIONNAIRE,
      roleCode: 'buyer',
      personRef: UNVETTED_BUYER.kind === 'member' ? UNVETTED_BUYER.personRef : null,
      answers: [{ questionCode: 'intended_claim', text: 'TEST: private to us.' }],
    });

    // Another buyer, holding a perfectly valid context of its own, sees nothing.
    const theirs = await loadDraft(OTHER_BUYER, BUYER_QUESTIONNAIRE);
    expect(Object.keys(theirs.answers)).toEqual([]);

    // And Sylva holds no privilege on the table at all: an unsubmitted draft is
    // an application that has not been made. Migration 0070 says so in words;
    // this asserts it in the catalogue.
    const grants = await withActor(OPERATOR, (tx) =>
      tx.one<{ can: boolean }>(
        `SELECT has_table_privilege('sylva_operator', 'org.vetting_draft', 'SELECT')
                AS can`,
      ),
    );
    expect(grants.can).toBe(false);
  });
});

/* ====================================================================== */
describe('submitting', () => {
  it('refuses an incomplete questionnaire, naming the questions', async () => {
    const err = await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      try {
        await submitVettingIn(tx, {
          questionnaireId: BUYER_QUESTIONNAIRE,
          roleCode: 'buyer',
          personRef: 'b0000000-0000-0000-0000-0000000000b9',
          answers: [{ questionCode: 'intended_claim', text: 'TEST: only one answer.' }],
        });
        return null;
      } catch (e) {
        return e;
      }
    });

    expect(err).toBeInstanceOf(MissingRequiredAnswersError);
    const missing = (err as MissingRequiredAnswersError).missing;
    expect(missing).toContain('sustainability');
    expect(missing).toContain('offset_use');
    // The optional question is never demanded.
    expect(missing).not.toContain('water_dependence');
  });

  it('required-ness is the database\'s, not the form\'s', async () => {
    // Nothing is passed in that could claim a question is optional: the submit
    // path re-reads org.question. Answering everything the database marks
    // required is sufficient, and answering the optional one is not necessary.
    const result = await inRolledBackTransaction(UNVETTED_BUYER, (tx) =>
      submitVettingIn(tx, {
        questionnaireId: BUYER_QUESTIONNAIRE,
        roleCode: 'buyer',
        personRef: 'b0000000-0000-0000-0000-0000000000b9',
        answers: FULL_ANSWERS.filter((a) => a.questionCode !== 'water_dependence'),
      }),
    );
    expect(result.submissionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes the submission and its answers, and clears the draft', async () => {
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      await saveDraftIn(tx, {
        questionnaireId: BUYER_QUESTIONNAIRE,
        roleCode: 'buyer',
        personRef: 'b0000000-0000-0000-0000-0000000000b9',
        answers: FULL_ANSWERS,
      });
      expect(Object.keys((await draftIn(tx, BUYER_QUESTIONNAIRE)).answers).length)
        .toBe(8);

      const result = await submitVettingIn(tx, {
        questionnaireId: BUYER_QUESTIONNAIRE,
        roleCode: 'buyer',
        personRef: 'b0000000-0000-0000-0000-0000000000b9',
        answers: FULL_ANSWERS,
      });

      const answers = await tx.query<{ question_code: string }>(
        'SELECT question_code FROM org.vetting_answer WHERE submission_id = $1',
        [result.submissionId],
      );
      expect(answers.length).toBe(8);

      // The draft has been superseded by something append-only, so it goes.
      const after = await draftIn(tx, BUYER_QUESTIONNAIRE);
      expect(Object.keys(after.answers)).toEqual([]);
    });
  });

  it('supersedes the previous application, and leaves it visible', async () => {
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      const before = await tx.one<{ n: string }>(
        `SELECT count(*)::text AS n FROM org.vetting_submission
          WHERE role_code = 'buyer'`,
      );

      const result = await submitVettingIn(tx, {
        questionnaireId: BUYER_QUESTIONNAIRE,
        roleCode: 'buyer',
        personRef: 'b0000000-0000-0000-0000-0000000000b9',
        answers: FULL_ANSWERS,
      });

      // The seed gives this organisation one submission already, so the new one
      // must point at it rather than stand beside it.
      expect(result.supersedesId).not.toBeNull();

      const after = await tx.one<{ n: string }>(
        `SELECT count(*)::text AS n FROM org.vetting_submission
          WHERE role_code = 'buyer'`,
      );
      // R4: the old application is still there. Nothing was replaced in place.
      expect(Number(after.n)).toBe(Number(before.n) + 1);

      // And the head of the chain is now the new one.
      const status = await vettingStatusIn(tx, 'buyer');
      expect(status.submission!.id).toBe(result.submissionId);
      expect(status.submission!.supersedesId).toBe(result.supersedesId);
    });
  });

  it('cannot fork the chain: a second submission on the same predecessor is refused', async () => {
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      const head = await tx.one<{ id: string }>(
        `SELECT s.id FROM org.vetting_submission s
          WHERE s.role_code = 'buyer'
            AND NOT EXISTS (SELECT 1 FROM org.vetting_submission x
                             WHERE x.supersedes_id = s.id)
          ORDER BY s.submitted_at DESC LIMIT 1`,
      );

      await tx.query(
        `INSERT INTO org.vetting_submission
           (org_id, role_code, questionnaire_id, supersedes_id)
         VALUES (sylva.actor_org_id(), 'buyer', $1, $2)`,
        [BUYER_QUESTIONNAIRE, head.id],
      );

      const refusal = await refusalOf(() =>
        tx.query(
          `INSERT INTO org.vetting_submission
             (org_id, role_code, questionnaire_id, supersedes_id)
           VALUES (sylva.actor_org_id(), 'buyer', $1, $2)`,
          [BUYER_QUESTIONNAIRE, head.id],
        ),
      );
      expect(refusal.code).toBe('23505');
      // And the application layer turns that into a sentence about the chain,
      // not into "an account already exists for this email address".
      expect(codeForVettingError({ code: refusal.code, constraint: 'vetting_submission_supersedes_id_key' }))
        .toBe('already_submitted');
    });
  });

  it('cannot submit for another organisation, whatever it sends', async () => {
    // The org_id is never a parameter: it is sylva.actor_org_id(), verified
    // against the HMAC. This asserts the policy would refuse it anyway.
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      const refusal = await refusalOf(() =>
        tx.query(
          `INSERT INTO org.vetting_submission (org_id, role_code, questionnaire_id)
           VALUES ($1::uuid, 'buyer', $2)`,
          [APPROVED_BUYER.kind === 'member' ? APPROVED_BUYER.orgId : '', BUYER_QUESTIONNAIRE],
        ),
      );
      // 42501: row-level security refused it.
      expect(refusal.code).toBe('42501');
    });
  });
});

/* ====================================================================== */
describe('R6: submitting is not approval', () => {
  /**
   * The test the whole area exists for.
   *
   * An organisation does everything it can do for itself - answers every
   * question and submits - and is STILL refused a deal, because approval is
   * derived from a decision only sylva_operator can record. The refusal comes
   * from deal.enforce_r6_and_publication(), a trigger, with SQLSTATE SY006.
   */
  it('a complete submission still leaves the organisation unable to create a deal', async () => {
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      const result = await submitVettingIn(tx, {
        questionnaireId: BUYER_QUESTIONNAIRE,
        roleCode: 'buyer',
        personRef: 'b0000000-0000-0000-0000-0000000000b9',
        answers: FULL_ANSWERS,
      });
      expect(result.submissionId).toBeTruthy();

      // Nothing about the approval cache moved.
      const approval = await tx.query(
        `SELECT 1 FROM org.org_role_approval WHERE role_code = 'buyer'`,
      );
      expect(approval.length).toBe(0);

      const vetted = await tx.one<{ ok: boolean }>(
        `SELECT sylva.is_vetted('buyer', sylva.actor_org_id()) AS ok`,
      );
      expect(vetted.ok).toBe(false);

      // And the gate refuses, by trigger, with its own SQLSTATE.
      const refusal = await refusalOf(() =>
        tx.query(
          `INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id)
           VALUES ($1::uuid, $2::uuid, sylva.actor_org_id())`,
          [PUBLISHED_PROJECT, PUBLISHED_PROJECT_OWNER],
        ),
      );
      expect(refusal.code).toBe('SY006');
      expect(refusal.message).toContain('not an approved buyer');
      expect(refusal.message).toContain('no decision on record');
    });
  });

  it('once Sylva records an approval, the same insert is allowed', async () => {
    // The decision is written by the OPERATOR, in its own rolled-back
    // transaction, because only sylva_operator holds INSERT on
    // org.vetting_decision - and because a decision recorded for real would
    // stay on this organisation's record for ever.
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const submission = await tx.one<{ id: string; org_id: string }>(
        `SELECT id, org_id FROM org.vetting_submission
          WHERE org_id = $1::uuid AND role_code = 'buyer'
          ORDER BY submitted_at DESC LIMIT 1`,
        [UNVETTED_BUYER.kind === 'member' ? UNVETTED_BUYER.orgId : ''],
      );

      const before = await tx.query(
        `SELECT 1 FROM org.org_role_approval
          WHERE org_id = $1::uuid AND role_code = 'buyer'`,
        [submission.org_id],
      );
      expect(before.length).toBe(0);

      await tx.query(
        `INSERT INTO org.vetting_decision
           (submission_id, org_id, role_code, decision, reason,
            decided_by_org_id, decided_by_person_ref)
         VALUES ($1::uuid, $2::uuid, 'buyer', 'approved',
                 'TEST: rolled back.', sylva.actor_org_id(), $3::uuid)`,
        [submission.id, submission.org_id, 'b0000000-0000-0000-0000-0000000000b7'],
      );

      // Approval appeared WITHOUT anyone writing it: the trigger derived it.
      const after = await tx.one<{ status: string }>(
        `SELECT status FROM org.org_role_approval
          WHERE org_id = $1::uuid AND role_code = 'buyer'`,
        [submission.org_id],
      );
      expect(after.status).toBe('approved');

      // And the gate that refused a moment ago now lets the deal through.
      const created = await tx.one<{ id: string }>(
        `INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid)
         RETURNING id`,
        [PUBLISHED_PROJECT, PUBLISHED_PROJECT_OWNER, submission.org_id],
      );
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('a suspension takes the gate away again, without retracting anything', async () => {
    await inRolledBackTransaction(OPERATOR, async (tx) => {
      const submission = await tx.one<{ id: string; org_id: string }>(
        `SELECT id, org_id FROM org.vetting_submission
          WHERE org_id = $1::uuid AND role_code = 'buyer'
          ORDER BY submitted_at DESC LIMIT 1`,
        [APPROVED_BUYER.kind === 'member' ? APPROVED_BUYER.orgId : ''],
      );

      await tx.query(
        `INSERT INTO org.vetting_decision
           (submission_id, org_id, role_code, decision, reason,
            decided_by_org_id, decided_by_person_ref)
         VALUES ($1::uuid, $2::uuid, 'buyer', 'suspended',
                 'TEST: rolled back.', sylva.actor_org_id(), $3::uuid)`,
        [submission.id, submission.org_id, 'b0000000-0000-0000-0000-0000000000b7'],
      );

      const status = await tx.one<{ status: string }>(
        `SELECT status FROM org.org_role_approval
          WHERE org_id = $1::uuid AND role_code = 'buyer'`,
        [submission.org_id],
      );
      expect(status.status).toBe('suspended');

      // The earlier approval is still on the record - R4. Two decisions, both
      // visible, newest first.
      const chain = await tx.query<{ decision: string }>(
        `SELECT decision::text AS decision FROM org.vetting_decision
          WHERE org_id = $1::uuid AND role_code = 'buyer'
          ORDER BY decided_at DESC`,
        [submission.org_id],
      );
      expect(chain.map((c) => c.decision)).toContain('approved');
      expect(chain[0]!.decision).toBe('suspended');

      const refusal = await refusalOf(() =>
        tx.query(
          `INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id)
           VALUES ($1::uuid, $2::uuid, $3::uuid)`,
          [PUBLISHED_PROJECT, PUBLISHED_PROJECT_OWNER, submission.org_id],
        ),
      );
      expect(refusal.code).toBe('SY006');
      expect(refusal.message).toContain('suspended');
    });
  });

  it('no application role can write the approval cache directly', async () => {
    // The guard added in migration 0070 states this; this asserts it from the
    // outside, as a buyer holding a real context.
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      const refusal = await refusalOf(() =>
        tx.query(
          `INSERT INTO org.org_role_approval
             (org_id, role_code, status, last_decision_id)
           VALUES (sylva.actor_org_id(), 'buyer', 'approved',
                   '80000000-0000-0000-0000-000000000003'::uuid)`,
        ),
      );
      expect(refusal.code).toBe('42501');
    });
  });
});

/* ====================================================================== */
describe('the status page reads', () => {
  it('derives "submitted" for an organisation with a submission and no decision', async () => {
    const status = await loadVettingStatus(UNVETTED_BUYER, 'buyer');
    expect(status.state).toBe('submitted');
    expect(status.submission).not.toBeNull();
    expect(status.decision).toBeNull();
    expect(status.approvalStatus).toBeNull();
    expect(status.asOfDate).not.toBeNull();
  });

  it('derives "approved" from the decision chain, with the reason Sylva recorded', async () => {
    const status = await loadVettingStatus(APPROVED_BUYER, 'buyer');
    expect(status.state).toBe('approved');
    expect(status.approvalStatus).toBe('approved');
    expect(status.decision!.decision).toBe('approved');
    expect(status.decision!.reason).toContain('DEMO');
    expect(status.history.length).toBeGreaterThan(0);
  });

  it('derives "not_started" for a role the organisation has never applied for', async () => {
    // The buyer has never submitted an investor questionnaire.
    const status = await loadVettingStatus(APPROVED_BUYER, 'investor');
    expect(status.state).toBe('not_started');
    expect(status.submission).toBeNull();
    expect(status.submissionCount).toBe(0);
  });

  it('shows an organisation its own name, and nobody else\'s', async () => {
    const mine = await loadVettingStatus(APPROVED_BUYER, 'buyer');
    expect(mine.organisation!.legalName).toBe('DEMO Nordbräu AG');
    expect(mine.organisation!.id).toBe('0c000000-0000-0000-0000-00000000000c');

    const theirs = await loadVettingStatus(OTHER_BUYER, 'buyer');
    expect(theirs.organisation!.id).toBe('0d000000-0000-0000-0000-00000000000d');
    expect(theirs.organisation!.legalName).not.toBe(mine.organisation!.legalName);

    // org.my_organisation() is scoped to the verified context, so it returns
    // exactly one row and never another organisation's.
    const rows = await withActor(APPROVED_BUYER, (tx) =>
      tx.query('SELECT id FROM org.my_organisation()'),
    );
    expect(rows.length).toBe(1);
  });

  it('still cannot read another organisation\'s submissions or decisions', async () => {
    const rows = await withActor(APPROVED_BUYER, (tx) =>
      tx.query(
        `SELECT 1 FROM org.vetting_submission WHERE org_id = $1::uuid`,
        [UNVETTED_BUYER.kind === 'member' ? UNVETTED_BUYER.orgId : ''],
      ),
    );
    expect(rows.length).toBe(0);
  });

  it('the head of the chain is the application nothing has replaced', async () => {
    await inRolledBackTransaction(UNVETTED_BUYER, async (tx) => {
      const q = await questionnaireIn(tx, 'buyer');
      const first = await vettingStatusIn(tx, 'buyer');

      const result = await submitVettingIn(tx, {
        questionnaireId: q!.id,
        roleCode: 'buyer',
        personRef: 'b0000000-0000-0000-0000-0000000000b9',
        answers: FULL_ANSWERS,
      });

      const second = await vettingStatusIn(tx, 'buyer');
      expect(second.submission!.id).toBe(result.submissionId);
      expect(second.submission!.id).not.toBe(first.submission!.id);
      expect(second.submissionCount).toBe(first.submissionCount + 1);
      // The superseded application is still counted, and still readable.
      expect(second.submission!.supersedesId).toBe(first.submission!.id);
    });
  });
});
