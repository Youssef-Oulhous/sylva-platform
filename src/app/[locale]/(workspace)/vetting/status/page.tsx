import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { requireActor } from '@/lib/auth/guards';
import { primaryRole } from '@/lib/auth/roles';
import { logAuthFailure } from '@/lib/auth/errors';
import { loadVettingStatus } from '@/lib/vetting/queries';
import { codeForVettingError, resolveVettingMessage } from '@/lib/vetting/errors';
import { organisationLabels } from '@/lib/vetting/reference';
import { isTransactingRole } from '@/lib/vetting/roles';
import { dateOf, type VettingStatus } from '@/lib/vetting/types';
import { orFallback } from '@/components/vetting/labels';
import SourceStamp from '@/components/ui/SourceStamp';
import ApplicationPanel from '@/components/vetting-status/ApplicationPanel';
import PermissionMatrix from '@/components/vetting-status/PermissionMatrix';
import StateReference from '@/components/vetting-status/StateReference';
import { VETTING_CONTACT } from '@/components/vetting-status/states';
import styles from './page.module.css';

/**
 * Vetting status, read from the database.
 *
 * An organisation waiting on a decision has three questions, and this page is
 * ordered by them: where does my application stand, what can I do in the
 * meantime, and what happens if the answer is no.
 *
 * Sylva vets every organisation that wants to transact before any deal can be
 * created (concept note sections 7 and 8, rule 6). That is the whole reason
 * this screen exists, so the page says it once at the top and then shows
 * exactly where the line falls.
 *
 * What changed when this was wired up:
 *
 *   - The declined "worked example" is gone. It was a second, invented
 *     organisation on a page about yours. The declined, suspended and revoked
 *     states now appear where they belong - as the state of THIS application,
 *     with the reason Sylva actually recorded - and the state reference table
 *     below still shows a reader what each state means before it happens.
 *   - The decision history is shown in full. org.vetting_decision is
 *     append-only: a suspension after an approval does not erase the approval,
 *     and this page does not either. That is Rule 4 made visible.
 *   - Nothing on this page estimates when a decision will arrive. No target
 *     time is published, and "Decision due: Not set" is the honest field.
 *
 * RULE 7. There are no unit volumes on this page at all - a vetting decision
 * concerns an organisation, not a project - so there is nothing here that could
 * be added across projects. The dates are the only figures and they carry a
 * source stamp inside the panel.
 *
 * A refusal from the database ends as a SENTENCE, not as a stack trace. There
 * is no error boundary above this route, so an unhandled throw here is the
 * framework's default error page - which in production says nothing useful and
 * in development shows the reader the SQL. The reads are therefore wrapped and
 * mapped through the same table every other refusal on this platform uses.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('vettingStatus.title'),
    description: t('vettingStatus.metaDescription'),
    // One organisation's application state. Nothing here should be indexed.
    robots: { index: false, follow: true },
  };
}

export default async function VettingStatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const viewer = await requireActor('/vetting/status');
  const role = primaryRole(viewer.roles);

  if (role === null || !isTransactingRole(role)) {
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t('vettingStatus.title')}</h1>
          <p className={styles.lead}>
            {orFallback(
              t,
              'vettingStatus.notApplicable',
              'This page is for organisations that want to buy, own a project or '
              + 'invest. Your account is not one of those, so there is no '
              + 'application to show.',
            )}
          </p>
        </header>
      </div>
    );
  }

  let status: VettingStatus;
  let labels: { sector: string; sizeBand: string; country: string };
  try {
    status = await loadVettingStatus(viewer.actor, role);
    labels = status.organisation
      ? await organisationLabels(locale, status.organisation)
      : { sector: '—', sizeBand: '—', country: '—' };
  } catch (err) {
    // The SQLSTATE goes to the server log; the reader gets a sentence. Never
    // the other way round - "permission denied for table org.vetting_decision"
    // tells a stranger what tables exist.
    logAuthFailure('vetting.status', err);
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t('vettingStatus.title')}</h1>
          <p className={styles.lead} role="alert">
            {resolveVettingMessage(t, codeForVettingError(err))}
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('vettingStatus.title')}</h1>
        <p className={styles.lead}>{t('vettingStatus.lead')}</p>
        <p className={styles.gate}>{t('vettingStatus.gate')}</p>
      </header>

      <section className={styles.section} aria-labelledby="this-application">
        <h2 id="this-application">{t('vettingStatus.section.thisApplication')}</h2>
        <p className={styles.sectionLead}>
          {t('vettingStatus.section.thisApplicationLead')}
        </p>
        <ApplicationPanel
          status={status}
          labels={labels}
          headingId="current-application"
        />
      </section>

      {status.history.length > 0 && (
        <section className={styles.section} aria-labelledby="history">
          <h2 id="history">
            {orFallback(t, 'vettingStatus.history.title', 'Every decision on record')}
          </h2>
          <p className={styles.sectionLead}>
            {orFallback(
              t,
              'vettingStatus.history.lead',
              'The decision record is append-only. A later decision does not '
              + 'replace an earlier one; both stay here, newest first.',
            )}
          </p>
          <div className="table-scroll">
            <table className={styles.history}>
              <thead>
                <tr>
                  <th scope="col">
                    {orFallback(t, 'vettingStatus.history.colDate', 'Decided')}
                  </th>
                  <th scope="col">
                    {orFallback(t, 'vettingStatus.history.colDecision', 'Decision')}
                  </th>
                  <th scope="col">
                    {orFallback(t, 'vettingStatus.history.colReason', 'Recorded reason')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {status.history.map((d) => {
                  const on = dateOf(d.decidedAt);
                  return (
                    <tr key={d.id}>
                      <td>
                        {on ? (
                          <time dateTime={on}>
                            {format.dateTime(new Date(on), 'long')}
                          </time>
                        ) : (
                          t('vettingStatus.field.notSet')
                        )}
                      </td>
                      <td>
                        {orFallback(
                          t,
                          `vettingStatus.decisionKind.${d.decision}`,
                          d.decision,
                        )}
                      </td>
                      {/* Verbatim: this is what Sylva wrote, not a label. */}
                      <td>{d.reason ?? t('vettingStatus.field.notSet')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Every figure carries its source and date, and a decision date is a
              figure. The table is its own read, so it gets its own stamp rather
              than borrowing the application panel's. */}
          <SourceStamp
            source={{
              label: t('vettingStatus.sourceLabel'),
              locator: null,
              asOfDate: dateOf(status.history[0]!.decidedAt) ?? status.history[0]!.decidedAt,
            }}
          />
        </section>
      )}

      <section className={styles.section} aria-labelledby="states">
        <h2 id="states">{t('vettingStatus.section.states')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.section.statesLead')}</p>
        <StateReference currentState={status.state} />
      </section>

      <section className={styles.section} aria-labelledby="matrix">
        <h2 id="matrix">{t('vettingStatus.section.matrix')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.section.matrixLead')}</p>
        <PermissionMatrix currentState={status.state} />
        <p className={styles.legend}>{t('vettingStatus.cellLegend')}</p>
      </section>

      <section className={styles.section} aria-labelledby="limits">
        <h2 id="limits">{t('vettingStatus.section.limits')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.limitsLead')}</p>
        <ul className={styles.limits}>
          <li>{t('vettingStatus.limit.timing')}</li>
          <li>{t('vettingStatus.limit.again')}</li>
        </ul>
        <p className={styles.contact}>
          <a href={`mailto:${VETTING_CONTACT}`} className={styles.contactCta}>
            {t('vettingStatus.next.contactCta')}
          </a>
          <span className={styles.contactAddress}>{VETTING_CONTACT}</span>
        </p>
      </section>

      <section className={styles.section} aria-labelledby="visibility">
        <h2 id="visibility">{t('vettingStatus.section.visibility')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.visibility.lead')}</p>
        <ul className={styles.who}>
          <li>{t('vettingStatus.visibility.sylva')}</li>
          <li>{t('vettingStatus.visibility.auditors')}</li>
        </ul>
        <p className={styles.notRecord}>{t('vettingStatus.visibility.notRecord')}</p>
      </section>

      <footer className={styles.foot}>
        <p className={styles.footLinks}>
          <Link href={status.state === 'not_started' ? '/vetting' : '/vetting?revise=1'}>
            {status.state === 'not_started'
              ? t('vettingStatus.next.questionnaireCta')
              : orFallback(
                  t,
                  'vettingStatus.reapply',
                  'Submit a new application',
                )}
          </Link>
          <Link href="/how-it-works#vetting">{t('vettingStatus.next.howCta')}</Link>
          <Link href="/projects">{t('home.ctaExplore')}</Link>
        </p>
      </footer>
    </div>
  );
}
