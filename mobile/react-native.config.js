// React Native community-module autolinking config.
//
// Exclude react-native-iap from NATIVE autolinking on both platforms. It bundles
// Play Billing Library 7, but Google now requires 8.0.0+ for new releases, and
// billing-8 support only exists in react-native-iap's new-architecture v15/16
// (too large a change on RN 0.79). Billing is dormant everywhere right now —
// Kempton has no paywall and the full app's billing is off until
// EXPO_PUBLIC_BILLING=1 — so shipping the native billing SDK only gets the build
// rejected by Play. The JS package stays installed so Metro still resolves the
// lazy require in services/purchases.ts (which fails soft when the native module
// is absent). Re-enable with a billing-8-capable path when paid subscriptions go
// live. NOTE: expo.autolinking.exclude only covers Expo modules; a React Native
// community module like this one is excluded here instead.
module.exports = {
  dependencies: {
    "react-native-iap": {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
