import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/db/actor';
import { closeAllPools } from '@/lib/db/pool';
import { readAs } from '@/lib/db/session';
import { IncomparableUnitsError, sumSameUnit } from '@/lib/units/qty';
import { formerMemberText, resolvePerson } from '@/lib/auditor/people';
import {
  AUDITOR_GUARDS,
  logAuditorAccess,
  readAuditorAccessLog,
  readAuditorDeals,
  readAuditorFilterOptions,
  readAuditorOrganisations,
  readAuditorOverview,
  readAuditorProject,
  readAuditorProjects,
  readAuditorRecord,
  runAuditorGuards,
} from '@/lib/auditor/queries';
import { ORG, PERSON } from '../rls/catalog';
import { inRolledBackTransaction, refusalOf } from './rollback';

/**
 * The auditor's view, against the real database as the real role.
 *
 * The centrepiece is the write suite: every statement below is attempted as
 * sylva_auditor, through withActor(), with a valid signed context - the same
 * path the application uses - and every one must be refused by PostgreSQL on
 * privilege. They run inside a transaction that is always rolled back, because
 * a probe that succeeded on an append-only table could not be undone.
 */

const AUDITOR: Actor = {
  kind: 'auditor',
  orgId: ORG.auditor,
  personRef: PERSON.auditor,
};

const BUYER_A: Actor = {
  kind: 'member',
  role: 'buyer',
  orgId: ORG.buyerA,
  personRef: PERSON.buyerA,
};

afterAll(async () => { await closeAllPools(); });

/* ====================================================================== */
/*  READ-ONLY AT THE DATABASE LEVEL                                        */
/* ====================================================================== */

describe('the auditor role is read-only, and the database says so', () => {
  it('ci.assert_auditor_is_read_only() passes, called as the auditor itself', async () => {
    // The guard the page prints. It reads information_schema and raises if
    // sylva_auditor holds any privilege other than SELECT on any table or any
    // column, so a later migration that grants the auditor an INSERT fails
    // here rather than being discovered in production.
    await expect(
      readAs(AUDITOR, (tx) => tx.query('SELECT ci.assert_auditor_is_read_only()')),
    ).resolves.toBeDefined();
  });

  it('runs the three guarantees the view claims, and all pass', async () => {
    const guards = await runAuditorGuards(AUDITOR);
    expect(guards.map((g) => g.name)).toEqual([...AUDITOR_GUARDS]);
    for (const g of guards) {
      expect(g.ok, `${g.name}: ${g.detail ?? ''}`).toBe(true);
      expect(g.detail).toBeNull();
    }
  });

  /**
   * One case per verb per kind of table. 42501 is PostgreSQL's
   * insufficient_privilege: the role holds no such grant, and the refusal
   * happens before any row is looked at.
   */
  const writes: { what: string; sql: string; params?: unknown[] }[] = [
    {
      what: 'INSERT into the record',
      sql: `INSERT INTO record.entry
              (entry_type, occurred_at, project_id, actor_org_id,
               actor_role_snapshot, actor_person_label, detail)
            VALUES ('listed', now(),
                    (SELECT id FROM proj.project LIMIT 1),
                    $1::uuid, 'auditor', 'x', '{}'::jsonb)`,
      params: [ORG.auditor],
    },
    {
      what: 'INSERT an organisation',
      sql: `INSERT INTO org.organisation
              (legal_name, country_code, sector_code, size_band_code)
            VALUES ('AUDITOR SHOULD NOT BE ABLE TO DO THIS', 'DE',
                    (SELECT code FROM platform.sector LIMIT 1),
                    (SELECT code FROM platform.size_band LIMIT 1))`,
    },
    {
      what: 'INSERT a source reference',
      sql: `INSERT INTO sylva.source_ref (kind, label, as_of_date)
            VALUES ('operator_statement', 'x', current_date)`,
    },
    {
      what: 'INSERT a document',
      sql: `INSERT INTO doc.document (scope, kind, visibility, project_id)
            VALUES ('project', 'other', 'public',
                    (SELECT id FROM proj.project LIMIT 1))`,
    },
    {
      what: 'INSERT a deal',
      sql: `INSERT INTO deal.deal (project_id, owner_org_id, buyer_org_id, stage)
            VALUES ((SELECT id FROM proj.project LIMIT 1), $1::uuid, $2::uuid,
                    'interest_expressed')`,
      params: [ORG.ownerA, ORG.buyerA],
    },
    {
      what: 'INSERT a vetting decision',
      sql: `INSERT INTO org.vetting_decision
              (submission_id, org_id, role_code, decision, decided_by_org_id)
            VALUES ((SELECT id FROM org.vetting_submission LIMIT 1),
                    $1::uuid, 'buyer', 'approved', $2::uuid)`,
      params: [ORG.buyerA, ORG.operator],
    },
    {
      what: 'INSERT into the access log directly',
      // The auditor may ASK the platform to log a read, through a SECURITY
      // DEFINER function. It may not write the log itself, which is what
      // keeps the log evidence rather than testimony.
      sql: `INSERT INTO record.access_log (actor_db_role, action)
            VALUES ('sylva_auditor', 'forged')`,
    },
    {
      what: 'UPDATE a project status',
      sql: `UPDATE proj.project SET status = 'published'`,
    },
    {
      what: 'UPDATE an account',
      sql: `UPDATE identity.user_account SET full_name = 'changed'`,
    },
    {
      what: 'UPDATE an organisation name',
      sql: `UPDATE org.organisation SET legal_name = 'changed'`,
    },
    { what: 'DELETE a record entry', sql: `DELETE FROM record.entry` },
    { what: 'DELETE a buyer site', sql: `DELETE FROM geo.buyer_site` },
    { what: 'DELETE a document version', sql: `DELETE FROM doc.document_version` },
    { what: 'DELETE an organisation', sql: `DELETE FROM org.organisation` },
    { what: 'TRUNCATE the record', sql: `TRUNCATE record.entry` },
  ];

  it.each(writes)('refuses to $what', async ({ sql, params }) => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(AUDITOR, (tx) => tx.query(sql, params ?? [])),
    );
    // 42501 insufficient_privilege. Not a trigger, not a policy: the grant
    // itself is absent, which is the strongest of the three.
    expect(refusal.code).toBe('42501');
  });

  it('cannot even read the signing key that makes a context unforgeable', async () => {
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(AUDITOR, (tx) =>
        tx.query('SELECT key FROM sylva.context_key'),
      ),
    );
    expect(refusal.code).toBe('42501');
  });
});

