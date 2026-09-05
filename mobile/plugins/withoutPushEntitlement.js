// ForeAi uses expo-notifications for LOCAL notifications only — the lightning
// safety alarm and golf-day reminders are scheduled on-device, and the app
// never registers for or receives a remote push. expo-notifications' iOS mod
// (withNotificationsIOS) unconditionally injects the `aps-environment`
// entitlement, which makes Xcode demand the Push Notifications capability on
// the signing provisioning profile. Our standard App Store profile does not
// carry that capability (and we don't want to add it — remote push would then
// need justification at App Review), so the archive step fails with:
//   "Provisioning profile ... doesn't include the aps-environment entitlement".
//
// This plugin runs after expo-notifications and removes the push entitlement,
// so the app signs cleanly against the plain App Store profile. Local
// notifications keep working — they don't require aps-environment.
const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    if (cfg.modResults && "aps-environment" in cfg.modResults) {
      delete cfg.modResults["aps-environment"];
    }
    return cfg;
  });
};
