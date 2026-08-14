// Golf Course API (golfcourseapi.com) — 30,000+ real courses with per-hole data.
//
// A free default key is embedded so online search works out of the box (the
// project owner opted to hardcode their free-tier key). Override it per build
// with EXPO_PUBLIC_GOLF_API_KEY when you want to use your own key/quota.

import { Course, Hole, registerCourse, assignStrokeIndex, hasCourse } from "../data/courses";
import { Coord } from "../lib/geo";

const BASE = "https://api.golfcourseapi.com/v1";
// Free-tier key, embedded by the project owner. Env var takes precedence.
const DEFAULT_KEY = "YNGKY3MKUOLOEXNB2BZSRTHCBM";
const KEY = (process.env.EXPO_PUBLIC_GOLF_API_KEY as string | undefined) || DEFAULT_KEY;

export function isConfigured(): boolean {
  return !!KEY;
}

function authHeaders(): Record<string, string> {
  return KEY ? { Authorization: `Key ${KEY}` } : {};
}

export type CourseSummary = {
  apiId: string;
  name: string;
  location: string;
};

function locationString(loc: any): string {
  if (!loc) return "";
  return [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
}

function displayName(c: any): string {
  const club = c.club_name ?? c.name ?? "Course";
  const course = c.course_name;
  return course && course !== club ? `${club} — ${course}` : club;
}

function mapSummary(c: any): CourseSummary {
  return { apiId: String(c.id), name: displayName(c), location: locationString(c.location) };
}

// Search the online database. Returns [] when unconfigured or offline.
export async function searchOnline(query: string): Promise<CourseSummary[]> {
  if (!KEY || query.trim().length < 2) return [];
  try {
    const res = await fetch(`${BASE}/search?search_query=${encodeURIComponent(query.trim())}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list: any[] = data.courses ?? data.results ?? (Array.isArray(data) ? data : []);
    return list.map(mapSummary);
  } catch {
    return [];
  }
}

// Pick the most complete tee (prefer 18 holes, then the longest).
function pickTee(tees: any): any | null {
  if (!tees) return null;
  const groups: any[] = [];
  if (Array.isArray(tees)) groups.push(...tees);
  else for (const k of Object.keys(tees)) if (Array.isArray(tees[k])) groups.push(...tees[k]);
  if (groups.length === 0) return null;
  return groups
    .filter((t) => Array.isArray(t.holes) && t.holes.length > 0)
    .sort((a, b) => {
      const ah = a.holes.length === 18 ? 1 : 0;
      const bh = b.holes.length === 18 ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return (b.total_yards ?? 0) - (a.total_yards ?? 0);
    })[0] ?? null;
}

// Pull GPS coordinates out of a hole/point if the data source includes them.
// Golf data providers use varied field names, so we probe the common shapes.
function extractCoord(src: any): Coord | undefined {
  if (!src) return undefined;
  const lat = src.latitude ?? src.lat ?? src.Latitude;
  const lng = src.longitude ?? src.lng ?? src.long ?? src.lon ?? src.Longitude;
  if (typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }
  return undefined;
}

function mapCourse(c: any): Course | null {
  const tee = pickTee(c.tees);
  if (!tee) return null;

  const rawHoles: any[] = tee.holes;
  const parsed = rawHoles.map((h) => ({
    par: Number(h.par) || 4,
    yards: Number(h.yardage ?? h.yards ?? 0) || 0,
    handicap: Number(h.handicap ?? h.hcp ?? 0) || 0,
    green: extractCoord(h.green ?? h.green_location ?? h.gps?.green),
    tee: extractCoord(h.tee ?? h.tee_location ?? h.gps?.tee),
  }));

  // Use the API's stroke index (handicap) where present; otherwise derive one.
  const hasSI = parsed.some((h) => h.handicap > 0);
  const si = hasSI ? parsed.map((h) => h.handicap) : assignStrokeIndex(parsed);

  const holes: Hole[] = parsed.map((h, i) => ({
    number: i + 1,
    par: h.par,
    yards: h.yards,
    si: si[i] || i + 1,
    green: h.green,
    tee: h.tee,
  }));

  const par = Number(tee.par_total) || holes.reduce((s, h) => s + h.par, 0);
  const center = extractCoord(c.location);

  return {
    id: `gca-${c.id}`,
    name: displayName(c),
    location: locationString(c.location) || "Golf Course API",
    province: c.location?.state ?? c.location?.country ?? "",
    par,
    holes,
    approxLayout: false, // real per-hole data
    center,
  };
}

// Fetch full course detail, register it, and return it. Null on failure.
export async function fetchCourse(apiId: string): Promise<Course | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}/courses/${apiId}`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.course ?? data;
    const course = mapCourse(c);
    if (course) registerCourse(course);
    return course;
  } catch {
    return null;
  }
}

// Make sure a course id resolves to real data — used when another device joins
// a shared tournament whose course came from the online database. IDs from the
// API look like "gca-<apiId>"; re-fetch and register if we don't have it.
export async function ensureCourse(courseId: string): Promise<boolean> {
  if (hasCourse(courseId)) return true;
  if (courseId.startsWith("gca-")) {
    const course = await fetchCourse(courseId.slice(4));
    return !!course;
  }
  return false;
}

// True if this id refers to an online course that may need hydrating.
export function isOnlineCourseId(courseId: string): boolean {
  return courseId.startsWith("gca-");
}
