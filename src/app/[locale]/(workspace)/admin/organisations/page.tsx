import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import OrganisationTable from '@/components/admin-area/OrganisationTable';
import PseudonymLookup from '@/components/admin-area/PseudonymLookup';
import { requireRole } from '@/lib/auth/guards';
import { AREA, ORGS, label, labelWith } from '@/lib/admin/labels';
import {
  loadOperatorOrganisations,
  resolvePseudonym,
  type OperatorOrganisations,
  type ResolvedPseudonym,
} from '@/lib/admin/organisations';
import { logOperatorRead } from '@/lib/admin/record';
import styles from '@/components/admin-area/AdminArea.module.css';

/**
 * Every organisation, and the one screen where a pseudonym can be resolved.
 *
 * TWO JOBS ON ONE PAGE, and they belong together. The first is the state of
 * every organisation: the roles it asked for, the approval it holds for each,
 * and the decisions those approvals were read back from. The second is
 * resolving a label such as "Buyer 003" to the organisation behind it - which
 * the simulation found the operator could not do on any screen at all, although
 * ROLES.md gives it the capability and the database grants it.
 *
 * WHY THE NAMES ARE HERE. org.organisation.legal_name is granted, at column
 * level, to sylva_operator, sylva_auditor and the record role, and to nothing
 * else: a buyer asking for another buyer's legal_name is refused with 42501
 * before any page is involved. So this is the one screen where names are
 * legitimately visible, and the page says why rather than leaving a reader to
 * assume it is an oversight.
 *
 * WHY THE LOOKUP IS ONE LABEL AT A TIME. Rule 5 is what makes a buyer willing
 * to appear on a public record at all. A table of every allocation would be a
 * bulk export of the mapping that rule exists to keep out of sight, so the
 * control takes one label, and every use of it is written to the access log.
 *
 * AN APPROVAL IS NEVER SET. org.org_role_approval is a cache maintained by the
 * SECURITY DEFINER trigger on org.vetting_decision, and
 * ci.assert_approval_is_derived() fails the build if any application role gains
 * a privilege on it. This page therefore has no control that changes a state:
 * an organisation is decided on /admin/vetting, by recording an entry.
 *
 * RULE 7. Every figure here counts organisations, applications or accounts. No
 * cell is a unit volume.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: label(t, ORGS.title),
    // Legal names, registration numbers and the pseudonym mapping. Never indexed.
    robots: { index: false, follow: false },
  };
}

/** Short enough to be a mistake rather than a label. "Buyer 3" is five. */
const MIN_LABEL = 3;

export default async function AdminOrganisationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireRole('operator', '/admin/organisations');

  const t = await getTranslations();
  const query = await searchParams;

  const raw = typeof query.pseudonym === 'string' ? query.pseudonym.trim() : '';
  const asked = raw === '' ? null : raw.slice(0, 120);
  const tooShort = asked !== null && asked.length < MIN_LABEL;

  let list: OperatorOrganisations | null = null;
  let resolved: ResolvedPseudonym[] | null = null;
  let failed = false;
  try {
    list = await loadOperatorOrganisations(viewer.actor, locale);
    if (asked !== null && !tooShort) {
      resolved = await resolvePseudonym(viewer.actor, locale, asked);
    }
  } catch (err) {
    console.error('[admin] could not read the organisations:', err);
    failed = true;
  }

  // Both reads are logged, and the lookup is logged with the label asked for:
  // a restricted capability that leaves no trace is one nobody can audit.
  await logOperatorRead(
    viewer.actor,
    asked !== null && !tooShort ? 'admin.resolvePseudonym' : 'admin.organisations',
    asked !== null && !tooShort ? 'pseudonym' : null,
    asked !== null && !tooShort ? asked : null,
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{label(t, AREA.eyebrow)}</p>
        <div className={styles.headTop}>
          <h1>{label(t, ORGS.title)}</h1>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>
        <p className={styles.lead}>{label(t, ORGS.lead)}</p>
        <p className={`${styles.statement} ${styles.statementStrong}`}>
          {label(t, ORGS.derivedNote)}
        </p>
        <p className={styles.statement}>{label(t, ORGS.r6Note)}</p>
        <p className={styles.note}>{label(t, AREA.restricted)}</p>
        {list && (
          <div className={styles.stamp}>
            <SourceStamp
              source={{
                label: label(t, ORGS.sourceLabel),
                locator: null,
                asOfDate: list.asOf,
              }}
            />
          </div>
        )}
      </header>

      {failed && (
        <p className={styles.failure} role="alert">{label(t, AREA.readFailed)}</p>
      )}

      {/* The lookup comes first: an operator opening this page from the record
          is here to resolve one label, not to read eighteen rows. */}
      {!failed && (
        <PseudonymLookup asked={asked} results={resolved} tooShort={tooShort} />
      )}

      {list && (
        <section className={styles.section} aria-labelledby="orgs-list">
          <h2 id="orgs-list">{label(t, ORGS.listTitle)}</h2>

          <div className={styles.countRow}>
            <p className={styles.count}>
              {labelWith(t, ORGS.count, { count: list.organisations.length })}
            </p>
          </div>

          <p className={styles.small}>{label(t, ORGS.peopleNote)}</p>

          <OrganisationTable organisations={list.organisations} />
        </section>
      )}
    </div>
  );
}
