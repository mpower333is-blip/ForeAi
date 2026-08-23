// ForeAi — one app for iOS and Android, built from this one codebase.
export default {
  expo: {
    name: "ForeAi",
    slug: "foreai",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "foreai",
    userInterfaceStyle: "dark",
    icon: "./assets/icon.png",
    platforms: ["ios", "android", "web"],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#06170F",
    },
    ios: {
      // iPhone-first: avoids Apple's separate 13" iPad screenshot requirement.
      // (An iPhone app still runs on iPad in compatibility mode.)
      supportsTablet: false,
      bundleIdentifier: "com.foreai.mobile",
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
      package: "com.foreai.mobile",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#06170F",
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
