/**
 * Strings the operator's screens need that the message catalogue does not have
 * yet.
 *
 * src/messages/en.json and de.json are owned by another agent, so nothing here
 * writes to them. Each string below is a KEY plus an English sentence, and
 * `adminText(t, code)` renders the key where it exists and the sentence where
 * it does not. The keys and their German are returned with this change so they
 * can be added in one pass; until then a person reads a real sentence rather
 * than "adminUi.publishDone".
 *
 * This is the same mechanism src/lib/auth/errors.ts and src/lib/owner/messages.ts
 * use, and it has a second benefit: scripts/check-i18n.ts resolves literal
 * t('…') calls, so a literal key that does not exist yet would fail the build.
 * A key held in a table and looked up by code does not, which is what lets the
 * two agents work in either order.
 */

export type AdminTextCode = keyof typeof TEXT;

const TEXT = {
  /* ------------------------------------------------------- both screens -- */
  liveNote: {
    key: 'adminUi.liveNote',
    en: 'Everything on this page is read from the database now, as a Sylva '
      + 'operator. Nothing on it is a stored summary.',
  },
  accessNote: {
    key: 'adminUi.accessNote',
    en: 'This screen belongs to Sylva operators. The database enforces that, '
      + 'not the page: every query here runs as the operator role, and no other '
      + 'role holds the privilege to read another organisation’s answers.',
  },
  notRecorded: { key: 'adminUi.notRecorded', en: 'Not recorded' },

  /*
   * Source labels are NOT here. The catalogue already carries them -
   * adminVetting.logSource, adminVetting.answerSource,
   * adminProjects.source.projectRecord and adminProjects.source.gateFunction -
   * in both languages, so the screens use those rather than adding a second
   * English sentence for the same thing.
   */

  /* ----------------------------------------------------- the vetting queue */
  queueEmpty: {
    key: 'adminUi.queue.empty',
    en: 'No applications have been submitted yet. An application appears here '
      + 'the moment an organisation submits the questionnaire.',
  },
  submissionCount: {
    key: 'adminUi.submissionCount',
    en: 'Applications from this organisation for this role',
  },
  stateRevoked: { key: 'adminUi.state.revoked', en: 'Revoked' },
  entryReinstated: {
    key: 'adminUi.entry.reinstated',
    en: 'Reinstatement recorded',
  },
  entryRevoked: { key: 'adminUi.entry.revoked', en: 'Revocation recorded' },
  superseded: { key: 'adminUi.log.superseded', en: 'Superseded' },
  correctionNote: {
    key: 'adminUi.log.correctionNote',
    en: 'A decision recorded in error is corrected by recording a later one. '
      + 'The earlier entry keeps its row and its reason and is marked '
      + 'superseded; the state is then read again from the whole chain. Nothing '
      + 'here is edited and nothing is removed.',
  },
  notAnswered: { key: 'adminUi.notAnswered', en: 'Not answered' },
  answerRequired: { key: 'adminUi.answerRequired', en: 'Required question' },
  decisionRecorded: {
    key: 'adminUi.decisionRecorded',
    en: 'Recorded. The state above was read again from the entries, this one '
      + 'included.',
  },
  reinstatementNote: {
    key: 'adminUi.reinstatementNote',
    en: 'This organisation is currently suspended, so approving it records a '
      + 'reinstatement rather than a first approval. Both read as approved; the '
      + 'record keeps which one happened.',
  },

  /* ----------------------------------------------- project review screen -- */
  projectsEmpty: {
    key: 'adminUi.projects.empty',
    en: 'No projects are recorded yet.',
  },
  publishNote: {
    key: 'adminUi.publish.note',
    en: 'This puts the project on the public index straight away. The database '
      + 'checks the ten items again as it does so.',
  },
  publishDone: {
    key: 'adminUi.publish.done',
    en: 'Published. The gate accepted the project and it is now on the public '
      + 'index.',
  },
  publishRefusedTitle: {
    key: 'adminUi.publish.refusedTitle',
    en: 'The database refused this publication',
  },
  gateEvaluatedNote: {
    key: 'adminUi.gate.evaluatedNote',
    en: 'This list is what proj.publication_gaps() returned for this project a '
      + 'moment ago, not a copy of it kept elsewhere.',
  },
} as const;

export function adminText(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: AdminTextCode,
): string {
  const m = TEXT[code];
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.en;
}

/** The key every code maps to. Used by the i18n hand-over, not by a page. */
export const ADMIN_TEXT_KEYS: Readonly<Record<string, string>> =
  Object.fromEntries(Object.values(TEXT).map((m) => [m.key, m.en]));

type Translator = { (key: string): string; has?: (key: string) => boolean };

/**
 * The two labels that span the catalogue and this file.
 *
 * `adminVetting.state.*` and `adminVetting.entry.*` were written for a screen
 * that did not yet read the database, so they cover the states that screen
 * could show. The enum `org.vetting_decision_kind` has two more members -
 * `reinstated` and `revoked` - which a real queue can hold. Rather than print
 * a bare key for those two, they resolve through the table above until the
 * catalogue carries them.
 */
export function stateLabel(t: Translator, state: string): string {
  if (state === 'revoked') return adminText(t, 'stateRevoked');
  if (state === 'not_started') return adminText(t, 'notRecorded');
  return t(`adminVetting.state.${state}`);
}

export function entryLabel(t: Translator, kind: string): string {
  if (kind === 'reinstated') return adminText(t, 'entryReinstated');
  if (kind === 'revoked') return adminText(t, 'entryRevoked');
  return t(`adminVetting.entry.${kind}`);
}
