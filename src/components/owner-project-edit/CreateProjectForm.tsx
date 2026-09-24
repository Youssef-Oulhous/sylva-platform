import { getTranslations } from 'next-intl/server';
import { createProjectAction } from '@/lib/owner/actions';
import { ownerText } from '@/lib/owner/messages';
import type { OwnerReference } from '@/lib/owner/types';
import { FieldRow, Note, SelectField, TextField } from './Fields';
import SourceFields from './SourceFields';
import styles from './RecordForm.module.css';

/**
 * A new project: its address, its country, and the two pieces of text no
 * project page can do without.
 *
 * Deliberately small. A project row with no title is a record that says
 * nothing, so the title and summary are written in the same transaction as the
 * project itself; everything else is recorded on the draft afterwards, one
 * section at a time, each with its own source and its own date. Asking for all
 * of it here would mean losing all of it to one refused field.
 *
 * The country list is read from platform.eu_member_state rather than typed into
 * a constant. A hard-coded code list is a foreign key violation waiting to
 * happen - the registration form shipped with one, and every submission it made
 * would have been refused.
 *
 * The owner is not a field. proj.project's insert policy sets owner_org_id from
 * the signed actor context, so there is nothing here to tamper with.
 */
export default async function CreateProjectForm({
  reference,
  locale,
}: {
  reference: OwnerReference;
  locale: string;
}) {
  const t = await getTranslations();
  const tf = await getTranslations('ownerProjectForm');
  const today = new Date().toISOString().slice(0, 10);

  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryLabel = (code: string, fallback: string) => {
    try {
      return regionNames?.of(code) ?? fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <form className={styles.form} action={createProjectAction}>
      <FieldRow>
        <TextField
          id="new-slug" name="slug"
          label={tf('field.slug')} hint={tf('field.slugHint')}
          mono required
        />
        <SelectField
          id="new-country" name="country"
          label={ownerText(t, 'countryField')}
          placeholderOption={ownerText(t, 'notStated')}
          options={reference.countries.map((c) => ({
            value: c.code, label: countryLabel(c.code, c.label),
          }))}
          required
        />
      </FieldRow>

      <FieldRow>
        <TextField
          id="new-title-en" name="title_en"
          label={tf('field.nameEn')} hint={tf('field.nameEnHint')} required
        />
        <TextField
          id="new-title-de" name="title_de"
          label={tf('field.nameDe')} hint={tf('field.nameDeHint')} optional
        />
      </FieldRow>

      <FieldRow>
        <TextField
          id="new-summary-en" name="summary_en"
          label={tf('field.summaryBodyEn')} hint={tf('field.summaryBodyHint')}
          rows={8} required
        />
        <TextField
          id="new-summary-de" name="summary_de"
          label={tf('field.summaryBodyDe')} hint={tf('field.summaryBodyHint')}
          rows={8} optional
        />
      </FieldRow>

      <Note tone="rule">{tf('field.summaryFallback')}</Note>

      <SourceFields prefix="new" defaultAsOf={today} />

      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>
          {ownerText(t, 'createAction')}
        </button>
      </div>
      <p className={styles.note}>{tf('actions.submitNote', {
        draft: t('status.draft'),
        review: t('status.submitted_for_review'),
      })}</p>
    </form>
  );
}
