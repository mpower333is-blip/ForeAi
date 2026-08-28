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
  courseHandicap,
  strokesReceivedOnHole,
  stablefordPoints,
} from "../lib/golfEngine";
import { COURSES, Course, Hole, getCourse, hasCourse, TeeId, DEFAULT_TEE, holesForTee } from "../data/courses";
import { useProfile } from "./ProfileContext";

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

export type HoleStats = {
  club?: string; // club off the tee
  fairway?: "hit" | "left" | "right" | "miss"; // tee-shot accuracy
  gir?: boolean; // green in regulation
  putts?: number;
  upDown?: boolean; // got up & down after missing the green
  penalties?: number;
};

export type ScoreTotals = {
  out: number; // front nine strokes
  in: number; // back nine strokes
  total: number;
  toPar: number; // total strokes vs par of holes played
  holesPlayed: number;
  net: number; // net strokes (gross - strokes received)
  points: number; // Stableford points
};

type RoundState = {
  courseId: string;
  courseName: string;
  course: Hole[];
  teeId: TeeId;
  setTee: (id: TeeId) => void;
  selectedCourse: Course;
  currentHole: number;
  bag: Club[];
  shots: LoggedShot[];
  scores: Record<number, number>;
  pickups: Record<number, boolean>;
  holeStats: Record<number, HoleStats>;
  playerHandicap: number;
  courseHcp: number;
  setCourse: (id: string) => void;
  setCurrentHole: (n: number) => void;
  setBag: (bag: Club[]) => void;
  setHoleScore: (hole: number, strokes: number) => void;
  setPickup: (hole: number, picked: boolean) => void;
  setPlayerHandicap: (h: number) => void;
  setHoleStat: (hole: number, patch: Partial<HoleStats>) => void;
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
  // AI caddie calibration — it learns from your first 18 holes, then personalizes.
  calibrationHoles: number; // 0-18 holes logged toward calibration
  isCalibrated: boolean; // true once you've played your first 18 holes
  resetCaddieLearning: () => void;
};

const CALIBRATION_TARGET = 18;

const Ctx = createContext<RoundState | null>(null);

let counter = 0;
function makeId() {
  counter += 1;
  return `shot_${counter}`;
}

export function RoundProvider({ children }: { children: React.ReactNode }) {
  // Default to Kempton Park (the ECS Golf Day home course, and COURSES[0]).
  const [courseId, setCourseId] = useState(
    hasCourse("kempton-park") ? "kempton-park" : COURSES[0].id
  );
  const [currentHole, setCurrentHole] = useState(1);
  const [teeId, setTee] = useState<TeeId>(DEFAULT_TEE);
  const [bag, setBag] = useState<Club[]>(DEFAULT_BAG);
  const [shots, setShots] = useState<LoggedShot[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [pickups, setPickups] = useState<Record<number, boolean>>({});
  const [holeStats, setHoleStats] = useState<Record<number, HoleStats>>({});
  // Handicap is owned by the persisted profile so it's one value everywhere.
  const { handicap: playerHandicap, setHandicap: setPlayerHandicap } = useProfile();
  const courseHcp = courseHandicap(playerHandicap);
  // Career-long shot log the caddie learns from — survives round resets.
  const [learningShots, setLearningShots] = useState<LoggedShot[]>([]);
  const [calibrationHoles, setCalibrationHoles] = useState(0);

  const selectedCourse = useMemo(() => getCourse(courseId), [courseId]);
  // Hole yardages scaled to the selected tee (par / SI / GPS unchanged).
  const teeHoles = useMemo(
    () => holesForTee(selectedCourse.holes, teeId),
    [selectedCourse, teeId]
  );

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
    if (strokes > 0) setPickups((prev) => ({ ...prev, [hole]: false }));
  };

  const setHoleStat = (hole: number, patch: Partial<HoleStats>) => {
    setHoleStats((prev) => ({ ...prev, [hole]: { ...prev[hole], ...patch } }));
  };

  const setPickup = (hole: number, picked: boolean) => {
    setPickups((prev) => ({ ...prev, [hole]: picked }));
    if (picked) setScores((prev) => {
      const next = { ...prev };
      delete next[hole];
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
    const entry = { ...s, id: makeId(), strokesGained };
    // First shot on this hole (this round) counts one hole toward calibration.
    const firstOnHole = shots.every((x) => x.hole !== s.hole);
    setShots((prev) => [...prev, entry]);
    setLearningShots((prev) => [...prev, entry]); // never cleared by resetRound
    if (firstOnHole) setCalibrationHoles((h) => Math.min(CALIBRATION_TARGET, h + 1));
  };

  const removeLastShot = () => setShots((prev) => prev.slice(0, -1));
  const resetRound = () => {
    setShots([]);
    setScores({});
    setPickups({});
    setHoleStats({});
    setCurrentHole(1);
  };

  const resetCaddieLearning = () => {
    setLearningShots([]);
    setCalibrationHoles(0);
  };

  const totalStrokesGained = useMemo(
    () => round2(shots.reduce((sum, s) => sum + s.strokesGained, 0)),
    [shots]
  );

  const shotsForHole = (hole: number) => shots.filter((s) => s.hole === hole);

  // The caddie learns from the whole career log, not just the current round.
  const learned = useMemo(() => learnDistances(learningShots), [learningShots]);
  const isCalibrated = calibrationHoles >= CALIBRATION_TARGET;
  // Only personalize club numbers once the first 18 holes are in the books.
  const effectiveBag = useMemo(
    () => (isCalibrated ? buildEffectiveBag(bag, learned) : bag),
    [bag, learned, isCalibrated]
  );

  const scoreTotals = useMemo<ScoreTotals>(() => {
    const holes = selectedCourse.holes;
    let out = 0;
    let inn = 0;
    let parPlayed = 0;
    let holesPlayed = 0;
    let net = 0;
    let points = 0;
    for (const h of holes) {
      const received = strokesReceivedOnHole(courseHcp, h.si);
      const scored = scores[h.number];
      const isPickup = pickups[h.number];
      if (!scored && !isPickup) continue;
      holesPlayed += 1;
      parPlayed += h.par;
      // A pickup counts as net double bogey for stroke totals, 0 points.
      const gross = isPickup ? h.par + received + 2 : (scored as number);
      if (h.number <= 9) out += gross;
      else inn += gross;
      net += gross - received;
      points += isPickup ? 0 : stablefordPoints(h.par, gross, received);
    }
    const total = out + inn;
    return { out, in: inn, total, toPar: total - parPlayed, holesPlayed, net, points };
  }, [scores, pickups, courseHcp, selectedCourse]);

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
    course: teeHoles,
    teeId,
    setTee,
    selectedCourse,
    currentHole,
    bag,
    shots,
    scores,
    pickups,
    holeStats,
    playerHandicap,
    courseHcp,
    setCourse,
    setCurrentHole,
    setBag,
    setHoleScore,
    setPickup,
    setPlayerHandicap,
    setHoleStat,
    logShot,
    removeLastShot,
    resetRound,
    totalStrokesGained,
    shotsForHole,
    categorySG,
    learned,
    effectiveBag,
    scoreTotals,
    calibrationHoles,
    isCalibrated,
    resetCaddieLearning,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRound(): RoundState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRound must be used within a RoundProvider");
  return ctx;
}
