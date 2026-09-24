import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import InterestReference from '@/components/express-interest/InterestReference';
import InterestForm from '@/components/express-interest/InterestForm';
import InterestConfirmation from '@/components/express-interest/InterestConfirmation';
import BlockedState from '@/components/express-interest/BlockedState';
import {
  DEMO_INTEREST_PROJECT,
  DEMO_PENDING_ORGANISATION,
  DEMO_RECORDED_INTEREST,
} from '@/components/express-interest/demo-interest';
import styles from './page.module.css';

/**
 * Express interest.
 *
 * The platform's main call to action, and the page it leads to must not dead-end.
 * So the page shows the whole of the release-1 behaviour in one place: a short
 * enquiry, what the confirmation says afterwards, and the two states that stop
 * the enquiry being sent at all - with, in every case, the next thing the reader
 * does.
 *
 * Release 1 records the interest event and notifies the project owner and Sylva
 * (concept note §10). The private deal room comes after it (§7), so this page
 * says that in words rather than offering a disabled "Open deal room" button
 * that would promise a room there is none.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions, no client
 * components. The form renders and does not submit; the confirmation and both
 * blocked states are rendered specimens, labelled as examples, not the result of
 * any check. The slug in the URL is not yet used to select a project: that
 * arrives with the data layer, together with notFound() for an unknown slug and
 * the real decision about which of these three states a visitor actually sees.
 *
 * Rule 7 (no unit volumes added across projects). Every figure on this page
 * belongs to one period of ONE project and ONE unit type, and the unit label is
 * printed beside each one. No total is shown - not across projects, and not even
 * across the periods of this project, because 2028 and 2029 are different
 * deliverables and a single figure would read as one quantity.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('project.expressInterest'),
    description: t('expressInterest.metaDescription'),
    // A project page must be shareable and indexable. A form for acting on one
    // has nothing to index.
    robots: { index: false, follow: true },
  };
}

export default async function ExpressInterestPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  // DEMO data. Nothing on this page is read from the database in this pass.
  const project = DEMO_INTEREST_PROJECT;

  return (
    <div className={styles.page}>
      <nav aria-label={t('expressInterest.breadcrumbLabel')} className={styles.breadcrumb}>
        <ol className={styles.crumbs}>
          <li>
            <Link href="/projects">{t('projects.title')}</Link>
          </li>
          <li>
            <Link href={`/projects/${project.slug}`}>{project.name}</Link>
          </li>
          <li aria-current="page">{t('project.expressInterest')}</li>
        </ol>
      </nav>

      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('project.expressInterest')}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{t('expressInterest.lead')}</p>
        <p className={styles.notAnOffer}>{t('expressInterest.notAnOffer')}</p>
      </header>

      <section className={styles.section} aria-labelledby="ei-reference">
        <h2 id="ei-reference" className={styles.sectionTitle}>
          {t('expressInterest.sections.reference')}
        </h2>
        <InterestReference project={project} />
      </section>

      <section className={styles.section} aria-labelledby="ei-enquiry">
        <h2 id="ei-enquiry" className={styles.sectionTitle}>
          {t('expressInterest.sections.enquiry')}
        </h2>
        <p className={styles.sectionLead}>{t('expressInterest.sections.enquiryLead')}</p>
        <InterestForm project={project} />
      </section>

      <section className={styles.section} aria-labelledby="ei-after">
        <h2 id="ei-after" className={styles.sectionTitle}>
          {t('expressInterest.sections.after')}
        </h2>
        <p className={styles.sectionLead}>{t('expressInterest.sections.afterLead')}</p>
        <InterestConfirmation project={project} interest={DEMO_RECORDED_INTEREST} />
      </section>

      <section className={styles.section} aria-labelledby="ei-blocked">
        <h2 id="ei-blocked" className={styles.sectionTitle}>
          {t('expressInterest.sections.blocked')}
        </h2>
        <p className={styles.sectionLead}>{t('expressInterest.sections.blockedLead')}</p>

        <div className={styles.blockedList}>
          {/* State 1: nobody is signed in. An interest event is recorded against
              an organisation, so there is nothing to record it against yet. */}
          <BlockedState
            exampleLabel={t('expressInterest.blocked.exampleSignedOut')}
            statusWord={t('expressInterest.blocked.signedOut.statusWord')}
            statusTone="neutral"
            title={t('expressInterest.blocked.signedOut.title')}
            body={t('expressInterest.blocked.signedOut.body')}
            actionsTitle={t('expressInterest.blocked.whatToDo')}
            actions={
              <>
                <Link href="/sign-in" className={styles.actionPrimary}>
                  {t('nav.signIn')}
                </Link>
                <Link href="/register" className={styles.actionSecondary}>
                  {t('expressInterest.blocked.signedOut.registerAction')}
                </Link>
              </>
            }
            note={t('expressInterest.blocked.signedOut.note')}
          />

          {/* State 2: signed in, organisation still in vetting. Rule 6 in the
              concept note: no deal for an organisation we have not approved. */}
          <BlockedState
            exampleLabel={t('expressInterest.blocked.exampleNotApproved')}
            statusWord={t('status.submitted_for_review')}
            statusTone="warning"
            title={t('expressInterest.blocked.notApproved.title')}
            body={t('expressInterest.blocked.notApproved.body')}
            facts={[
              {
                label: t('expressInterest.confirmation.organisation'),
                value: DEMO_PENDING_ORGANISATION.name,
              },
              {
                label: t('expressInterest.blocked.notApproved.submittedLabel'),
                value: format.dateTime(
                  new Date(DEMO_PENDING_ORGANISATION.questionnaireSubmittedOn),
                  'long',
                ),
                mono: true,
              },
            ]}
            listTitle={t('expressInterest.blocked.notApproved.asksTitle')}
            items={[
              t('expressInterest.blocked.notApproved.asks1'),
              t('expressInterest.blocked.notApproved.asks2'),
              t('expressInterest.blocked.notApproved.asks3'),
            ]}
            actionsTitle={t('expressInterest.blocked.whatToDo')}
            actions={
              <>
                <Link href="/for-buyers#vetting" className={styles.actionPrimary}>
                  {t('expressInterest.blocked.notApproved.vettingAction')}
                </Link>
                <Link href={`/projects/${project.slug}`} className={styles.actionSecondary}>
                  {t('expressInterest.confirmation.backToProject')}
                </Link>
              </>
            }
            note={t('expressInterest.blocked.notApproved.note')}
          />
        </div>
      </section>

      <footer className={styles.foot}>
        <p className={styles.footNote}>{t('expressInterest.frontendNote')}</p>
      </footer>
    </div>
  );
}
