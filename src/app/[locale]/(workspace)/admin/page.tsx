import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import { requireRole } from '@/lib/auth/guards';
import { AREA, OVERVIEW, label, labelWith } from '@/lib/admin/labels';
import { loadOperatorWorkload, type OperatorWorkload } from '@/lib/admin/overview';
import { ROLE_KEY } from '@/lib/admin/types';
import styles from '@/components/admin-area/AdminArea.module.css';

/**
 * Where a Sylva operator lands: what is waiting, not a welcome.
 *
 * /admin did not exist. An operator signing in arrived on the vetting queue,
 * which is one of six duties, and the other five were invisible until somebody
 * remembered to look for them - so questions sent "to the project owner and to
 * us" sat unread and nobody could tell. Every section below is work Sylva owes
 * somebody else, in the order the operator's own navigation lists it, and every
 * line is a link to the screen where that work is done.
 *
 * ONE READ, ONE TRANSACTION. loadOperatorWorkload() runs every statement in one
 * readAs() as sylva_operator, so the counts on this page cannot disagree with
 * each other. A section is never filtered by organisation in this file: the
 * operator's policies are USING (true) because operating the platform means
 * seeing all of it, and a predicate added here would be application code
 * quietly deciding what an operator may see.
 *
 * RULE 7. Every figure on this page counts ROWS - applications, projects,
 * questions, entries - and each one prints the word beside the number. There is
 * no unit volume anywhere on it, so there is nothing that could be added across
 * projects, and the page says so rather than leaving a reader to work it out.
 *
 * RULE I. A failed read is a sentence, not a stack trace: the page renders with
 * the sections it could not read replaced by one line saying so, because an
 * operator who cannot see the vetting count still needs the link to the queue.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: label(t, OVERVIEW.title),
    // An operator work queue naming other organisations has nothing to index.
    robots: { index: false, follow: false },
  };
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page's own guard. The layout is presentation; this is what decides
  // whether the page renders at all. It is still not the security boundary -
  // that is the operator pool and the policies underneath it.
  const viewer = await requireRole('operator', '/admin');

  const t = await getTranslations();
  const format = await getFormatter();

  let work: OperatorWorkload | null = null;
  let failed = false;
  try {
    work = await loadOperatorWorkload(viewer.actor, locale);
  } catch (err) {
    console.error('[admin] could not read the work queue:', err);
    failed = true;
  }

  const day = (iso: string) => (
    <time dateTime={iso} className={styles.mono}>
      {format.dateTime(new Date(iso), 'short')}
    </time>
  );
  const waiting = (days: number) => labelWith(t, OVERVIEW.waitingDays, { count: days });
  const roleName = (code: string) =>
    ROLE_KEY[code] && t.has(`adminVetting.role.${ROLE_KEY[code]}`)
      ? t(`adminVetting.role.${ROLE_KEY[code]}`)
      : code;
  const statusName = (code: string) =>
    t.has(`status.${code}`) ? t(`status.${code}`) : code;

  const stamp = work && (
    <SourceStamp
      source={{ label: label(t, OVERVIEW.sourceLabel), locator: null, asOfDate: work.asOf }}
    />
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{label(t, AREA.eyebrow)}</p>
        <div className={styles.headTop}>
          <h1>{label(t, OVERVIEW.title)}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{label(t, OVERVIEW.lead)}</p>
        <p className={styles.note}>{label(t, AREA.restricted)}</p>
        <p className={styles.note}>{label(t, AREA.countsAreRows)}</p>
        <div className={styles.stamp}>{stamp}</div>
      </header>

      {failed && (
        <p className={styles.failure} role="alert">{label(t, AREA.readFailed)}</p>
      )}

      {work && (
        <>
          {/* ---------------------------------------------- applications --- */}
          <section className={styles.section} aria-labelledby="queue-vetting">
            <div className={styles.sectionHead}>
              <h2 id="queue-vetting">{label(t, OVERVIEW.vettingTitle)}</h2>
              <span className={styles.tag}>
                {labelWith(t, OVERVIEW.vettingCount, { count: work.vettingWaiting })}
              </span>
            </div>
            <p className={styles.sectionLead}>{label(t, OVERVIEW.vettingLead)}</p>

            {work.vettingApplications.length === 0 ? (
              <p className={styles.empty}>{label(t, OVERVIEW.vettingEmpty)}</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption>{label(t, OVERVIEW.vettingCaption)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{label(t, OVERVIEW.colOrganisation)}</th>
                      <th scope="col">{label(t, OVERVIEW.colRole)}</th>
                      <th scope="col">{label(t, OVERVIEW.colAsked)}</th>
                      <th scope="col">{label(t, OVERVIEW.waitingSince)}</th>
                      <th scope="col">
                        <span className="visually-hidden">{label(t, AREA.open)}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {work.vettingApplications.map((a) => (
                      <tr key={a.submissionId}>
                        <th scope="row" className={styles.rowHead}>{a.organisationName}</th>
                        <td>{roleName(a.roleCode)}</td>
                        <td>{day(a.submittedOn)}</td>
                        <td className={styles.nowrap}>{waiting(a.waitingDays)}</td>
                        <td>
                          <Link
                            href={{
                              pathname: '/admin/vetting',
                              query: { application: a.submissionId },
                            }}
                          >
                            {label(t, AREA.open)}
                            <span className="visually-hidden"> {a.organisationName}</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.more}>
              <Link href="/admin/vetting">{label(t, OVERVIEW.vettingAll)}</Link>
            </p>
          </section>

          {/* --------------------------------------------------- projects --- */}
          <section className={styles.section} aria-labelledby="queue-projects">
            <div className={styles.sectionHead}>
              <h2 id="queue-projects">{label(t, OVERVIEW.projectsTitle)}</h2>
            </div>
            <p className={styles.sectionLead}>{label(t, OVERVIEW.projectsLead)}</p>

            <ul className={styles.figures}>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.projectsTotal}</span>
                <span className={styles.figureLabel}>{label(t, OVERVIEW.figProjects)}</span>
              </li>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.projectsPublished}</span>
                <span className={styles.figureLabel}>{label(t, OVERVIEW.figPublished)}</span>
              </li>
            </ul>

            {work.projectsWaiting.length === 0 ? (
              <p className={styles.empty}>{label(t, OVERVIEW.projectsEmpty)}</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption>{label(t, OVERVIEW.projectsCaption)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{label(t, OVERVIEW.colProject)}</th>
                      <th scope="col">{label(t, OVERVIEW.colStatus)}</th>
                      <th scope="col">{label(t, OVERVIEW.colGate)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {work.projectsWaiting.map((p) => (
                      <tr key={p.slug}>
                        <th scope="row" className={styles.rowHead}>
                          <Link href={{ pathname: '/admin/projects', query: { project: p.slug } }}>
                            {p.title}
                          </Link>
                          <span className={styles.sub}>{p.slug}</span>
                        </th>
                        <td><Badge tone="neutral">{statusName(p.status)}</Badge></td>
                        <td>
                          {p.gaps === 0
                            ? label(t, OVERVIEW.gapsNone)
                            : labelWith(t, OVERVIEW.gapsSome, { count: p.gaps })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.more}>
              <Link href="/admin/projects">{label(t, OVERVIEW.projectsAll)}</Link>
            </p>
          </section>

          {/* -------------------------------------------------- questions --- */}
          <section className={styles.section} aria-labelledby="queue-questions">
            <div className={styles.sectionHead}>
              <h2 id="queue-questions">{label(t, OVERVIEW.questionsTitle)}</h2>
            </div>
            <p className={styles.sectionLead}>{label(t, OVERVIEW.questionsLead)}</p>

            <ul className={styles.figures}>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.questionsUnanswered}</span>
                <span className={styles.figureLabel}>
                  {label(t, OVERVIEW.figQuestionsOpen)}
                </span>
              </li>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.questionsTotal}</span>
                <span className={styles.figureLabel}>
                  {label(t, OVERVIEW.figQuestionsTotal)}
                </span>
              </li>
            </ul>

            {work.questionsWaiting.length === 0 ? (
              <p className={styles.empty}>{label(t, OVERVIEW.questionsEmpty)}</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption>{label(t, OVERVIEW.questionsCaption)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{label(t, OVERVIEW.colQuestion)}</th>
                      <th scope="col">{label(t, OVERVIEW.colOrganisation)}</th>
                      <th scope="col">{label(t, OVERVIEW.colAsked)}</th>
                      <th scope="col">{label(t, OVERVIEW.waitingSince)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {work.questionsWaiting.map((q) => (
                      <tr key={q.questionId}>
                        <th scope="row" className={styles.rowHead}>
                          {q.projectTitle}
                          <span className={styles.sub}>{q.excerpt}</span>
                        </th>
                        <td>{q.askerName}</td>
                        <td>{day(q.askedOn)}</td>
                        <td className={styles.nowrap}>{waiting(q.waitingDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.more}>
              <Link href="/admin/questions">{label(t, OVERVIEW.questionsAll)}</Link>
            </p>
          </section>

          {/* ----------------------------------------------- organisations --- */}
          <section className={styles.section} aria-labelledby="queue-orgs">
            <div className={styles.sectionHead}>
              <h2 id="queue-orgs">{label(t, OVERVIEW.orgsTitle)}</h2>
            </div>
            <p className={styles.sectionLead}>{label(t, OVERVIEW.orgsLead)}</p>

            <ul className={styles.figures}>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.organisationsTotal}</span>
                <span className={styles.figureLabel}>{label(t, OVERVIEW.figOrgs)}</span>
              </li>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.organisationsApproved}</span>
                <span className={styles.figureLabel}>
                  {label(t, OVERVIEW.figOrgsApproved)}
                </span>
              </li>
            </ul>

            {work.organisationsApplied.length === 0 ? (
              <p className={styles.empty}>{label(t, OVERVIEW.orgsEmpty)}</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption>{label(t, OVERVIEW.orgsTitle)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{label(t, OVERVIEW.colOrganisation)}</th>
                      <th scope="col">{label(t, OVERVIEW.colApplications)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {work.organisationsApplied.map((o) => (
                      <tr key={o.orgId}>
                        <th scope="row" className={styles.rowHead}>
                          {o.legalName}
                          <span className={styles.sub}>{o.countryCode}</span>
                        </th>
                        <td>{o.applications}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.more}>
              <Link href="/admin/organisations">{label(t, OVERVIEW.orgsAll)}</Link>
            </p>
          </section>

          {/* ------------------------------------------------- the record --- */}
          <section className={styles.section} aria-labelledby="queue-record">
            <div className={styles.sectionHead}>
              <h2 id="queue-record">{label(t, OVERVIEW.recordTitle)}</h2>
            </div>
            <p className={styles.sectionLead}>{label(t, OVERVIEW.recordLead)}</p>

            <ul className={styles.figures}>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.recordEntries}</span>
                <span className={styles.figureLabel}>{label(t, OVERVIEW.figEntries)}</span>
              </li>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.recordNotPublic}</span>
                <span className={styles.figureLabel}>
                  {label(t, OVERVIEW.figNotPublic)}
                </span>
              </li>
              <li className={styles.figure}>
                <span className={styles.figureValue}>{work.recordCorrections}</span>
                <span className={styles.figureLabel}>
                  {label(t, OVERVIEW.figCorrections)}
                </span>
              </li>
            </ul>

            {work.recordLatestOn !== null && (
              <p className={styles.small}>
                {label(t, OVERVIEW.recordLatest)}: {day(work.recordLatestOn)}
              </p>
            )}

            <p className={styles.more}>
              <Link href="/admin/record">{label(t, OVERVIEW.recordAll)}</Link>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