/* ====================================================================== */
/*  WHAT THE AUDITOR SEES THAT NOBODY ELSE DOES                            */
/* ====================================================================== */

describe('the auditor reads across organisations', () => {
  it('sees every record entry, where a buyer sees only its own', async () => {
    const asAuditor = await readAs(AUDITOR, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.entry'),
    );
    const asBuyer = await readAs(BUYER_A, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.entry'),
    );
    expect(Number(asAuditor.n)).toBeGreaterThan(Number(asBuyer.n));
    expect(Number(asBuyer.n)).toBeGreaterThan(0);
  });

  it('reads organisation legal names, which no public-facing role may', async () => {
    const orgs = await readAuditorOrganisations(AUDITOR);
    expect(orgs.length).toBeGreaterThan(5);
    expect(orgs.every((o) => o.legalName.trim().length > 0)).toBe(true);

    // R5: the same column is refused to a buyer by column-level grant, so no
    // bug in any template can leak a name.
    const refusal = await refusalOf(() =>
      inRolledBackTransaction(BUYER_A, (tx) =>
        tx.query('SELECT legal_name FROM org.organisation'),
      ),
    );
    expect(refusal.code).toBe('42501');
  });

  it('sees unpublished projects, and what the publication gate would refuse', async () => {
    const projects = await readAuditorProjects(AUDITOR, 'en');
    const published = projects.filter((p) => p.status === 'published');
    const unpublished = projects.filter((p) => p.status !== 'published');

    expect(published.length).toBeGreaterThan(0);
    expect(unpublished.length).toBeGreaterThan(0);

    // The gate is a database function, so a published project has nothing
    // outstanding by construction. If this ever fails, publication was not
    // going through proj.enforce_publication_gate().
    for (const p of published) expect(p.gaps).toEqual([]);
    // And at least one draft is short of something, or the gate is not a gate.
    expect(unpublished.some((p) => p.gaps.length > 0)).toBe(true);
  });

  it('marks each entry with whether the public record reaches it', async () => {
    const page = await readAuditorRecord(AUDITOR, {
      locale: 'en', projectSlug: null, entryType: null, page: 1, pageSize: 200,
    });
    expect(page.entries.length).toBeGreaterThan(0);

    const publicHere = page.entries.filter((e) => e.onPublicRecord).length;
    const inTheView = await readAs(AUDITOR, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.v_public_entry'),
    );
    // The flag is not a guess: it is EXISTS against the view the public page
    // reads, so the two must agree exactly.
    expect(publicHere).toBe(Number(inTheView.n));

    // And nothing was filtered out on the way: the page holds the whole table.
    const total = await readAs(AUDITOR, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.entry'),
    );
    expect(page.entryCount).toBe(Number(total.n));
  });

  it('offers every entry type as a filter, not only the public ones', async () => {
    const options = await readAuditorFilterOptions(AUDITOR, 'en');
    const all = await readAs(AUDITOR, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.entry_type'),
    );
    expect(options.entryTypes.length).toBe(Number(all.n));
    // Drafts are filterable too; the public filter lists published projects.
    expect(options.projects.some((p) => p.status !== 'published')).toBe(true);
  });

  it('names both parties to a deal AND the label the public record shows', async () => {
    const { deals } = await readAuditorDeals(AUDITOR, 'en');
    expect(deals.length).toBeGreaterThan(0);
    for (const d of deals) {
      expect(d.buyerOrgName.trim().length).toBeGreaterThan(0);
      expect(d.ownerOrgName.trim().length).toBeGreaterThan(0);
    }
    // At least one undisclosed deal, or R5 has nothing to protect in the demo
    // data and this test proves nothing.
    expect(deals.some((d) => !d.disclosed)).toBe(true);
  });
});

