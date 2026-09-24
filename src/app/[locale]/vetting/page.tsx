import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import OrganisationPanel from '@/components/vetting/OrganisationPanel';
import VettingProgress from '@/components/vetting/VettingProgress';
import VettingForm from '@/components/vetting/VettingForm';
import styles from './page.module.css';

/**
 * The vetting questionnaire.
 *
 * Vetting is the operator's main safeguard against greenwashing and a condition
 * of the funding behind the pilot (concept note section 7). It is also the gate:
 * no deal can be created for an organisation that has not been approved. So this
 * page has two jobs at once - collect eight answers, and explain itself well
 * enough that the answers are worth reading. Every question states why it is
 * asked, on the page, next to the field, not behind a disclosure control.
 *
 * The page is laid out as a document with an index: the eight questions on the
 * left with a status word against each, the questionnaire itself on the right.
 * A buyer coming back to a half-finished form lands on the list of what is still
 * open and reaches it in one click.
 *
 * FRONTEND PASS. No database, no fetch, no auth, no server actions. The
 * organisation, the saved draft and the three filled-in answers are typed DEMO
 * constants in src/components/vetting/vetting-data.ts. The form has no action,
 * both footer controls are inert buttons, and there is no client component on
 * the page.
 *
 * Rule 7 (no unit volumes added across projects): this page renders no unit
 * volumes at all. Its only figure counts questions in this questionnaire, which
 * is a single document rather than a project, so there is no quantity here that
 * two projects' units could be added into. Volumes stay on the project page,
 * where the unit label travels with the number.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vettingForm' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    // A questionnaire an organisation fills in about itself has nothing to
    // index, and it must not turn up in a search for the organisation's name.
    robots: { index: false, follow: true },
  };
}

export default async function VettingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('vettingForm.title')}</h1>
        <p className={styles.lead}>{t('vettingForm.lead')}</p>

        <div className={styles.demoNote}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
          <p className={styles.demoNoteText}>{t('vettingForm.demoNote')}</p>
        </div>
      </header>

      <OrganisationPanel />

      <div className={styles.layout}>
        {/* Not an <aside>: it is the index to the document beside it, and an
            unlabelled complementary landmark would add noise rather than
            structure. The panel inside carries its own heading. */}
        <div className={styles.side}>
          <VettingProgress />
        </div>

        <div className={styles.body}>
          <section className={styles.why} aria-labelledby="vetting-why-title">
            <h2 id="vetting-why-title">{t('vettingForm.whyTitle')}</h2>
            <p>{t('vettingForm.whyBody1')}</p>
            <p>{t('vettingForm.whyBody2')}</p>
            <p className={styles.readBy}>{t('vettingForm.readBy')}</p>
          </section>

          <VettingForm />

          <section className={styles.next} aria-labelledby="vetting-next-title">
            <h2 id="vetting-next-title">{t('vettingForm.next.title')}</h2>
            <ol className={styles.steps}>
              <li className={styles.step}>{t('vettingForm.next.step1')}</li>
              <li className={styles.step}>{t('vettingForm.next.step2')}</li>
              <li className={styles.step}>{t('vettingForm.next.step3')}</li>
            </ol>

            {/* What approval is not. Stated with the same weight as what it is:
                the client's safeguard is worth nothing if the page lets a reader
                infer that we have audited them or endorsed their claim. */}
            <div className={styles.limit}>
              <h3 className={styles.limitTitle}>{t('vettingForm.next.notTitle')}</h3>
              <p className={styles.limitBody}>{t('vettingForm.next.notBody')}</p>
            </div>

            <p className={styles.away}>
              <Link href="/for-buyers">{t('vettingForm.next.backToBuyers')}</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
