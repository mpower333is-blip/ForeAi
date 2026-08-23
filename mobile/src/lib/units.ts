// Display units.
//
// The app computes everything internally in YARDS — the golf engine, the club
// carry distances, the calibration that learns your real distances, and the GPS
// rangefinder math. South African golfers play in METRES, though, so every
// distance shown to the player is converted to metres right at the display edge
// (and any distance the player enters is converted straight back to yards).
// Keeping the internals in one unit means the engine and stored data never have
// to change — only the numbers on screen do.

export const M_PER_YARD = 0.9144;

// Yards → metres (for display). Rounded to a whole metre.
export function ydToM(yd: number): number {
  return Math.round(yd * M_PER_YARD);
}

// Metres → yards (for values the player enters via a metre stepper).
export function mToYd(m: number): number {
  return Math.round(m / M_PER_YARD);
}

// The unit label shown next to distances.
export const DIST_UNIT = "m";

// Format a yard value as a metre string, e.g. 150 → "137 m".
export function fmtDist(yd: number): string {
  return `${ydToM(yd)} ${DIST_UNIT}`;
}
