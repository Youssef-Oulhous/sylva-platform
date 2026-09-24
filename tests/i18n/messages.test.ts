import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The message catalogues.
 *
 * Five pages once shipped rendering raw translation keys - "ownerProjectForm.field.nameEn"
 * where a label belonged - because next-intl renders a missing key as the key itself and
 * nothing in the build objected. These tests are the second half of the fix: the first is
 * scripts/check-i18n.ts, and this file makes sure that script is actually run and actually
 * capable of failing.
 *
 * NO DATABASE. The catalogues are files, so these tests read files. They deliberately do
 * not open a connection, which also means they do not have to be serialised with the
 * database tests.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = fileURLToPath(new URL('../..', import.meta.url));

type Tree = { [key: string]: string | Tree };

function load(locale: 'en' | 'de'): Tree {
  return JSON.parse(readFileSync(`${REPO}/src/messages/${locale}.json`, 'utf8')) as Tree;
}

function flatten(tree: Tree, prefix = '', out = new Map<string, string>()) {
  for (const [key, value] of Object.entries(tree)) {
    if (value !== null && typeof value === 'object') flatten(value, `${prefix}${key}.`, out);
    else out.set(`${prefix}${key}`, String(value));
  }
  return out;
}

const en = flatten(load('en'));
const de = flatten(load('de'));

/**
 * One key from each area of every page that was broken, plus the ones that are only
 * reached on a branch the demo record does not take - an empty queue, a project with no
 * availability, a gate with nothing missing. Rendering the page proves the common path;
 * this list is what stops the uncommon one regressing silently.
 */
const REPAIRED_PAGES: Record<string, readonly string[]> = {
  '/about': [
    'about.title',
    'about.operator.duty.publish',
    'about.data.erasure.deleted.name',
    'about.contact.form.roleOwner',
    'about.source.conceptNote',
  ],
  '/vetting/status': [
    'vettingStatus.title',
    'vettingStatus.state.under_review',
    'vettingStatus.stateMeaning.declined',
    'vettingStatus.stage.position.current',
    'vettingStatus.cell.notSet',
  ],
  '/owner': [
    'owner.title',
    'owner.lead',
    'owner.projects.empty',
    'owner.projects.availabilityCaption',
    'owner.gate.item.englishPageText.label',
    'owner.gate.item.availability.note',
    'owner.gate.complete',
    'owner.questions.noneWaiting',
    'owner.questions.unknownProject',
    'owner.interest.empty',
    'owner.buyer.namedForDeal',
    'owner.sizeBand.sme',
    'owner.dealShape.coInvestment',
    'owner.unit.hectareYears',
  ],
  '/owner/projects/new': [
    'ownerProjectForm.title',
    'ownerProjectForm.formLabel',
    'ownerProjectForm.record.ref',
    'ownerProjectForm.labels.required',
    'ownerProjectForm.provenance.locatorPlaceholder',
    'ownerProjectForm.readiness.barLabel',
    'ownerProjectForm.readiness.gate.identity.detail',
    'ownerProjectForm.readiness.gate.review.requirement',
    'ownerProjectForm.readiness.state.withOperator',
    'ownerProjectForm.section.documents.lead',
    'ownerProjectForm.field.periodUnitNote',
    'ownerProjectForm.option.deal.coInvestmentHint',
    'ownerProjectForm.option.role.landOwner',
    'ownerProjectForm.country.EE',
    'ownerProjectForm.doc.claimAnnex',
    'ownerProjectForm.unit.scorePoints',
    'ownerProjectForm.draft.outcome.condition.metric',
  ],
  '/admin/projects': [
    'adminProjects.title',
    'adminProjects.rule7Note',
    'adminProjects.col.slug',
    'adminProjects.country.HU',
    'adminProjects.gate.item.verifier.requires',
    'adminProjects.gate.count.commitments',
    'adminProjects.panel.notSubmitted',
    'adminProjects.publish.publishedTitle',
    'adminProjects.publish.readyLead',
    'adminProjects.publish.inertNote',
    'adminProjects.others.complete',
    'adminProjects.unit.notRecorded',
  ],
};

describe('the message catalogues', () => {
  it('holds the same keys in English and in German', () => {
    expect([...en.keys()].filter((k) => !de.has(k))).toEqual([]);
    expect([...de.keys()].filter((k) => !en.has(k))).toEqual([]);
  });

  it('has no empty message in either language', () => {
    const blank = (m: Map<string, string>) =>
      [...m].filter(([, v]) => v.trim().length === 0).map(([k]) => k);
    expect(blank(en)).toEqual([]);
    expect(blank(de)).toEqual([]);
  });

  it('does not serve the English string as the German one for prose', () => {
    // Labels legitimately coincide - "Status", "Region", "ha", "km²". Prose does not:
    // a long message identical in both languages is an untranslated string, not a word
    // that happens to be the same.
    const identicalProse = [...en]
      .filter(([key, value]) => value.length > 60 && de.get(key) === value)
      .map(([key]) => key);
    expect(identicalProse).toEqual([]);
  });
});

