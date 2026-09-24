/**
 * The rows the matrix needs, and the demo seed does not have.
 *
 * db/seed/*.sql gives us organisations, people, vetting, two published
 * projects, a draft project, documents and buyer sites. It gives us no deals,
 * no messages, no terms, no questions, no record entries and no investor
 * financials - which are exactly the tables where "one buyer seeing another
 * buyer's prices or terms" would happen. So the matrix creates them.
 *
 * Three properties this file is built for:
 *
 *  - Written through the REAL write path. Everything goes through
 *    withActor({kind:'operator'}) - the same transaction shape, the same
 *    privilege role, the same triggers as production. Nothing is inserted as
 *    the superuser, so a fixture that cannot be created is itself a finding.
 *
 *  - Idempotent. Most of these tables are append-only: UPDATE and DELETE are
 *    revoked and trigger-blocked, so a fixture can be created but never tidied
 *    away. Every statement is therefore a no-op on a second run.
 *
 *  - Obvious in the data. Every value says DEMO and says it is a fixture, so
 *    nobody mistakes one for pilot data on the /record page.
 */
import { withActor } from '@/lib/db/session';
import { actorFor } from './principals';
import {
  DEAL, DEAL_DOCUMENT, DEAL_DOCUMENT_VERSION, FIXTURE_SOURCE_REF, ORG, PERIOD,
  PERSON, PROJECT, RECORD_ENTRY, TERMS, UNIT_TYPE,
} from './catalog';

const OPERATOR = actorFor('operator');

let done: Promise<void> | null = null;

/** Create the fixtures once per process. Safe to call from every test file. */
export function ensureFixtures(): Promise<void> {
  done ??= build();
  return done;
}

