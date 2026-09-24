/**
 * DEMO DATA for the project owner's question inbox.
 *
 * Nothing here comes from the database. This is the frontend pass: the page is
 * built, reviewed and translated before the data layer exists, so the inbox is
 * held as typed constants and the shape below is what the page reads.
 *
 * Every organisation name begins with "DEMO". No question, reply or draft below
 * was written by a real buyer, and none of it describes a real wetland, a real
 * verification or a real environmental result.
 *
 * Prose a reader sees is held as an i18n KEY, never as an English string, so the
 * German site is not silently served English. Proper nouns - organisation names,
 * project names, question references and buyer labels - stay as literals,
 * because that is how they will arrive from the database and because a buyer
 * label is an identifier rather than a word.
 *
 * RULE 7. There is no volume field, no price field and no unit field anywhere in
 * this module, so there is no quantity on this page that could be added across
 * projects. The only figures the page prints are counts of questions, and the
 * page says so beside them. Unit volumes stay on each project's availability
 * table, where the unit type travels with the number.
 */

export interface DemoOwnerOrg {
  /** Never translated. */
  name: string;
  countryCode: string;
}

export interface DemoQuestionProject {
  /** Matches the project page route, so the inbox can link to it. */
  slug: string;
  /** Never translated. */
  name: string;
  countryCode: string;
}

export type DemoSectorCode =
  | 'food_bev'
  | 'chemicals'
  | 'utilities'
  | 'finance'
  | 'public';

export type DemoSizeBandCode = 'sme' | 'large';

/**
 * How the buyer appears on the question.
 *
 *  - 'label' is the per-deal pseudonym, which is the default. Labels start
 *    again at 001 on each project, so the same label on two projects is not the
 *    same organisation.
 *  - 'named' means the buyer chose disclosure for this deal, so the owner sees
 *    the organisation's name as well as the label it was given.
 */
export type DemoBuyerIdentityKind = 'label' | 'named';

export interface DemoBuyer {
  kind: DemoBuyerIdentityKind;
  /** The per-deal label. An identifier, never translated. */
  label: string;
  /** Present only when the buyer chose to be named for this deal. */
  name: string | null;
  sectorCode: DemoSectorCode;
  countryCode: string;
  sizeBandCode: DemoSizeBandCode;
}

export interface DemoReply {
  /** The organisation that replied. Never translated. */
  byOrgName: string;
  sentOn: string;
  /** i18n key for the reply text. */
  bodyKey: string;
}

/** What the question is about. One of a fixed set, so it can be translated. */
export type DemoQuestionTopic =
  | 'claimRights'
  | 'availability'
  | 'catchment'
  | 'durability';

export interface DemoQuestion {
  /**
   * The question's reference. In the database this will be a UUID; a short
   * printable form stands in for it here so a reference can be read aloud.
   */
  ref: string;
  projectSlug: string;
  askedOn: string;
  buyer: DemoBuyer;
  topic: DemoQuestionTopic;
  /** i18n key for the question text. */
  bodyKey: string;
  /** The reply that was sent, or null while the question is unanswered. */
  reply: DemoReply | null;
  /**
   * An unsent draft the owner started. Held separately from the reply so an
   * unsent draft can never be mistaken on screen for something the buyer has
   * read.
   */
  draftKey: string | null;
}

/** The owner whose inbox this is. */
export const DEMO_OWNER: DemoOwnerOrg = {
  name: 'DEMO Havel Restoration Partners GmbH',
  countryCode: 'DE',
};

/**
 * The owner's projects, in the order the inbox shows them. Every project the
 * owner holds appears, including one with no questions, because an owner needs
 * to see that a project has had no questions rather than have it omitted.
 */
export const DEMO_OWNER_PROJECTS: readonly DemoQuestionProject[] = [
  {
    slug: 'demo-untere-havel-wetland-restoration',
    name: 'DEMO Untere Havel Wetland Restoration',
    countryCode: 'DE',
  },
  {
    slug: 'demo-oder-floodplain-reconnection',
    name: 'DEMO Oder Floodplain Reconnection',
    countryCode: 'DE',
  },
  {
    slug: 'demo-peene-valley-peatland-rewetting',
    name: 'DEMO Peene Valley Peatland Rewetting',
    countryCode: 'DE',
  },
];

/** The date of the extract the counts on the page are taken from. */
export const DEMO_INBOX_EXTRACT = {
  asOfDate: '2026-09-23',
} as const;

const HAVEL = 'demo-untere-havel-wetland-restoration';
const ODER = 'demo-oder-floodplain-reconnection';

/**
 * Newest first. The order on screen is the order here.
 *
 * "Buyer 001" on the Oder project is a different organisation from "Buyer 001"
 * on the Untere Havel project: the label is scoped to the project and the deal,
 * not to the organisation.
 */
export const DEMO_QUESTIONS: readonly DemoQuestion[] = [
  {
    ref: 'Q-000214',
    projectSlug: HAVEL,
    askedOn: '2026-09-21',
    buyer: {
      kind: 'label',
      label: 'Buyer 003',
      name: null,
      sectorCode: 'chemicals',
      countryCode: 'DE',
      sizeBandCode: 'large',
    },
    topic: 'claimRights',
    bodyKey: 'messages.q214.question',
    reply: null,
    draftKey: 'messages.q214.draft',
  },
  {
    ref: 'Q-000213',
    projectSlug: HAVEL,
    askedOn: '2026-09-18',
    buyer: {
      kind: 'named',
      label: 'Buyer 001',
      name: 'DEMO Nordbräu AG',
      sectorCode: 'food_bev',
      countryCode: 'DE',
      sizeBandCode: 'large',
    },
    topic: 'availability',
    bodyKey: 'messages.q213.question',
    reply: {
      byOrgName: DEMO_OWNER.name,
      sentOn: '2026-09-19',
      bodyKey: 'messages.q213.reply',
    },
    draftKey: null,
  },
  {
    ref: 'Q-000212',
    projectSlug: HAVEL,
    askedOn: '2026-09-16',
    buyer: {
      kind: 'label',
      label: 'Buyer 002',
      name: null,
      sectorCode: 'food_bev',
      countryCode: 'NL',
      sizeBandCode: 'large',
    },
    topic: 'catchment',
    bodyKey: 'messages.q212.question',
    reply: null,
    draftKey: null,
  },
  {
    ref: 'Q-000209',
    projectSlug: ODER,
    askedOn: '2026-09-11',
    buyer: {
      kind: 'label',
      label: 'Buyer 001',
      name: null,
      sectorCode: 'utilities',
      countryCode: 'DE',
      sizeBandCode: 'large',
    },
    topic: 'durability',
    bodyKey: 'messages.q209.question',
    reply: {
      byOrgName: DEMO_OWNER.name,
      sentOn: '2026-09-12',
      bodyKey: 'messages.q209.reply',
    },
    draftKey: null,
  },
];

export function questionsForProject(slug: string): readonly DemoQuestion[] {
  return DEMO_QUESTIONS.filter((q) => q.projectSlug === slug);
}

export function isAnswered(question: DemoQuestion): boolean {
  return question.reply !== null;
}

export function countAwaiting(questions: readonly DemoQuestion[]): number {
  return questions.filter((q) => !isAnswered(q)).length;
}

export function countAnswered(questions: readonly DemoQuestion[]): number {
  return questions.filter(isAnswered).length;
}
