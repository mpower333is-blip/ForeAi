// Metro config — the one reason this file exists: disable package-exports
// resolution so the Firebase JS SDK resolves correctly on React Native.
//
// Expo SDK 53+ / Metro 0.80+ turn `unstable_enablePackageExports` ON by default.
// firebase 10.x's TOP-LEVEL `exports` map (e.g. "./auth") has only
// types/node/browser/default conditions — NO `react-native` — so under package
// exports Metro resolves `firebase/auth` to its BROWSER build, which does not
// contain `getReactNativePersistence`. services/firebase.ts then calls
// `getReactNativePersistence(AsyncStorage)` where it's `undefined`, throwing a
// TypeError at launch on BOTH platforms whenever EXPO_PUBLIC_USE_FIRESTORE=1
// (i.e. every production build) — an uncaught fatal ~150 ms in, before any UI.
// It also triggers the "Component auth/firestore has not been registered yet"
// dual-package error, because firebase/app, /auth and /firestore each self-bundle
// their own copy of the component container.
//
// Disabling package exports falls back to main-field resolution: firebase/auth's
// CJS entry requires @firebase/auth, which DOES expose a `react-native` field
// pointing at dist/rn/index.js (the build that has getReactNativePersistence and
// shares one component container). This is the behaviour the app shipped with
// before the SDK upgrade, and the Expo/Firebase-recommended workaround.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