/* ====================================================================== */
/*  ERASURE, AND WHY A MISSING NAME IS NOT TAMPERING                       */
/* ====================================================================== */

describe('erasure narrows what the auditor can name', () => {
  it('the record holds no foreign key into identity, so erasure cannot cascade', async () => {
    // This is the invariant the whole erasure design rests on. With a foreign
    // key, ON DELETE RESTRICT makes a person undeletable and CASCADE destroys
    // the record; the absence of one is what lets R4 and the right to erasure
    // coexist. See docs/DECISIONS.md D3.
    await expect(
      readAs(AUDITOR, (tx) => tx.query('SELECT ci.assert_no_fk_into_identity()')),
    ).resolves.toBeDefined();
  });

  it('a person_ref with no account resolves to nothing rather than to an error', async () => {
    // The mechanism the page depends on, exercised directly: the join that
    // resolves a name is a LEFT JOIN on a column with no FK behind it, so an
    // erased person produces a null name and the entry is otherwise intact.
    const row = await readAs(AUDITOR, (tx) =>
      tx.one<{ full_name: string | null }>(
        `SELECT u.full_name
           FROM (VALUES ('00000000-0000-0000-0000-0000000000ff'::uuid)) AS v(person_ref)
           LEFT JOIN identity.user_account u ON u.person_ref = v.person_ref`,
      ),
    );
    expect(row.full_name).toBeNull();
  });

  it('renders an unresolved person as a former member of a named organisation', () => {
    const erased = resolvePerson({
      orgId: ORG.buyerA,
      orgName: 'DEMO Nordbräu AG',
      roleAtTime: 'buyer',
      personRef: PERSON.buyerA,
      personName: null,
      personLabel: 'representative #1',
    });
    expect(erased.kind).toBe('erased');
    expect(formerMemberText('Former member', 'DEMO Nordbräu AG', 'Unknown'))
      .toBe('Former member — DEMO Nordbräu AG');
  });

  it('distinguishes an erased person from an entry that never had one', () => {
    const none = resolvePerson({
      orgId: ORG.operator, orgName: 'DEMO Sylva Operations', roleAtTime: 'operator',
      personRef: null, personName: null, personLabel: 'Sylva operations',
    });
    expect(none.kind).toBe('none');

    const named = resolvePerson({
      orgId: ORG.operator, orgName: 'DEMO Sylva Operations', roleAtTime: 'operator',
      personRef: PERSON.operator, personName: 'DEMO Operator', personLabel: 'x',
    });
    expect(named.kind).toBe('named');
  });

  it('counts the people the record names who no longer have an account', async () => {
    const overview = await readAuditorOverview(AUDITOR);
    // A number, whatever it is. The page states it rather than leaving blank
    // cells to be interpreted.
    expect(Number.isInteger(overview.unresolvedPeople)).toBe(true);
    expect(overview.unresolvedPeople).toBeGreaterThanOrEqual(0);
    expect(overview.entries).toBeGreaterThanOrEqual(overview.publicEntries);
    expect(overview.entriesNotOnPublicRecord)
      .toBe(overview.entries - overview.publicEntries);
  });
});

