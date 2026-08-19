// Two build variants from one codebase (EXPO_PUBLIC_APP_VARIANT):
//   default  → "ForeAi"        (full showcase app)
//   "event"  → "ECS Golf Day"  (golf-day-only app, its own icon + package id)
// Different ids so both can be installed side by side.
const isEvent = process.env.EXPO_PUBLIC_APP_VARIANT === "event";

export default {
  expo: {
    name: isEvent ? "ECS Golf Day" : "ForeAi",
    slug: isEvent ? "ecs-golf-day" : "foreai",
    version: "1.0.0",
    orientation: "portrait",
    scheme: isEvent ? "ecsgolfday" : "foreai",
    userInterfaceStyle: "dark",
    icon: isEvent ? "./assets/icon-event.png" : "./assets/icon.png",
    platforms: ["ios", "android", "web"],
    splash: {
      image: isEvent ? "./assets/splash-icon-event.png" : "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: isEvent ? "#0A1B3A" : "#06170F",
    },
    ios: {
      // iPhone-first: avoids Apple's separate 13" iPad screenshot requirement.
      // (An iPhone app still runs on iPad in compatibility mode.)
      supportsTablet: false,
      bundleIdentifier: isEvent ? "com.foreai.event" : "com.foreai.mobile",
      infoPlist: {
        NSCameraUsageDescription:
          "ForeAi uses the camera to frame your swing and give you posture feedback.",
        NSMotionUsageDescription:
          "ForeAi uses motion sensors to detect your swing and measure its tempo.",
        NSLocationWhenInUseUsageDescription:
          "ForeAi uses your location to show distances to the pin while you play.",
        // The app only uses standard HTTPS encryption — declare it exempt so
        // App Store Connect never asks the export-compliance question per build.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: isEvent ? "com.foreai.event" : "com.foreai.mobile",
      adaptiveIcon: {
        foregroundImage: isEvent ? "./assets/adaptive-icon-event.png" : "./assets/adaptive-icon.png",
        backgroundColor: isEvent ? "#0A1B3A" : "#06170F",
      },
      permissions: [
        "CAMERA",
        "HIGH_SAMPLING_RATE_SENSORS",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
      ],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission:
            "ForeAi uses the camera to frame your swing and give you posture feedback.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "ForeAi uses your location to show distances to the pin while you play.",
        },
      ],
      // Compile the fmt pod as C++17 so it builds under Xcode 26 (required by
      // Apple for App Store / TestFlight uploads). See plugins/withFmtCpp17.js.
      "./plugins/withFmtCpp17",
    ],
    extra: {
      // EXPO_PUBLIC_API_URL is read directly in services/api.ts; set it in a
      // .env or your EAS build profile to point the app at a deployed backend.
    },
  },
};
