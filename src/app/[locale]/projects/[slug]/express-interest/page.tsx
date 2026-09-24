import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import InterestReference from '@/components/express-interest/InterestReference';
import InterestForm from '@/components/express-interest/InterestForm';
import InterestConfirmation from '@/components/express-interest/InterestConfirmation';
import BlockedState from '@/components/express-interest/BlockedState';
import { c } from '@/components/express-interest/copy';
import { getActor } from '@/lib/auth/session';
import { interestGate } from '@/lib/interest/gate';
import { getInterestProject, getRecordedInterest } from '@/lib/interest/queries';
import { isInterestErrorCode, resolveInterestMessage } from '@/lib/interest/errors';
import styles from './page.module.css';

/**
 * Express interest.
 *
 * The platform's main call to action, and the page it leads to must not
 * dead-end. So this page is never blank and never a stack trace: it is always
 * one of five things, and each of them says what the reader does next.
 *
 *   the confirmation   ?recorded=<public_id> - what was written, read back
 *   the form           signed in, approved, no live deal here
 *   not signed in      an interest event is recorded against an organisation
 *   not approved       R6. Sylva vets every organisation before it transacts
 *   already open       one private conversation per (project, buyer)
 *
 * WIRED TO THE DATABASE. The project, its periods and their remaining volumes
 * are read as the caller's PostgreSQL role with the caller's signed
 * organisation context; the form posts to a Server Action that writes the deal,
 * the disclosure choice, the volumes, the message and the record entry in one
 * transaction.
 *
 * The gate decides what the page SAYS. It is not the security boundary - the
 * R6 trigger, the unique partial index and row-level security are, and they
 * fire whether or not the gate was consulted. A bug here shows the wrong
 * sentence; it cannot open a deal that the database would refuse.
 *
 * Release 1 opens NO deal room. The confirmation says so in words rather than
 * offering a disabled "Open deal room" button that would promise a room there
 * is none.
 *
 * Rule 7 (no unit volumes added across projects). Every figure on this page
 * belongs to one period of ONE project and ONE unit type, and the unit label is
 * printed beside each one. No total is shown - not across projects, and not
 * even across the periods of this project, because 2028 and 2029 are different
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
    // has nothing to index - and a confirmation must never be indexed at all.
    robots: { index: false, follow: true },
  };
}

export default async function ExpressInterestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const query = await searchParams;

  const actor = await getActor();

  // An unknown slug, an unpublished project and a published project with no
  // effective forecast all return null, and all three are a 404. Telling them
  // apart on screen would tell a stranger which slugs exist.
  const project = await getInterestProject(actor, slug, locale);
  if (!project) notFound();

  /* ------------------------------------------------ the confirmation */

  const recordedId = typeof query.recorded === 'string' ? query.recorded : null;
  if (recordedId) {
    // Row-level security is what makes this id safe in a URL: record.entry's
    // SELECT policy returns the entry only to a party to the deal, to Sylva and
    // to the auditor. Anyone else gets null, and null is a 404.
    const recorded = await getRecordedInterest(actor, recordedId, locale);
    if (!recorded || recorded.projectSlug !== slug) notFound();

    return (
      <div className={styles.page}>
        <Breadcrumb slug={slug} title={project.title} t={t} />
        <header className={styles.head}>
          <div className={styles.headTop}>
            <h1>{t('project.expressInterest')}</h1>
            <Badge tone="demo">{t('demo.badge')}</Badge>
          </div>
        </header>
        <InterestConfirmation recorded={recorded} />
      </div>
    );
  }

  /* -------------------------------------------------------- the page */

  const gate = await interestGate(project.id);

  const rawError = typeof query.error === 'string' ? query.error : undefined;
  const errorCode = rawError && isInterestErrorCode(rawError) ? rawError : null;

  return (
    <div className={styles.page}>
      <Breadcrumb slug={slug} title={project.title} t={t} />

      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1>{t('project.expressInterest')}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{t('expressInterest.lead')}</p>
        <p className={styles.notAnOffer}>{t('expressInterest.notAnOffer')}</p>
      </header>

      {/* The action redirects back here with a CODE, never a message and never
          anything the person typed. The sentence is rendered from the code. */}
      {errorCode ? (
        <div className={styles.errorNotice} role="alert">
          <strong className={styles.errorHeading}>{c(t, 'errorHeading')}</strong>
          <p className={styles.errorBody}>{resolveInterestMessage(t, errorCode)}</p>
        </div>
      ) : null}

      <section className={styles.section} aria-labelledby="ei-reference">
        <h2 id="ei-reference" className={styles.sectionTitle}>
          {t('expressInterest.sections.reference')}
        </h2>
        <InterestReference project={project} />
      </section>

      {gate.state === 'ok' ? (
        <section className={styles.section} aria-labelledby="ei-enquiry">
          <h2 id="ei-enquiry" className={styles.sectionTitle}>
            {t('expressInterest.sections.enquiry')}
          </h2>
          <p className={styles.sectionLead}>{t('expressInterest.sections.enquiryLead')}</p>
          <InterestForm project={project} />
        </section>
      ) : (
        <section className={styles.section} aria-labelledby="ei-blocked">
          <h2 id="ei-blocked" className={styles.sectionTitle}>
            {t('expressInterest.sections.blocked')}
          </h2>

          {gate.state === 'not_signed_in' ? (
            /* An interest event is recorded against an organisation, so there
               is nothing to record it against yet. */
            <BlockedState
              statusWord={t('expressInterest.blocked.signedOut.statusWord')}
              statusTone="neutral"
              title={t('expressInterest.blocked.signedOut.title')}
              body={t('expressInterest.blocked.signedOut.body')}
              actionsTitle={t('expressInterest.blocked.whatToDo')}
              actions={
                <>
                  <Link
                    href={{
                      pathname: '/sign-in',
                      query: { next: `/projects/${slug}/express-interest` },
                    }}
                    className={styles.actionPrimary}
                  >
                    {t('nav.signIn')}
                  </Link>
                  <Link href="/register" className={styles.actionSecondary}>
                    {t('expressInterest.blocked.signedOut.registerAction')}
                  </Link>
                </>
              }
              note={t('expressInterest.blocked.signedOut.note')}
            />
          ) : null}

          {gate.state === 'wrong_role' ? (
            <BlockedState
              statusWord={c(t, 'wrongRoleStatus')}
              statusTone="neutral"
              title={c(t, 'wrongRoleTitle')}
              body={c(t, 'wrongRoleBody')}
              actionsTitle={t('expressInterest.blocked.whatToDo')}
              actions={
                <Link href={`/projects/${slug}`} className={styles.actionSecondary}>
                  {t('expressInterest.confirmation.backToProject')}
                </Link>
              }
              note={c(t, 'wrongRoleNote')}
            />
          ) : null}

          {gate.state === 'not_approved' ? (
            /* Rule 6 in the concept note: no deal for an organisation we have
               not approved. The date turns a refusal into a status. */
            <BlockedState
              statusWord={t('status.submitted_for_review')}
              statusTone="warning"
              title={t('expressInterest.blocked.notApproved.title')}
              body={t('expressInterest.blocked.notApproved.body')}
              facts={
                gate.submittedAt
                  ? [{
                      label: t('expressInterest.blocked.notApproved.submittedLabel'),
                      value: format.dateTime(new Date(gate.submittedAt), 'long'),
                      mono: true,
                    }]
                  : undefined
              }
              listTitle={t('expressInterest.blocked.notApproved.asksTitle')}
              items={[
                t('expressInterest.blocked.notApproved.asks1'),
                t('expressInterest.blocked.notApproved.asks2'),
                t('expressInterest.blocked.notApproved.asks3'),
              ]}
              actionsTitle={t('expressInterest.blocked.whatToDo')}
              actions={
                <>
                  <Link href="/vetting" className={styles.actionPrimary}>
                    {t('expressInterest.blocked.notApproved.vettingAction')}
                  </Link>
                  <Link href={`/projects/${slug}`} className={styles.actionSecondary}>
                    {t('expressInterest.confirmation.backToProject')}
                  </Link>
                </>
              }
              note={
                gate.submittedAt
                  ? t('expressInterest.blocked.notApproved.note')
                  : c(t, 'notApprovedNotSubmitted')
              }
            />
          ) : null}

          {gate.state === 'already_open' ? (
            /* ux_one_live_deal_per_buyer_project. A second enquiry would be a
               duplicate of the first, not an addition to it. */
            <BlockedState
              statusWord={c(t, 'alreadyOpenStatus')}
              statusTone="neutral"
              title={c(t, 'alreadyOpenTitle')}
              body={c(t, 'alreadyOpenBody')}
              facts={[
                {
                  label: c(t, 'alreadyOpenOpened'),
                  value: format.dateTime(new Date(gate.open.openedAt), 'long'),
                  mono: true,
                },
                ...(gate.open.pseudonym
                  ? [{
                      label: c(t, 'alreadyOpenPseudonym'),
                      value: gate.open.pseudonym,
                      mono: true,
                    }]
                  : []),
              ]}
              actionsTitle={t('expressInterest.blocked.whatToDo')}
              actions={
                <>
                  {gate.open.recordPublicId ? (
                    <Link
                      href={{
                        pathname: `/projects/${slug}/express-interest`,
                        query: { recorded: gate.open.recordPublicId },
                      }}
                      className={styles.actionPrimary}
                    >
                      {c(t, 'alreadyOpenView')}
                    </Link>
                  ) : null}
                  <Link href={`/projects/${slug}`} className={styles.actionSecondary}>
                    {t('expressInterest.confirmation.backToProject')}
                  </Link>
                </>
              }
              note={c(t, 'alreadyOpenNote')}
            />
          ) : null}
        </section>
      )}
    </div>
  );
}

function Breadcrumb({
  slug,
  title,
  t,
}: {
  slug: string;
  title: string;
  t: (key: string) => string;
}) {
  return (
    <nav aria-label={t('expressInterest.breadcrumbLabel')} className={styles.breadcrumb}>
      <ol className={styles.crumbs}>
        <li>
          <Link href="/projects">{t('projects.title')}</Link>
        </li>
        <li>
          <Link href={`/projects/${slug}`}>{title}</Link>
        </li>
        <li aria-current="page">{t('project.expressInterest')}</li>
      </ol>
    </nav>
  );
}