/* ====================================================================== */
/*  PROVENANCE AND RULE 7                                                  */
/* ====================================================================== */

describe('every figure keeps its source, and no figure is added across projects', () => {
  it('stamps each availability figure with a source, a date and a unit label', async () => {
    const detail = await readAuditorProject(
      AUDITOR, 'demo-untere-havel-wetland-restoration', 'en',
    );
    expect(detail).not.toBeNull();
    expect(detail!.availability.length).toBeGreaterThan(0);
    for (const a of detail!.availability) {
      expect(a.source.label).toBeTruthy();
      expect(a.source.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.unitLabel).toBeTruthy();
    }
    for (const p of detail!.parties) expect(p.source.label).toBeTruthy();
    for (const g of detail!.geometry) expect(g.source.label).toBeTruthy();
  });

  it('RULE 7: a total across two projects throws, within one project does not', async () => {
    const a = await readAuditorProject(
      AUDITOR, 'demo-untere-havel-wetland-restoration', 'en',
    );
    const b = await readAuditorProject(
      AUDITOR, 'demo-marais-de-briere-restoration', 'en',
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    const mixed = [...a!.availability, ...b!.availability].map((x) => x.remaining);
    expect(mixed.length).toBeGreaterThan(1);
    expect(() => sumSameUnit(mixed)).toThrow(IncomparableUnitsError);

    const withinA = a!.availability.map((x) => x.remaining);
    expect(sumSameUnit(withinA)).not.toBeNull();
  });

  it('carries a document version its content hash and its storage region', async () => {
    const detail = await readAuditorProject(
      AUDITOR, 'demo-untere-havel-wetland-restoration', 'en',
    );
    const versions = detail!.documents.flatMap((d) => d.versions);
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(v.contentSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(v.storageRegion).toBeTruthy();
      // EU hosting is a foreign key, not a policy: a region that is not in an
      // EU member state cannot exist in platform.storage_region.
      expect(v.storageMemberState).toBeTruthy();
    }
  });
});

/* ====================================================================== */
/*  THE ACCESS LOG                                                         */
/* ====================================================================== */

describe('an auditor read is itself recorded', () => {
  it('may call the logging function, and the row names the real caller', async () => {
    // Inside a rolled-back transaction, so a test run leaves no line in an
    // append-only log that could never be removed.
    const row = await inRolledBackTransaction(AUDITOR, async (tx) => {
      await tx.query(
        `SELECT record.log_access('test.auditor', 'test', null,
            jsonb_build_object('caller_role', current_user))`,
      );
      return tx.one<{ caller_role: string; actor_db_role: string; org: string | null }>(
        `SELECT al.detail ->> 'caller_role' AS caller_role,
                al.actor_db_role,
                al.actor_org_id::text AS org
           FROM record.access_log al
          WHERE al.action = 'test.auditor'
          ORDER BY al.entry_no DESC LIMIT 1`,
      );
    });

    // current_user as an ARGUMENT is evaluated in the caller's context.
    expect(row.caller_role).toBe('sylva_auditor');
    // ...and the same expression read INSIDE the SECURITY DEFINER function is
    // not. That is FINDING-005, asserted here so the day it is fixed this
    // test fails and says so rather than the defect quietly persisting.
    expect(row.actor_db_role).not.toBe('sylva_auditor');
    // The organisation comes from the signed context and is correct.
    expect(row.org).toBe(ORG.auditor);
  });

  it('does not log for an actor who is not an auditor', async () => {
    const before = await readAs(AUDITOR, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.access_log'),
    );
    await logAuditorAccess(BUYER_A, 'auditor.overview');
    const after = await readAs(AUDITOR, (tx) =>
      tx.one<{ n: string }>('SELECT count(*)::text AS n FROM record.access_log'),
    );
    expect(after.n).toBe(before.n);
  });

  it('reads the log back, newest first', async () => {
    const rows = await readAuditorAccessLog(AUDITOR, 10);
    expect(Array.isArray(rows)).toBe(true);
    for (let i = 1; i < rows.length; i += 1) {
      expect(new Date(rows[i - 1]!.at).getTime())
        .toBeGreaterThanOrEqual(new Date(rows[i]!.at).getTime());
    }
  });
});
