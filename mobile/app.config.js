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
        NSMicrophoneUsageDescription:
          "ForeAi listens for the sound of your ball strike to log shots automatically.",
        NSLocationWhenInUseUsageDescription:
          "ForeAi uses your location to show distances to the pin while you play.",
        // The app only uses standard HTTPS encryption — declare it exempt so
        // App Store Connect never asks the export-compliance question per build.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.foreai.mobile",
      // Play requires a higher versionCode on every upload. In CI we set
      // ANDROID_VERSION_CODE to the Codemagic build number; locally it's 1.
      versionCode: process.env.ANDROID_VERSION_CODE
        ? Number(process.env.ANDROID_VERSION_CODE)
        : 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#06170F",
      },
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
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
      [
        "expo-av",
        {
          microphonePermission:
            "ForeAi listens for the sound of your ball strike to log shots automatically.",
        },
      ],
      // Strip the aps-environment entitlement expo-notifications injects — we
      // only use LOCAL notifications, so requiring the Push Notifications
      // capability on the App Store profile just breaks signing. Expo composes
      // entitlement mods LIFO (last-listed runs first), so this must be listed
      // BEFORE expo-notifications for its strip to run LAST and win.
      "./plugins/withoutPushEntitlement",
      // Local notifications for the lightning safety alarm (no push server).
      "expo-notifications",
      [
        // Google Play requires apps to target Android 16 (API 36) from Aug 2026.
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
          },
        },
      ],
    ],
    // Static web exports hosted under a sub-path (GitHub Pages serves the app
    // at /ForeAi/) need every asset URL prefixed with that path. Unset locally,
    // so `expo start` and the native builds are unaffected.
    ...(process.env.EXPO_PUBLIC_WEB_BASE_URL
      ? { experiments: { baseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL } }
      : {}),
    extra: {
      // EXPO_PUBLIC_API_URL is read directly in services/api.ts; set it in a
      // .env or your EAS build profile to point the app at a deployed backend.
    },
  },
};
