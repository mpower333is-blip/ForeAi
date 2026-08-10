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
import { COURSES, Course, Hole, getCourse } from "../data/courses";

export type { Hole } from "../data/courses";

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

export type ScoreTotals = {
  out: number; // front nine strokes
  in: number; // back nine strokes
  total: number;
  toPar: number; // total strokes vs par of holes played
  holesPlayed: number;
};

type RoundState = {
  courseId: string;
  courseName: string;
  course: Hole[];
  selectedCourse: Course;
  currentHole: number;
  bag: Club[];
  shots: LoggedShot[];
  scores: Record<number, number>;
  setCourse: (id: string) => void;
  setCurrentHole: (n: number) => void;
  setBag: (bag: Club[]) => void;
  setHoleScore: (hole: number, strokes: number) => void;
  logShot: (s: Omit<LoggedShot, "id" | "strokesGained">) => void;
  removeLastShot: () => void;
  resetRound: () => void;
  // derived
  totalStrokesGained: number;
  shotsForHole: (hole: number) => LoggedShot[];
  categorySG: () => { label: string; value: number }[];
  learned: Record<string, LearnedClub>;
  effectiveBag: Club[];
  scoreTotals: ScoreTotals;
};

const Ctx = createContext<RoundState | null>(null);

let counter = 0;
function makeId() {
  counter += 1;
  return `shot_${counter}`;
}

export function RoundProvider({ children }: { children: React.ReactNode }) {
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [currentHole, setCurrentHole] = useState(1);
  const [bag, setBag] = useState<Club[]>(DEFAULT_BAG);
  const [shots, setShots] = useState<LoggedShot[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});

  const selectedCourse = useMemo(() => getCourse(courseId), [courseId]);

  const setCourse = (id: string) => {
    setCourseId(id);
    setCurrentHole(1);
  };

  const setHoleScore = (hole: number, strokes: number) => {
    setScores((prev) => {
      const next = { ...prev };
      if (strokes <= 0) delete next[hole];
      else next[hole] = strokes;
      return next;
    });
  };

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
    setScores({});
    setCurrentHole(1);
  };

  const totalStrokesGained = useMemo(
    () => round2(shots.reduce((sum, s) => sum + s.strokesGained, 0)),
    [shots]
  );

  const shotsForHole = (hole: number) => shots.filter((s) => s.hole === hole);

  const learned = useMemo(() => learnDistances(shots), [shots]);
  const effectiveBag = useMemo(() => buildEffectiveBag(bag, learned), [bag, learned]);

  const scoreTotals = useMemo<ScoreTotals>(() => {
    const holes = selectedCourse.holes;
    let out = 0;
    let inn = 0;
    let parPlayed = 0;
    let holesPlayed = 0;
    for (const h of holes) {
      const s = scores[h.number];
      if (!s) continue;
      holesPlayed += 1;
      parPlayed += h.par;
      if (h.number <= 9) out += s;
      else inn += s;
    }
    const total = out + inn;
    return { out, in: inn, total, toPar: total - parPlayed, holesPlayed };
  }, [scores, selectedCourse]);

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
    courseId,
    courseName: selectedCourse.name,
    course: selectedCourse.holes,
    selectedCourse,
    currentHole,
    bag,
    shots,
    scores,
    setCourse,
    setCurrentHole,
    setBag,
    setHoleScore,
    logShot,
    removeLastShot,
    resetRound,
    totalStrokesGained,
    shotsForHole,
    categorySG,
    learned,
    effectiveBag,
    scoreTotals,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRound(): RoundState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRound must be used within a RoundProvider");
  return ctx;
}
