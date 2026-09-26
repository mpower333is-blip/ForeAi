// Central place for store links, pricing and what the free vs. paid tiers get.
// Update the URLs here once the app is live in each store and the landing page
// is published — everything in the app reads from this file.

import { Platform } from "react-native";
import { CLUB } from "./appVariant";

// This flavour's install package. The watch ships INSIDE the phone app's package
// (Wear OS same-package model), so the Play listing that offers "Install on watch"
// is the phone app's OWN listing. Kempton -> com.foreai.kempton, else the default
// ForeAi package. (com.foreai.wear is only the watch's code namespace — NOT a
// published app, so linking to it gave "Item not found".)
const APP_PACKAGE = CLUB ? `com.foreai.${CLUB}` : "com.foreai.mobile";

// In-app purchases / subscriptions. Currently OFF on iOS: the iOS build ships
// fully unlocked with NO paywall, so there's nothing for App Review to reject
// under Guideline 3.1.2 (and no half-configured purchase to trip 2.1). Android
// keeps the subscription. Flip this back on for iOS once the IAP products are
// created and approved in App Store Connect and EXPO_PUBLIC_BILLING=1 is in the
// build. When false, everything is unlocked and every purchase/upgrade CTA is
// hidden.
export const IAP_ENABLED = Platform.OS !== "ios";

// TODO: replace with the real listings once published.
export const APP_STORE_URL = "https://apps.apple.com/app/foreai/id0000000000";
export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
// A single shareable link that sends people to the right store + event sign-up.
// This is the hosted landing page (clubhouse/get.html) on the ForeAi domain.
export const LANDING_URL = "https://foreai.co.za/get.html";

// The Wear OS companion ships under the SAME package as the phone app, so its
// Play listing IS the phone app's listing (which shows "Install on watch" once the
// Wear build is published). Use this flavour's package — never com.foreai.wear.
export const WEAR_PACKAGE = APP_PACKAGE;
export const WEAR_PLAY_URL =
  `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
// Direct APK download for sideloading before the watch app is on the Play Store.
// Host the built wear APK here (e.g. on the ForeAi domain) and update this URL.
export const WEAR_APK_URL = "https://foreai.co.za/foreai-watch.apk";

// The full package (unlocks everything beyond the free demo).
export const PACKAGE_NAME = "ForeAi Pro";
// Demo-only fallback price (shown when store billing isn't configured). The real
// paywall uses live store prices from Google Play / App Store — set those on the
// subscription products (foreai_pro_monthly / foreai_pro_annual): e.g.
// Monthly R99 · Annual R799, each with a 7-day free trial.
export const PACKAGE_PRICE = "R99/mo";

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
