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

// Wind — the golf engine and the weather API work in mph; South Africa uses
// km/h, so wind is converted at the display/input edge just like distance.
export const KMH_PER_MPH = 1.60934;
export function mphToKmh(mph: number): number {
  return Math.round(mph * KMH_PER_MPH);
}
export function kmhToMph(kmh: number): number {
  return Math.round(kmh / KMH_PER_MPH);
}
export const WIND_UNIT = "km/h";

// Temperature — engine baseline is °F; players see °C.
export function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}
export function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}
export const TEMP_UNIT = "°C";
