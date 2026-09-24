/**
 * The strings this feature added, with an English sentence to fall back on.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A HARDCODED STRING
 *
 * src/messages/en.json and de.json are owned by another agent, and
 * `npm run check:i18n` fails the build on a literal `t('some.key')` that does
 * not resolve. So a component that referenced a brand-new key directly would
 * break the build for everybody until the catalogue caught up.
 *
 * Every entry below therefore carries the key AND the English sentence. The
 * lookup happens through `t.has(key)`, with a key held in a variable rather
 * than written as a literal, which is exactly the shape the auth agent used in
 * src/lib/auth/errors.ts and the one case check-i18n.ts counts rather than
 * resolves. The moment the German lands, every one of these renders in German
 * with no change here.
 *
 * This is NOT a licence to keep English in components. The keys are listed in
 * this change's i18nKeys output, in English and in German, and this file is a
 * bridge with a short life, not a second message catalogue.
 */

export interface Translator {
  (key: string): string;
  has?: (key: string) => boolean;
}

/** Render `key` if the catalogue has it, the English sentence if it does not. */
export function line(t: Translator, key: string, fallbackEn: string): string {
  try {
    if (typeof t.has === 'function' && t.has(key)) return t(key);
  } catch {
    /* fall through */
  }
  return fallbackEn;
}

/** The keys this feature introduces. Keep in step with the i18nKeys output. */
export const COPY = {
  volumeHint: [
    'expressInterest.form.volumeHint',
    'Whole numbers only. A decimal point means different things in different countries, so the form does not accept one; if you need a fraction, say so in the message below.',
  ],
  sendNote: [
    'expressInterest.form.sendNote',
    'Sending this records an interest event in the permanent record and opens a private conversation with the project owner. It is not an offer and it commits you to nothing.',
  ],
  errorHeading: [
    'expressInterest.error.heading',
    'This enquiry was not sent',
  ],
  messageSent: [
    'expressInterest.confirmation.messageSent',
    'Your message went to the project owner and to Sylva. It is not published.',
  ],
  noMessage: [
    'expressInterest.confirmation.noMessage',
    'You sent no message with this enquiry. The project owner will be in touch anyway.',
  ],
  ownerLabel: [
    'expressInterest.confirmation.projectOwner',
    'Project owner',
  ],
  stageLabel: [
    'expressInterest.confirmation.stage',
    'Stage',
  ],
  stageInterest: [
    'expressInterest.confirmation.stageInterestExpressed',
    'Interest expressed — the first of four stages, ending at signed.',
  ],
  shapeUndecided: [
    'expressInterest.confirmation.shapeUndecided',
    'Not decided yet — the project owner will walk you through the three shapes.',
  ],

  // ---------------------------------------------------------------- blocked
  wrongRoleStatus: ['expressInterest.blocked.wrongRole.statusWord', 'Not a buyer account'],
  wrongRoleTitle: [
    'expressInterest.blocked.wrongRole.title',
    'This account cannot express interest',
  ],
  wrongRoleBody: [
    'expressInterest.blocked.wrongRole.body',
    'Express interest is for buyer accounts. Your account is registered for a different role on the platform, so there is nothing for Sylva to record an interest event against.',
  ],
  wrongRoleNote: [
    'expressInterest.blocked.wrongRole.note',
    'Every project page, the evidence behind it and the public record stay readable to you.',
  ],
  notApprovedNotSubmitted: [
    'expressInterest.blocked.notApproved.notSubmitted',
    'We have not received your vetting questionnaire yet.',
  ],
  alreadyOpenStatus: ['expressInterest.blocked.alreadyOpen.statusWord', 'Already open'],
  alreadyOpenTitle: [
    'expressInterest.blocked.alreadyOpen.title',
    'You already have an open interest in this project',
  ],
  alreadyOpenBody: [
    'expressInterest.blocked.alreadyOpen.body',
    'Expressing interest opens one private conversation between your organisation and this project. Yours is already open, so a second enquiry would duplicate it rather than add to it. Anything further — periods, volumes, questions — belongs in the conversation you already have.',
  ],
  alreadyOpenOpened: ['expressInterest.blocked.alreadyOpen.openedLabel', 'Interest recorded'],
  alreadyOpenPseudonym: [
    'expressInterest.blocked.alreadyOpen.pseudonymLabel',
    'On the public record',
  ],
  alreadyOpenView: ['expressInterest.blocked.alreadyOpen.viewAction', 'See what was recorded'],
  alreadyOpenNote: [
    'expressInterest.blocked.alreadyOpen.note',
    'Interest in a different project is a separate conversation and is not affected by this one.',
  ],
} as const satisfies Record<string, readonly [string, string]>;

export type CopyKey = keyof typeof COPY;

/** `c(t, 'sendNote')` — the key and its fallback, together, by name. */
export function c(t: Translator, key: CopyKey): string {
  const [messageKey, fallbackEn] = COPY[key];
  return line(t, messageKey, fallbackEn);
}