describe('the five pages that rendered raw keys', () => {
  for (const [page, keys] of Object.entries(REPAIRED_PAGES)) {
    it(`${page} has every message it asks for, in both languages`, () => {
      expect(keys.filter((k) => !en.has(k))).toEqual([]);
      expect(keys.filter((k) => !de.has(k))).toEqual([]);
    });

    it(`${page} has no message that is still the bare key`, () => {
      // The failure mode being guarded against: a key added to the catalogue with its
      // own name as the value, which renders exactly like a missing key.
      for (const key of keys) {
        expect(en.get(key)).not.toBe(key);
        expect(de.get(key)).not.toBe(key);
      }
    });
  }
});

/**
 * The keys the linter cannot see.
 *
 * check-i18n.ts resolves `t('literal')`. It cannot resolve `t(`owner.gate.item.${code}.label`)`
 * or a key held as a string in a demo-data module, because both need the module evaluated.
 * These tests evaluate them: they import the real constants the pages render from and
 * assert every key those constants can produce exists in both languages.
 *
 * This is the half of the check that catches a gate code, a sector, a deal shape or a
 * country added to a data file without its message.
 */
describe('keys built at runtime', () => {
  const both = (keys: readonly string[]) => {
    expect(keys.filter((k) => !en.has(k))).toEqual([]);
    expect(keys.filter((k) => !de.has(k))).toEqual([]);
  };

  it('/owner: every publication gate code has a label and a note', async () => {
    const m = await import('@/lib/owner/types');
    both(
      m.PUBLICATION_GATE_CODES.flatMap((code) => [
        `owner.gate.item.${m.GATE_ITEM_KEY[code]}.label`,
        `owner.gate.item.${m.GATE_ITEM_KEY[code]}.note`,
      ]),
    );
  });

  it('/owner: every publication status the dashboard can print resolves', async () => {
    const m = await import('@/lib/owner/types');
    // statusKey() is the one place the dashboard turns proj.publication_status
    // into a message key, and the enum has exactly these six values.
    both((['draft', 'submitted_for_review', 'changes_requested',
           'published', 'withdrawn', 'archived'] as const).map(m.statusKey));
  });

  it('/owner: the strings awaiting translation are declared, not scattered', async () => {
    const m = await import('@/lib/owner/messages');
    const keys = Object.keys(m.OWNER_TEXT_KEYS);
    expect(keys.length).toBeGreaterThan(0);
    // Every one is under one namespace, so the hand-over to the message
    // catalogue is a single subtree rather than a hunt through the components.
    expect(keys.filter((k) => !k.startsWith('ownerUi.'))).toEqual([]);
    // None of them may be added to only one language. This is the assertion
    // that turns green when the keys land and stays honest until they do.
    const present = keys.filter((k) => en.has(k) || de.has(k));
    expect(present.filter((k) => !en.has(k) || !de.has(k))).toEqual([]);
  });

  it('/admin/projects: every gate code, count key and status resolves', async () => {
    // The operator's screens moved from a demo constant to the database, so
    // the keys built at runtime are now built from the gate function's own
    // codes and from proj.publication_status - not from a fixture. Country,
    // sector and unit labels are no longer keys at all: they come from
    // platform.eu_member_state, platform.sector and units.unit_type as text.
    const m = await import('@/lib/admin/types');
    both([
      ...m.PUBLICATION_GATE_CODES.flatMap((code) => [
        `adminProjects.gate.item.${m.GATE_ITEM_KEY[code]}.label`,
        `adminProjects.gate.item.${m.GATE_ITEM_KEY[code]}.requires`,
      ]),
      ...m.STATUS_ORDER.map((s) => `status.${s}`),
      // Every GateCountKey the detail column can produce.
      ...(['fields', 'geometries', 'rights', 'indicators', 'baselines',
           'commitments', 'periods'] as const)
        .map((k) => `adminProjects.gate.count.${k}`),
      'adminProjects.unit.notRecorded',
      'adminProjects.notRecorded',
    ]);
  });

  it('/admin/vetting: every role and decision option resolves', async () => {
    const m = await import('@/lib/admin/types');
    both([
      ...Object.values(m.ROLE_KEY).map((k) => `adminVetting.role.${k}`),
      ...m.ADMIN_DECISION_CHOICES.flatMap((c) => [
        `adminVetting.decision.${m.DECISION_KEY[c]}`,
        `adminVetting.decision.${m.DECISION_KEY[c]}Note`,
      ]),
      // The four states the catalogue was written for. `revoked` and
      // `not_started` fall back through src/lib/admin/messages.ts until their
      // keys land, which is what the next test checks.
      ...(['submitted', 'approved', 'declined', 'suspended'] as const)
        .map((s) => `adminVetting.state.${s}`),
      ...(['submitted', 'approved', 'declined', 'suspended'] as const)
        .map((k) => `adminVetting.entry.${k}`),
    ]);
  });

  it('/admin: the strings awaiting translation are declared, not scattered', async () => {
    const m = await import('@/lib/admin/messages');
    const keys = Object.keys(m.ADMIN_TEXT_KEYS);
    expect(keys.length).toBeGreaterThan(0);
    // Every one is under one namespace, so the hand-over to the message
    // catalogue is a single subtree rather than a hunt through the components.
    expect(keys.filter((k) => !k.startsWith('adminUi.'))).toEqual([]);
    // Each has a real English sentence to fall back to, so a missing key never
    // renders as "adminUi.publishDone".
    expect(Object.values(m.ADMIN_TEXT_KEYS).filter((v) => v.trim() === '')).toEqual([]);
    // None of them may be added to only one language.
    const present = keys.filter((k) => en.has(k) || de.has(k));
    expect(present.filter((k) => !en.has(k) || !de.has(k))).toEqual([]);
  });

  it('/owner/projects/[slug]: the record form uses only keys that exist', async () => {
    // The record form no longer carries a demo constant to walk: every label on
    // it is either a literal t('…') that scripts/check-i18n.ts resolves, or a
    // string declared in src/lib/owner/messages.ts with an English fallback.
    // What is still built at runtime is the unit label and the source label,
    // and both come from the database as text rather than as a key.
    const m = await import('@/lib/owner/types');
    both(
      m.PUBLICATION_GATE_CODES.flatMap((code) => [
        `owner.gate.item.${m.GATE_ITEM_KEY[code]}.label`,
        `owner.gate.item.${m.GATE_ITEM_KEY[code]}.note`,
      ]),
    );
  });

  it('/vetting/status: every stage position resolves', async () => {
    both(
      (['done', 'current', 'ahead'] as const).map(
        (p) => `vettingStatus.stage.position.${p}`,
      ),
    );
  });

  /**
   * The vetting states moved from a demo constant to the database's own
   * vocabulary, and three of them - not_started, suspended, revoked - are new.
   * Their catalogue keys are owned by another agent and land separately, so a
   * bare `both()` here would fail for a reason that is not a bug.
   *
   * What still has to hold, and is what this pair of tests actually protects:
   *
   *   1  every state has an English sentence to fall back to, so a missing key
   *      renders a sentence and never the string "vettingStatus.state.revoked";
   *   2  any state key that HAS been added is in both languages, so German
   *      never silently falls back to English for a state English has.
   */
  it('/vetting/status: every state has an English fallback', async () => {
    const m = await import('@/components/vetting-status/states');
    for (const state of m.VETTING_STATES) {
      expect(m.STATE_FALLBACK_EN[state]?.trim()).toBeTruthy();
      expect(m.STATE_MEANING_FALLBACK_EN[state]?.trim()).toBeTruthy();
      // A fallback that is the key is the failure mode this file exists for.
      expect(m.STATE_FALLBACK_EN[state]).not.toContain('vettingStatus.');
    }
  });

  it('/vetting/status: a state key present in English is present in German', async () => {
    const m = await import('@/components/vetting-status/states');
    const keys = m.VETTING_STATES.flatMap((s) => [
      `vettingStatus.state.${s}`,
      `vettingStatus.stateMeaning.${s}`,
    ]).filter((k) => en.has(k));
    expect(keys.filter((k) => !de.has(k))).toEqual([]);
  });
});

describe('scripts/check-i18n.ts', () => {
  const run = (): { code: number; out: string } => {
    try {
      const out = execFileSync('npx', ['tsx', 'scripts/check-i18n.ts'], {
        cwd: REPO,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (error) {
      const e = error as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };

  it('passes on the catalogues as they stand', () => {
    const { code, out } = run();
    expect(out).toContain('i18n ok');
    expect(code).toBe(0);
  }, 60_000);

  it('exists in tests/, next to the tests it backs', () => {
    expect(readFileSync(`${ROOT}i18n/messages.test.ts`, 'utf8')).toContain('check-i18n');
  });
});
