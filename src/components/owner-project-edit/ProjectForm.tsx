import { getTranslations } from 'next-intl/server';
import IdentitySection from './IdentitySection';
import LocationSection from './LocationSection';
import SummarySection from './SummarySection';
import OutcomesSection from './OutcomesSection';
import ClaimRightsSection from './ClaimRightsSection';
import DurabilitySection from './DurabilitySection';
import PartnersSection from './PartnersSection';
import PeriodsSection from './PeriodsSection';
import DocumentsSection from './DocumentsSection';
import FormActions from './FormActions';
import styles from './ProjectForm.module.css';

/**
 * The record, in the order a buyer reads it.
 *
 * The nine sections are the nine sections of the project page, numbered the
 * same way, so an owner filling in section 08 knows which part of the page the
 * answer lands on. That ordering is the point of the form: it is the reason an
 * owner can predict what a buyer will see.
 *
 * FRONTEND PASS. The form has no action, no method and no handler; every control
 * is uncontrolled and nothing on the page is a client component. Native
 * elements do all the work, so no part of this needs one.
 */
export default async function ProjectForm() {
  const t = await getTranslations('ownerProjectForm');

  return (
    <form className={styles.form} noValidate aria-label={t('formLabel')}>
      <IdentitySection />
      <LocationSection />
      <SummarySection />
      <OutcomesSection />
      <ClaimRightsSection />
      <DurabilitySection />
      <PartnersSection />
      <PeriodsSection />
      <DocumentsSection />
      <FormActions />
    </form>
  );
}
