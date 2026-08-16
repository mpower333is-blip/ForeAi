// Which build this is:
//   "full"  — the complete ForeAi showcase app (all features)
//   "event" — the "ECS Golf Day" app: golf-day only (Events + live scoring up
//             front; Swing Coach & AI Caddie as demos; the rest hidden)
//
// Selected at build time via EXPO_PUBLIC_APP_VARIANT (inlined into the bundle),
// and read by app.config.js to set the app name / icon / package id.

export type AppVariant = "full" | "event";

export const APP_VARIANT: AppVariant =
  process.env.EXPO_PUBLIC_APP_VARIANT === "event" ? "event" : "full";

export const IS_EVENT = APP_VARIANT === "event";

// Display name for this build (splash, onboarding).
export const APP_NAME = IS_EVENT ? "ECS Golf Day" : "ForeAi";

// Optional: pre-fill an event join code in the event app (set once you've
// created the ECS Golf Day and have its code).
export const PRESET_EVENT_CODE = (process.env.EXPO_PUBLIC_EVENT_CODE ?? "").toUpperCase();
