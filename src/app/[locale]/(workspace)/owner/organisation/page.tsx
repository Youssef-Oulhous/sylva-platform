import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import SourceStamp from '@/components/ui/SourceStamp';
import ApplicationPanel from '@/components/vetting-status/ApplicationPanel';
import { orFallback } from '@/components/vetting/labels';
import { requireRole } from '@/lib/auth/guards';
import { logAuthFailure } from '@/lib/auth/errors';
import { ownerText } from '@/lib/owner/messages';
import { loadVettingStatus } from '@/lib/vetting/queries';
import { organisationLabels } from '@/lib/vetting/reference';
import { codeForVettingError, resolveVettingMessage } from '@/lib/vetting/errors';
import { dateOf, type VettingStatus } from '@/lib/vetting/types';
import styles from './page.module.css';

/**
 * This organisation's own record, and where its vetting stands.
 *
 * "Organisation" is one of the five sections the project owner's area has, and
 * until now it had no page: the link went nowhere and the only route to any of
 * this was /vetting/status, a page written for somebody waiting on a first
 * decision. So an owner had no answer to "what does Sylva hold about us, and are
 * we approved" inside their own workspace.
 *
 * THE ONLY ROUTE TO ITS OWN NAME. org.my_organisation() takes no argument and
 * resolves through the signed actor context, so no id can be substituted and a
 * forged context returns nothing. Reading your own name is not the read that
 * needs a trace; another organisation's name is reachable only through
 * deal.counterparty_legal_name(), which logs it.
 *
 * ONE DATE, BECAUSE THERE IS ONE DATE. org.organisation carries created_at and no
 * updated_at, so the record shows when it was created and says why there is
 * nothing else to show. Inventing a "last updated" would be inventing a fact.
 *
 * THE DECISION HISTORY IS SHOWN IN FULL. org.vetting_decision is append-only: a
 * suspension after an approval does not erase the approval, and this page does
 * not either. Nothing here estimates when a decision will arrive, because no
 * target time is published.
 *
 * A refusal from the database ends as a SENTENCE. There is no error boundary above
 * this route, so an unhandled throw would be the framework's error page - which in
 * development shows the reader the SQL.
 *
 * RULE 7. A vetting decision concerns an organisation, not a project, so there is
 * no unit volume on this page at all.
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
    description: t('vettingStatus.lead'),
    robots: { index: false, follow: false },
  };
}

export default async function OwnerOrganisationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireRole('project_owner', '/owner/organisation');
  const t = await getTranslations();
  const format = await getFormatter();

  let status: VettingStatus;
  let labels: { sector: string; sizeBand: string; country: string };
  try {
    status = await loadVettingStatus(viewer.actor, 'project_owner');
    labels = status.organisation
      ? await organisationLabels(locale, status.organisation)
      : { sector: '—', sizeBand: '—', country: '—' };
  } catch (err) {
    // The SQLSTATE goes to the server log; the reader gets a sentence. Never the
    // other way round - a permission-denied message names tables to a stranger.
    logAuthFailure('owner.organisation', err);
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <h1>{ownerText(t, 'orgTitle')}</h1>
          <p className={styles.lead} role="alert">
            {resolveVettingMessage(t, codeForVettingError(err))}
          </p>
        </header>
      </div>
    );
  }

  const org = status.organisation;
  const createdOn = org ? dateOf(org.createdAt) ?? org.createdAt : null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{ownerText(t, 'orgTitle')}</h1>
        <p className={styles.lead}>{ownerText(t, 'orgLead')}</p>
      </header>

      <section className={styles.section} aria-labelledby="org-record">
        <h2 id="org-record">{ownerText(t, 'orgRecordTitle')}</h2>

        {org === null ? (
          <p className={styles.empty}>{ownerText(t, 'orgNoRecord')}</p>
        ) : (
          <>
            <dl className={styles.pairs}>
              <div className={styles.pair}>
                <dt>{t('project.owner')}</dt>
                <dd>{org.legalName}</dd>
              </div>
              <div className={styles.pair}>
                <dt>{ownerText(t, 'orgCountry')}</dt>
                <dd>{labels.country}</dd>
              </div>
              <div className={styles.pair}>
                <dt>{ownerText(t, 'orgSector')}</dt>
                <dd>{labels.sector}</dd>
              </div>
              <div className={styles.pair}>
                <dt>{ownerText(t, 'orgSizeBand')}</dt>
                <dd>{labels.sizeBand}</dd>
              </div>
              <div className={styles.pair}>
                <dt>{ownerText(t, 'orgRegistered')}</dt>
                <dd>
                  {createdOn ? (
                    <time dateTime={createdOn}>
                      {format.dateTime(new Date(createdOn), 'long')}
                    </time>
                  ) : (
                    t('vettingStatus.field.notSet')
                  )}
                </dd>
              </div>
            </dl>

            <p className={styles.note}>{ownerText(t, 'orgOnlyDate')}</p>

            {/* A date is a figure, so it carries its source. */}
            <SourceStamp
              source={{
                label: ownerText(t, 'orgSource'),
                locator: null,
                asOfDate: createdOn ?? new Date().toISOString().slice(0, 10),
              }}
            />
          </>
        )}
      </section>

      <section className={styles.section} aria-labelledby="org-vetting">
        <h2 id="org-vetting">{t('vettingStatus.section.thisApplication')}</h2>
        <p className={styles.sectionLead}>{t('vettingStatus.gate')}</p>
        <ApplicationPanel
          status={status}
          labels={labels}
          headingId="owner-application"
        />
      </section>

      {status.history.length > 0 && (
        <section className={styles.section} aria-labelledby="org-history">
          <h2 id="org-history">{t('vettingStatus.history.title')}</h2>
          <p className={styles.sectionLead}>{t('vettingStatus.history.lead')}</p>

          <div className="table-scroll">
            <table className={styles.history} aria-label={t('vettingStatus.history.title')}>
              <thead>
                <tr>
                  <th scope="col">{t('vettingStatus.history.colDate')}</th>
                  <th scope="col">{t('vettingStatus.history.colDecision')}</th>
                  <th scope="col">{t('vettingStatus.history.colReason')}</th>
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

          <SourceStamp
            source={{
              label: t('vettingStatus.sourceLabel'),
              locator: null,
              asOfDate:
                dateOf(status.history[0]!.decidedAt) ?? status.history[0]!.decidedAt,
            }}
          />
        </section>
      )}

      <footer className={styles.foot}>
        <p className={styles.footLinks}>
          <Link href="/vetting/status">{t('vettingStatus.title')} &rarr;</Link>
          <Link href="/how-it-works#vetting">{t('vettingStatus.next.howCta')}</Link>
        </p>
      </footer>
    </div>
  );
}
