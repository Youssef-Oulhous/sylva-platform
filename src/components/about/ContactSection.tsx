import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import Badge from '@/components/ui/Badge';
import { CONTACT_CHANNELS, CONTACT_ROLES } from './about-data';
import shared from './AboutSection.module.css';
import styles from './ContactSection.module.css';

/**
 * Contact.
 *
 * Two deliberate choices.
 *
 * The addresses are not links. They sit on the reserved `.example` domain, which
 * can never resolve, and a mailto: on an address that will bounce is worse than
 * text: it opens the reader's mail client and loses their message. They are
 * printed as text, flagged as placeholders, and become links when Sylva supplies
 * the real ones.
 *
 * The message fields are not inside a <form>. Nothing handles a submission in
 * this pass, and an empty <form> is not inert: with no submit button, pressing
 * Enter in a text field still triggers implicit submission and would navigate
 * away, discarding whatever had been typed. So the fields are a labelled group
 * now, and the <form> element arrives together with the action that handles it.
 * The button is a real button that does nothing, not a disabled one, so it stays
 * reachable by keyboard and its description can explain why.
 */
export default async function ContactSection() {
  const t = await getTranslations();

  return (
    <>
      <h2>{t('about.contact.title')}</h2>
      <p className={shared.lead}>{t('about.contact.lead')}</p>

      <h3 className={shared.subhead}>{t('about.contact.channelsTitle')}</h3>
      <p className={styles.placeholderNote}>
        <Badge tone="demo">{t('about.contact.placeholderBadge')}</Badge>{' '}
        {t('about.contact.placeholderNote')}
      </p>

      <dl className={styles.channels}>
        {CONTACT_CHANNELS.map((c) => (
          <div key={c.id} className={styles.channel}>
            <dt className={styles.purpose}>{t(c.purposeKey)}</dt>
            <dd className={styles.address}>{c.address}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.projectQuestion}>
        <h3 className={styles.projectQuestionTitle}>
          {t('about.contact.projectQuestion')}
        </h3>
        <p className={styles.projectQuestionBody}>
          {t('about.contact.projectQuestionBody')}
        </p>
        <Link href="/projects" className={shared.cta}>
          {t('about.contact.projectQuestionCta')} &rarr;
        </Link>
      </div>

      <h3 className={shared.subhead} id="contact-form-heading">
        {t('about.contact.formTitle')}
      </h3>
      <p className={styles.formNote} id="contact-form-note">
        {t('about.contact.formNote')}
      </p>

      <div
        role="group"
        aria-labelledby="contact-form-heading"
        aria-describedby="contact-form-note"
        className={styles.fields}
      >
        <div className={styles.field}>
          <label htmlFor="contact-name">{t('about.contact.form.name')}</label>
          <input id="contact-name" name="name" type="text" autoComplete="name" />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-organisation">
            {t('about.contact.form.organisation')}
          </label>
          <input
            id="contact-organisation"
            name="organisation"
            type="text"
            autoComplete="organization"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-email">{t('about.contact.form.email')}</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-role">{t('about.contact.form.role')}</label>
          <select id="contact-role" name="role" defaultValue="">
            <option value="" disabled>
              {t('about.contact.form.roleChoose')}
            </option>
            {CONTACT_ROLES.map((key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="contact-subject">{t('about.contact.form.subject')}</label>
          <input id="contact-subject" name="subject" type="text" />
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="contact-message">{t('about.contact.form.message')}</label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            aria-describedby="contact-message-hint"
          />
          <p className={styles.hint} id="contact-message-hint">
            {t('about.contact.form.messageHint')}
          </p>
        </div>

        <div className={styles.actions}>
          {/* type="button": a real, focusable control that submits nothing. */}
          <button type="button" className={styles.submit} aria-describedby="contact-form-note">
            {t('about.contact.form.submit')}
          </button>
        </div>
      </div>
    </>
  );
}
