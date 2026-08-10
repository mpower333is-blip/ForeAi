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
    },
    android: {
      package: "com.foreai.mobile",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#071b13",
      },
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    extra: {
      // EXPO_PUBLIC_API_URL is read directly in services/api.ts; set it in a
      // .env or your EAS build profile to point the app at a deployed backend.
    },
  },
};
