// Direct store billing config — Apple StoreKit + Google Play Billing via
// react-native-iap. RevenueCat has been removed; the app talks to the stores
// itself, so there is no third-party subscription service or API key.
//
// Create these subscription products with THE SAME product id in BOTH stores:
//   • Google Play Console → Monetize → Subscriptions
//   • App Store Connect   → Subscriptions
// Attach a 7-DAY FREE TRIAL as an introductory / intro offer on each product —
// the store runs the trial-then-charge; the app simply sees an active
// subscription during the trial.
import { Platform } from "react-native";

// Subscription product ids. Keep them identical across iOS + Android so one SKU
// list works on every platform.
export const SKU_MONTHLY = "foreai_pro_monthly";
export const SKU_ANNUAL = "foreai_pro_annual";
export const SUBSCRIPTION_SKUS = [SKU_MONTHLY, SKU_ANNUAL];

// Real store billing is enabled per build with EXPO_PUBLIC_BILLING="1" (set it
// in the release workflow once the products exist and are approved). Until then
// the app stays in "demo unlock" mode: the paywall works end-to-end for testing
// but nothing is charged — the same safe pre-launch behaviour we had before.
export const BILLING_ENABLED = process.env.EXPO_PUBLIC_BILLING === "1";

// True when real purchases are live for this build/platform. Web never bills.
export const PURCHASES_CONFIGURED = BILLING_ENABLED && Platform.OS !== "web";
