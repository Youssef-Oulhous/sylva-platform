import { getTranslations } from 'next-intl/server';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import { countryLabel, label, PARTY_ROLE } from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './PartnersSection.module.css';

/**
 * The organisations behind the project, as register rows.
 *
 * Deliberately not cards with avatars: one buyer told the client it judges a
 * project by meeting the people behind it, and the useful answer to that is a
 * legible register of who holds which role, not a profile grid. No logos, no
 * portraits, no follower counts.
 *
 * The names come from org.v_public_party, never from org.organisation. No
 * public-facing role holds SELECT on org.organisation.legal_name at all
 * (migration 0016, R5), and the view names only declared parties and the owners
 * of already-public projects - so a bug in this component cannot turn into a
 * buyer's name on a public page.
 *
 * No platform reference is printed. The demo page showed one; the schema has no
 * such column, and inventing an identifier for an organisation would be
 * inventing a fact about it.
 */
export default async function PartnersSection({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('project.partners')}</h2>
      <p className={styles.lead}>{t('projectPage.partners.lead')}</p>

      <ul className={styles.list}>
        {project.partners.map((p) => (
          <li key={`${p.role}-${p.orgId}`} className={styles.row}>
            <div className={styles.role}>{label(t, PARTY_ROLE[p.role], p.role)}</div>
            <div className={styles.body}>
              <p className={styles.name}>{p.name}</p>
              {p.description && (
                <>
                  <p className={styles.note}>{p.description.body}</p>
                  <FallbackNote text={p.description} />
                </>
              )}
              {p.source && (
                <SourceStamp
                  source={{
                    label: p.source.label,
                    locator: p.source.locator,
                    asOfDate: p.source.asOfDate,
                  }}
                />
              )}
            </div>
            <div className={styles.meta}>
              <span className={styles.place}>
                {countryLabel(t, p.countryCode, p.countryCode)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {project.partnersNote && (
        <>
          <p className={styles.footNote}>{project.partnersNote.body}</p>
          <FallbackNote text={project.partnersNote} />
        </>
      )}

      <p className={styles.footNote}>{t('projectPage.partners.note')}</p>
    </>
  );
}
