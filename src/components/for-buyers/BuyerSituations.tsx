import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import styles from './BuyerSituations.module.css';

/**
 * The two buyer situations, side by side and deliberately not merged.
 *
 * The client interviewed both kinds of company and they read the same project
 * page in a different order. Putting them in one column with one list of
 * benefits would hide exactly the distinction a visitor arrives with. So: two
 * panels, each naming who it is, what it ranks first, and which sections of a
 * project page answer it.
 *
 * Colour follows meaning and never carries it alone. The water-driven panel is
 * marked with the water tone AND the word; the reporting-driven panel is
 * neutral, because reporting and budget are financial-neutral information.
 */

interface SituationRead {
  id: string;
  /** i18n key for the line of text. */
  textKey: string;
  /** Anchor on the demo project page, or null where no section answers it. */
  anchor: string | null;
  /** i18n key naming that section. Existing project keys are reused. */
  sectionKey: string | null;
}

interface Situation {
  id: 'water' | 'reporting';
  tone: 'water' | 'neutral';
  tagKey: string;
  titleKey: string;
  whoKey: string;
  ranksKey: string;
  reads: readonly SituationRead[];
  noteKey: string;
}

/** DEMO reference: the project page these panels point at. Fictional. */
const DEMO_PROJECT_SLUG = 'demo-untere-havel-wetland-restoration';

/**
 * DEMO figure. The client's own buyer research, as described in the concept
 * note of 22 September 2026. It is a count of interviews, not an environmental
 * figure, and it carries its source like every other figure on the platform.
 */
const RESEARCH = {
  organisationsInterviewed: 8,
  source: { labelKey: 'forBuyers.source.interviews', locator: null, asOfDate: '2026-09-22' },
} as const;

const SITUATIONS: readonly Situation[] = [
  {
    id: 'water',
    tone: 'water',
    tagKey: 'forBuyers.situations.water.tag',
    titleKey: 'forBuyers.situations.water.heading',
    whoKey: 'forBuyers.situations.water.who',
    ranksKey: 'forBuyers.situations.water.ranks',
    reads: [
      { id: 'map', textKey: 'forBuyers.situations.water.read1', anchor: 'map', sectionKey: 'project.map' },
      { id: 'outcomes', textKey: 'forBuyers.situations.water.read2', anchor: 'outcomes', sectionKey: 'project.outcomes' },
      { id: 'claims', textKey: 'forBuyers.situations.water.read3', anchor: 'claim-rights', sectionKey: 'project.claimRights' },
      { id: 'durability', textKey: 'forBuyers.situations.water.read4', anchor: 'durability', sectionKey: 'project.durability' },
    ],
    noteKey: 'forBuyers.situations.water.note',
  },
  {
    id: 'reporting',
    tone: 'neutral',
    tagKey: 'forBuyers.situations.reporting.tag',
    titleKey: 'forBuyers.situations.reporting.heading',
    whoKey: 'forBuyers.situations.reporting.who',
    ranksKey: 'forBuyers.situations.reporting.ranks',
    reads: [
      { id: 'evidence', textKey: 'forBuyers.situations.reporting.read1', anchor: 'evidence', sectionKey: 'forBuyers.situations.evidenceSection' },
      { id: 'documents', textKey: 'forBuyers.situations.reporting.read2', anchor: 'documents', sectionKey: 'project.documents' },
      { id: 'partners', textKey: 'forBuyers.situations.reporting.read3', anchor: 'partners', sectionKey: 'project.partners' },
      { id: 'availability', textKey: 'forBuyers.situations.reporting.read4', anchor: 'availability', sectionKey: 'project.availability' },
    ],
    noteKey: 'forBuyers.situations.reporting.note',
  },
];

export default async function BuyerSituations() {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <h2>{t('forBuyers.situations.title')}</h2>
      <p className={styles.lead}>{t('forBuyers.situations.lead')}</p>

      <p className={styles.figure}>
        <span className={styles.figureValue}>
          {format.number(RESEARCH.organisationsInterviewed)}
        </span>
        <span className={styles.figureLabel}>
          {t('forBuyers.situations.interviewedLabel')}
        </span>
      </p>
      <SourceStamp
        source={{
          label: t(RESEARCH.source.labelKey),
          locator: RESEARCH.source.locator,
          asOfDate: RESEARCH.source.asOfDate,
        }}
      />

      <div className={styles.grid}>
        {SITUATIONS.map((s) => (
          <article
            key={s.id}
            className={s.id === 'water' ? `${styles.panel} ${styles.panelWater}` : styles.panel}
          >
            <div className={styles.panelHead}>
              <Badge tone={s.tone}>{t(s.tagKey)}</Badge>
              <h3 className={styles.panelTitle}>{t(s.titleKey)}</h3>
            </div>

            <p className={styles.who}>{t(s.whoKey)}</p>

            <p className={styles.ranks}>
              <span className={styles.ranksLabel}>{t('forBuyers.situations.ranksLabel')}</span>
              {t(s.ranksKey)}
            </p>

            <h4 className={styles.readsTitle}>{t('forBuyers.situations.readsTitle')}</h4>
            <ul className={styles.reads}>
              {s.reads.map((r) => (
                <li key={r.id} className={styles.read}>
                  <span>{t(r.textKey)}</span>
                  {r.anchor && r.sectionKey && (
                    <Link
                      href={`/projects/${DEMO_PROJECT_SLUG}#${r.anchor}`}
                      className={styles.readLink}
                      aria-label={t('forBuyers.situations.seeSection', {
                        section: t(r.sectionKey),
                      })}
                    >
                      {t(r.sectionKey)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <p className={styles.note}>{t(s.noteKey)}</p>
          </article>
        ))}
      </div>
    </>
  );
}
