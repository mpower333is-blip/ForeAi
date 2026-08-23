// South African golf course catalog.
//
// Course identity (name, town, province, par) is real. Where we don't have an
// official scorecard, the per-hole layout (yardages, stroke index) is generated
// to be realistic and internally consistent, and the course is flagged
// `approxLayout` so the UI can say so. Par + stroke index are what scoring and
// handicap allocation need, and the caddie always lets you set the exact
// distance — so approximate layouts are still fully usable on the course.
//
// To make a course exact, replace its generated holes with the official card
// (or wire a licensed course-data API and hydrate from it).

import { Coord, haversineMeters } from "../lib/geo";

export type Hole = {
  number: number;
  par: number;
  yards: number;
  si: number; // stroke index 1-18 (handicap allocation)
  green?: Coord; // green centre GPS, when the data source provides it
  tee?: Coord; // tee GPS, when available
  greenFront?: Coord; // front of green (for Front/Middle/Back distances)
  greenBack?: Coord; // back of green
};

export type Course = {
  id: string;
  name: string;
  location: string; // "Town, Province"
  province: string;
  par: number;
  holes: Hole[];
  approxLayout?: boolean;
  center?: Coord; // course GPS centre, for the satellite view
};

type Raw = {
  id: string;
  name: string;
  town: string;
  province: string;
  par?: number; // defaults to 72
  yards?: number; // total; layout is scaled to it when given
  lat?: number;
  lng?: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Disjoint slots so par-3s and par-5s never collide or cluster.
const PAR3_SLOTS = [3, 6, 8, 12, 15, 17];
const PAR5_SLOTS = [2, 5, 10, 13, 16, 18];

// Build a full 18-hole layout from a total par (and optional total yardage).
function buildLayout(parTotal: number, totalYards?: number): Hole[] {
  // Choose how many par-3s (a) and par-5s (b). Standard par 72 = 4 and 4;
  // every stroke of total par above/below shifts par-5s up / par-3s up.
  let a = 4;
  let b = 4;
  const delta = parTotal - 72;
  if (delta > 0) b += delta;
  else a += -delta;
  a = clamp(a, 2, 6);
  b = clamp(b, 2, 6);
  if (a + b > 16) b = 16 - a; // leave at least two par-4s

  const par3 = new Set(PAR3_SLOTS.slice(0, a));
  const par5 = new Set(PAR5_SLOTS.slice(0, b));

  const pars: number[] = [];
  for (let h = 1; h <= 18; h++) {
    pars.push(par3.has(h) ? 3 : par5.has(h) ? 5 : 4);
  }

  // Base yardage per par, with a deterministic per-hole wobble.
  const base: Record<number, number> = { 3: 170, 4: 400, 5: 525 };
  const raw = pars.map((p, i) => {
    const wobble = (((i * 37) % 11) - 5) * 6; // -30..+30, deterministic
    return base[p] + wobble;
  });

  // Scale to the known total yardage if we have one.
  let yards = raw;
  if (totalYards && totalYards > 0) {
    const sum = raw.reduce((s, y) => s + y, 0);
    const k = totalYards / sum;
    yards = raw.map((y) => Math.round((y * k) / 5) * 5);
  } else {
    yards = raw.map((y) => Math.round(y / 5) * 5);
  }

  // Stroke index: hardest holes (par-5s, then long par-4s) get the lowest SI.
  const order = pars
    .map((p, i) => ({ i, difficulty: p * 1000 + yards[i] }))
    .sort((x, y) => y.difficulty - x.difficulty);
  const si: number[] = new Array(18);
  order.forEach((o, rank) => {
    si[o.i] = rank + 1;
  });

  return pars.map((par, i) => ({
    number: i + 1,
    par,
    yards: yards[i],
    si: si[i],
  }));
}

// Bundled offline course(s). We ship the event's home course only — Kempton
// Park Golf Club — with its exact scorecard. Any other course is found live
// through the Golf Course API search (real GPS + yardages) and registered at
// runtime, so the app isn't tied to a hard-coded national list.
// prettier-ignore
const RAW_COURSES: Raw[] = [
  { id: "kempton-park", name: "Kempton Park Golf Club", town: "Kempton Park", province: "Gauteng", par: 72, lat: -26.1016, lng: 28.236 },
];

// Exact hole-by-hole cards where we have the real numbers. Par and yardage are
// course facts; stroke index is filled by difficulty where the official SI
// isn't known. Yards are converted from the club's metre distances (× 1.09361).
const EXACT_LAYOUTS: Record<string, { par: number; yards: number }[]> = {
  // Kempton Park Golf Club — middle-of-green distances, OUT 1–9 / IN 10–18.
  "kempton-park": [
    { par: 5, yards: 576 }, { par: 4, yards: 341 }, { par: 4, yards: 386 },
    { par: 4, yards: 386 }, { par: 3, yards: 197 }, { par: 4, yards: 420 },
    { par: 4, yards: 382 }, { par: 5, yards: 430 }, { par: 3, yards: 171 },
    { par: 4, yards: 376 }, { par: 3, yards: 125 }, { par: 5, yards: 467 },
    { par: 5, yards: 450 }, { par: 4, yards: 350 }, { par: 4, yards: 420 },
    { par: 4, yards: 358 }, { par: 3, yards: 176 }, { par: 4, yards: 394 },
  ],
};

function exactLayout(rows: { par: number; yards: number }[]): Hole[] {
  const si = assignStrokeIndex(rows);
  return rows.map((r, i) => ({ number: i + 1, par: r.par, yards: r.yards, si: si[i] }));
}

export const COURSES: Course[] = RAW_COURSES.map((r) => {
  const exact = EXACT_LAYOUTS[r.id];
  const holes = exact ? exactLayout(exact) : buildLayout(r.par ?? 72, r.yards);
  return {
    id: r.id,
    name: r.name,
    province: r.province,
    location: `${r.town}, ${r.province}`,
    par: holes.reduce((sum, h) => sum + h.par, 0),
    holes,
    approxLayout: exact ? false : true,
    center: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : undefined,
  };
});

export const PROVINCES: string[] = Array.from(new Set(COURSES.map((c) => c.province)));

// Courses fetched at runtime from the Golf Course API are registered here so
// getCourse(id) resolves them like the bundled ones.
const DYNAMIC = new Map<string, Course>();

export function registerCourse(course: Course): void {
  DYNAMIC.set(course.id, course);
}

export function hasCourse(id: string): boolean {
  return DYNAMIC.has(id) || COURSES.some((c) => c.id === id);
}

export function getCourse(id: string): Course {
  return DYNAMIC.get(id) ?? COURSES.find((c) => c.id === id) ?? COURSES[0];
}

// A shared helper the API layer reuses to fill missing stroke indexes.
export function assignStrokeIndex(holes: { par: number; yards: number }[]): number[] {
  const order = holes
    .map((h, i) => ({ i, difficulty: h.par * 1000 + h.yards }))
    .sort((a, b) => b.difficulty - a.difficulty);
  const si: number[] = new Array(holes.length);
  order.forEach((o, rank) => {
    si[o.i] = rank + 1;
  });
  return si;
}

export function frontNinePar(course: Course): number {
  return course.holes.slice(0, 9).reduce((s, h) => s + h.par, 0);
}
export function backNinePar(course: Course): number {
  return course.holes.slice(9).reduce((s, h) => s + h.par, 0);
}

// Every course the app knows about right now — bundled plus any imported live.
export function allCourses(): Course[] {
  const seen = new Set(COURSES.map((c) => c.id));
  const extra = Array.from(DYNAMIC.values()).filter((c) => !seen.has(c.id));
  return [...COURSES, ...extra];
}

// Case-insensitive search over name / town / province (bundled + imported).
export function searchCourses(query: string): Course[] {
  const q = query.trim().toLowerCase();
  const list = allCourses();
  if (!q) return list;
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)
  );
}

export type CourseNearby = Course & { distanceKm: number | null };

// Order the known courses by how close their centre is to `coord`. Courses with
// no GPS centre sort last (distanceKm = null) but are still returned, so the
// list stays complete. Pass null to just return the courses unsorted.
export function coursesNearest(coord: Coord | null): CourseNearby[] {
  const list = allCourses();
  const withDist = list.map((c) => ({
    ...c,
    distanceKm:
      coord && c.center ? haversineMeters(coord, c.center) / 1000 : null,
  }));
  if (!coord) return withDist;
  return withDist.sort((a, b) => {
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}