async function build(): Promise<void> {
  await withActor(OPERATOR, async (tx) => {
    // -- provenance first: source_ref_id is NOT NULL wherever a figure lands --
    await tx.query(
      `INSERT INTO sylva.source_ref (id, kind, label, locator, as_of_date)
       VALUES ($1, 'operator_statement',
               'DEMO row-level security matrix fixture, created by tests/rls', NULL, DATE '2026-09-24')
       ON CONFLICT (id) DO NOTHING`,
      [FIXTURE_SOURCE_REF],
    );

    // ------------------------------------------------------------- deals --
    // Two deals that must never see each other. The R6 trigger checks that
    // each buyer is an approved organisation and that the project is
    // published; the pseudonym trigger allocates a per-deal label.
    await tx.query(
      `INSERT INTO deal.deal (id, project_id, owner_org_id, buyer_org_id, intended_shape)
       VALUES ($1, $2, $3, $4, 'forward')
       ON CONFLICT (id) DO NOTHING`,
      [DEAL.a, PROJECT.p1, ORG.ownerA, ORG.buyerA],
    );
    await tx.query(
      `INSERT INTO deal.deal (id, project_id, owner_org_id, buyer_org_id, intended_shape)
       VALUES ($1, $2, $3, $4, 'spot')
       ON CONFLICT (id) DO NOTHING`,
      [DEAL.b, PROJECT.p2, ORG.ownerB, ORG.buyerB],
    );

    // ---------------------------------------------------------- messages --
    for (const [dealId, projectId, buyerOrg, ownerOrg, person, body] of [
      [DEAL.a, PROJECT.p1, ORG.buyerA, ORG.ownerA, PERSON.buyerA,
       'DEMO fixture: Buyer A asks Owner A about the 2028 period. Private to this deal.'],
      [DEAL.b, PROJECT.p2, ORG.buyerB, ORG.ownerB, PERSON.buyerB,
       'DEMO fixture: Buyer B asks Owner B about the 2029 period. Private to this deal.'],
    ] as const) {
      await tx.query(
        `INSERT INTO deal.deal_message
           (deal_id, project_id, buyer_org_id, owner_org_id, sender_org_id, sender_person_ref, body)
         SELECT $1, $2, $3, $4, $3, $5, $6
          WHERE NOT EXISTS (SELECT 1 FROM deal.deal_message m WHERE m.deal_id = $1)`,
        [dealId, projectId, buyerOrg, ownerOrg, person, body],
      );
    }

    // ------------------------------------------------------------- terms --
    // The prices the client says must never cross between buyers.
    await tx.query(
      `INSERT INTO deal.deal_terms_version
         (id, deal_id, project_id, buyer_org_id, owner_org_id, version_no,
          unit_type_id, period_id, deal_shape, amount_raw,
          price_amount, price_basis, price_currency, proposed_by_org_id, source_ref_id)
       VALUES ($1, $2, $3, $4, $5, 1, $6, $7, 'forward', 1200, 41.50, 'per_unit', 'EUR', $4, $8)
       ON CONFLICT (id) DO NOTHING`,
      [TERMS.a, DEAL.a, PROJECT.p1, ORG.buyerA, ORG.ownerA,
       UNIT_TYPE.p1, PERIOD.p1, FIXTURE_SOURCE_REF],
    );
    await tx.query(
      `INSERT INTO deal.deal_terms_version
         (id, deal_id, project_id, buyer_org_id, owner_org_id, version_no,
          unit_type_id, period_id, deal_shape, amount_raw,
          price_amount, price_basis, price_currency, proposed_by_org_id, source_ref_id)
       VALUES ($1, $2, $3, $4, $5, 1, $6, $7, 'spot', 90, 128.00, 'per_unit', 'EUR', $4, $8)
       ON CONFLICT (id) DO NOTHING`,
      [TERMS.b, DEAL.b, PROJECT.p2, ORG.buyerB, ORG.ownerB,
       UNIT_TYPE.p2, PERIOD.p2, FIXTURE_SOURCE_REF],
    );

    // --------------------------------------------------------- questions --
    // The private question box. Three askers so the matrix can show that an
    // investor's question is not visible to a buyer and the other way round.
    for (const [projectId, ownerOrg, askerOrg, person, body] of [
      [PROJECT.p1, ORG.ownerA, ORG.buyerA, PERSON.buyerA,
       'DEMO fixture: Buyer A asks about claim rights on project 1.'],
      [PROJECT.p1, ORG.ownerA, ORG.investorA, PERSON.investorA,
       'DEMO fixture: Investor A asks about the financing need on project 1.'],
      [PROJECT.p2, ORG.ownerB, ORG.buyerB, PERSON.buyerB,
       'DEMO fixture: Buyer B asks about durability on project 2.'],
    ] as const) {
      await tx.query(
        `INSERT INTO deal.project_question
           (project_id, owner_org_id, asker_org_id, asker_person_ref, body)
         SELECT $1, $2, $3, $4, $5
          WHERE NOT EXISTS (SELECT 1 FROM deal.project_question q
                             WHERE q.project_id = $1 AND q.asker_org_id = $3)`,
        [projectId, ownerOrg, askerOrg, person, body],
      );
    }

    // -------------------------------------------------- deal documents --
    // visibility = 'deal_participants'. The counterparties are denormalised
    // onto the row and held honest by a composite foreign key to the deal.
    for (const [docId, verId, dealId, projectId, buyerOrg, ownerOrg, key] of [
      [DEAL_DOCUMENT.a, DEAL_DOCUMENT_VERSION.a, DEAL.a, PROJECT.p1, ORG.buyerA, ORG.ownerA, 'demo/loi-deal-a.pdf'],
      [DEAL_DOCUMENT.b, DEAL_DOCUMENT_VERSION.b, DEAL.b, PROJECT.p2, ORG.buyerB, ORG.ownerB, 'demo/loi-deal-b.pdf'],
    ] as const) {
      await tx.query(
        `INSERT INTO doc.document
           (id, scope, kind, visibility, project_id, deal_id, deal_buyer_org_id, deal_owner_org_id)
         VALUES ($1, 'deal', 'letter_of_intent', 'deal_participants', $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [docId, projectId, dealId, buyerOrg, ownerOrg],
      );
      await tx.query(
        `INSERT INTO doc.document_version
           (id, document_id, version_no, storage_region, storage_bucket, storage_key,
            content_sha256, byte_size, media_type, locale, uploaded_by_org_id, uploaded_by_person_ref)
         VALUES ($1, $2, 1, 'eu-central-1', 'sylva-demo-documents', $3::text,
                 sha256(convert_to($3::text, 'UTF8')), 44000, 'application/pdf', 'en', $4, NULL)
         ON CONFLICT (id) DO NOTHING`,
        [verId, docId, key, ownerOrg],
      );
    }

    // ----------------------------------------------- investor financials --
    // "Financing need, revenue streams, the financial model. Visible only to
    // investors we have vetted."
    for (const [projectId, need, note] of [
      [PROJECT.p1, 2400000, 'DEMO fixture: grant tranche plus forward sales of the 2028 period.'],
      [PROJECT.p2, 1750000, 'DEMO fixture: co-investment plus spot sales of the 2029 period.'],
    ] as const) {
      await tx.query(
        `INSERT INTO proj.project_financials
           (project_id, version_no, financing_need, currency, revenue_streams_note,
            source_ref_id, as_of_date)
         VALUES ($1, 1, $2, 'EUR', $3, $4, DATE '2026-09-24')
         ON CONFLICT DO NOTHING`,
        [projectId, need, note, FIXTURE_SOURCE_REF],
      );
    }

    // --------------------------------------------------------- the record --
    // One public-side entry per project and one deal-side entry per deal, so
    // the matrix can show that a buyer reaches its own deal's entries and not
    // the other buyer's.
    for (const [publicId, entryType, projectId, dealId, buyerOrg, ownerOrg, actorOrg, role, person] of [
      [RECORD_ENTRY.listedP1, 'listed', PROJECT.p1, null, null, null, ORG.ownerA, 'project_owner', PERSON.ownerA],
      [RECORD_ENTRY.listedP2, 'listed', PROJECT.p2, null, null, null, ORG.ownerB, 'project_owner', PERSON.ownerB],
      [RECORD_ENTRY.interestDealA, 'interest_expressed', PROJECT.p1, DEAL.a, ORG.buyerA, ORG.ownerA, ORG.buyerA, 'buyer', PERSON.buyerA],
      [RECORD_ENTRY.interestDealB, 'interest_expressed', PROJECT.p2, DEAL.b, ORG.buyerB, ORG.ownerB, ORG.buyerB, 'buyer', PERSON.buyerB],
    ] as const) {
      await tx.query(
        `INSERT INTO record.entry
           (public_id, entry_type, project_id, deal_id, deal_buyer_org_id, deal_owner_org_id,
            actor_org_id, actor_role_snapshot, actor_person_ref, actor_person_label,
            source_ref_id, detail)
         VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7, $8, $9, 'representative #1', $10,
                 '{"fixture":"tests/rls"}'::jsonb)
         ON CONFLICT (public_id) DO NOTHING`,
        [publicId, entryType, projectId, dealId, buyerOrg, ownerOrg, actorOrg, role, person, FIXTURE_SOURCE_REF],
      );
    }
  });
}
