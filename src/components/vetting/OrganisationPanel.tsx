import { getTranslations } from 'next-intl/server';
import Badge from '@/components/ui/Badge';
import SourceStamp from '@/components/ui/SourceStamp';
import {
  STATE_FALLBACK_EN,
  STATE_TONE,
} from '@/components/vetting-status/states';
import type { OrganisationLabels } from '@/lib/vetting/reference';
import { dateOf, type OwnOrganisation, type VettingState } from '@/lib/vetting/types';
import { orFallback } from './labels';
import styles from './OrganisationPanel.module.css';

/**
 * Who is answering, and where that organisation stands.
 *
 * A questionnaire with no visible subject is easy to fill in for the wrong
 * entity, so the organisation on the form is stated before the first question.
 * The status is a word as well as a tint, and it says what is and is not
 * available today rather than implying a queue position we cannot know.
 *
 * The name comes from org.my_organisation(), the SECURITY DEFINER function
 * added in migration 0071. It is the ONLY route by which a buyer can read its
 * own legal name: R5 withholds org.organisation.legal_name from every
 * public-facing role, and until that migration it withheld it from the
 * organisation itself too.
 */
export default async function OrganisationPanel({
  organisation,
  labels,
  state,
}: {
  organisation: OwnOrganisation | null;
  labels: OrganisationLabels | null;
  state: VettingState;
}) {
  const t = await getTranslations('vettingForm');

  return (
    <section className={styles.panel} aria-labelledby="vetting-org-title">
      <div className={styles.head}>
        <h2 id="vetting-org-title" className={styles.title}>
          {t('org.title')}
        </h2>
        {/* The tint and the word. Neither is doing the job on its own. */}
        <Badge tone={STATE_TONE[state]}>
          {orFallback(
            t,
            `state.${state}`,
            STATE_FALLBACK_EN[state],
          )}
        </Badge>
      </div>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.nameLabel')}</dt>
          <dd className={styles.value}>{organisation?.legalName ?? '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.sectorLabel')}</dt>
          <dd className={styles.value}>{labels?.sector ?? '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.countryLabel')}</dt>
          <dd className={styles.value}>{labels?.country ?? '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('org.referenceLabel')}</dt>
          {/* An identifier, so it is set in mono - the one other use of the
              mono face besides figures and source stamps. */}
          <dd className={`${styles.value} ${styles.reference}`}>
            {organisation?.id ?? '—'}
          </dd>
        </div>
      </dl>

      <p className={styles.note}>{t('org.statusNote')}</p>

      {organisation && (
        <SourceStamp
          source={{
            label: orFallback(t, 'org.sourceLabel', 'Organisation record'),
            locator: null,
            // org.organisation carries created_at and no updated_at, so this
            // is the only date the record can honestly be stamped with. A
            // later edit by Sylva would not move it; that is a gap in the
            // table, not something to paper over with now().
            asOfDate: dateOf(organisation.createdAt) ?? organisation.createdAt,
          }}
        />
      )}
    </section>
  );
}
