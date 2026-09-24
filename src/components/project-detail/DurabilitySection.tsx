import { getFormatter, getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { label, TIMELINE_KIND, UI } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './DurabilitySection.module.css';

/**
 * Long-term protection: who controls the land, who has committed to maintain
 * it, and for how long.
 *
 * The timeline holds ONLY dates the platform actually records - the date the
 * project was published, each declared outcome period, and the start and end of
 * each durability commitment. Nothing is interpolated and nothing is projected
 * past the last recorded date. Where the documents are silent the timeline
 * simply ends, and that silence is the answer to the buyer who asked what
 * happens after thirty or forty years. Inventing a row there would be the
 * platform making an environmental claim.
 */
export default async function DurabilitySection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <>
      <h2>{t('project.durability')}</h2>
      <p className={styles.lead}>{t('projectPage.durability.lead')}</p>

      {project.durability.length === 0 ? (
        <p className={styles.timelineNote}>{label(t, UI.noDurability)}</p>
      ) : (
        <dl className={styles.facts}>
          {project.durability.map((d) => (
            <div key={d.commitmentKey} className={styles.fact}>
              <dt className={styles.factLabel}>
                {d.responsibleOrgName ?? t('project.landControl')}
              </dt>
              <dd className={styles.factValue}>
                {d.statement?.body}
                <FallbackNote text={d.statement} />
                {d.landControlNote && (
                  <>
                    <span className={styles.factNote}>{d.landControlNote.body}</span>
                    <FallbackNote text={d.landControlNote} />
                  </>
                )}
                {(d.startsOn || d.endsOn || d.horizonYears !== null) && (
                  <span className={styles.factNote}>
                    {[
                      d.startsOn && format.dateTime(new Date(d.startsOn), 'short'),
                      d.endsOn && format.dateTime(new Date(d.endsOn), 'short'),
                    ]
                      .filter(Boolean)
                      .join(' – ')}
                    {d.horizonYears !== null && ` · ${format.number(d.horizonYears)} a`}
                  </span>
                )}
                <SourceStamp
                  source={{
                    label: d.source.label,
                    locator: d.source.locator,
                    asOfDate: d.source.asOfDate,
                  }}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {project.durabilityNote && (
        <div className={styles.factValue}>
          <p>{project.durabilityNote.body}</p>
          <FallbackNote text={project.durabilityNote} />
          <SourceStamp
            source={{
              label: project.durabilityNote.source.label,
              locator: project.durabilityNote.source.locator,
              asOfDate: project.durabilityNote.source.asOfDate,
            }}
          />
        </div>
      )}

      <h3 className={styles.timelineTitle}>{t('projectPage.durability.timelineTitle')}</h3>
      <p className={styles.timelineNote}>{t('projectPage.durability.timelineNote')}</p>

      <ol className={styles.timeline}>
        {project.timeline.map((e) => (
          <li key={e.id} className={styles.entry}>
            <span className={styles.when}>{e.when}</span>
            <span className={styles.entryBody}>
              <span className={styles.entryTitle}>{label(t, TIMELINE_KIND[e.kind])}</span>
              <span className={styles.entryText}>
                {[
                  e.startsOn && format.dateTime(new Date(e.startsOn), 'short'),
                  e.endsOn && format.dateTime(new Date(e.endsOn), 'short'),
                ]
                  .filter(Boolean)
                  .join(' – ')}
              </span>
              {e.source ? (
                <SourceStamp
                  source={{
                    label: e.source.label,
                    locator: e.source.locator,
                    asOfDate: e.source.asOfDate,
                  }}
                />
              ) : (
                /* Not a document figure: the platform recorded it itself when
                   the project was published. Saying so keeps the one entry on
                   this timeline with no source_ref honest. */
                <span className={styles.state}>{label(t, UI.timelinePlatformSource)}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
