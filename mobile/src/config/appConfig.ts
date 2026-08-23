// Central place for store links, pricing and what the free vs. paid tiers get.
// Update the URLs here once the app is live in each store and the landing page
// is published — everything in the app reads from this file.

// TODO: replace with the real listings once published.
export const APP_STORE_URL = "https://apps.apple.com/app/foreai/id0000000000";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.foreai.mobile";
// A single shareable link that sends people to the right store + event sign-up.
// This is the hosted landing page (clubhouse/get.html) on the ForeAi domain.
export const LANDING_URL = "https://foreai.co.za/get.html";

// The Wear OS companion app (see ../../wear). Package id from wear/app build.
export const WEAR_PACKAGE = "com.foreai.wear";
export const WEAR_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.foreai.wear";
// Direct APK download for sideloading before the watch app is on the Play Store.
// Host the built wear APK here (e.g. on the ForeAi domain) and update this URL.
export const WEAR_APK_URL = "https://foreai.co.za/foreai-watch.apk";

// The full package (unlocks everything beyond the free demo).
export const PACKAGE_NAME = "ForeAi Pro";
export const PACKAGE_PRICE = "R199"; // once-off — adjust to your pricing

// What each tier includes (shown on the paywall).
export const FREE_FEATURES = [
  "AI Caddie — demo club calls",
  "Swing Coach — demo swing analysis",
  "Full access to Golf Days & Tournaments",
  "Join events and score live on the day",
];

export const PRO_FEATURES = [
  "Live round tracking & scorecard",
  "AI Caddie that learns your real distances",
  "Unlimited Swing Coach analysis & history",
  "GPS rangefinder — front / middle / back",
  "Strokes-gained stats & trends",
  "Course strategy planner",
  "Range games & practice challenges",
];

// Which features are free in the demo build. Everything else is Pro-gated.
export type FeatureKey =
  | "caddie"
  | "coach"
  | "events"
  | "round"
  | "stats"
  | "strategy"
  | "games";

export const FREE_FEATURE_KEYS: FeatureKey[] = ["caddie", "coach", "events"];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  caddie: "AI Caddie",
  coach: "Swing Coach",
  events: "Golf Days & Tournaments",
  round: "Live Round Tracking",
  stats: "Strokes-Gained Stats",
  strategy: "Course Strategy",
  games: "Range Games",
};
