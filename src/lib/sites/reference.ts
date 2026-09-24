import { ANONYMOUS } from '@/lib/db/actor';
import { readAs } from '@/lib/db/session';

/**
 * The country list on the site form, read from the database.
 *
 * platform.eu_member_state is the only country table this platform has - it is
 * an EU-funded pilot - and it is public reference data granted to
 * sylva_web_anon in migration 0016, so it is read as ANONYMOUS.
 *
 * The LABEL comes from the reader's own locale data via Intl.DisplayNames,
 * falling back to the English name that ships with the row. That is the same
 * choice the organisation panel makes, and the reason is that a country added
 * to the table later arrives translated instead of arriving in English and
 * waiting for somebody to notice. A key per country would be 27 keys in two
 * languages that ICU already knows.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
}

export async function countryOptions(locale: string): Promise<Option[]> {
  const rows = await readAs(ANONYMOUS, (tx) =>
    tx.query<{ code: string; name_en: string }>(
      'SELECT code::text AS code, name_en FROM platform.eu_member_state ORDER BY name_en',
    ),
  );

  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }

  const options = rows.map((r) => {
    let label = r.name_en;
    try {
      label = names?.of(r.code) ?? r.name_en;
    } catch {
      label = r.name_en;
    }
    return { value: r.code, label };
  });

  // Sorted in the reader's language, not in English: a German list running
  // Belgien, Bulgarien, Dänemark reads as a list; one running Austria, Belgium,
  // Bulgaria with German labels does not.
  return options.sort((a, b) => a.label.localeCompare(b.label, locale));
}
