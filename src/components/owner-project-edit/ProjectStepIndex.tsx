import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import { ownerText } from '@/lib/owner/messages';
import { PROJECT_STEPS, stepGaps, stepHref, stepLabel, stepNumber } from '@/lib/owner/steps';
import { GATE_ITEM_KEY, type PublicationGateCode } from '@/lib/owner/types';
import styles from './ProjectSteps.module.css';

/**
 * The record's sections, as the way in to each of them.
 *
 * This is the index to a document of eight pages, so it names each section, says
 * whether anything on it is still blocking publication, and names what that is.
 * An owner who came back to fix the exclusions column can get there in one click
 * from here; before the record was split they scrolled past eight other sections
 * to reach it.
 *
 * The state is the database's: `gaps` is the array proj.publication_gaps()
 * returned a moment ago, mapped to steps by src/lib/owner/steps.ts. A section
 * with none of its codes open says "Recorded" and one with codes open says
 * "Missing" - as words, in a badge that also carries a tint, never as a tint
 * alone.
 *
 * A step with no gate code of its own is the ordinary case in the middle of this
 * list rather than an exception: nothing on this platform claims a section is
 * complete because it has no gate item. Where the gate says nothing, the badge
 * says nothing either.
 */
export default async function ProjectStepIndex({
  slug,
  gaps,
}: {
  slug: string;
  gaps: readonly PublicationGateCode[];
}) {
  const t = await getTranslations();

  return (
    <ul className={styles.index}>
      {PROJECT_STEPS.map((step) => {
        const open = stepGaps(step, gaps);
        return (
          <li key={step.segment} className={styles.indexItem}>
            <div className={styles.indexHead}>
              <span className={styles.navNum} aria-hidden="true">
                {String(stepNumber(step.segment)).padStart(2, '0')}
              </span>
              <p className={styles.indexName}>
                <Link href={stepHref(slug, step.segment)}>{stepLabel(t, step)}</Link>
              </p>
              {step.gates.length > 0 && (
                <Badge tone={open.length > 0 ? 'warning' : 'neutral'}>
                  {open.length > 0 ? t('owner.gate.missing') : t('owner.gate.recorded')}
                </Badge>
              )}
            </div>

            {open.length > 0 && (
              <p className={styles.indexNote}>
                {open
                  .map((code) => t(`owner.gate.item.${GATE_ITEM_KEY[code]}.label`))
                  .join(` ${t('source.separator')} `)}
              </p>
            )}

            <p className={styles.indexNote}>
              <Link href={stepHref(slug, step.segment)}>
                {ownerText(t, 'stepOpen')} &rarr;
              </Link>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
