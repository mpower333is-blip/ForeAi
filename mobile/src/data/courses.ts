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
import { SA_COURSES } from "./saCourses";
import { HANDICAPS_CARDS, cardToLayout } from "./handicapsCards";

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

// Tee boxes. Our bundled hole yardages represent the standard men's (white)
// tee; the other tees are scaled from it until we have a course's real per-tee
// scorecard. Par and stroke index don't change with the tee; GPS distances are
// measured live, so they're always exact regardless of tee.
export type TeeId = "red" | "white" | "blue" | "pro";
export type Tee = { id: TeeId; name: string; who: string; factor: number };
export const TEES: Tee[] = [
  { id: "red", name: "Red", who: "Ladies", factor: 0.85 },
  { id: "white", name: "White", who: "Men's", factor: 1.0 },
  { id: "blue", name: "Blue", who: "Championship", factor: 1.06 },
  { id: "pro", name: "Pro", who: "Back", factor: 1.12 },
];
export const DEFAULT_TEE: TeeId = "white";

export function teeFactor(id: TeeId): number {
  return TEES.find((t) => t.id === id)?.factor ?? 1;
}

// Scale a course's hole yardages to the chosen tee (par / SI / GPS untouched).
export function holesForTee(holes: Hole[], id: TeeId): Hole[] {
  const f = teeFactor(id);
  if (f === 1) return holes;
  return holes.map((h) => ({ ...h, yards: Math.round((h.yards * f) / 5) * 5 }));
}

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
  // East Rand courses we're surveying — layout is a placeholder until we
  // capture each hole's GPS on-site (and drop in the real scorecard). Centres
  // are approximate, just to sort them nearest-first and centre the map.
  { id: "serengeti-serengeti", name: "Serengeti — Whistling Thorn", town: "Kempton Park", province: "Gauteng", par: 72, lat: -26.021, lng: 28.418 },
  { id: "serengeti-masai", name: "Serengeti — Masai Mara", town: "Kempton Park", province: "Gauteng", par: 72, lat: -26.021, lng: 28.418 },
  { id: "modderfontein", name: "Modderfontein Golf Club", town: "Modderfontein", province: "Gauteng", par: 72, lat: -26.093, lng: 28.164 },
  { id: "avion-park", name: "Avion Park Golf Club", town: "Kempton Park", province: "Gauteng", par: 72, lat: -26.123, lng: 28.219 },
  // Curated national list of well-known SA courses (names + province/city + par
  // only). No coords/contacts/exact layout — those come from the live Golf Course
  // API when opened online, or a scorecard. Flagged approximate until then.
  ...SA_COURSES,
];

