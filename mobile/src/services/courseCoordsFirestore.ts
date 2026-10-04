// Live course-survey sync. Surveyed tee/green coordinates are shared through a
// single Firestore doc per course (courseCoords/{courseId}), so a pin captured
// or corrected on one device shows up for everyone within seconds — no rebuild,
// no app release. Publicly readable; only organisers/owners may write (see
// firestore.rules), so authoritative course data isn't open to every device.
//
// Only loaded when the app is built with EXPO_PUBLIC_USE_FIRESTORE=1 (the
// CourseCoordsContext require()s it behind that flag), so the firebase SDK is
// not pulled into non-Firestore builds.

import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { firestore, ensureSignedIn } from "./firebase";
import type { Coord } from "../lib/geo";
import type { CoursePoints, HolePoints, HolePointKey } from "../state/CourseCoordsContext";

type RemoteHole = Partial<Record<HolePointKey, { lat: number; lng: number }>>;
type RemoteDoc = { holes?: Record<string, RemoteHole>; updatedAt?: number };

// Firestore doc shape -> the in-app CoursePoints (hole number -> points).
function toCoursePoints(data: RemoteDoc | undefined): CoursePoints {
  const out: CoursePoints = {};
  const holes = data?.holes ?? {};
  for (const [h, pts] of Object.entries(holes)) {
    const hole = Number(h);
    if (!Number.isFinite(hole)) continue;
    const hp: HolePoints = {};
    for (const [k, c] of Object.entries(pts || {})) {
      if (c && typeof c.lat === "number" && typeof c.lng === "number") {
        (hp as Record<string, Coord>)[k] = { lat: c.lat, lng: c.lng };
      }
    }
    out[hole] = hp;
  }
  return out;
}

// Publish one captured point. Fail-soft: if the device isn't an organiser (write
// denied) or is offline, the capture still lives locally — it just isn't shared.
export async function publishCoursePoint(
  courseId: string,
  hole: number,
  key: HolePointKey,
  coord: Coord,
): Promise<void> {
  try {
    await ensureSignedIn();
    const ref = doc(firestore(), "courseCoords", courseId);
    await setDoc(
      ref,
      { holes: { [hole]: { [key]: { lat: coord.lat, lng: coord.lng } } }, updatedAt: Date.now() },
      { merge: true },
    );
  } catch {
    /* denied / offline — local capture still works */
  }
}

// Live subscription to every course's shared coordinates. Calls back with the
// full map whenever anything changes. Returns an unsubscribe fn.
export function subscribeCourseCoords(
  cb: (all: Record<string, CoursePoints>) => void,
): () => void {
  try {
    const col = collection(firestore(), "courseCoords");
    return onSnapshot(
      col,
      (snap) => {
        const out: Record<string, CoursePoints> = {};
        snap.forEach((d) => {
          out[d.id] = toCoursePoints(d.data() as RemoteDoc);
        });
        cb(out);
      },
      () => {
        /* permission / network error — keep whatever we have */
      },
    );
  } catch {
    return () => {};
  }
}
