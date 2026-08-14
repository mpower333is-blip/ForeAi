// golfapi.io (v2.3) integration — the key win is the `coordinates` endpoint,
// which gives per-hole GPS (green front/centre/back, tee) so we can draw real
// hole maps and compute Front/Middle/Back distances.
//
// NOTE: this parser is written to golfapi.io's documented v2.3 shape but has
// NOT been verified against a live response yet (the build sandbox blocks the
// host). Confirm/adjust `parseCoordinates` and `parseCourse` once a sample
// response is available. See https://golfapi.io/docs/.
//
// The key is metered (trial = 25 calls) and this repo is public, so the key is
// read from EXPO_PUBLIC_GOLFAPI_KEY only — it is intentionally NOT hardcoded.
// Responses are cached in-memory to conserve the call allowance.

import { Course, Hole, registerCourse, assignStrokeIndex } from "../data/courses";
import { Coord } from "../lib/geo";

const BASE = "https://golfapi.io/api/v2.3";
const KEY = process.env.EXPO_PUBLIC_GOLFAPI_KEY as string | undefined;

export function isGolfApiConfigured(): boolean {
  return !!KEY;
}

const cache = new Map<string, Course>();

async function get(path: string): Promise<any | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function num(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function coord(lat: any, lng: any): Coord | undefined {
  const la = num(lat);
  const ln = num(lng);
  if (la == null || ln == null || (la === 0 && ln === 0)) return undefined;
  return { lat: la, lng: ln };
}

// --- coordinates: per-hole GPS ---------------------------------------------
// Documented shape: { coordinates: [ { poi, location, sideFW, hole, latitude,
// longitude }, ... ] }. POI 1 = green (location 1=front, 2=centre, 3=back);
// POI 11/12 = tee. Adjust here once verified against a real response.
type HoleGps = { green?: Coord; greenFront?: Coord; greenBack?: Coord; tee?: Coord };

export function parseCoordinates(data: any): Record<number, HoleGps> {
  const list: any[] = data?.coordinates ?? (Array.isArray(data) ? data : []);
  const out: Record<number, HoleGps> = {};
  for (const c of list) {
    const hole = num(c.hole);
    const poi = num(c.poi);
    const loc = num(c.location);
    const pt = coord(c.latitude ?? c.lat, c.longitude ?? c.lng ?? c.long);
    if (hole == null || !pt) continue;
    const h = (out[hole] ||= {});
    if (poi === 1) {
      if (loc === 1) h.greenFront = pt;
      else if (loc === 3) h.greenBack = pt;
      else h.green = pt; // location 2 (centre) or unspecified
    } else if (poi === 11 || poi === 12) {
      // prefer a back tee (12); otherwise take whatever tee we see
      if (poi === 12 || !h.tee) h.tee = pt;
    }
  }
  return out;
}

// --- course: pars + stroke indexes -----------------------------------------
export function parseCourse(data: any, gps: Record<number, HoleGps>): Course | null {
  const c = data?.course ?? data;
  if (!c) return null;

  const numHoles = num(c.numHoles) ?? 18;
  const pars: number[] = c.parsMen ?? c.pars ?? c.parsWomen ?? [];
  const indexes: number[] = c.indexesMen ?? c.indexes ?? c.indexesWomen ?? [];

  const parsed = Array.from({ length: numHoles }, (_, i) => ({
    par: num(pars[i]) ?? 4,
    yards: 0,
  }));
  const si = indexes.length === numHoles ? indexes.map((x) => num(x) ?? 0) : assignStrokeIndex(parsed);

  const holes: Hole[] = parsed.map((p, i) => {
    const g = gps[i + 1] ?? {};
    return {
      number: i + 1,
      par: p.par,
      yards: p.yards,
      si: si[i] || i + 1,
      green: g.green,
      greenFront: g.greenFront,
      greenBack: g.greenBack,
      tee: g.tee,
    };
  });

  const par = holes.reduce((s, h) => s + h.par, 0);
  const center = coord(c.latitude, c.longitude);
  const name = c.clubName ? `${c.clubName} — ${c.courseName ?? ""}`.trim().replace(/—\s*$/, "") : c.courseName ?? "Course";

  return {
    id: `gio-${c.courseID ?? c.courseId ?? c.id}`,
    name,
    location: [c.city, c.state, c.country].filter(Boolean).join(", ") || "GolfAPI",
    province: c.state ?? c.country ?? "",
    par,
    holes,
    approxLayout: false,
    center,
  };
}

// Import a course by golfapi.io course id: fetch course + coordinates, combine,
// register, and return it. Uses ~2 API calls (cached thereafter).
export async function importGolfApiCourse(courseId: string): Promise<Course | null> {
  if (cache.has(courseId)) return cache.get(courseId)!;
  const [courseData, coordData] = await Promise.all([
    get(`/courses/${courseId}`),
    get(`/coordinates/${courseId}`),
  ]);
  if (!courseData) return null;
  const gps = coordData ? parseCoordinates(coordData) : {};
  const course = parseCourse(courseData, gps);
  if (course) {
    registerCourse(course);
    cache.set(courseId, course);
  }
  return course;
}
