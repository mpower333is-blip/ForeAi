import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Coord } from "../lib/geo";
import { loadJSON, saveJSON } from "../lib/storage";

// Per-course GPS coordinates captured on-site (walk to each hole and tap to
// record the green front/middle/back and the tee).
//
// Two layers, merged for display:
//   • LOCAL  — this device's own captures, persisted so a survey keeps working
//              offline and instantly.
//   • REMOTE — the shared, live survey from Firestore (courseCoords/{courseId}),
//              so a pin captured or corrected by an organiser shows up for
//              everyone within seconds, no app rebuild. Only active when the app
//              is built with EXPO_PUBLIC_USE_FIRESTORE=1.
// Local wins per-point (your fresh capture overrides the shared one); remote
// fills in everything else.

export type HolePointKey = "green" | "greenFront" | "greenBack" | "tee";
export type HolePoints = Partial<Record<HolePointKey, Coord>>;
export type CoursePoints = Record<number, HolePoints>; // hole number -> points

const KEY = "foreai.coords.v1";
const USE_FIRESTORE = process.env.EXPO_PUBLIC_USE_FIRESTORE === "1";

// Lazily require the Firestore sync ONLY in Firestore builds, so the firebase
// SDK is dead-code-eliminated from non-Firestore builds (matches tournamentApi).
type CCSync = typeof import("../services/courseCoordsFirestore");
let _sync: CCSync | null = null;
function sync(): CCSync | null {
  if (!USE_FIRESTORE) return null;
  if (!_sync) {
    try {
      _sync = require("../services/courseCoordsFirestore") as CCSync;
    } catch {
      _sync = null;
    }
  }
  return _sync;
}

// Merge remote (shared) under local (this device) — local point wins.
function mergeCoords(
  remote: Record<string, CoursePoints>,
  local: Record<string, CoursePoints>,
): Record<string, CoursePoints> {
  const out: Record<string, CoursePoints> = {};
  const courseIds = new Set([...Object.keys(remote), ...Object.keys(local)]);
  for (const cid of courseIds) {
    const r = remote[cid] ?? {};
    const l = local[cid] ?? {};
    const holeNums = new Set<number>(
      [...Object.keys(r), ...Object.keys(l)].map((n) => Number(n)).filter((n) => Number.isFinite(n)),
    );
    const cp: CoursePoints = {};
    for (const h of holeNums) cp[h] = { ...(r[h] ?? {}), ...(l[h] ?? {}) };
    out[cid] = cp;
  }
  return out;
}

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
  const [local, setLocal] = useState<Record<string, CoursePoints>>({});
  const [remote, setRemote] = useState<Record<string, CoursePoints>>({});
  const [ready, setReady] = useState(false);

  // Load this device's saved captures.
  useEffect(() => {
    loadJSON<Record<string, CoursePoints>>(KEY).then((saved) => {
      if (saved) setLocal(saved);
      setReady(true);
    });
  }, []);

  // Persist local captures whenever they change.
  useEffect(() => {
    if (ready) saveJSON(KEY, local);
  }, [local, ready]);

  // Subscribe to the live shared survey (Firestore builds only).
  useEffect(() => {
    const s = sync();
    if (!s) return;
    const unsub = s.subscribeCourseCoords((all) => setRemote(all));
    return unsub;
  }, []);

  const all = useMemo(() => mergeCoords(remote, local), [remote, local]);

  const value = useMemo<CourseCoordsState>(
    () => ({
      ready,
      points: (courseId, hole) => all[courseId]?.[hole] ?? {},
      capture: (courseId, hole, key, coord) => {
        setLocal((prev) => {
          const course = { ...(prev[courseId] ?? {}) };
          course[hole] = { ...(course[hole] ?? {}), [key]: coord };
          return { ...prev, [courseId]: course };
        });
        // Publish to the shared live map (fail-soft; non-organisers keep it local).
        sync()?.publishCoursePoint(courseId, hole, key, coord);
      },
      clearPoint: (courseId, hole, key) =>
        setLocal((prev) => {
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
