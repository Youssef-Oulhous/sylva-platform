import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import { ownerText } from '@/lib/owner/messages';
import {
  neighbours, PROJECT_STEPS, stepGaps, stepHref, stepLabel, stepNumber,
  type ProjectStep,
} from '@/lib/owner/steps';
import { GATE_ITEM_KEY, statusKey, bodyOf, type OwnerProjectRecord } from '@/lib/owner/types';
import styles from './ProjectSteps.module.css';

/**
 * One page of one project's record.
 *
 * The record was a single page of thirteen forms and around 120 inputs. It is
 * now nine pages, and this frame is what makes each of them legible as a PART of
 * something rather than as a page on its own: it states which project you are
 * inside, lists every section with the ones that are still blocking publication
 * marked, names where this step sits in the whole, and says what is missing here
 * specifically.
 *
 * WHAT IS MISSING IS THE DATABASE'S ANSWER. `record.gaps` is the array
 * proj.publication_gaps() returned a moment ago, and src/lib/owner/steps.ts maps
 * each of its ten codes to the step that can clear it. Nothing here
 * reimplements the gate, so a step cannot claim to be done while the database
 * would refuse to publish the project.
 *
 * ACCESSIBILITY. One h1 per page - this frame owns it, and the step pages render
 * only their forms underneath. The navigation is a real <nav> with a label and
 * aria-current="page" on the step being read. "Missing" is never carried by the
 * amber dot alone: the dot has a visually-hidden word beside it, and the missing
 * items are also listed as a sentence under the heading.
 */
export default async function ProjectStepFrame({
  record,
  segment,
  lead,
  children,
}: {
  record: OwnerProjectRecord;
  /** The step this page is. Must be one of PROJECT_STEPS. */
  segment: string;
  /** The section's own standing lead, already translated. */
  lead?: string;
  children: ReactNode;
}) {
  const t = await getTranslations();

  const step = PROJECT_STEPS.find((s) => s.segment === segment);
  const n = stepNumber(segment);
  const total = PROJECT_STEPS.length;
  const gapsHere = step ? stepGaps(step, record.gaps) : [];
  const { previous, next } = neighbours(segment);

  const title = bodyOf(record.text, 'title', 'en') || record.slug;
  const missingWord = t('owner.gate.missing');

  const stepItem = (s: ProjectStep) => {
    const here = s.segment === segment;
    const open = stepGaps(s, record.gaps).length > 0;
    return (
      <li key={s.segment}>
        <Link
          href={stepHref(record.slug, s.segment)}
          className={here ? `${styles.navLink} ${styles.navLinkHere}` : styles.navLink}
          aria-current={here ? 'page' : undefined}
        >
          <span className={styles.navNum} aria-hidden="true">
            {String(stepNumber(s.segment)).padStart(2, '0')}
          </span>
          <span>{stepLabel(t, s)}</span>
          {open && (
            <>
              <span className={styles.navMissing} aria-hidden="true" />
              <span className="visually-hidden">{missingWord}</span>
            </>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className={styles.frame}>
      <p className={styles.crumb}>
        <Link href="/owner/projects">&larr; {ownerText(t, 'backToProjects')}</Link>
      </p>

      {/* The project this record belongs to. Not a heading: the page's one
          heading is the step below, and a second h1 would leave a screen reader
          with two answers to "what page is this". */}
      <p className={styles.project}>
        <span className={styles.projectName}>{title}</span>
        <span className={styles.projectSlug}>{record.slug}</span>
        <Badge tone={record.status === 'published' ? 'bio' : 'neutral'}>
          {t(statusKey(record.status))}
        </Badge>
        <Link href={stepHref(record.slug, '')} className={styles.projectLink}>
          {ownerText(t, 'backToProject')}
        </Link>
      </p>

      <nav className={styles.nav} aria-label={ownerText(t, 'stepNavLabel')}>
        <ul className={styles.navList}>{PROJECT_STEPS.map(stepItem)}</ul>
      </nav>

      <header className={styles.head}>
        <p className={styles.position} aria-hidden="true">
          {String(n).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </p>
        <h1 className={styles.title}>{step ? stepLabel(t, step) : record.slug}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}

        {/* What is still missing HERE, in words, from the gate the database
            itself applies. The whole-record list lives on the project
            overview; this is only this page's share of it. */}
        <div
          className={
            gapsHere.length > 0
              ? `${styles.standing} ${styles.standingBlocked}`
              : styles.standing
          }
        >
          <p className={styles.standingLine}>
            {gapsHere.length === 0
              ? t('owner.gate.complete')
              : t('owner.gate.blocking', { count: gapsHere.length })}
          </p>
          {gapsHere.length > 0 && (
            <ul className={styles.gapList}>
              {gapsHere.map((code) => (
                <li key={code}>
                  {t(`owner.gate.item.${GATE_ITEM_KEY[code]}.label`)} &mdash;{' '}
                  {t(`owner.gate.item.${GATE_ITEM_KEY[code]}.note`)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {children}

      <nav className={styles.onwards} aria-label={ownerText(t, 'stepNavLabel')}>
        {previous ? (
          <Link href={stepHref(record.slug, previous.segment)}>
            <span className={styles.onwardsLabel}>{ownerText(t, 'stepPrevious')}</span>
            &larr; {stepLabel(t, previous)}
          </Link>
        ) : (
          <Link href={stepHref(record.slug, '')}>
            <span className={styles.onwardsLabel}>{ownerText(t, 'stepPrevious')}</span>
            &larr; {ownerText(t, 'stepOverview')}
          </Link>
        )}
        {next && (
          <Link href={stepHref(record.slug, next.segment)}>
            <span className={styles.onwardsLabel}>{ownerText(t, 'stepNext')}</span>
            {stepLabel(t, next)} &rarr;
          </Link>
        )}
      </nav>
    </div>
  );
}
