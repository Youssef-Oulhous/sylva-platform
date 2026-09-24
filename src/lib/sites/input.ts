import { z } from 'zod';

/**
 * What a site form is allowed to say, checked on the SERVER.
 *
 * Kept in its own module, apart from the Server Actions that use it, for one
 * reason: an action calls cookies() and redirect(), so it can only run inside a
 * request, and a validation rule that can only be exercised inside a request is
 * a validation rule nobody tests. This file imports nothing but zod, so
 * tests/db/sites.test.ts can put a latitude of 999 through the real schema
 * rather than through a copy of it.
 *
 * The `required`, `min`, `max` and `step` attributes on the form are a
 * convenience for the person typing. They are not a check: a POST from outside
 * the page never touches them. This is the check.
 */

/** A decimal degree, as a STRING first. */
function degrees(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(32)
    // Deliberately not z.coerce.number(): coercion turns '' into 0, and 0 is a
    // real coordinate in the Gulf of Guinea. A blank latitude must fail, not
    // quietly become the equator. It also refuses 'NaN', 'Infinity' and '1e400',
    // each of which Number() accepts and none of which is a place.
    .refine((v) => /^[+-]?\d+(\.\d+)?$/.test(v), 'not a decimal number')
    .transform(Number)
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, 'out of range');
}

export const SiteFields = z.object({
  label: z.string().trim().min(1).max(200),
  // Two uppercase letters. sylva.country_code enforces the same thing and gets
  // the last word; this is the copy that produces a readable message before the
  // round trip.
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  latitude: degrees(-90, 90),
  longitude: degrees(-180, 180),
});

export const SiteFieldsWithId = SiteFields.extend({ id: z.string().uuid() });

export const SiteIdOnly = z.object({ id: z.string().uuid() });

/**
 * Which field the person should look at, for a form that highlights it. A field
 * NAME is not personal data; the value would be, so it never travels.
 */
export function firstField(err: z.ZodError): string {
  return err.issues[0]?.path.join('.') ?? 'form';
}
