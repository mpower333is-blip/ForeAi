// Offline cache for hole satellite images.
//
// Each hole's satellite photo (a stable, course-framed PNG — see holeSatellite)
// is saved to the app's document directory so it loads with no network. Images
// are cached on first view, and a course can be pre-downloaded in full via
// prefetchCourse() so it works fully offline on the course.

import * as FileSystem from "expo-file-system";
import { holeFrame } from "./holeSatellite";
import type { Course } from "../data/courses";
import type { Coord } from "./geo";

const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}sat/` : null;
const keyOf = (courseId: string, holeNumber: number) => `${courseId}-h${holeNumber}`;
const fileFor = (key: string) => `${DIR}${key}.png`;

async function ensureDir(): Promise<boolean> {
  if (!DIR) return false;
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    return true;
  } catch {
    return false;
  }
}

// The local file uri for a hole if it's already cached, else null.
export async function cachedTile(courseId: string, holeNumber: number): Promise<string | null> {
  if (!DIR) return null;
  try {
    const info = await FileSystem.getInfoAsync(fileFor(keyOf(courseId, holeNumber)));
    return info.exists ? info.uri : null;
  } catch {
    return null;
  }
}

// Return a local uri for a hole's image: the cached copy if present, otherwise
// download it and cache it. Returns null when it can't be fetched or stored
// (offline and not yet cached) — the caller then falls back to the remote url.
export async function ensureTile(courseId: string, holeNumber: number, url: string): Promise<string | null> {
  const existing = await cachedTile(courseId, holeNumber);
  if (existing) return existing;
  if (!(await ensureDir())) return null;
  try {
    const res = await FileSystem.downloadAsync(url, fileFor(keyOf(courseId, holeNumber)));
    return res?.uri ?? null;
  } catch {
    return null;
  }
}

export type PrefetchProgress = { done: number; total: number; ok: number };

// Download every hole's satellite image for a course (for offline use on the
// course). Skips holes already cached. Reports progress per hole.
export async function prefetchCourse(course: Course, onProgress?: (p: PrefetchProgress) => void): Promise<PrefetchProgress> {
  const holes = course.holes ?? [];
  const total = holes.length;
  let done = 0, ok = 0;
  for (const hole of holes) {
    const frame = holeFrame(hole, course.center as Coord | undefined);
    if (frame) {
      const uri = await ensureTile(course.id, hole.number, frame.url);
      if (uri) ok++;
    }
    done++;
    onProgress?.({ done, total, ok });
  }
  return { done, total, ok };
}

// How many of a course's holes are already saved offline.
export async function offlineCount(course: Course): Promise<number> {
  let n = 0;
  for (const hole of course.holes ?? []) {
    if (await cachedTile(course.id, hole.number)) n++;
  }
  return n;
}
