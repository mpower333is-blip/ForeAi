// Golf Course API (golfcourseapi.com) — 30,000+ real courses with per-hole data.
//
// The API key is read from EXPO_PUBLIC_GOLF_API_KEY and is NEVER committed to
// the repo. Set it in a local .env, an EAS secret, or a CI secret. Without a
// key the app falls back to the bundled offline course list.

import { Course, Hole, registerCourse, assignStrokeIndex } from "../data/courses";

const BASE = "https://api.golfcourseapi.com/v1";
const KEY = process.env.EXPO_PUBLIC_GOLF_API_KEY as string | undefined;

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

function mapCourse(c: any): Course | null {
  const tee = pickTee(c.tees);
  if (!tee) return null;

  const rawHoles: any[] = tee.holes;
  const parsed = rawHoles.map((h) => ({
    par: Number(h.par) || 4,
    yards: Number(h.yardage ?? h.yards ?? 0) || 0,
    handicap: Number(h.handicap ?? h.hcp ?? 0) || 0,
  }));

  // Use the API's stroke index (handicap) where present; otherwise derive one.
  const hasSI = parsed.some((h) => h.handicap > 0);
  const si = hasSI ? parsed.map((h) => h.handicap) : assignStrokeIndex(parsed);

  const holes: Hole[] = parsed.map((h, i) => ({
    number: i + 1,
    par: h.par,
    yards: h.yards,
    si: si[i] || i + 1,
  }));

  const par = Number(tee.par_total) || holes.reduce((s, h) => s + h.par, 0);

  return {
    id: `gca-${c.id}`,
    name: displayName(c),
    location: locationString(c.location) || "Golf Course API",
    province: c.location?.state ?? c.location?.country ?? "",
    par,
    holes,
    approxLayout: false, // real per-hole data
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
