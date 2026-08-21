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

// Join code the event app auto-joins on first launch, so a player never has to
// type it. Overridable at build time with EXPO_PUBLIC_EVENT_CODE; otherwise the
// event build falls back to the ECS Golf Day code. (The full app has no preset.)
const DEFAULT_EVENT_CODE = IS_EVENT ? "3YG6JS" : "";
export const PRESET_EVENT_CODE = (
  process.env.EXPO_PUBLIC_EVENT_CODE || DEFAULT_EVENT_CODE
).toUpperCase();
