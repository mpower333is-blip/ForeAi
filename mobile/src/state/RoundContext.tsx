import React, { createContext, useContext, useMemo, useState } from "react";
import {
  Club,
  DEFAULT_BAG,
  Lie,
  Surface,
  strokesGainedForShot,
  round2,
  learnDistances,
  effectiveBag as buildEffectiveBag,
  LearnedClub,
} from "../lib/golfEngine";

// A single logged shot during a live round.
export type LoggedShot = {
  id: string;
  hole: number;
  club: string;
  startYards: number;
  startSurface: Surface;
  endYards: number;
  endSurface: Surface;
  lie: Lie;
  holed: boolean;
  strokesGained: number;
};

export type Hole = {
  number: number;
  par: number;
  yards: number;
};

// A simple 18-hole layout used for the demo round. In a full build this comes
// from a course database keyed by GPS position.
export const DEMO_COURSE: Hole[] = [
  { number: 1, par: 4, yards: 410 },
  { number: 2, par: 5, yards: 538 },
  { number: 3, par: 3, yards: 175 },
  { number: 4, par: 4, yards: 388 },
  { number: 5, par: 4, yards: 445 },
  { number: 6, par: 3, yards: 205 },
  { number: 7, par: 5, yards: 560 },
  { number: 8, par: 4, yards: 402 },
  { number: 9, par: 4, yards: 370 },
  { number: 10, par: 4, yards: 425 },
  { number: 11, par: 3, yards: 160 },
  { number: 12, par: 5, yards: 512 },
  { number: 13, par: 4, yards: 398 },
  { number: 14, par: 4, yards: 460 },
  { number: 15, par: 3, yards: 188 },
  { number: 16, par: 5, yards: 548 },
  { number: 17, par: 4, yards: 355 },
  { number: 18, par: 4, yards: 432 },
];

type RoundState = {
  course: Hole[];
  currentHole: number;
  bag: Club[];
  shots: LoggedShot[];
  setCurrentHole: (n: number) => void;
  setBag: (bag: Club[]) => void;
  logShot: (s: Omit<LoggedShot, "id" | "strokesGained">) => void;
  removeLastShot: () => void;
  resetRound: () => void;
  // derived
  totalStrokesGained: number;
  shotsForHole: (hole: number) => LoggedShot[];
  categorySG: () => { label: string; value: number }[];
  learned: Record<string, LearnedClub>;
  effectiveBag: Club[];
};

const Ctx = createContext<RoundState | null>(null);

let counter = 0;
function makeId() {
  counter += 1;
  return `shot_${counter}`;
}

export function RoundProvider({ children }: { children: React.ReactNode }) {
  const [currentHole, setCurrentHole] = useState(1);
  const [bag, setBag] = useState<Club[]>(DEFAULT_BAG);
  const [shots, setShots] = useState<LoggedShot[]>([]);

  const logShot: RoundState["logShot"] = (s) => {
    const strokesGained = strokesGainedForShot({
      startYards: s.startYards,
      startSurface: s.startSurface,
      endYards: s.endYards,
      endSurface: s.endSurface,
      holed: s.holed,
    });
    setShots((prev) => [...prev, { ...s, id: makeId(), strokesGained }]);
  };

  const removeLastShot = () => setShots((prev) => prev.slice(0, -1));
  const resetRound = () => {
    setShots([]);
    setCurrentHole(1);
  };

  const totalStrokesGained = useMemo(
    () => round2(shots.reduce((sum, s) => sum + s.strokesGained, 0)),
    [shots]
  );

  const shotsForHole = (hole: number) => shots.filter((s) => s.hole === hole);

  const learned = useMemo(() => learnDistances(shots), [shots]);
  const effectiveBag = useMemo(() => buildEffectiveBag(bag, learned), [bag, learned]);

  const categorySG = () => {
    const bucket = (s: LoggedShot): string => {
      if (s.endSurface === "green" || s.startSurface === "green") return "Putting";
      if (s.startSurface === "tee" && s.startYards > 300) return "Off the Tee";
      if (s.startYards <= 40) return "Around the Green";
      return "Approach";
    };
    const groups: Record<string, number> = {
      "Off the Tee": 0,
      Approach: 0,
      "Around the Green": 0,
      Putting: 0,
    };
    for (const s of shots) groups[bucket(s)] = round2(groups[bucket(s)] + s.strokesGained);
    return Object.entries(groups).map(([label, value]) => ({ label, value }));
  };

  const value: RoundState = {
    course: DEMO_COURSE,
    currentHole,
    bag,
    shots,
    setCurrentHole,
    setBag,
    logShot,
    removeLastShot,
    resetRound,
    totalStrokesGained,
    shotsForHole,
    categorySG,
    learned,
    effectiveBag,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRound(): RoundState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRound must be used within a RoundProvider");
  return ctx;
}
