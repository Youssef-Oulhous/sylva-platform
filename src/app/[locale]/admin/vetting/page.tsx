import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import DecisionForm from '@/components/admin-vetting/DecisionForm';
import DecisionModel from '@/components/admin-vetting/DecisionModel';
import EntryLog from '@/components/admin-vetting/EntryLog';
import QuestionnaireAnswers from '@/components/admin-vetting/QuestionnaireAnswers';
import QueueTable from '@/components/admin-vetting/QueueTable';
import SubmissionDetail from '@/components/admin-vetting/SubmissionDetail';
import { DEMO_QUEUE, PANEL_ROW } from '@/components/admin-vetting/demo-queue';
import styles from './page.module.css';

/**
 * The operator vetting queue.
 *
 * Vetting is the gate. No deal can be created for an organisation Sylva has not
 * approved (concept note section 8, rule 6), and the vetting decision is the
 * operator's main safeguard against greenwashing and a condition of the funding
 * behind the pilot (section 7). So this screen has one job and it is not
 * clearing a list: it is making a decision that will be read back for years.
 *
 * The screen is therefore laid out as an argument rather than a work queue.
 * First how a decision is recorded and how a state is derived from it, because
 * a reviewer who thinks the badge is a setting will treat the decision as
 * reversible. Then the queue. Then one application in full: who it is, the
 * entries its state was read from, every answer it gave, and the decision.
 *
 * APPROVAL IS NOT SET, IT IS RECORDED. There is no control anywhere on this
 * page that writes a state, and no field in the demo data that holds one.
 * `QueueRow` carries an append-only log; `deriveState()` reads the state from
 * that log; every state on screen - queue cell, panel badge, the state each
 * decision option would produce - comes from that one function. A corrected
 * entry keeps its row and its reason and gains the word "Corrected", because
 * the record is append-only (section 8, rule 4).
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. Everything
 * rendered comes from the typed DEMO constants in
 * src/components/admin-vetting/demo-queue.ts. The decision form has no action
 * and no method, every control that would write is an inert button marked
 * aria-disabled and described by the note that says why, and there is no client
 * component on the page - the one disclosure is a native <details>.
 *
 * RULE 7 (no unit volumes added across projects). This screen renders no unit
 * volume at all: a vetting decision concerns an organisation, not a project, so
 * there is no quantity here that two projects' units could be summed into. The
 * only figures are dates and counts of APPLICATIONS, and each count prints the
 * word "applications" beside itself so it cannot be read as a volume.
 *
 * RULE J (invent no business or legal rules). What a suspension does to deals
 * already agreed, and how much of a recorded reason the applicant sees, are not
 * settled by the concept note. Both are printed as open questions rather than
 * answered.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminVetting' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // An operator screen holding other organisations' questionnaire answers has
    // nothing to index, and must never surface in a search for an applicant.
    robots: { index: false, follow: false },
  };
}

export default async function AdminVettingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const row = PANEL_ROW;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('adminVetting.operator')}</p>
        <h1>{t('adminVetting.title')}</h1>
        <p className={styles.lead}>{t('adminVetting.lead')}</p>

        <div className={styles.demoNote}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <p className={styles.demoNoteText}>{t('adminVetting.demoNote')}</p>
        </div>

        <p className={styles.accessNote}>{t('adminVetting.accessNote')}</p>
      </header>

      <DecisionModel />

      <QueueTable rows={DEMO_QUEUE} />

      {/* One application, in full. The queue row above it carries aria-current,
          so which application this is can be read from the table as well. */}
      <section className={styles.panel} aria-labelledby="panel-title">
        <SubmissionDetail row={row} headingId="panel-title" />
        <QuestionnaireAnswers headingId="panel-answers" />
        <EntryLog row={row} headingId="panel-log" />
        <DecisionForm row={row} headingId="panel-decide" />
      </section>

      <nav className={styles.related} aria-label={t('adminVetting.relatedTitle')}>
        <h2 className={styles.relatedTitle}>{t('adminVetting.relatedTitle')}</h2>
        <ul className={styles.relatedList}>
          <li>
            <Link href="/vetting">{t('adminVetting.related.questionnaire')}</Link>
            <span className={styles.relatedNote}>
              {t('adminVetting.related.questionnaireNote')}
            </span>
          </li>
          <li>
            <Link href="/record">{t('adminVetting.related.record')}</Link>
            <span className={styles.relatedNote}>{t('adminVetting.related.recordNote')}</span>
          </li>
          <li>
            <Link href="/how-it-works">{t('adminVetting.related.howItWorks')}</Link>
            <span className={styles.relatedNote}>
              {t('adminVetting.related.howItWorksNote')}
            </span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
