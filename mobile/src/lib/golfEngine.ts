// ForeAi local golf engine.
//
// Everything here runs fully on-device so the app is useful without a network
// connection. The backend mirrors this logic for persistence + cross-device
// sync, but the caddie, strategy and strokes-gained features never *require* it.

import { ydToM } from "./units";

// ---------------------------------------------------------------------------
// Player bag — default carry distances (yards). Users can tune these in Profile.
// ---------------------------------------------------------------------------

export type Club = {
  name: string;
  carry: number; // typical carry in yards
};

export const DEFAULT_BAG: Club[] = [
  { name: "Driver", carry: 250 },
  { name: "3 Wood", carry: 230 },
  { name: "5 Wood", carry: 215 },
  { name: "Hybrid", carry: 200 },
  { name: "4 Iron", carry: 190 },
  { name: "5 Iron", carry: 180 },
  { name: "6 Iron", carry: 170 },
  { name: "7 Iron", carry: 158 },
  { name: "8 Iron", carry: 145 },
  { name: "9 Iron", carry: 132 },
  { name: "PW", carry: 118 },
  { name: "GW", carry: 100 },
  { name: "SW", carry: 82 },
  { name: "LW", carry: 62 },
];

export type Lie = "tee" | "fairway" | "rough" | "sand" | "recovery";

// ---------------------------------------------------------------------------
// Playing distance — convert the raw yardage on the rangefinder into the
// distance the shot actually needs to fly, accounting for conditions.
// ---------------------------------------------------------------------------

export type Conditions = {
  yardage: number;
  windSpeed?: number; // mph, positive = headwind, negative = tailwind
  elevation?: number; // yards of elevation change, positive = uphill
  lie?: Lie;
  temperature?: number; // °F, optional; thin air / warm air carries further
};

export function playingDistance(c: Conditions): number {
  let d = c.yardage;

  // Wind: roughly 1% of the shot per mph into the wind, ~0.5% downwind.
  if (c.windSpeed) {
    const factor = c.windSpeed > 0 ? 0.01 : 0.005;
    d += c.yardage * factor * c.windSpeed;
  }

  // Elevation: every yard uphill plays about a yard longer (and vice versa).
  if (c.elevation) d += c.elevation;

  // Lie penalties — harder lies cost distance/spin control.
  switch (c.lie) {
    case "rough":
      d += 8;
      break;
    case "sand":
      d += 12;
      break;
    case "recovery":
      d += 15;
      break;
  }

  // Temperature: baseline 70°F, ~2 yds per 10° swing on a full shot.
  if (typeof c.temperature === "number") {
    d -= ((c.temperature - 70) / 10) * 2;
  }

  return Math.round(d);
}

// ---------------------------------------------------------------------------
// Club recommendation — pick the club whose carry is closest to the playing
// distance, then produce a short natural-language rationale.
// ---------------------------------------------------------------------------

export type Recommendation = {
  club: string;
  playingYards: number;
  confidence: "high" | "medium" | "low";
  notes: string[];
};

export function recommendClub(
  c: Conditions,
  bag: Club[] = DEFAULT_BAG
): Recommendation {
  const target = playingDistance(c);
  const sorted = [...bag].sort((a, b) => a.carry - b.carry);

  let best = sorted[sorted.length - 1];
  let bestGap = Math.abs(best.carry - target);
  for (const club of sorted) {
    const gap = Math.abs(club.carry - target);
    if (gap < bestGap) {
      best = club;
      bestGap = gap;
    }
  }

  const notes: string[] = [];
  if (c.windSpeed && Math.abs(c.windSpeed) >= 8) {
    const dM = ydToM(target - c.yardage);
    notes.push(
      c.windSpeed > 0
        ? `Playing ${dM > 0 ? "+" : ""}${dM} m into the wind`
        : `Downwind — plays ${dM} m shorter`
    );
  }
  if (c.elevation && Math.abs(c.elevation) >= 5) {
    const eM = ydToM(c.elevation);
    notes.push(c.elevation > 0 ? `Uphill +${eM} m` : `Downhill ${eM} m`);
  }
  if (c.lie && c.lie !== "fairway" && c.lie !== "tee") {
    notes.push(`${c.lie} lie — take extra club, swing smooth`);
  }
  if (bestGap > 8) {
    notes.push(
      target > best.carry
        ? "In between clubs — commit to the longer number"
        : "Slightly more club than needed — choke down"
    );
  }
  if (notes.length === 0) notes.push("Stock number — make your normal swing");

  const confidence: Recommendation["confidence"] =
    bestGap <= 5 ? "high" : bestGap <= 12 ? "medium" : "low";

  return { club: best.name, playingYards: target, confidence, notes };
}

