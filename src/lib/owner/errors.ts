import { authMessage, codeForDatabaseError, isAuthErrorCode, type AuthErrorCode } from '@/lib/auth/errors';

/**
 * What went wrong, in a sentence the owner can act on.
 *
 * The rule, restated from the design contract: a reader gets "You don't have
 * access to this information", never "Something went wrong" and never
 * "error: new row violates row-level security policy for table proj.project".
 * The second is useless and the third tells a stranger what tables exist.
 *
 * Codes from src/lib/auth/errors.ts are reused where they already say the right
 * thing; the ones below are the failures only this area can produce. Each
 * carries an English fallback because src/messages/*.json is owned by another
 * agent: until the keys land a person reads a real sentence rather than
 * "ownerError.slugTaken".
 */

export type OwnerErrorCode =
  | AuthErrorCode
  | 'slug_taken'
  | 'slug_invalid'
  | 'not_editable'
  | 'not_found'
  | 'nothing_to_save'
  | 'geometry_invalid'
  | 'no_unit_type'
  | 'period_overlaps'
  | 'buffer_above_expected'
  | 'already_recorded'
  | 'gate_incomplete';

interface Message {
  readonly key: string;
  readonly fallbackEn: string;
}

const OWNER_MESSAGES: Record<string, Message> = {
  slug_taken: {
    key: 'ownerError.slugTaken',
    fallbackEn: 'Another project already uses that web address. Choose a different one.',
  },
  slug_invalid: {
    key: 'ownerError.slugInvalid',
    fallbackEn:
      'A web address may hold lower-case letters, digits and hyphens only, and must be '
      + 'between 3 and 80 characters.',
  },
  not_editable: {
    key: 'ownerError.notEditable',
    // The database refused the transition; this says which transitions exist
    // rather than restating the refusal.
    fallbackEn:
      'This project cannot be changed in that way at the moment. A project can be sent for '
      + 'review while it is a draft or after Sylva has asked for changes; publication is '
      + "Sylva's step, not yours.",
  },
  not_found: {
    key: 'ownerError.notFound',
    // Deliberately the same answer for "no such project" and "somebody else's
    // project": telling them apart would turn this route into a way to find
    // out which slugs exist as other organisations' drafts.
    fallbackEn: 'No project of yours has that address.',
  },
  nothing_to_save: {
    key: 'ownerError.nothingToSave',
    fallbackEn: 'Nothing was changed, so nothing was recorded.',
  },
  geometry_invalid: {
    key: 'ownerError.geometryInvalid',
    fallbackEn:
      'That boundary could not be read as a valid polygon. It must be GeoJSON holding one '
      + 'Polygon or MultiPolygon in WGS 84, with no self-intersections.',
  },
  no_unit_type: {
    key: 'ownerError.noUnitType',
    fallbackEn:
      'Record the scheme and unit type for this project before recording a volume. A volume '
      + 'means nothing without the unit it is measured in.',
  },
  period_overlaps: {
    key: 'ownerError.periodOverlaps',
    fallbackEn: 'That period overlaps one this project already has. Periods may not overlap.',
  },
  buffer_above_expected: {
    key: 'ownerError.bufferAboveExpected',
    fallbackEn: 'The buffer cannot be larger than the expected issuance.',
  },
  already_recorded: {
    key: 'ownerError.alreadyRecorded',
    fallbackEn: 'That entry is already on the record. Nothing was changed.',
  },
  gate_incomplete: {
    key: 'ownerError.gateIncomplete',
    fallbackEn:
      'Sylva could not publish this project because part of the record is still missing. '
      + 'The readiness list says which part.',
  },
};

export function ownerMessage(code: OwnerErrorCode): Message {
  const own = OWNER_MESSAGES[code];
  if (own) return own;
  const auth = authMessage(code as AuthErrorCode);
  return { key: auth.key, fallbackEn: auth.fallbackEn };
}

