import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import ActorCell from '@/components/auditor/ActorCell';
import { getActor } from '@/lib/auth/session';
import { AUDIT, auditorErrorLabel, DEALS, label } from '@/lib/auditor/labels';
import { logAuditorAccess, readAuditorDeals } from '@/lib/auditor/queries';
import type { AuditDeal, AuditDealEvent } from '@/lib/auditor/types';
import styles from '@/components/auditor/Auditor.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: label(t, DEALS.title), robots: { index: false, follow: false } };
}

/**
 * Deal records.
 *
 * This is the page R5 is about. Everywhere else on the platform a buyer
 * appears as a per-deal label, because the failure the concept note most wants
 * to avoid is one buyer seeing another buyer's position. An auditor sees the
 * legal name AND the label, side by side, which is the only place on the
 * platform where a pseudonymous public row can be tied back to a company.
 *
 * What is NOT here: agreed terms, commitments and interest volumes. The
 * auditor role holds no privilege on deal.deal_terms_version,
 * deal.commitment_entry or deal.interest_volume, so this page cannot show them
 * and does not pretend to - it says so instead. That is a real gap in the
 * grants rather than a decision made here; see the note returned with this
 * change.
 */
export default async function AuditorDealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const actor = await getActor();

  let deals: AuditDeal[] = [];
  let events: AuditDealEvent[] = [];
  let failure: unknown = null;
  try {
    ({ deals, events } = await readAuditorDeals(actor, locale));
  } catch (err) {
    console.error('[auditor] could not read the deals:', err);
    failure = err;
  }
  await logAuditorAccess(actor, 'auditor.deals');

  return (
    <>
      <section className={styles.section} aria-labelledby="auditor-deals">
        <h1 id="auditor-deals">{label(t, DEALS.title)}</h1>
        <p className={styles.lead}>{label(t, DEALS.lead)}</p>
        <p className={styles.small}>{label(t, AUDIT.namesBody)}</p>

        {failure !== null ? (
          <p className={styles.failure} role="alert">
            {label(t, auditorErrorLabel(failure))}
          </p>
        ) : deals.length === 0 ? (
          <p className={styles.empty}>{label(t, DEALS.noDeals)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{label(t, DEALS.colRef)}</th>
                  <th scope="col">{label(t, DEALS.colProject)}</th>
                  <th scope="col">{label(t, DEALS.colBuyer)}</th>
                  <th scope="col">{label(t, DEALS.colOwner)}</th>
                  <th scope="col">{label(t, DEALS.colStage)}</th>
                  <th scope="col">{label(t, DEALS.colDisclosed)}</th>
                  <th scope="col">{label(t, DEALS.colOpened)}</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td className={styles.mono}>
                      <span title={d.id}>{d.shortRef}</span>
                      <span className={styles.sub}>
                        {d.stageEventCount} events · {d.entryCount} record entries
                      </span>
                    </td>
                    <td>
                      {d.projectTitle}
                      <span className={styles.sub}>{d.projectSlug}</span>
                    </td>
                    <td>
                      {d.buyerOrgName}
                      <span className={styles.sub}>
                        {label(t, DEALS.publicLabel)}:{' '}
                        {d.pseudonym ?? label(t, DEALS.noPseudonym)}
                      </span>
                    </td>
                    <td>{d.ownerOrgName}</td>
                    <td>
                      {d.stage}
                      {d.intendedShape && (
                        <span className={styles.sub}>{d.intendedShape}</span>
                      )}
                      {d.stageIsTerminal && (
                        <span className={`${styles.tag} ${styles.tagError}`}>
                          {label(t, DEALS.terminal)}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.tag} ${
                        d.disclosed ? styles.tagPublic : styles.tagPrivate
                      }`}>
                        {label(t, d.disclosed ? DEALS.disclosed : DEALS.notDisclosed)}
                      </span>
                    </td>
                    <td className={styles.nowrap}>
                      <time dateTime={d.openedAt}>
                        {format.dateTime(new Date(d.openedAt), 'short')}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.empty}>{label(t, DEALS.termsGap)}</p>
      </section>

      <section className={styles.section} aria-labelledby="auditor-deal-events">
        <h3 id="auditor-deal-events">{label(t, DEALS.events)}</h3>
        {events.length === 0 ? (
          <p className={styles.empty}>{label(t, DEALS.noEvents)}</p>
        ) : (
          <div className="table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{label(t, DEALS.colRef)}</th>
                  <th scope="col">When</th>
                  <th scope="col">Event</th>
                  <th scope="col">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={`${e.kind}-${e.dealId}-${e.occurredAt}`}>
                    <td className={styles.mono}>
                      <span title={e.dealId}>{e.dealShortRef}</span>
                    </td>
                    <td className={styles.nowrap}>
                      <time dateTime={e.occurredAt}>
                        {format.dateTime(new Date(e.occurredAt), 'short')}
                      </time>
                    </td>
                    <td>
                      {e.description}
                      <span className={styles.sub}>{e.kind}</span>
                    </td>
                    <td><ActorCell actor={e.actor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
