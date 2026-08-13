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
      backgroundColor: "#071b13",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.foreai.mobile",
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
      package: "com.foreai.mobile",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#071b13",
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
