// Declare hardware features as NOT required so Google Play does not filter the
// app off devices based on features IMPLIED by our permissions.
//
// With no <uses-feature> entries, Android/Play treat several features as
// required=true by implication:
//   CAMERA          -> android.hardware.camera + android.hardware.camera.autofocus
//   RECORD_AUDIO    -> android.hardware.microphone
//   ACCESS_FINE_LOCATION -> android.hardware.location.gps
// A device missing (or not reporting) any implied-required feature is shown
// "device not compatible" on the Play Store and can't install — which is how a
// large-screen / foldable device (e.g. Samsung Galaxy Z Fold) can get excluded.
//
// ForeAi treats camera, microphone, sensors and GPS as OPTIONAL — the app
// installs and runs without any of them (those features simply degrade) — so none
// of them should gate installability. This marks them all required=false, which
// can only widen device compatibility, never narrow it.
const { withAndroidManifest } = require("@expo/config-plugins");

const OPTIONAL_FEATURES = [
  "android.hardware.camera",
  "android.hardware.camera.autofocus",
  "android.hardware.camera.front",
  "android.hardware.camera.any",
  "android.hardware.microphone",
  "android.hardware.location",
  "android.hardware.location.gps",
  "android.hardware.location.network",
  "android.hardware.sensor.accelerometer",
  "android.hardware.sensor.gyroscope",
];

module.exports = function withAndroidOptionalFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest["uses-feature"] = manifest["uses-feature"] || [];
    const list = manifest["uses-feature"];
    for (const name of OPTIONAL_FEATURES) {
      const existing = list.find((f) => f && f.$ && f.$["android:name"] === name);
      if (existing) {
        existing.$["android:required"] = "false";
      } else {
        list.push({ $: { "android:name": name, "android:required": "false" } });
      }
    }

    // Large-screen / foldable layout: declare the app resizable so it fills the
    // display (and works in split-screen) when a Z Fold is unfolded, instead of
    // being pillar-boxed. Paired with orientation: "default" in app.config, the
    // app stops hard-locking portrait on Android. (iOS stays portrait via
    // ios.infoPlist.) resizeableActivity defaults true on modern targetSdk, but
    // we set it explicitly so Play's large-screen check sees it.
    const application = manifest.application && manifest.application[0];
    if (application) {
      application.$ = application.$ || {};
      application.$["android:resizeableActivity"] = "true";
    }

    return cfg;
  });
};
