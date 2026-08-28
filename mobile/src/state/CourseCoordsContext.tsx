import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Coord } from "../lib/geo";
import { loadJSON, saveJSON } from "../lib/storage";

// Per-course GPS coordinates captured on-site (walk to each hole and tap to
// record the green front/middle/back and the tee). Persisted on the device, so
// once a course is surveyed it keeps working offline. Export the survey to send
// it back for bundling into the app for everyone.

export type HolePointKey = "green" | "greenFront" | "greenBack" | "tee";
export type HolePoints = Partial<Record<HolePointKey, Coord>>;
export type CoursePoints = Record<number, HolePoints>; // hole number -> points

const KEY = "foreai.coords.v1";

type CourseCoordsState = {
  ready: boolean;
  points: (courseId: string, hole: number) => HolePoints;
  capture: (courseId: string, hole: number, key: HolePointKey, coord: Coord) => void;
  clearPoint: (courseId: string, hole: number, key: HolePointKey) => void;
  greensCaptured: (courseId: string) => number; // holes with a usable pin
  exportCourse: (courseId: string, holeCount: number) => string; // JSON to send back
};

const Ctx = createContext<CourseCoordsState | null>(null);

export function CourseCoordsProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<Record<string, CoursePoints>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJSON<Record<string, CoursePoints>>(KEY).then((saved) => {
      if (saved) setAll(saved);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveJSON(KEY, all);
  }, [all, ready]);

  const value = useMemo<CourseCoordsState>(
    () => ({
      ready,
      points: (courseId, hole) => all[courseId]?.[hole] ?? {},
      capture: (courseId, hole, key, coord) =>
        setAll((prev) => {
          const course = { ...(prev[courseId] ?? {}) };
          course[hole] = { ...(course[hole] ?? {}), [key]: coord };
          return { ...prev, [courseId]: course };
        }),
      clearPoint: (courseId, hole, key) =>
        setAll((prev) => {
          const course = { ...(prev[courseId] ?? {}) };
          const h = { ...(course[hole] ?? {}) };
          delete h[key];
          course[hole] = h;
          return { ...prev, [courseId]: course };
        }),
      greensCaptured: (courseId) => {
        const c = all[courseId] ?? {};
        return Object.values(c).filter((h) => h.green || h.greenFront || h.greenBack).length;
      },
      exportCourse: (courseId, holeCount) => {
        const c = all[courseId] ?? {};
        const holes = Array.from({ length: holeCount }, (_, i) => {
          const p = c[i + 1] ?? {};
          return { number: i + 1, ...p };
        }).filter((h) => h.green || h.greenFront || h.greenBack || h.tee);
        return JSON.stringify({ courseId, holes }, null, 2);
      },
    }),
    [all, ready]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCourseCoords(): CourseCoordsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCourseCoords must be used within a CourseCoordsProvider");
  return v;
}
