import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import styles from './PublicIdentityNote.module.css';

/**
 * Why the form asks for sector, country and size.
 *
 * On the public record an organisation appears as a label such as "Buyer 014"
 * with its sector, country and size, unless it has chosen to be named for that
 * deal (concept note §8). Those three fields are therefore the only part of the
 * organisation's registration that a stranger will ever read, and a registrant
 * should be shown that before typing them rather than after.
 *
 * The specimen is built from the same translated option values the form uses, so
 * the example and the select can never drift apart.
 */

/** DEMO DATA. A fictional organisation, shown to demonstrate the pseudonym. */
const DEMO_ORG = {
  registeredName: 'DEMO Nordwasser Getränke GmbH',
  pseudonymNumber: '014',
  sectorKey: 'register.sector.foodBeverage',
  countryKey: 'register.country.de',
  sizeKey: 'register.size.s4',
} as const;

export default async function PublicIdentityNote() {
  const t = await getTranslations();
  const attributes = [
    t(DEMO_ORG.sectorKey),
    t(DEMO_ORG.countryKey),
    t(DEMO_ORG.sizeKey),
  ].join(` ${t('source.separator')} `);

  return (
    <section className={styles.panel} aria-labelledby="public-identity-title">
      <h2 id="public-identity-title" className={styles.title}>
        {t('register.public.title')}
      </h2>
      <p className={styles.body}>{t('register.public.body')}</p>

      <div className={styles.specimen}>
        <div className={styles.specimenHead}>
          <Badge tone="demo">{t('demo.badge')}</Badge>
        </div>

        <dl className={styles.rows}>
          <dt className={styles.term}>{t('register.public.registeredLabel')}</dt>
          <dd className={styles.value}>{DEMO_ORG.registeredName}</dd>

          <dt className={styles.term}>{t('register.public.publicLabel')}</dt>
          <dd className={styles.value}>
            <span className={styles.pseudonym}>
              {t('register.role.buyer')} {DEMO_ORG.pseudonymNumber}
            </span>
            <span className={styles.attributes}>{attributes}</span>
          </dd>
        </dl>
      </div>

      <p className={styles.note}>{t('register.public.note')}</p>
      <Link href="/record" className={styles.link}>
        {t('register.public.recordLink')}
      </Link>
    </section>
  );
}
