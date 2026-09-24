/**
 * English first, German second (concept note section 9).
 *
 * A locale is added here and nowhere else. i18n.locale in the database carries
 * the same two codes and a CHECK constraint, so the two cannot drift apart
 * without a migration.
 */
export const locales = ['en', 'de'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
