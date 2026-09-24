import { ANONYMOUS } from '@/lib/db/actor';
import { readAs } from '@/lib/db/session';
import type { OwnOrganisation } from './types';

/**
 * The words for an organisation's three coded attributes.
 *
 * sector, size band and country are foreign keys into platform.sector,
 * platform.size_band and platform.eu_member_state, and those tables carry the
 * labels - label_en / label_de / name_en. So a sector Sylva adds later shows up
 * in both languages without a code change, and no code list is duplicated in
 * TypeScript. This is the same reasoning as src/lib/auth/reference.ts, which
 * exists because the registration form's hard-coded lists contained codes the
 * database had never heard of.
 *
 * Read as ANONYMOUS: all three are public reference data granted to
 * sylva_web_anon in migration 0016, and none of them says anything about the
 * organisation asking.
 */

export interface OrganisationLabels {
  readonly sector: string;
  readonly sizeBand: string;
  readonly country: string;
}

export async function organisationLabels(
  locale: string,
  org: OwnOrganisation,
): Promise<OrganisationLabels> {
  // 'de' or anything else. The column list is closed, so naming a column here
  // cannot become an injection point.
  const de = locale === 'de';

  return readAs(ANONYMOUS, async (tx) => {
    const row = await tx.maybe<{
      sector: string | null; size_band: string | null; country: string | null;
    }>(
      `SELECT
         (SELECT CASE WHEN $1::boolean THEN COALESCE(s.label_de, s.label_en)
                      ELSE s.label_en END
            FROM platform.sector s WHERE s.code = $2)          AS sector,
         (SELECT CASE WHEN $1::boolean THEN COALESCE(b.label_de, b.label_en)
                      ELSE b.label_en END
            FROM platform.size_band b WHERE b.code = $3)       AS size_band,
         (SELECT m.name_en
            FROM platform.eu_member_state m WHERE m.code = $4::text) AS country`,
      [de, org.sectorCode, org.sizeBandCode, org.countryCode],
    );

    // The code is shown when the label is missing. A code is ugly and correct;
    // an empty cell reads as "this organisation has no sector", which is a
    // different and false statement.
    return {
      sector: row?.sector ?? org.sectorCode,
      sizeBand: row?.size_band ?? org.sizeBandCode,
      country: row?.country ?? org.countryCode,
    };
  });
}
