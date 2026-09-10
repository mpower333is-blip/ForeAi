// ForeAi ships as ONE codebase with a few flavours, each selected at build time
// by an EXPO_PUBLIC_* env var and given its own package id + name so they install
// side-by-side:
//
//  • (default)                    → "ForeAi", the full multi-course app.
//  • EXPO_PUBLIC_SURVEY_ONLY=1    → "ForeAi Survey", the course-mapping tool.
//  • EXPO_PUBLIC_CLUB=kempton     → "Kempton Park Golf", a single-club app that
//                                   boots into the club home and is locked to the
//                                   club's own (fully surveyed) course.
//
// A club flavour is the whole ForeAi app, fully unlocked (no paywall), branded
// for one club and pinned to one course — a ready-made app a club can hand to its
// members. Branding here is a PLACEHOLDER green/white theme + text mark; drop in
// the real logo/colours later without touching the rest of the app.

export const CLUB = process.env.EXPO_PUBLIC_CLUB || "";
export const IS_CLUB_APP = CLUB !== "";

// Per-club config. Add a club by adding an entry keyed by its EXPO_PUBLIC_CLUB
// value; everything else (course data, GPS, watch) is already shared.
export type ClubConfig = {
  appName: string; // app + store name
  courseId: string; // the course this app is locked to (must exist in courses.ts)
  shortName: string; // shown on the club home hero
  tagline: string;
  // Placeholder club content — safe defaults the club can correct later.
  about: string;
  event: { title: string; blurb: string };
  contact: { phone?: string; email?: string; web?: string; address?: string };
  sponsors: string[]; // names only for now; logos can come later
};

const CLUBS: Record<string, ClubConfig> = {
  kempton: {
    appName: "Kempton Park Golf",
    courseId: "kempton-park",
    shortName: "Kempton Park Golf Club",
    tagline: "Your course, in your pocket.",
    about:
      "The official app for Kempton Park Golf Club — GPS rangefinder, hole-by-hole maps and a live scorecard for all 18 holes.",
    event: {
      title: "ECS Golf Day",
      blurb: "The club's fundraiser day. Join the event in-app on the day to score live with your fourball.",
    },
    contact: {
      phone: "",
      email: "",
      web: "",
      address: "Kempton Park, Gauteng",
    },
    sponsors: ["Your sponsor here", "Your sponsor here", "Your sponsor here"],
  },
};

export const CLUB_CONFIG: ClubConfig | null = IS_CLUB_APP ? CLUBS[CLUB] ?? null : null;

// App display name: club flavour → club name; survey flavour handled separately
// in app.config.js; otherwise the default.
export const APP_NAME = CLUB_CONFIG?.appName ?? "ForeAi";

// The course a club app is pinned to (null for the normal multi-course app).
export const CLUB_COURSE_ID: string | null = CLUB_CONFIG?.courseId ?? null;