export function isOwnerErrorCode(value: unknown): value is OwnerErrorCode {
  return (
    (typeof value === 'string' && Object.hasOwn(OWNER_MESSAGES, value))
    || isAuthErrorCode(value)
  );
}

/**
 * Renders with next-intl where the key exists and with the English sentence
 * where it does not. `t` is from useTranslations()/getTranslations(); next-intl
 * exposes `.has()` on it.
 */
export function resolveOwnerMessage(
  t: { (key: string): string; has?: (key: string) => boolean },
  code: OwnerErrorCode,
): string {
  const m = ownerMessage(code);
  try {
    if (typeof t.has === 'function' && t.has(m.key)) return t(m.key);
  } catch {
    /* fall through to the English sentence */
  }
  return m.fallbackEn;
}

interface PgError { code?: unknown; constraint?: unknown; message?: unknown }

/**
 * A database error, as a code this area can show.
 *
 * The specific cases first, then the shared map in src/lib/auth/errors.ts.
 * SQLSTATEs worth naming here:
 *
 *   23505 + project_slug_key   the web address is taken
 *   23514 project_slug_check   the web address is not a legal slug
 *   23P01                      an EXCLUDE constraint - overlapping periods
 *   SY008                      the publication gate refused an incomplete page
 *   42501 / 0 rows updated     row-level security declined the transition
 *   XX000 from PostGIS         an unreadable or invalid geometry
 */
export function ownerCodeForDatabaseError(err: unknown): OwnerErrorCode {
  const e = err as PgError | null;
  const sqlstate = typeof e?.code === 'string' ? e.code : '';
  const constraint = typeof e?.constraint === 'string' ? e.constraint : '';
  const text = typeof e?.message === 'string' ? e.message : '';

  if (sqlstate === '23505' && constraint.includes('slug')) return 'slug_taken';
  if (sqlstate === '23514' && constraint.includes('slug')) return 'slug_invalid';
  if (sqlstate === '23514' && constraint.includes('buffer_within_expected')) {
    return 'buffer_above_expected';
  }
  if (sqlstate === '23514' && constraint.includes('geom')) return 'geometry_invalid';
  if (sqlstate === '23P01') return 'period_overlaps';
  if (sqlstate === '23505') return 'already_recorded';
  if (sqlstate === 'SY008') return 'gate_incomplete';
  if (/geojson|geometry|postgis/i.test(text)) return 'geometry_invalid';

  return codeForDatabaseError(err);
}

/**
 * The same, for a statement that hands a polygon to PostGIS.
 *
 * PostGIS reports an unreadable GeoJSON body as a bare XX000 carrying a parser
 * message - "null expected (at offset 1)" for a body that is not JSON at all -
 * with no constraint name and no word a general mapper could match on. Read
 * without context that is an internal error, and the honest general answer to
 * an internal error is "not now, try again", which would be exactly wrong: the
 * polygon is what is wrong and trying again will not help.
 *
 * The context is what makes the difference, so it is supplied by the ONE caller
 * that has it rather than guessed at from the message text.
 */
export function geometryCodeForDatabaseError(err: unknown): OwnerErrorCode {
  const sqlstate = typeof (err as PgError | null)?.code === 'string'
    ? (err as PgError).code as string : '';
  // XX000 internal_error and 22023 invalid_parameter_value are the two PostGIS
  // raises for a geometry it cannot parse or cannot accept.
  if (sqlstate === 'XX000' || sqlstate === '22023') return 'geometry_invalid';
  return ownerCodeForDatabaseError(err);
}

/** The SQLSTATE goes to the log, the sentence goes to the person. */
export function logOwnerFailure(where: string, err: unknown): void {
  const e = err as PgError | null;
  console.error(JSON.stringify({
    level: 'error',
    msg: 'owner action failed',
    where,
    sqlstate: typeof e?.code === 'string' ? e.code : null,
    constraint: typeof e?.constraint === 'string' ? e.constraint : null,
    detail: typeof e?.message === 'string' ? e.message : String(err),
  }));
}
