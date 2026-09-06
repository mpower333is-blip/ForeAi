// ForeAi uses expo-notifications for LOCAL notifications (lightning alarm +
// golf-day reminders scheduled on-device). Local notifications do NOT need the
// iOS `aps-environment` entitlement, but expo-notifications' iOS mod injects it
// unconditionally — which makes Xcode demand the Push Notifications capability
// on the signing profile and breaks the archive:
//   "Provisioning profile ... doesn't include the aps-environment entitlement".
//
// So by default we STRIP the push entitlement, letting the app sign against the
// plain App Store profile with no Apple-portal work.
//
// REMOTE push (the server-side lightning watcher pushing alerts when the app is
// closed) DOES require aps-environment on iOS. When you're ready to enable iOS
// push, set EXPO_PUBLIC_ENABLE_IOS_PUSH=1 for the build AND, in the Apple
// Developer portal, add the Push Notifications capability to com.foreai.mobile
// and regenerate the App Store provisioning profile (and upload an APNs key to
// your Expo project). With the flag set this plugin leaves the entitlement in
// place. Android push is unaffected either way.
const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  if (process.env.EXPO_PUBLIC_ENABLE_IOS_PUSH === "1") {
    return config; // keep aps-environment so remote push works on iOS
  }
  return withEntitlementsPlist(config, (cfg) => {
    if (cfg.modResults && "aps-environment" in cfg.modResults) {
      delete cfg.modResults["aps-environment"];
    }
    return cfg;
  });
};
