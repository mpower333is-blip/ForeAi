// Indoor "no-ball" simulator engine.
//
// Turns a SWING (reduced to power + strike-quality, whatever the input device —
// a manual slider today, camera pose or the DIY BLE club sensor later) plus the
// chosen club's carry/dispersion into a shot, advancing the ball down the hole
// until it's holed. Pure and deterministic given an injected RNG, so it's
// unit-testable. Distances are in YARDS (the app engine's unit).

export type SimLie = "tee" | "fairway" | "rough" | "green";

// A swing reduced to two numbers, device-agnostic:
//   power   — fraction of a full swing with the chosen club (0..~1.2)
//   quality — strike quality 0..100 (tempo/balance/centredness); scales accuracy
export type Swing = { power: number; quality: number };

export type Stroke = {
  club: string;
  lie: SimLie; // lie the stroke was played FROM
  fromYd: number; // distance to pin before
  carryYd: number; // distance advanced toward the target
  lateralYd: number; // signed sideways miss: − left, + right
  toYd: number; // distance to pin after
  toLie: SimLie; // lie the ball finished in
  holed: boolean;
};

export const ON_GREEN_YD = 20; // within this of the pin counts as "on the green"
const HOLED_YD = 1.2; // tap-in / holed out off a full swing

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Strike quality (0..100) → 0..1 accuracy factor (1 = flush / dead straight).
function accuracy(quality: number) {
  return clamp(quality, 0, 100) / 100;
}

// Where a full-swing shot finished, from its remaining distance + sideways miss.
function lieFor(toYd: number, lateralYd: number): SimLie {
  if (toYd <= ON_GREEN_YD) return "green";
  return Math.abs(lateralYd) > 22 ? "rough" : "fairway";
}

// One full-swing stroke (tee / fairway / rough). Power scales the club's carry;
// quality + the club's dispersion decide the carry scatter and the sideways miss.
function playFullSwing(p: {
  club: string;
  baseCarryYd: number;
  dispersionYd: number;
  swing: Swing;
  fromYd: number;
  lie: SimLie;
  rng: () => number;
}): Stroke {
  const acc = accuracy(p.swing.quality);
  const disp = Math.max(4, p.dispersionYd);
  const scatter = (p.rng() * 2 - 1) * disp * (1 - acc) * 1.5;
  const carry = Math.max(0, p.baseCarryYd * clamp(p.swing.power, 0, 1.3) + scatter);
  const effCarry = carry * (p.lie === "rough" ? 0.92 : 1); // rough costs a little
  const lateral = (p.rng() * 2 - 1) * disp * (1 - acc) * 2.2;
  const along = p.fromYd - effCarry; // remaining on the target line (overshoot → negative)
  const to = Math.max(0, Math.hypot(along, lateral));
  const holed = to <= HOLED_YD;
  return {
    club: p.club,
    lie: p.lie,
    fromYd: Math.round(p.fromYd),
    carryYd: Math.round(effCarry),
    lateralYd: Math.round(lateral),
    toYd: Math.round(to),
    toLie: holed ? "green" : lieFor(to, lateral),
    holed,
  };
}

// Putting (feet-scale). Power aims for the remaining distance; control error
// shrinks with quality. Holed when it finishes inside the tap-in band.
function putt(p: { fromYd: number; swing: Swing; rng: () => number }): Stroke {
  const feet = p.fromYd * 3;
  const acc = accuracy(p.swing.quality);
  const aimFeet = feet * clamp(p.swing.power <= 0 ? 1 : p.swing.power, 0.5, 1.5);
  const err = (p.rng() * 2 - 1) * Math.max(1.5, feet * 0.18) * (1 - acc * 0.7);
  const leftFeet = Math.abs(feet - (aimFeet + err));
  const holed = leftFeet <= 1.5; // cup band
  const toYd = Math.max(0, leftFeet / 3);
  return {
    club: "Putter",
    lie: "green",
    fromYd: Math.round(p.fromYd * 10) / 10,
    carryYd: Math.round((feet - leftFeet) / 3),
    lateralYd: 0,
    toYd: Math.round(toYd * 10) / 10,
    toLie: "green",
    holed,
  };
}

// Play one stroke from the current lie. The screen supplies the chosen club's
// learned/default carry + dispersion; this stays pure.
export function playStroke(p: {
  club: string;
  baseCarryYd: number;
  dispersionYd: number;
  swing: Swing;
  fromYd: number;
  lie: SimLie;
  rng?: () => number;
}): Stroke {
  const rng = p.rng ?? Math.random;
  if (p.lie === "green") return putt({ fromYd: p.fromYd, swing: p.swing, rng });
  return playFullSwing({ ...p, rng });
}

// A hole in progress.
export type SimHole = {
  lengthYd: number;
  par: number;
  strokes: Stroke[];
  remainingYd: number;
  lie: SimLie;
  done: boolean;
};

export function startHole(lengthYd: number, par: number): SimHole {
  return { lengthYd, par, strokes: [], remainingYd: lengthYd, lie: "tee", done: false };
}

// Apply a stroke to a hole and return the updated hole (does not mutate the input).
export function applyStroke(hole: SimHole, stroke: Stroke): SimHole {
  const strokes = [...hole.strokes, stroke];
  return {
    ...hole,
    strokes,
    remainingYd: stroke.holed ? 0 : stroke.toYd,
    lie: stroke.holed ? "green" : stroke.toLie,
    done: stroke.holed || strokes.length >= 12, // safety cap: pick up after 12
  };
}

export function holeScore(hole: SimHole): number {
  return hole.strokes.length;
}
