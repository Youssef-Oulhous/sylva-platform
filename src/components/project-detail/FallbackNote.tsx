import { getTranslations } from 'next-intl/server';
import { label, UI } from '@/lib/projects/labels';
import type { Localised } from '@/lib/projects/types';
import styles from './FallbackNote.module.css';

/**
 * "This paragraph is English because no reviewed translation of it exists."
 *
 * Locale fallback on this platform is PER FIELD, which means a German page can
 * legitimately contain an English paragraph. Silently is the one way it must
 * not happen: a reader has to be able to tell a translated figure from an
 * untranslated one, and a reviewer has to be able to find the gaps by reading
 * the page. So every field that fell back says so, right where it fell back.
 */
export default async function FallbackNote({
  text,
}: {
  text: Localised | null | undefined;
}) {
  if (!text?.isFallback) return null;
  const t = await getTranslations();
  return (
    <p className={styles.note} lang={text.locale}>
      {label(t, UI.fallbackNotice)}
    </p>
  );
}
