// Compute the satellite frame (Esri export URL) for every Kempton hole, exactly
// as the app's holeFrame() does, and write a manifest. No network — pure geometry.
// The Kempton APK build downloads these URLs and bundles the images for offline.
//
//   npx tsx scripts/gen-kempton-tiles.ts
import * as fs from "fs";
import * as path from "path";
import { getCourse } from "../mobile/src/data/courses";
import { holeFrame } from "../mobile/src/lib/holeSatellite";

const COURSE_ID = "kempton-park";
const course = getCourse(COURSE_ID);
const tiles = course.holes.map((h) => {
  const f = holeFrame(h, course.center);
  return { hole: h.number, url: f?.url ?? null, bbox: f?.bbox ?? null };
});

const missing = tiles.filter((t) => !t.url);
const out = { courseId: COURSE_ID, generatedAt: new Date().toISOString(), tiles };
const dest = path.join(__dirname, "kempton-tiles.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`wrote ${tiles.length} frames to ${dest}; missing=${missing.length}`);
if (missing.length) console.log("holes without a frame:", missing.map((m) => m.hole).join(", "));
