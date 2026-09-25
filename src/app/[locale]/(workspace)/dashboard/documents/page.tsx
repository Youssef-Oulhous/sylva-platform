import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import DocumentsSection from '@/components/buyer-dashboard/DocumentsSection';
import ProjectDocumentsTable from '@/components/buyer-dashboard/ProjectDocumentsTable';
import { requireRole } from '@/lib/auth/guards';
import { buyerDocuments, buyerOrganisation } from '@/lib/dashboard/queries';
import { buyerText } from '@/lib/dashboard/messages';
import type { BuyerDocuments } from '@/lib/dashboard/types';
import styles from '@/components/buyer-dashboard/BuyerPage.module.css';

/**
 * "Documents" - everything this organisation can reach.
 *
 * Two halves, because they are two different kinds of thing and a single list
 * would hide that. The first is what the organisation lodged or was sent: its
 * vetting response, the decision recorded against it, anything from a deal room,
 * and any signed agreement. The second is new: the documents of the projects it
 * has expressed interest in, which used to mean opening one project page per
 * interest and collecting them by hand.
 *
 * WHICH ROWS APPEAR IS THE DATABASE'S ANSWER. Neither half filters by
 * visibility, and neither may. The six classes are row-level policies on
 * doc.document and doc.document_version, so an approved buyer sees the public and
 * the vetted-buyer documents of those projects, an unapproved one sees the public
 * ones, and a document class it holds no claim on simply does not come back. The
 * class is printed beside each project document rather than assumed.
 *
 * THE DOWNLOAD IS REAL AND CARRIES NO STORAGE KEY. Links go to
 * /api/documents/<id> and /api/projects/<slug>/documents/<id>, which resolve the
 * document again as the reader's own role before serving it. The bucket, the
 * region and the key never reach this page.
 *
 * Rule 7: there is not a unit volume on this page. The only figure is a file
 * size, in kilobytes, with the unit beside it.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('workspace.buyer.documents')} · ${t('workspace.buyer.title')}`,
    description: buyerText(t, 'documentsLead'),
    // An organisation's own document library is not for a search index.
    robots: { index: false, follow: false },
  };
}

export default async function BuyerDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tb = await getTranslations('buyerDashboard');

  const viewer = await requireRole('buyer', '/dashboard/documents');

  let documents: BuyerDocuments = { own: [], projects: [] };
  let orgName = '';
  let failed = false;
  try {
    const [docs, org] = await Promise.all([
      buyerDocuments(viewer.actor, locale),
      buyerOrganisation(viewer.actor, locale),
    ]);
    documents = docs;
    orgName = org.organisation?.legalName ?? '';
  } catch (err) {
    console.error('[buyer] could not read the documents:', err);
    failed = true;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('workspace.buyer.documents')}</h1>
        <p className={styles.lead}>{buyerText(t, 'documentsLead')}</p>
        {orgName === '' ? null : (
          <p className={styles.org}>
            <span className={styles.orgLabel}>{t('mySites.orgLabel')}</span>
            <span className={styles.orgName}>{orgName}</span>
          </p>
        )}
      </header>

      {failed ? (
        <p className={styles.failure} role="alert">{buyerText(t, 'unavailable')}</p>
      ) : (
        <>
          {/* 1. The organisation's own documents, in the three groups the
                 client's design puts them in. All three are rendered even when
                 all three are empty: "no agreement has been signed yet" is the
                 most consequential fact in the section. */}
          <section className={styles.section} aria-labelledby="own-documents">
            <div className={styles.sectionHead}>
              <h2 id="own-documents">{tb('section.documents')}</h2>
              <p className={styles.sectionIntro}>{tb('section.documentsIntro')}</p>
            </div>
            <DocumentsSection documents={documents.own} />
          </section>

          {/* 2. The documents of the projects this organisation is looking at. */}
          <section className={styles.section} aria-labelledby="project-documents">
            <div className={styles.sectionHead}>
              <h2 id="project-documents">{buyerText(t, 'projectDocsTitle')}</h2>
              <p className={styles.sectionIntro}>
                {buyerText(t, 'projectDocsIntro')}
              </p>
            </div>
            <ProjectDocumentsTable documents={documents.projects} />
          </section>
        </>
      )}
    </div>
  );
}
