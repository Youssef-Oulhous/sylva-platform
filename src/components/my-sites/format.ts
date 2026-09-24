/**
 * How a coordinate and a distance are written on the site pages.
 *
 * Coordinates are NOT run through format.number(). A coordinate is closer to an
 * identifier than to a quantity: it is typed into the form with a decimal
 * point, it is written with a decimal point in the GeoJSON boundary files, and
 * a reader comparing the screen with a file should see the same characters in
 * both. Four decimal places whatever was entered, so a column of them aligns -
 * 0.0001 degrees is about 11 metres.
 */
export function formatDegrees(value: number): string {
  return value.toFixed(4);
}

/**
 * Metres to kilometres, for display only.
 *
 * The database returns metres and the types carry metres; this is the last step
 * before the number reaches a table cell, and the unit label is printed beside
 * it by the caller. Under a kilometre the figure keeps one decimal, because
 * "0 km" from a site 400 m from a boundary is wrong in the direction that
 * matters.
 */
export function kilometresFrom(metres: number): number {
  const km = metres / 1000;
  return km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
}
