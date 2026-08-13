// Range Games engine — inRange-style gamified practice. Pure scoring logic so
// it can be unit-tested; the screens supply the inputs (sensor swings or manual
// distance entry) and render the results.

import { SwingMetrics } from "./swingDetector";

export type GameId = "closest" | "target" | "longdrive" | "tempo";

export type GameDef = {
  id: GameId;
  name: string;
  emoji: string;
  blurb: string;
  sensor: boolean; // uses motion capture vs manual entry
};

export const GAMES: GameDef[] = [
  {
    id: "closest",
    name: "Closest to the Pin",
    emoji: "🎯",
    blurb: "Pick a target and stick it close. Points for proximity over 5 shots.",
    sensor: false,
  },
  {
    id: "target",
    name: "Target Challenge",
    emoji: "🏁",
    blurb: "Hit six changing target distances. Score every shot, chase a high score.",
    sensor: false,
  },
  {
    id: "longdrive",
    name: "Long Drive",
    emoji: "💥",
    blurb: "Swing your phone through impact — estimate your carry and beat your best.",
    sensor: true,
  },
  {
    id: "tempo",
    name: "Tempo Trainer",
    emoji: "🎼",
    blurb: "Groove a tour 3:1 tempo. Each swing scored on rhythm and balance.",
    sensor: true,
  },
];

// ---- Proximity (Closest / Target) ----------------------------------------

// Points for finishing `actual` yards when aiming at `target` (0-100).
export function proximityPoints(target: number, actual: number): number {
  const miss = Math.abs(target - actual);
  const pct = miss / Math.max(1, target); // miss as a fraction of the shot
  const pts = Math.round(100 - pct * 350); // ~7% miss ≈ 75 pts, ~28% ≈ 0
  return Math.max(0, Math.min(100, pts));
}

export function proximityLabel(target: number, actual: number): string {
  const miss = Math.abs(target - actual);
  if (miss <= 3) return "Stiff! 🎯";
  if (miss <= 8) return "Great";
  if (miss <= 16) return "Solid";
  if (miss <= 28) return "Room to improve";
  return "Way off";
}

// A repeatable sequence of target distances for the Target Challenge. Seeded by
// a session index so it's deterministic (no Math.random at module scope).
export function targetSequence(seed: number): number[] {
  const pool = [95, 120, 140, 155, 175, 195, 210, 80, 130, 165];
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push(pool[(seed + i * 3) % pool.length]);
  return out;
}

// ---- Long Drive ----------------------------------------------------------

// Rough carry estimate from the impact spike. Phones can't measure club speed,
// so this is a calibrated, relative number for a fun leaderboard — not a
// launch-monitor figure.
export function estimateDriveYards(peakG: number): number {
  const mph = 55 + (peakG - 1) * 22; // same model as the swing coach
  const carry = mph * 2.35; // ~smash-factor mapping to carry
  return Math.max(120, Math.min(360, Math.round(carry)));
}

// ---- Tempo ---------------------------------------------------------------

const IDEAL_TEMPO = 3.0;

// Score a single swing's tempo + balance (0-100).
export function tempoPoints(m: SwingMetrics): number {
  const tempoOff = Math.abs(m.tempoRatio - IDEAL_TEMPO);
  const tempoScore = Math.max(0, 100 - tempoOff * 45); // 3.0 → 100, 2.0/4.0 → ~55
  const balance = (m.setupStability + m.finishBalance) / 2; // 0-100
  return Math.round(tempoScore * 0.7 + balance * 0.3);
}

export function grade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}
