import { ANONYMOUS } from '@/lib/db/actor';
import { readAs } from '@/lib/db/session';

/**
 * The option lists on the registration form, read from the database.
 *
 * They used to be hard-coded arrays in the component with codes like
 * 'food_beverage' and '1_49'. Not one of those codes exists in
 * platform.sector or platform.size_band, so every one of them would have been
 * refused by a foreign key the moment the form was wired to anything. Reference
 * data belongs in the reference tables; the form reads it.
 *
 * The labels come with the rows - platform.sector.label_en / label_de - so the
 * list is translated by the same authority that owns the codes, and a sector
 * added later appears in both languages without a code change.
 *
 * Read as ANONYMOUS: registration happens before anybody is signed in, and
 * these three tables are public reference data granted to sylva_web_anon in
 * migration 0016.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
}

export interface RegistrationReference {
  readonly sectors: readonly Option[];
  readonly sizeBands: readonly Option[];
  readonly countries: readonly Option[];
}

export async function registrationReference(locale: string): Promise<RegistrationReference> {
  // 'de' or anything else; the column list is closed, so this cannot be an
  // injection point even though it names a column.
  const de = locale === 'de';

  return readAs(ANONYMOUS, async (tx) => {
    const sectors = await tx.query<{ code: string; label: string }>(
      `SELECT code, CASE WHEN $1::boolean THEN COALESCE(label_de, label_en) ELSE label_en END AS label
         FROM platform.sector ORDER BY label_en`,
      [de],
    );
    const sizeBands = await tx.query<{ code: string; label: string }>(
      `SELECT code, CASE WHEN $1::boolean THEN COALESCE(label_de, label_en) ELSE label_en END AS label
         FROM platform.size_band ORDER BY code DESC`,
      [de],
    );
    // The country of registration. The EU member states are the list this
    // platform has: an EU-funded pilot, and platform.eu_member_state is the
    // only country table in the database.
    const countries = await tx.query<{ code: string; label: string }>(
      `SELECT code::text AS code, name_en AS label
         FROM platform.eu_member_state ORDER BY name_en`,
    );

    return {
      sectors: sectors.map((r) => ({ value: r.code, label: r.label })),
      sizeBands: sizeBands.map((r) => ({ value: r.code, label: r.label })),
      countries: countries.map((r) => ({ value: r.code, label: r.label })),
    };
  });
}
