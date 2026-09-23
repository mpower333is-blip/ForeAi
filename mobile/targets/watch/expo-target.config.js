// @bacons/apple-targets config — adds a native watchOS app target to the Expo-
// generated Xcode project on every `expo prebuild`, so we stay in the managed
// workflow (no committed ios/ folder). The Swift sources in this folder are
// compiled into the target.
//
// This runs ONLY when the plugin is enabled (EXPO_PUBLIC_WATCH=1 in the build —
// see mobile/app.config.js), so normal phone builds are completely unaffected.
//
// NOTE: watch-target tooling is the finicky part (per docs/apple-watch-plan.md).
// The generated bundle id is expected to be <app>.<dir> = com.foreai.mobile.watch
// — set WATCH_BUNDLE_ID to match for Codemagic signing, and verify on the first
// build.
/** @type {import("@bacons/apple-targets/app.plugin").Config} */
module.exports = {
  type: "watch",
  name: "ForeAi",
  deploymentTarget: "9.0",
  // watchOS app icon — required, or App Store upload fails with ITMS-90391
  // ("Missing Icons … CFBundleIconFiles"). apple-targets generates the watch
  // AppIcon asset catalog from this 1024×1024 source (path is relative to the
  // Expo project root, mobile/). Reuses the main app icon.
  icon: "./assets/icon.png",
  frameworks: ["CoreLocation"],
  infoPlist: {
    NSLocationWhenInUseUsageDescription:
      "ForeAi uses your location to show distances to the pin while you play.",
  },
};
