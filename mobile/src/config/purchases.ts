// RevenueCat configuration for real subscriptions (Apple App Store + Google Play).
//
// You create the products in App Store Connect and Google Play Console, connect
// them in RevenueCat, and paste RevenueCat's PUBLIC SDK keys here (or, better,
// set them as build-time env vars so they're not committed):
//   EXPO_PUBLIC_RC_IOS_KEY      = appl_XXXXXXXX   (RevenueCat → iOS app → API key)
//   EXPO_PUBLIC_RC_ANDROID_KEY  = goog_XXXXXXXX   (RevenueCat → Android app → API key)
//
// Until a key is set for the running platform, the app stays in "demo unlock"
// mode: the paywall still works end-to-end for testing but nothing is charged.
// The moment a key is present, the Unlock buttons make real store purchases.
import { Platform } from "react-native";

// The entitlement that means "Pro" in RevenueCat (create it as `pro` and attach
// both the monthly and annual products to it).
export const RC_ENTITLEMENT = "pro";

// Optional: pin a specific offering by identifier. Empty = RevenueCat's current.
export const RC_OFFERING = "";

const IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? "";

// The public SDK key for the platform this build is running on.
export const RC_API_KEY: string =
  Platform.select({ ios: IOS_KEY, android: ANDROID_KEY, default: "" }) ?? "";

// True once a key exists for this platform — real purchases are live.
export const PURCHASES_CONFIGURED = RC_API_KEY.length > 0;