// Exact hole-by-hole cards where we have the real numbers. Par and yardage are
// course facts; stroke index is filled by difficulty where the official SI
// isn't known. Yards are converted from the club's metre distances (× 1.09361).
const EXACT_LAYOUTS: Record<string, { par: number; yards: number; si?: number }[]> = {
  // Kempton Park Golf Club — official Lindsay Saker VW scorecard. Men's tee
  // distances (tee to centre of green) converted from metres ×1.09361, so the
  // app's metres display matches the card exactly; par and stroke index are the
  // card's own. Men card: par 72, 6369 m. OUT 1–9 / IN 10–18.
  "kempton-park": [
    { par: 5, yards: 628, si: 4 },  { par: 4, yards: 364, si: 16 }, { par: 4, yards: 417, si: 8 },
    { par: 4, yards: 444, si: 2 },  { par: 3, yards: 209, si: 10 }, { par: 4, yards: 424, si: 6 },
    { par: 4, yards: 398, si: 14 }, { par: 5, yards: 522, si: 12 }, { par: 3, yards: 179, si: 18 },
    { par: 4, yards: 366, si: 13 }, { par: 3, yards: 159, si: 17 }, { par: 5, yards: 528, si: 11 },
    { par: 5, yards: 537, si: 5 },  { par: 4, yards: 422, si: 1 },  { par: 4, yards: 417, si: 3 },
    { par: 4, yards: 385, si: 9 },  { par: 3, yards: 165, si: 15 }, { par: 4, yards: 401, si: 7 },
  ],
  // Avion Park Golf Club — a 9-hole course (par 35). Captured on-course from
  // the middle-of-green GPS distances (metres → yards ×1.09361), which round-
  // trip back to the exact metres the app displays: 265, 176, 333, 411, 280,
  // 316, 278, 347, 108 m.
  "avion-park": [
    { par: 4, yards: 290 }, { par: 3, yards: 192 }, { par: 4, yards: 364 },
    { par: 5, yards: 449 }, { par: 4, yards: 306 }, { par: 4, yards: 346 },
    { par: 4, yards: 304 }, { par: 4, yards: 379 }, { par: 3, yards: 118 },
  ],
  // Serengeti — Masai Mara (18, par 72). Full card captured on-course from the
  // middle-of-green GPS distances (metres): front 1–9 = 364, 272, 503, 363,
  // 153, 364, 385, 420, 179; back 10–18 = 340, 464, 181, 400, 263, 129, 507,
  // 302, 406. Stored as yards (×1.09361) which round-trip back to those metres.
  "serengeti-masai": [
    { par: 4, yards: 398 }, { par: 4, yards: 297 }, { par: 5, yards: 550 },
    { par: 4, yards: 397 }, { par: 3, yards: 167 }, { par: 4, yards: 398 },
    { par: 4, yards: 421 }, { par: 5, yards: 459 }, { par: 3, yards: 196 },
    { par: 4, yards: 372 }, { par: 5, yards: 507 }, { par: 3, yards: 198 },
    { par: 4, yards: 437 }, { par: 4, yards: 288 }, { par: 3, yards: 141 },
    { par: 5, yards: 554 }, { par: 4, yards: 330 }, { par: 4, yards: 444 },
  ],
  // Modderfontein Golf Club (18, par 72). Full card captured on-course, middle-
  // of-green metres: OUT 1–9 = 387,395,153,388,404,339,375,465,166; IN 10–18 =
  // 478,159,362,459,147,390,317,358,334. Stored as yards (×1.09361).
  // Distances are the on-course GPS survey (middle of green); stroke index is
  // the official handicaps.co.za allocation (Yellow card). Par matches the card.
  "modderfontein": [
    { par: 5, yards: 423, si: 18 }, { par: 4, yards: 432, si: 4 },  { par: 3, yards: 167, si: 14 },
    { par: 4, yards: 424, si: 10 }, { par: 4, yards: 442, si: 2 },  { par: 4, yards: 371, si: 6 },
    { par: 4, yards: 410, si: 8 },  { par: 5, yards: 508, si: 16 }, { par: 3, yards: 182, si: 12 },
    { par: 5, yards: 523, si: 9 },  { par: 3, yards: 174, si: 17 }, { par: 4, yards: 396, si: 3 },
    { par: 5, yards: 502, si: 13 }, { par: 3, yards: 161, si: 11 }, { par: 4, yards: 426, si: 1 },
    { par: 4, yards: 347, si: 15 }, { par: 4, yards: 391, si: 5 },  { par: 4, yards: 365, si: 7 },
  ],
  // Serengeti — Whistling Thorn: an 18-hole PAR-3 course (par 54, every hole
  // par 3). Full card captured on-course (tee-to-pin yards): FRONT 1–9 = 165,
  // 166, 314, 192, 139, 235, 238, 172, 308; BACK 10–18 = 155, 210, 214, 173,
  // 111, 265, 176, 312, 177. Some are long par 3s, but the course is all par 3.
  // Distances are the on-course survey; stroke index is the official
  // handicaps.co.za allocation for the Whistling Thorn par-3 course (Yellow).
  "serengeti-serengeti": [
    { par: 3, yards: 165, si: 7 },  { par: 3, yards: 166, si: 11 }, { par: 3, yards: 314, si: 1 },
    { par: 3, yards: 192, si: 15 }, { par: 3, yards: 139, si: 17 }, { par: 3, yards: 235, si: 5 },
    { par: 3, yards: 238, si: 13 }, { par: 3, yards: 172, si: 9 },  { par: 3, yards: 308, si: 3 },
    { par: 3, yards: 155, si: 14 }, { par: 3, yards: 210, si: 4 },  { par: 3, yards: 214, si: 12 },
    { par: 3, yards: 173, si: 10 }, { par: 3, yards: 111, si: 18 }, { par: 3, yards: 265, si: 2 },
    { par: 3, yards: 176, si: 16 }, { par: 3, yards: 312, si: 8 },  { par: 3, yards: 177, si: 6 },
  ],
};

// Partially-surveyed layouts: real holes where we've captured them, realistic
// estimates for the rest. Flagged `approxLayout` so the app says so, and the
// caddie always lets you set the exact distance on the tee. (Empty right now —
// every surveyed course above has a full card.)
const PARTIAL_LAYOUTS: Record<string, { par: number; yards: number }[]> = {};

function exactLayout(rows: { par: number; yards: number; si?: number }[]): Hole[] {
  // Use the official stroke index when the card gives it; otherwise rank by
  // difficulty as a stand-in.
  const hasOfficialSi = rows.every((r) => typeof r.si === "number");
  const si = hasOfficialSi ? rows.map((r) => r.si as number) : assignStrokeIndex(rows);
  return rows.map((r, i) => ({ number: i + 1, par: r.par, yards: r.yards, si: si[i] }));
}

// Official handicaps.co.za cards, keyed by course id. Hand-written EXACT_LAYOUTS
// (on-course GPS surveys, physical scorecards) take precedence where both exist.
const HCP_LAYOUTS: Record<string, { par: number; yards: number; si?: number }[]> =
  Object.fromEntries(HANDICAPS_CARDS.map((c) => [c.id, cardToLayout(c)]));
const ALL_LAYOUTS: Record<string, { par: number; yards: number; si?: number }[]> = {
  ...HCP_LAYOUTS,
  ...EXACT_LAYOUTS,
};

// Course list: the bundled/curated courses, plus any handicaps.co.za club that
// isn't already present (matched by id upgrades a curated course to an exact card).
const RAW_IDS = new Set(RAW_COURSES.map((r) => r.id));
const HCP_RAW: Raw[] = HANDICAPS_CARDS.filter((c) => !RAW_IDS.has(c.id)).map((c) => ({
  id: c.id, name: c.name, town: c.town, province: c.province, par: c.par, lat: c.lat, lng: c.lng,
}));
const ALL_RAW: Raw[] = [...RAW_COURSES, ...HCP_RAW];

export const COURSES: Course[] = ALL_RAW.map((r) => {
  const exact = ALL_LAYOUTS[r.id];
  const partial = PARTIAL_LAYOUTS[r.id];
  const rows = exact ?? partial;
  const holes = rows ? exactLayout(rows) : buildLayout(r.par ?? 72, r.yards);
  return {
    id: r.id,
    name: r.name,
    province: r.province,
    location: `${r.town}, ${r.province}`,
    par: holes.reduce((sum, h) => sum + h.par, 0),
    holes,
    // Only a fully-captured card is exact; partial and generated are approximate.
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
