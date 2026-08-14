// golfapi.io (v2.3) integration.
//
// Schema confirmed from the docs for /clubs, /courses and /courses/{id}. The
// /coordinates/{id} per-hole GPS shape (POI codes) is still to be verified — the
// coordinate parser below is defensive until then, but course import (pars,
// stroke indexes, real yardages per tee, course centre) is exact.
//
// Call cost: search = 0.1 calls, a course/coordinates fetch = 1 call each.
// The key is metered + the repo is public, so it's read from
// EXPO_PUBLIC_GOLFAPI_KEY only (not hardcoded); results are cached.

import { Course, Hole, registerCourse, assignStrokeIndex } from "../data/courses";
import { Coord } from "../lib/geo";

const BASE = "https://golfapi.io/api/v2.3";
const KEY = process.env.EXPO_PUBLIC_GOLFAPI_KEY as string | undefined;

export function isGolfApiConfigured(): boolean {
  return !!KEY;
}

const courseCache = new Map<string, Course>();

async function get(path: string): Promise<any | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
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
function locationString(c: any): string {
  return [c.city, c.state, c.country].filter(Boolean).join(", ");
}
function displayName(c: any): string {
  const club = c.clubName ?? "";
  const course = c.courseName ?? "";
  if (club && course && course !== club && !/^\d+-hole/i.test(course)) return `${club} — ${course}`;
  return club || course || "Course";
}

// --- search (0.1 calls) ----------------------------------------------------

export type GolfApiSummary = {
  id: string; // courseID
  name: string;
  location: string;
  holes: number;
  hasGps: boolean;
};

export async function searchGolfApi(query: string): Promise<GolfApiSummary[]> {
  if (!KEY || query.trim().length < 2) return [];
  const data = await get(`/courses?name=${encodeURIComponent(query.trim())}&measureUnit=yd`);
  const list: any[] = data?.courses ?? [];
  return list.map((c) => ({
    id: String(c.courseID),
    name: displayName(c),
    location: locationString(c),
    holes: num(c.numHoles) ?? 18,
    hasGps: c.hasGPS === 1 || c.hasGPS === "1",
  }));
}

// --- coordinates: per-hole GPS (defensive, pending verification) ------------
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
      else h.green = pt;
    } else if (poi === 11 || poi === 12) {
      if (poi === 12 || !h.tee) h.tee = pt;
    }
  }
  return out;
}

// --- course (1 call) — exact schema ----------------------------------------

// Pick a sensible default tee (the median by total length ≈ standard men's tee).
function pickTee(tees: any[]): any | null {
  if (!Array.isArray(tees) || tees.length === 0) return null;
  const withTotal = tees.map((t) => {
    let total = 0;
    for (let i = 1; i <= 18; i++) total += num(t[`length${i}`]) ?? 0;
    return { t, total };
  });
  withTotal.sort((a, b) => b.total - a.total);
  return withTotal[Math.floor(withTotal.length / 2)].t;
}

export function parseCourse(data: any, gps: Record<number, HoleGps> = {}): Course | null {
  const c = data?.course ?? data;
  if (!c || !c.courseID) return null;

  const numHoles = num(c.numHoles) ?? 18;
  const pars: any[] = c.parsMen ?? c.parsWomen ?? [];
  const indexes: any[] = c.indexesMen ?? c.indexesWomen ?? [];
  const tee = pickTee(c.tees ?? []);
  const toYards = c.measure === "m" ? 1.09361 : 1; // request uses measureUnit=yd, but guard

  const parsed = Array.from({ length: numHoles }, (_, i) => ({
    par: num(pars[i]) ?? 4,
    yards: tee ? Math.round((num(tee[`length${i + 1}`]) ?? 0) * toYards) : 0,
  }));
  const si =
    indexes.length === numHoles ? indexes.map((x) => num(x) ?? 0) : assignStrokeIndex(parsed);

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

  return {
    id: `gio-${c.courseID}`,
    name: displayName(c),
    location: locationString(c) || "GolfAPI",
    province: c.state ?? c.country ?? "",
    par: holes.reduce((s, h) => s + h.par, 0),
    holes,
    approxLayout: false,
    center: coord(c.latitude, c.longitude),
  };
}

// Import by course id: course (1 call) + coordinates (1 call, only if hasGPS).
export async function importGolfApiCourse(courseId: string, hasGps = true): Promise<Course | null> {
  const cacheKey = `gio-${courseId}`;
  if (courseCache.has(cacheKey)) return courseCache.get(cacheKey)!;

  const courseData = await get(`/courses/${courseId}?measureUnit=yd`);
  if (!courseData) return null;
  const gpsData = hasGps ? await get(`/coordinates/${courseId}`) : null;
  const gps = gpsData ? parseCoordinates(gpsData) : {};

  const course = parseCourse(courseData, gps);
  if (course) {
    registerCourse(course);
    courseCache.set(cacheKey, course);
  }
  return course;
}
