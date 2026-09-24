import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import type { DemoProject } from './demo-data';
import styles from './ProjectHeader.module.css';

/**
 * The first screen of a due-diligence document: who, where, what state, and
 * the two things a reader can do next.
 *
 * The key-facts strip states the scheme and the unit type before any figure
 * appears anywhere on the page, because a figure without its unit invites the
 * comparison Rule 7 forbids.
 */
export default async function ProjectHeader({ project }: { project: DemoProject }) {
  const t = await getTranslations();

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t('project.scheme'), value: project.schemeName },
    { label: t('project.unitType'), value: t(project.unitLabelKey) },
    {
      label: t('projectPage.keyFacts.nearestPeriod'),
      value: (
        <>
          <span className={styles.mono}>{project.nearestPeriodLabel}</span>{' '}
          <span className={styles.factNote}>{t('projectPage.keyFacts.periodOfOutcome')}</span>
        </>
      ),
    },
    {
      label: t('projectPage.keyFacts.dealTypes'),
      value: project.dealTypeKeys.map((k) => t(k)).join(' · '),
    },
  ];

  return (
    <header className={styles.header}>
      <nav aria-label={t('projectPage.breadcrumb.label')} className={styles.breadcrumb}>
        <Link href="/projects">{t('projects.title')}</Link>
        <span aria-hidden="true">/</span>
        <span>{project.name}</span>
      </nav>

      <div className={styles.badges}>
        <Badge tone="demo">{t('demo.badge')}</Badge>
        <Badge tone="neutral">{t(project.statusKey)}</Badge>
        <Badge tone="water">{t('project.water')}</Badge>
        <Badge tone="bio">{t('project.biodiversity')}</Badge>
      </div>

      <h1 className={styles.title}>{project.name}</h1>

      <p className={styles.place}>
        {t(project.regionKey)} · {t(project.countryKey)} · {t(project.catchmentKey)}
      </p>

      <dl className={styles.identity}>
        <div className={styles.identityRow}>
          <dt>{t('project.owner')}</dt>
          <dd>{project.ownerOrgName}</dd>
        </div>
        <div className={styles.identityRow}>
          <dt>{t('project.status')}</dt>
          <dd>{t(project.statusKey)}</dd>
        </div>
        <div className={styles.identityRow}>
          <dt>{t('projectPage.verification.label')}</dt>
          <dd>{t(project.verificationStateKey)}</dd>
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

      <SourceStamp
        source={{
          label: t(project.headerSource.labelKey),
          locator: project.headerSource.locator,
          asOfDate: project.headerSource.asOfDate,
        }}
      />
    </header>
  );
}
