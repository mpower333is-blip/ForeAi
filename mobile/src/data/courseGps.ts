// Per-hole GPS captured on-course (or from satellite), keyed by course id.
//
// Each entry is a hole's key points: the tee box, and the front / middle / back
// of the green. These drive the live Front/Middle/Back rangefinder distances and
// the satellite hole view. Partial holes are fine — whatever is present is used,
// and anything missing simply isn't shown until it's captured.
//
// Order matches the course's holes (index 0 = hole 1). Coordinates are decimal
// degrees (lat, lng).

import { Coord } from "../lib/geo";

export type HoleGps = {
  tee?: Coord;        // white/men's tee box
  greenFront?: Coord; // front edge of the green
  green?: Coord;      // centre of the green ("middle")
  greenBack?: Coord;  // back edge of the green
  hazards?: { type: "tree" | "water" | "bunker"; lat: number; lng: number }[];
};

export const COURSE_GPS: Record<string, HoleGps[]> = {
  // Kempton Park Golf Club — the ECS event venue. Captured on-course.
  "kempton-park": [
    // H1
    { tee: { lat: -26.106729210093444, lng: 28.212617524491545 } },
  ],
};
