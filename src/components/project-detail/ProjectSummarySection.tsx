import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { label, TEXT_FIELD } from '@/lib/projects/labels';
import type { ProjectDetail, ProjectText } from '@/lib/projects/types';
import styles from './ProjectSummarySection.module.css';

/**
 * What is being restored, why, and what is measured - in that order, in plain
 * language, before any table.
 *
 * The prose is proj.project_text, in the reader's locale where a reviewed
 * translation exists and in English where it does not, marked either way. The
 * first paragraph is the lead; the rest follow. Nothing is summarised,
 * truncated or re-ordered here: the project owner wrote it and the page shows
 * it.
 *
 * The deeper detail uses native <details>/<summary>, so disclosure costs no
 * client JavaScript and works before hydration.
 */
export default async function ProjectSummarySection({
  project,
}: {
  project: ProjectDetail;
}) {
  const t = await getTranslations();

  const paragraphs = project.summary ? splitParagraphs(project.summary.body) : [];
  const [lead, ...rest] = paragraphs;

  // The remaining text fields, each as its own disclosure. The catchment note
  // is not repeated here - it sits under the map, where it is read.
  const details: { code: string; text: ProjectText }[] = [];
  if (project.durabilityNote) details.push({ code: 'durability_note', text: project.durabilityNote });
  if (project.partnersNote) details.push({ code: 'partners_note', text: project.partnersNote });

  return (
    <>
      <h2>{t('project.summary')}</h2>

      {lead && <p className={styles.lead}>{lead}</p>}

      {rest.length > 0 && (
        <div className={styles.prose}>
          {rest.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {project.summary && (
        <>
          <FallbackNote text={project.summary} />
          <SourceStamp
            source={{
              label: project.summary.source.label,
              locator: project.summary.source.locator,
              asOfDate: project.summary.source.asOfDate,
            }}
          />
        </>
      )}

      {details.length > 0 && (
        <div className={styles.details}>
          {details.map((d) => (
            <details key={d.code} className={styles.detail}>
              <summary className={styles.summary}>{label(t, TEXT_FIELD[d.code])}</summary>
              <div className={styles.detailBody}>
                {splitParagraphs(d.text.body).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <FallbackNote text={d.text} />
                <SourceStamp
                  source={{
                    label: d.text.source.label,
                    locator: d.text.source.locator,
                    asOfDate: d.text.source.asOfDate,
                  }}
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

/** Blank line between paragraphs, as the project owner typed it. */
function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
