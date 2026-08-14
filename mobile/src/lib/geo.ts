// Geospatial helpers for the on-course GPS rangefinder.

export type Coord = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;
const M_TO_YARDS = 1.09361;

// Great-circle distance between two GPS points, in metres.
export function haversineMeters(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceYards(a: Coord, b: Coord): number {
  return Math.round(haversineMeters(a, b) * M_TO_YARDS);
}

export function metersToYards(m: number): number {
  return Math.round(m * M_TO_YARDS);
}

// Front/Middle/Back-of-green distances (yards) from a position — the classic
// rangefinder readout (Score Capture's B / M / F).
export function greenDistances(
  from: Coord,
  hole: { greenFront?: Coord; green?: Coord; greenBack?: Coord }
): { front?: number; middle?: number; back?: number } {
  return {
    front: hole.greenFront ? distanceYards(from, hole.greenFront) : undefined,
    middle: hole.green ? distanceYards(from, hole.green) : undefined,
    back: hole.greenBack ? distanceYards(from, hole.greenBack) : undefined,
  };
}