// ---------------------------------------------------------------------------
// Strokes gained — expected strokes to hole out from a given distance/lie,
// with linear interpolation between benchmark yardages (PGA Tour baselines).
// ---------------------------------------------------------------------------

// Expected strokes to hole out from a distance (yards) on the given surface.
const EXPECTED: Record<string, [number, number][]> = {
  // [yards, expected strokes]
  tee: [
    [100, 2.92],
    [150, 2.99],
    [200, 3.12],
    [250, 3.36],
    [300, 3.71],
    [450, 4.15],
  ],
  fairway: [
    [20, 2.4],
    [50, 2.6],
    [100, 2.8],
    [150, 2.98],
    [200, 3.19],
    [250, 3.45],
  ],
  rough: [
    [20, 2.59],
    [50, 2.82],
    [100, 3.02],
    [150, 3.24],
    [200, 3.53],
  ],
  sand: [
    [20, 2.53],
    [50, 2.92],
    [100, 3.15],
    [150, 3.45],
  ],
  green: [
    [3, 1.04],
    [6, 1.34],
    [12, 1.6],
    [24, 1.88],
    [60, 2.2],
    [90, 2.4],
  ],
};

function interpolate(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

export type Surface = "tee" | "fairway" | "rough" | "sand" | "green";

export function expectedStrokes(yardage: number, surface: Surface = "fairway"): number {
  const table = EXPECTED[surface] ?? EXPECTED.fairway;
  return interpolate(table, yardage);
}

// Strokes gained for a single shot:
//   SG = (expected before) - (expected after) - 1 (for the stroke itself)
export function strokesGainedForShot(params: {
  startYards: number;
  startSurface: Surface;
  endYards: number;
  endSurface: Surface;
  holed?: boolean;
}): number {
  const before = expectedStrokes(params.startYards, params.startSurface);
  const after = params.holed
    ? 0
    : expectedStrokes(params.endYards, params.endSurface);
  return round2(before - after - 1);
}

// ---------------------------------------------------------------------------
// Course strategy — turn hole context into an aggressive/conservative plan.
// ---------------------------------------------------------------------------

export type StrategyInput = {
  parYards: number;
  hazard?: "water-left" | "water-right" | "bunker-front" | "ob-left" | "ob-right" | "none";
  pin?: "front" | "middle" | "back-left" | "back-right" | "tucked";
  miss?: "left" | "right" | "none";
};

export type StrategyPlan = {
  headline: string;
  target: string;
  reasoning: string;
  aggression: "aggressive" | "balanced" | "conservative";
};

export function courseStrategy(input: StrategyInput): StrategyPlan {
  const { hazard = "none", pin = "middle", miss = "none" } = input;

  // Hazard on the same side as the player's miss → play away from trouble.
  const hazardSide = hazard.includes("right")
    ? "right"
    : hazard.includes("left")
    ? "left"
    : null;

  if (hazardSide && miss === hazardSide) {
    return {
      headline: "Protect against the big miss",
      target: hazardSide === "right" ? "Aim at left-center, favor the fat side" : "Aim at right-center, favor the fat side",
      reasoning: `Your miss (${miss}) matches the ${hazard.replace("-", " ")}. Take the hazard out of play and accept a longer putt.`,
      aggression: "conservative",
    };
  }

  if (pin === "tucked" || pin === "back-left" || pin === "back-right") {
    return {
      headline: "Don't chase the flag",
      target: "Middle of the green, uphill putt",
      reasoning: `Pin is ${pin.replace("-", " ")}. The center leaves a makeable putt from anywhere; short-siding costs you a shot.`,
      aggression: "balanced",
    };
  }

  if (pin === "front" && hazard === "bunker-front") {
    return {
      headline: "Fly it past the trouble",
      target: "Back-middle of the green",
      reasoning: "Front bunker guards a front pin — take one more club and land past it. A long putt beats a bunker shot.",
      aggression: "balanced",
    };
  }

  return {
    headline: "Attack the pin",
    target: "Fire at the flag",
    reasoning: "No hazard in your miss pattern and an accessible pin — this is a green-light shot.",
    aggression: "aggressive",
  };
}

// ---------------------------------------------------------------------------
// Smart distances — Arccos-style. Learn each club's real carry and dispersion
// from the player's own logged shots, instead of trusting static bag numbers.
// ---------------------------------------------------------------------------

export type ShotRecord = {
  club: string;
  startYards: number;
  endYards: number;
  holed?: boolean;
};

export type LearnedClub = {
  name: string;
  carry: number; // average yards advanced
  dispersion: number; // std deviation of carry (consistency proxy)
  samples: number;
};

const MIN_SAMPLES = 3; // below this we don't trust the learned number

export function learnDistances(shots: ShotRecord[]): Record<string, LearnedClub> {
  const byClub: Record<string, number[]> = {};
  for (const s of shots) {
    const carry = (s.holed ? s.startYards : s.startYards - s.endYards);
    if (carry <= 0) continue; // ignore putts / mishits that don't advance
    (byClub[s.club] ||= []).push(carry);
  }

  const out: Record<string, LearnedClub> = {};
  for (const [name, carries] of Object.entries(byClub)) {
    const mean = carries.reduce((a, b) => a + b, 0) / carries.length;
    const variance =
      carries.reduce((a, b) => a + (b - mean) ** 2, 0) / carries.length;
    out[name] = {
      name,
      carry: Math.round(mean),
      dispersion: Math.round(Math.sqrt(variance)),
      samples: carries.length,
    };
  }
  return out;
}

// Merge learned carries into the base bag so recommendations use real numbers
// wherever the player has enough shots on record.
export function effectiveBag(
  base: Club[],
  learned: Record<string, LearnedClub>
): Club[] {
  return base.map((c) => {
    const l = learned[c.name];
    return l && l.samples >= MIN_SAMPLES ? { name: c.name, carry: l.carry } : c;
  });
}

export function isLearned(
  name: string,
  learned: Record<string, LearnedClub>
): boolean {
  return !!learned[name] && learned[name].samples >= MIN_SAMPLES;
}

// Expected finishing window from a club's dispersion — "you'll likely end up
// within ±N yards of the target". Falls back to a sensible default.
export function dispersionWindow(
  club: string,
  learned: Record<string, LearnedClub>
): number {
  const l = learned[club];
  if (l && l.samples >= MIN_SAMPLES && l.dispersion > 0) return l.dispersion;
  return 12; // conservative default when we have no data yet
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Handicapping (relative, not official WHS) — course handicap, strokes received
// per hole, and Stableford points. Without slope/rating the course handicap is
// just the rounded index; the app is a scoring aid, not a WHS authority.
// ---------------------------------------------------------------------------

export function courseHandicap(index: number): number {
  return Math.round(index);
}

// WHS-style allocation: everyone gets floor(hcp/18) on every hole, plus one
// extra on the hardest `hcp % 18` holes (by stroke index).
export function strokesReceivedOnHole(courseHcp: number, si: number): number {
  if (courseHcp <= 0) return 0;
  const base = Math.floor(courseHcp / 18);
  const extra = si <= courseHcp % 18 ? 1 : 0;
  return base + extra;
}

// Stableford points for a hole: 2 at net par, +1 per shot better, floored at 0.
export function stablefordPoints(par: number, gross: number, received: number): number {
  const net = gross - received;
  return Math.max(0, 2 - (net - par));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function signed(n: number): string {
  return n > 0 ? `+${round2(n)}` : `${round2(n)}`;
}
