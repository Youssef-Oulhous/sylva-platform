import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import FallbackNote from './FallbackNote';
import {
  countryLabel, DEAL_SHAPE, label, UI, VINTAGE_SHORT,
} from '@/lib/projects/labels';
import type { ProjectDetail } from '@/lib/projects/types';
import styles from './ProjectHeader.module.css';

/**
 * The first screen of a due-diligence document: who, where, what state, and
 * the two things a reader can do next.
 *
 * The key-facts strip states the scheme and the unit type before any figure
 * appears anywhere on the page, because a figure without its unit invites the
 * comparison Rule 7 forbids.
 *
 * Every value here comes from the database. The verification line is derived
 * from ONE fact - whether a verification report exists in the document register
 * - because that is the only thing the platform can honestly say about it.
 */
export default async function ProjectHeader({ project }: { project: ProjectDetail }) {
  const t = await getTranslations();

  const domains = new Set(project.outcomes.map((o) => o.domain));
  const nearest = nearestPeriod(project);
  const unit = project.unitType.metricLabel.body;

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t('project.scheme'), value: project.scheme.name },
    {
      label: t('project.unitType'),
      value: (
        <>
          {unit} <span className={styles.factNote}>({project.unitType.unitOfMeasure})</span>
        </>
      ),
    },
  ];
  if (nearest) {
    facts.push({
      label: t('projectPage.keyFacts.nearestPeriod'),
      value: (
        <>
          <span className={styles.mono}>{nearest.label}</span>{' '}
          <span className={styles.factNote}>
            {label(t, VINTAGE_SHORT[project.unitType.vintageSemantics])}
          </span>
        </>
      ),
    });
  }
  facts.push({
    label: t('projectPage.keyFacts.dealTypes'),
    value: project.dealShapes
      .map((s) => label(t, DEAL_SHAPE[s.code], s.labelEn))
      .join(' · '),
  });

  return (
    <header className={styles.header}>
      <nav aria-label={t('projectPage.breadcrumb.label')} className={styles.breadcrumb}>
        <Link href="/projects">{t('projects.title')}</Link>
        <span aria-hidden="true">/</span>
        <span>{project.title.body}</span>
      </nav>

      <div className={styles.badges}>
        <Badge tone="demo">{t('demo.badge')}</Badge>
        <Badge tone="neutral">{statusLabel(t, project.status)}</Badge>
        {domains.has('water') && <Badge tone="water">{t('project.water')}</Badge>}
        {domains.has('biodiversity') && <Badge tone="bio">{t('project.biodiversity')}</Badge>}
      </div>

      <h1 className={styles.title}>{project.title.body}</h1>
      <FallbackNote text={project.title} />

      <p className={styles.place}>
        {[
          countryLabel(t, project.countryCode, project.countryNameEn),
          project.catchment?.datasetName,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {project.status !== 'published' && (
        <p className={styles.actionNote}>{label(t, UI.statusNotPublished)}</p>
      )}

      <dl className={styles.identity}>
        <div className={styles.identityRow}>
          <dt>{t('project.owner')}</dt>
          <dd>{project.ownerOrgName}</dd>
        </div>
        <div className={styles.identityRow}>
          <dt>{t('project.status')}</dt>
          <dd>{statusLabel(t, project.status)}</dd>
        </div>
        <div className={styles.identityRow}>
          <dt>{t('projectPage.verification.label')}</dt>
          <dd>
            {label(
              t,
              project.hasVerificationReport ? UI.verificationDone : UI.verificationPending,
            )}
          </dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Link
          href={`/projects/${project.slug}/express-interest`}
          className={styles.primary}
        >
          {t('project.expressInterest')}
        </Link>
        <a
          href={`/api/projects/${project.slug}/documents.zip`}
          className={styles.secondary}
        >
          {t('project.downloadDocuments')}
        </a>
      </div>
      <p className={styles.actionNote}>{t('projectPage.header.interestNote')}</p>

      <dl className={styles.facts}>
        {facts.map((f) => (
          <div key={f.label} className={styles.fact}>
            <dt className={styles.factLabel}>{f.label}</dt>
            <dd className={styles.factValue}>{f.value}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.actionNote}>
        <strong>{label(t, UI.unitDefinition)}:</strong>{' '}
        {project.unitType.definition.body}
      </p>
      <FallbackNote text={project.unitType.definition} />

      <SourceStamp
        source={{
          label: project.title.source.label,
          locator: project.title.source.locator,
          asOfDate: project.title.source.asOfDate,
        }}
      />
    </header>
  );
}

/**
 * The next period whose outcome has not yet passed, or the first one declared.
 * Never a total, never an aggregate across periods.
 */
function nearestPeriod(project: ProjectDetail) {
  const today = new Date().toISOString().slice(0, 10);
  return project.periods.find((p) => p.endsOn >= today) ?? project.periods[0] ?? null;
}

/** proj.publication_status maps one-to-one onto the `status.*` namespace. */
function statusLabel(t: { (k: string): string; has?: (k: string) => boolean }, status: string) {
  const key = `status.${status}`;
  try {
    if (typeof t.has === 'function' && t.has(key)) return t(key);
  } catch {
    /* fall through */
  }
  return status;
}
