// Native in-app subscriptions via expo-iap — Apple App Store + Google
// Play only, no third-party billing service. Apple/Google are the sole
// middlemen, so nothing is taken beyond the stores' standard commission (enrol
// in Apple's Small Business Program → 15%; Google is 15% on subscriptions).
//
// Create two AUTO-RENEWING subscription products with THESE exact ids in App
// Store Connect and Google Play Console, each with a 7-day free trial:
export const PRODUCT_MONTHLY = "foreai_pro_monthly";
export const PRODUCT_ANNUAL = "foreai_pro_annual";
export const SUBSCRIPTION_SKUS = [PRODUCT_MONTHLY, PRODUCT_ANNUAL];

// Billing is a build-time switch. Until EXPO_PUBLIC_IAP_LIVE=1 the app stays in
// "demo unlock" mode — the paywall works end-to-end for testing, but nothing is
// charged and the native billing module is never touched. Set it in the store
// build once the products exist and you're ready to test real purchases in
// sandbox, then keep it on for production.
export const PURCHASES_CONFIGURED = process.env.EXPO_PUBLIC_IAP_LIVE === "1";
