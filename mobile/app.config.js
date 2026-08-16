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
      supportsTablet: true,
      bundleIdentifier: isEvent ? "com.foreai.event" : "com.foreai.mobile",
      infoPlist: {
        NSCameraUsageDescription:
          "ForeAi uses the camera to frame your swing and give you posture feedback.",
        NSMotionUsageDescription:
          "ForeAi uses motion sensors to detect your swing and measure its tempo.",
        NSLocationWhenInUseUsageDescription:
          "ForeAi uses your location to show distances to the pin while you play.",
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
    ],
    extra: {
      // EXPO_PUBLIC_API_URL is read directly in services/api.ts; set it in a
      // .env or your EAS build profile to point the app at a deployed backend.
    },
  },
};
